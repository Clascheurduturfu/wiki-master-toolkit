const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const model = require('../sync-model.js');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const PRICE = { fetchedAt: 1000, ok: true, averages: { R: 35, C: 0 } };
const pulls = (id, n) => ({ epoch: { time: 0, id: 'initial' }, sources: { [id]: model.counts({ R: n }) } });
const doc = (id, n = 0, prices = {}) => model.document(id, prices, pulls(id, n));

function page(storage = new Map(), navigator = {}) {
  const listeners = new Map(), handles = new Map();
  const document = { getElementById: () => null, addEventListener() {}, hidden: false };
  const window = {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); }
  };
  const localStorage = {
    get length() { return storage.size; }, key: index => [...storage.keys()][index],
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
  };
  // Fake IDB keeps the real directory adapter so restore/permission paths can be tested.
  const indexedDB = { open() {
    const request = {};
    const db = { createObjectStore() {}, close() {}, transaction() {
      const transaction = { objectStore: () => ({ get: key => ({ result: handles.get(key) }),
        put: (value, key) => { handles.set(key, value); return { result: key }; } }) };
      queueMicrotask(() => transaction.oncomplete()); return transaction;
    } };
    queueMicrotask(() => { request.result = db; request.onsuccess(); }); return request;
  } };
  const context = vm.createContext({ window, document, localStorage, indexedDB, crypto, Date,
    navigator, console, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } } });
  for (const file of ['sync-model.js', 'features/core.js', 'features/file-sync.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  const core = window.__wmAverageFeatures.core.create();
  const sync = window.__wmAverageFeatures.fileSync.create({ core, pullStats: { renderPullStats() {} } });
  return { sync, core, window, storage, stats: () => JSON.parse(storage.get('wm_pull_stats_v1')).counts };
}

function folder() {
  const files = new Map(); let permission = 'granted', writes = 0;
  const handle = name => ({ kind: 'file', name,
    getFile: async () => ({ size: (files.get(name) || '').length, text: async () => files.get(name) || '' }),
    createWritable: async () => { let staged; return {
      write: async value => { staged = value; }, close: async () => { files.set(name, staged); writes++; }, abort: async () => {}
    }; }
  });
  return { files, get writes() { return writes; }, queryPermission: async () => permission,
    requestPermission: async () => { permission = 'granted'; return permission; },
    deny: () => { permission = 'prompt'; },
    async *values() { for (const name of files.keys()) yield handle(name); },
    getFileHandle: async (name, options) => {
      if (!files.has(name)) { if (!options?.create) throw Error('Missing'); files.set(name, ''); }
      return handle(name);
    }
  };
}

test('price merging keeps newest successes, zero and missing prices, and ignores errors', () => {
  const old = { [A]: PRICE };
  const newer = { [A]: { fetchedAt: 2000, ok: true, averages: { R: 40 } }, [B]: { fetchedAt: 3000, ok: false, averages: {} } };
  assert.equal(model.mergePrices(old, newer)[A].averages.R, 40);
  assert.equal(model.mergePrices(newer, old)[A].averages.R, 40);
  assert.equal(model.mergePrices(old)[A].averages.C, 0);
  assert.equal(model.mergePrices(newer)[B], undefined);
});

test('pull history merge is commutative and idempotent instead of adding an imported total again', () => {
  const first = pulls(A, 10), second = pulls(B, 7);
  const merged = model.mergePulls(first, second, first, second);
  assert.equal(model.totals(merged).R, 17);
  assert.deepEqual(merged, model.mergePulls(second, first));
  assert.equal(model.totals(model.mergePulls(merged, merged)).R, 17);
});

test('a synced reset cannot resurrect old historical counters', () => {
  const reset = { epoch: { time: 1000, id: A }, sources: { [B]: model.counts({ R: 2 }) } };
  const result = model.mergePulls(pulls(A, 100), reset, pulls(B, 300));
  assert.equal(model.totals(result).R, 2);
});

test('initial migration preserves current browser stats/prices and records a recoverable stats backup', () => {
  const stats = { counts: { R: 123, L: 4, C: 300 }, updatedAt: 900 };
  const storage = new Map([['wm_pull_stats_v1', JSON.stringify(stats)], ['wm_avg_v3_' + A, JSON.stringify(PRICE)]]);
  const p = page(storage), exported = p.sync.exportDocument();
  assert.equal(p.stats().R, 123); assert.equal(p.stats().L, 4); assert.equal(p.stats().C, 300);
  assert.deepEqual(JSON.parse(storage.get('wm_file_sync_original_stats_v1')), stats);
  assert.equal(exported.prices[A].averages.R, 35);
  const second = page(storage);
  assert.equal(model.totals(second.sync.exportDocument().pulls).R, 123);
});

test('older-version pull increments are absorbed once when the updated extension starts again', () => {
  const p = page(new Map([['wm_pull_stats_v1', JSON.stringify({ counts: { R: 10 } })]]));
  p.storage.set('wm_pull_stats_v1', JSON.stringify({ counts: { ...p.stats(), R: 13 } }));
  const second = page(p.storage), third = page(p.storage);
  assert.equal(model.totals(second.sync.exportDocument().pulls).R, 13);
  assert.equal(model.totals(third.sync.exportDocument().pulls).R, 13);
});

test('importing on a fresh computer, recording new pulls, and syncing back never doubles old totals', async () => {
  const first = page(new Map([['wm_pull_stats_v1', JSON.stringify({ counts: { R: 10 } })]]));
  const second = page();
  await second.sync.importDocuments([first.sync.exportDocument()]);
  await second.sync.recordPulls([{ rarity: 'R' }, { rarity: 'L' }]);
  await first.sync.importDocuments([second.sync.exportDocument(), second.sync.exportDocument()]);
  assert.equal(first.stats().R, 11); assert.equal(first.stats().L, 1);
  const reloaded = page(second.storage);
  assert.equal(reloaded.stats().R, 11);
  await reloaded.sync.importDocuments([first.sync.exportDocument()]);
  assert.equal(reloaded.stats().R, 11);
});

test('local folder sync uses distinct files and preserves concurrent updates from both computers', async () => {
  const shared = folder();
  const a = page(new Map([['wm_pull_stats_v1', JSON.stringify({ counts: { R: 10 } })], ['wm_avg_v3_' + A, JSON.stringify(PRICE)]]));
  const b = page(); a.window.showDirectoryPicker = b.window.showDirectoryPicker = async () => shared;
  await a.sync.connect(); await b.sync.connect();
  assert.equal(b.stats().R, 10);
  await Promise.all([a.sync.recordPulls([{ rarity: 'R' }]), b.sync.recordPulls([{ rarity: 'R' }, { rarity: 'R' }])]);
  b.core.writeLocalValue('wm_avg_v3_' + B, { ...PRICE, fetchedAt: 2000 });
  await a.sync.syncNow(); await b.sync.syncNow(); await a.sync.syncNow(); await b.sync.syncNow();
  assert.equal(a.stats().R, 13); assert.equal(b.stats().R, 13);
  assert.equal(shared.files.size, 2);
  assert.equal(a.sync.exportDocument().prices[B].averages.R, 35);
  const writes = shared.writes;
  await a.sync.syncNow(); await a.sync.syncNow();
  assert.equal(shared.writes, writes, 'Unchanged data should not churn the Drive files.');
});

test('malformed imports are rejected before touching current browser data', async () => {
  const p = page(new Map([['wm_pull_stats_v1', JSON.stringify({ counts: { R: 15 } })]]));
  await assert.rejects(p.sync.importDocuments([doc(A, 30), { format: 'unknown' }]));
  assert.equal(p.stats().R, 15);
});

test('a deleted or rolled-back file is repaired from the browser cache without losing history', async () => {
  const shared = folder(), p = page(new Map([['wm_pull_stats_v1', JSON.stringify({ counts: { R: 15 } })]]));
  p.window.showDirectoryPicker = async () => shared; await p.sync.connect();
  const name = `wm-sync-${p.sync.exportDocument().writer}.json`;
  const original = shared.files.get(name);
  shared.files.delete(name); await p.sync.syncNow();
  assert.equal(shared.files.get(name), original);
  await p.sync.recordPulls([{ rarity: 'R' }]); await p.sync.syncNow();
  shared.files.set(name, original); await p.sync.syncNow();
  assert.equal(model.totals(JSON.parse(shared.files.get(name)).pulls).R, 16);
});

test('simultaneous pulls in two tabs of one browser session retain every increment', async () => {
  const storage = new Map(); let lock = Promise.resolve();
  const navigator = { locks: { request(_name, action) {
    const work = lock.then(action); lock = work.catch(() => {}); return work;
  } } };
  const first = page(storage, navigator), second = page(storage, navigator);
  await Promise.all([first.sync.recordPulls([{ rarity: 'R' }, { rarity: 'R' }]), second.sync.recordPulls([{ rarity: 'R' }])]);
  assert.equal(second.stats().R, 3);
  const reloaded = page(storage, navigator);
  assert.equal(reloaded.stats().R, 3);
});

test('permission revocation leaves local data intact and resumes after explicit reauthorization', async () => {
  const shared = folder(), p = page(); p.window.showDirectoryPicker = async () => shared;
  await p.sync.connect(); shared.deny();
  await p.sync.recordPulls([{ rarity: 'R' }]); await p.sync.syncNow();
  assert.equal(p.stats().R, 1); assert.match(p.sync.getStatus(), /Autorisation/);
  await p.sync.reauthorize();
  const exported = JSON.parse([...shared.files.values()][0]);
  assert.equal(model.totals(exported.pulls).R, 1);
});

test('a corrupt own file is never overwritten with an empty or partial snapshot', async () => {
  const shared = folder(), p = page(new Map([['wm_pull_stats_v1', JSON.stringify({ counts: { R: 15 } })]]));
  const name = `wm-sync-${p.sync.exportDocument().writer}.json`;
  shared.files.set(name, '{broken'); p.window.showDirectoryPicker = async () => shared;
  await assert.rejects(p.sync.connect());
  assert.equal(shared.files.get(name), '{broken'); assert.equal(p.stats().R, 15);
});

test('export whitelists prices and pull counts and excludes cookies/settings/credentials', () => {
  const p = page(new Map([['wm_feature_settings_v1', '{"private":"secret-placeholder"}'], ['arbitrary-token', 'secret-placeholder']]));
  const exported = JSON.stringify(p.sync.exportDocument());
  assert.equal(exported.includes('secret-placeholder'), false);
  assert.deepEqual(Object.keys(p.sync.exportDocument()).sort(), ['format', 'prices', 'pulls', 'version', 'writer']);
});
