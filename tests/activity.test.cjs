const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const uid = '11111111-1111-4111-8111-111111111111';
const auctionId = '22222222-2222-4222-8222-222222222222';
const cardId = '33333333-3333-4333-8333-333333333333';
const achievementId = '44444444-4444-4444-8444-444444444444';
const otherAchievement = '55555555-5555-4555-8555-555555555555';
const auction = { id: auctionId, card_id: cardId, snapshot_rarity: 'R', status: 'active', effective_bid: 10,
  card: { id: cardId, wikipedia_title: 'Tracked card', image_url: 'https://example.test/card.png' } };
function setup(job) {
  const storage = new Map(), calls = [], events = [];
  const token = 'Bearer header.' + Buffer.from(JSON.stringify({ sub: uid })).toString('base64url') + '.signature';
  const catalogue = [{ id: achievementId, title: 'New success', wikibidous_reward: 80 }];
  const core = { VERSION: 'test', readLocalValue: key => storage.get(key), writeLocalValue: (key, value) => storage.set(key, value), cacheKey: id => 'wm_avg_v3_' + id, cacheMemory: new Map() };
  const window = { __wmAverageFeatures: {}, addEventListener() {}, dispatchEvent: event => events.push(event.type),
    __wmAverageBridgeRuntime: { core: { getSupabaseRequestTemplate: () => ({ url: 'https://cyrxjeppjqsxxjayfrur.supabase.co/rest/v1/profiles', headers: { apikey: 'fixture-public-key', authorization: token } }) } } };
  const context = vm.createContext({ window, document: { getElementById: () => null }, navigator: {}, location: { origin: 'https://www.wiki-masters.com', pathname: '/collection' },
    Headers, URL, AbortSignal, atob, CustomEvent: class { constructor(type) { this.type = type; } }, setTimeout: fn => { fn(); },
    fetch: async (url, options) => {
      const call = { url, method: options.method || 'GET', body: options.body && JSON.parse(options.body), options }; calls.push(call);
      const result = await job?.(call, { calls, storage });
      const data = result?.data ?? (url.includes('/rest/v1/achievements?') ? catalogue : url.includes('/user_achievements?') ? [{ achievement_id: achievementId, claimed_at: null }] : { auction, unlocked: [] });
      const status = result?.status ?? 200;
      return { status, ok: status < 400, headers: new Headers(result?.headers || {}), json: async () => data };
    } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../features/activity.js'), 'utf8'), context);
  const service = window.__wmAverageFeatures.activity.create({ core });
  return { service, calls, storage, events, window };
}
test('watchlist persists verified auction links without a bid and rejects foreign URLs', async () => {
  const { service, calls, storage } = setup();
  for (const value of ['https://evil.test/marketplace/' + auctionId, 'https://www.wiki-masters.com/api/marketplace/' + auctionId, 'javascript:alert(1)']) assert.throws(() => service.auctionId(value));
  await service.follow('https://www.wiki-masters.com/marketplace/' + auctionId + '?foo=1');
  await service.follow(auctionId);
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'GET');
  assert.equal(storage.get('wm_auction_watchlist_v1')[0].title, 'Tracked card');
  service.unfollow(auctionId); assert.equal(service.readWatchlist().length, 0);
});
test('achievement discovery completes before authoritative reads, with concurrent checks deduplicated', async () => {
  let finish;
  const { service, calls, storage } = setup(call => call.url.endsWith('/check') ? new Promise(resolve => { finish = () => resolve({ data: { unlocked: [achievementId] } }); }) : undefined);
  const first = service.checkAchievements(), second = service.checkAchievements();
  assert.equal(calls.length, 1); assert.equal(calls[0].body.event, 'achievements_sync');
  finish(); const results = await Promise.all([first, second]);
  assert.equal(calls.length, 3); assert.equal(results[0].claimable[0].reward, 80);
  for (const call of calls.slice(1)) { assert.equal(call.options.credentials, 'omit'); assert.equal(call.options.cache, 'no-store'); }
  assert.equal(storage.size, 0, 'Login tokens and achievement state are never persisted by the feature.');
});
test('server check errors remain errors, never an empty success list', async () => {
  const { service, calls, storage } = setup(() => ({ status: 429, data: { error: 'slow down' }, headers: { 'Retry-After': '180' } }));
  await assert.rejects(service.checkAchievements(), /429/);
  assert.equal(calls.length, 1); assert.ok(storage.get('wm_atlas_price_pause_v1').until > Date.now() + 170000);
  await assert.rejects(service.checkAchievements(), /réessaie/); assert.equal(calls.length, 1);
});
test('claim all checks for new achievements, handles already claimed and reports only confirmed rewards', async () => {
  const { service, calls, events } = setup(call => {
    if (call.url.includes('/rest/v1/achievements?')) return { data: [{ id: achievementId, title: 'A', wikibidous_reward: 80 }, { id: otherAchievement, title: 'B', wikibidous_reward: 25 }] };
    if (call.url.includes('/user_achievements?')) return { data: [achievementId, otherAchievement].map(id => ({ achievement_id: id, claimed_at: null })) };
    if (call.url.endsWith('/claim')) return { data: call.body.achievement_id === achievementId ? { claimed_at: '2026-10-03T12:00:00Z', amount: 80 } : { already_claimed: true, amount: 25 } };
  });
  const result = await service.claimAll();
  assert.equal(result.claimed, 1); assert.equal(result.gained, 80); assert.equal(result.already, 1); assert.equal(result.error, null);
  assert.equal(calls[0].url, '/api/achievements/check');
  assert.deepEqual(events, ['wikimasters:wikibidous-balance-refresh']);
});
test('ambiguous claim stops without retry or claiming subsequent rewards', async () => {
  const { service, calls } = setup(call => {
    if (call.url.includes('/rest/v1/achievements?')) return { data: [achievementId, otherAchievement].map(id => ({ id, title: id, wikibidous_reward: 80 })) };
    if (call.url.includes('/user_achievements?')) return { data: [achievementId, otherAchievement].map(id => ({ achievement_id: id, claimed_at: null })) };
    if (call.url.endsWith('/claim')) return { data: { ok: true } };
  });
  const result = await service.claimAll(); assert.match(result.error, /ambiguë/); assert.equal(result.claimed, 0);
  assert.equal(calls.filter(call => call.url.endsWith('/claim')).length, 1);
});
