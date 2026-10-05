const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function fixture(responses) {
  const listeners = new Map(), events = [], calls = [];
  const window = { addEventListener(type, callback) { const callbacks = listeners.get(type) || []; callbacks.push(callback); listeners.set(type, callbacks); },
    removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== callback)); },
    dispatchEvent(event) { events.push(event); for (const callback of [...listeners.get(event.type) || []]) callback(event); } };
  const context = vm.createContext({ window, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    setTimeout: callback => { callback(); return 1; } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../bridge/packs.js'), 'utf8'), context);
  const packs = window.__wmBridgeFeatures.bridgePacks.create({ core: { MAX_BULK_PACKS: 10, mapPackCards: json => json.cards || [], originalFetch: async (url, options) => {
    calls.push({ url, options }); const next = responses.shift();
    if (next instanceof Error) throw next;
    return { ok: next.status === 200, status: next.status, json: async () => next.body };
  } } });
  return { packs, window, events, calls, settle: () => new Promise(resolve => setImmediate(resolve)) };
}
test('mid-batch verification pauses without another opening, then resumes with accumulated cards', async () => {
  const p = fixture([{ status: 200, body: { cards: [{ id: 'first' }], packs_remaining: 1 } },
    { status: 403, body: { human_verification_required: true } }, { status: 200, body: { cards: [{ id: 'second' }], packs_remaining: 0 } }]);
  const job = p.packs.openAllPacks('batch'); await p.settle();
  assert.equal(p.calls.length, 2);
  const pause = p.events.find(event => event.type === 'wm-average-pack-verification-needed');
  assert.equal(pause.detail.openedPacks, 1);
  p.window.dispatchEvent({ type: 'wm-average-pack-verification-result', detail: { requestId: 'other', ok: true } }); await p.settle();
  assert.equal(p.calls.length, 2);
  p.window.dispatchEvent({ type: 'wm-average-pack-verification-result', detail: { requestId: 'batch', ok: true } }); await job;
  const result = p.events.at(-1).detail;
  assert.equal(result.ok, true); assert.equal(result.openedPacks, 2); assert.equal(result.cards.length, 2);
});
test('cancelling verification returns partial results and never replays a failed ambiguous opening', async () => {
  const p = fixture([{ status: 200, body: { cards: [{ id: 'first' }], packs_remaining: 1 } }, { status: 403, body: { human_verification_required: true } }]);
  const job = p.packs.openAllPacks('batch'); await p.settle();
  p.window.dispatchEvent({ type: 'wm-average-pack-verification-result', detail: { requestId: 'batch', ok: false } }); await job;
  assert.equal(p.calls.length, 2); assert.equal(p.events.at(-1).detail.cards.length, 1); assert.equal(p.events.at(-1).detail.ok, false);
  const failed = fixture([new Error('Network uncertainty')]); await failed.packs.openAllPacks('failed');
  assert.equal(failed.calls.length, 1); assert.equal(failed.events.at(-1).detail.ok, false);
});
