const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { setImmediate: flushIO } = require('node:timers/promises');
const ID = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const CARD = { id: ID, title: 'Fixture card', rarity: 'R' };
const KEY = id => 'wm_avg_v3_' + id;
const ROOT = path.join(__dirname, '..');

function page({ storage = new Map(), result = () => ({ status: 200, body: { summary: { R: { average: 35 } } } }), now = 1800000000000 } = {}) {
  const listeners = new Map(), timers = new Map(), calls = [], rendered = [];
  let sequence = 0, active = 0, peak = 0;
  const window = {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); return true; }
  };
  const document = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
  const localStorage = {
    getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
  };
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const fakeFetch = async (url, options = {}) => {
    calls.push({ url, options }); active++; peak = Math.max(active, peak);
    const reply = await result(url, options); active--;
    if (reply.error) throw reply.error;
    const response = { ok: reply.status >= 200 && reply.status < 300, status: reply.status,
      headers: { get: () => reply.retryAfter ?? null }, json: async () => reply.body };
    response.clone = () => response;
    return response;
  };
  window.fetch = fakeFetch;
  const context = vm.createContext({ window, document, localStorage, Date: ClockDate, URL, AbortController,
    console: { debug() {}, warn() {}, error() {} }, location: { origin: 'https://www.wiki-masters.com', pathname: '/collection' },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id) });
  const load = file => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context);
  load('features/core.js'); load('features/price-loader.js'); load('bridge/prices.js'); load('bridge/intercept.js');
  const core = window.__wmAverageFeatures.core.create();
  const runtime = { core, priceUi: { renderKnownCard: id => rendered.push(id), formatAverage: String, chooseAverage: () => null },
    settings: { isEnabled: () => false }, pullStats: { recordPullStats() {} } };
  const bridge = { core: { originalFetch: fakeFetch, captureSupabaseRequest() {}, captureGlobalCardsRequest() {},
    isGlobalCardsApi: () => false, isTradesApi: () => false, isMarketplaceDetailApi: () => false,
    isPacksOpenApi: () => false } };
  bridge.prices = window.__wmBridgeFeatures.bridgePrices.create(bridge);
  runtime.priceLoader = window.__wmAverageFeatures.priceLoader.create(runtime);
  const flush = async () => { for (let i = 0; i < 4; i++) await flushIO(); };
  const advance = async milliseconds => {
    const end = now + milliseconds; await flush();
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].callback(); await flush();
    }
    now = end; await flush();
  };
  return { runtime, bridge, context, window, load, storage, calls, flush, advance, peak: () => peak,
    emit: (type, detail) => window.dispatchEvent({ type, detail }),
    cache: id => JSON.parse(storage.get(KEY(id)) || 'null'),
    pending: () => JSON.parse(storage.get('wm_atlas_unpriced_cards_v1') || '{}') };
}

test('successful prices never expire or get deleted; errors retain a short expiry', () => {
  const entry = { fetchedAt: 1000, ok: true, averages: { R: 22 } };
  const storage = new Map([[KEY(ID), JSON.stringify(entry)]]);
  const p = page({ storage });
  assert.equal(p.runtime.core.isCacheEntryValid(entry), true);
  p.runtime.core.cleanupPriceCacheOnceDaily();
  assert.deepEqual(p.cache(ID), entry);
  assert.equal(p.runtime.core.isCacheEntryValid({ ...entry, ok: false }), false);
});

test('legacy Atlas prices migrate without overwriting a newer reference cache', async () => {
  const storage = new Map([
    ['wikimasters-prices:cache:v1', JSON.stringify({ [ID]: { time: 1000, summary: { R: { average: '22' }, C: { average: null } } },
      [OTHER]: { time: 1000, summary: { R: { average: 25 } } } })],
    [KEY(OTHER), JSON.stringify({ fetchedAt: 2000, ok: true, averages: { R: 99 } })]
  ]);
  const p = page({ storage });
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush();
  assert.deepEqual(p.cache(ID).averages, { R: 22 });
  assert.deepEqual(p.cache(OTHER).averages, { R: 99 });
  assert.equal(p.calls.length, 0);
});

test('an automatically priced card is reused after reload even years later', async () => {
  const p = page(); p.runtime.priceLoader.loadCacheForCards([CARD, CARD]); await p.flush();
  assert.equal(p.calls.length, 1); assert.equal(p.cache(ID).averages.R, 35);
  const second = page({ storage: p.storage, now: 2100000000000 });
  second.runtime.priceLoader.loadCacheForCards([CARD]); await second.advance(0);
  assert.equal(second.calls.length, 0);
});

test('manual refresh replaces a price only after success', async () => {
  let failed = false;
  const p = page({ result: () => failed ? { status: 404, body: {} } : { status: 200, body: { summary: { R: { average: 35 } } } } });
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush(); failed = true;
  p.runtime.priceLoader.loadCacheForCards([CARD], { forceRarities: new Set(['R']) }); await p.flush();
  assert.equal(p.cache(ID).ok, true); assert.equal(p.cache(ID).averages.R, 35);
  assert.equal(p.runtime.priceLoader.getStatus(ID), 'Erreur API 404');
});

test('site fetch summaries are saved and reused by collection without another request', async () => {
  const p = page();
  windowIntercept(p);
  await p.window.fetch(`/api/marketplace/cards/${ID}/sales?scope=summary`); await p.flush();
  assert.equal(p.cache(ID).averages.R, 35);
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush();
  assert.equal(p.calls.length, 1);
});
function windowIntercept(p) { p.context.window.__wmBridgeFeatures.bridgeIntercept.create(p.bridge); }

test('XHR summaries are captured, while failed XHR responses are ignored', async () => {
  const p = page();
  class XHR {
    open() {} setRequestHeader() {} addEventListener(type, listener) { this.listener = listener; }
    send() { this.listener?.(); }
  }
  p.window.XMLHttpRequest = XHR; windowIntercept(p);
  const request = new XHR(); request.status = 200;
  request.responseText = JSON.stringify({ summary: { R: { average: '47' } } });
  request.open('GET', `/api/marketplace/cards/${ID}/sales?scope=summary`); request.send();
  assert.equal(p.cache(ID).averages.R, 47);
  const failed = new XHR(); failed.status = 500;
  failed.responseText = JSON.stringify({ summary: { R: { average: 0 } } });
  failed.open('GET', `/api/marketplace/cards/${ID}/sales?scope=summary`); failed.send();
  assert.equal(p.cache(ID).averages.R, 47);
});

test('malformed and cross-origin observed responses never poison permanent cache', () => {
  const p = page();
  p.bridge.prices.captureSummaryResponse(`/api/marketplace/cards/${ID}/sales?scope=summary`, { summary: [] });
  p.bridge.prices.captureSummaryResponse(`https://other.example/api/marketplace/cards/${ID}/sales?scope=summary`, { summary: { R: { average: 8 } } });
  assert.equal(p.cache(ID), null);
  assert.deepEqual(JSON.parse(JSON.stringify(p.bridge.prices.averagesFromSummary({ summary: { R: { average: null }, SR: { average: 0 } } }))), { SR: 0 });
});

test('new pack cards are priced even with the recap feature disabled', async () => {
  const p = page(); p.context.location.pathname = '/pulls';
  p.load('features/packs.js');
  p.runtime.packs = p.window.__wmAverageFeatures.packs.create(p.runtime);
  p.emit('wm-average-pack-opened', { cards: [CARD, CARD] }); await p.flush();
  assert.equal(p.calls.length, 1); assert.equal(p.cache(ID).averages.R, 35);
  assert.deepEqual(p.pending(), {});
});

test('unfinished pack price work resumes automatically on a new page', async () => {
  const p = page({ result: () => new Promise(() => {}) });
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush();
  assert.equal(p.pending()[ID].title, CARD.title);
  const second = page({ storage: p.storage }); await second.advance(0);
  assert.equal(second.calls.length, 1); assert.equal(second.cache(ID).averages.R, 35);
  assert.deepEqual(second.pending(), {});
});

test('duplicate collection/pull loads share three concurrent requests without bursting above the bound', async () => {
  const replies = [];
  const p = page({ result: () => new Promise(resolve => replies.push(resolve)) });
  const cards = Array.from({ length: 5 }, (_, index) => ({ ...CARD, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
  p.runtime.priceLoader.loadCacheForCards(cards);
  p.runtime.priceLoader.loadCacheForCards(cards); await p.flush();
  assert.equal(p.calls.length, 3); assert.equal(p.peak(), 3);
  while (replies.length) { replies.shift()({ status: 200, body: { summary: { R: { average: 35 } } } }); await p.flush(); }
  assert.equal(p.calls.length, 5);
});

test('server cooldown stops the queue and persists across reloads', async () => {
  const p = page({ result: () => ({ status: 403, body: { code: 'automation_limit' } }) });
  const cards = [CARD, { ...CARD, id: OTHER }, ...Array.from({ length: 3 }, (_, index) => ({ ...CARD, id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }))];
  p.runtime.priceLoader.loadCacheForCards(cards); await p.flush();
  assert.equal(p.calls.length, 3);
  assert.equal(p.runtime.priceLoader.getStatus(cards[3].id), 'Limite du site');
  const second = page({ storage: p.storage }); await second.advance(1000);
  assert.equal(second.calls.length, 0);
});

test('a cooldown published by another feature stops new price requests in the current page', async () => {
  const p = page();
  p.storage.set('wm_atlas_price_pause_v1', JSON.stringify({ until: 1800000120000, label: 'Erreur API 429' }));
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush();
  assert.equal(p.calls.length, 0);
  assert.equal(p.runtime.priceLoader.getStatus(CARD.id), 'Erreur API 429');
  await p.advance(120000);
  assert.equal(p.calls.length, 1); assert.equal(p.cache(ID).averages.R, 35);
});

test('observed success during an active request preserves the price if that request later fails', async () => {
  let reply;
  const p = page({ result: () => new Promise(resolve => { reply = resolve; }) });
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush();
  p.bridge.prices.captureSummaryResponse(`/api/marketplace/cards/${ID}/sales?scope=summary`, { summary: { R: { average: 88 } } });
  reply({ status: 404, body: {} }); await p.flush();
  assert.equal(p.cache(ID).averages.R, 88);
});

test('a transient failed pull retries automatically and clears pending work after recovery', async () => {
  let recovered = false;
  const p = page({ result: () => recovered
    ? { status: 200, body: { summary: { R: { average: 42 } } } }
    : { status: 500, body: {} } });
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.advance(1000);
  assert.equal(p.calls.length, 3);
  assert.equal(p.cache(ID).ok, false);
  assert.match(p.runtime.priceLoader.getStatus(ID), /nouvel essai prévu/);
  recovered = true; await p.advance(60000);
  assert.equal(p.calls.length, 4); assert.equal(p.cache(ID).averages.R, 42);
  assert.deepEqual(p.pending(), {});
});

test('an observed site price cancels a delayed retry and no duplicate request follows', async () => {
  const p = page({ result: () => ({ status: 429, retryAfter: '120', body: {} }) });
  p.runtime.priceLoader.loadCacheForCards([CARD]); await p.flush();
  p.bridge.prices.captureSummaryResponse(`/api/marketplace/cards/${ID}/sales?scope=summary`, { summary: { R: { average: 77 } } });
  await p.advance(130000);
  assert.equal(p.calls.length, 1); assert.equal(p.cache(ID).averages.R, 77);
  assert.equal(p.runtime.priceLoader.isPending(ID), false);
});

test('a different rarity cannot be shown as the selected price and zero remains a valid price', () => {
  const p = page(); p.load('features/price-ui.js');
  const ui = p.window.__wmAverageFeatures.priceUi.create(p.runtime);
  assert.equal(ui.chooseAverage({ averages: { SR: 50 } }, null, 'R'), null);
  assert.equal(ui.chooseAverage({ averages: { R: 0 } }, null, 'R'), 0);
});
