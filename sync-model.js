// Portable data format: prices use fetch timestamps; pull counts use monotonic
// per-session components so repeatedly importing the same file cannot add twice.
(() => {
  const RARITIES = ['L', 'UR', 'SR', 'R', 'PC', 'C'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function counts(value) {
    return Object.fromEntries(RARITIES.map(rarity => {
      const n = Number(value?.[rarity]);
      return [rarity, Number.isSafeInteger(n) && n >= 0 ? n : 0];
    }));
  }
  function price(value) {
    if (!object(value) || value.ok !== true || !Number.isFinite(value.fetchedAt) || value.fetchedAt <= 0 || !object(value.averages)) return null;
    const averages = {};
    for (const rarity of RARITIES) {
      if (!(rarity in value.averages)) continue;
      const n = value.averages[rarity];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
      averages[rarity] = n;
    }
    return { fetchedAt: value.fetchedAt, ok: true, averages };
  }
  function mergePrices(...lists) {
    const result = {};
    for (const list of lists) {
      if (!object(list)) continue;
      for (const [id, raw] of Object.entries(list)) {
        const hit = UUID.test(id) ? price(raw) : null;
        if (!hit) continue;
        const old = result[id];
        if (!old || hit.fetchedAt > old.fetchedAt || (hit.fetchedAt === old.fetchedAt && JSON.stringify(hit) > JSON.stringify(old))) result[id] = hit;
      }
    }
    return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  }
  function emptyPulls() { return { epoch: { time: 0, id: 'initial' }, sources: {} }; }
  function epochCompare(a, b) { return a.time - b.time || a.id.localeCompare(b.id); }
  function pulls(value) {
    if (!object(value) || !object(value.epoch) || !Number.isSafeInteger(value.epoch.time) || value.epoch.time < 0
      || typeof value.epoch.id !== 'string' || value.epoch.id.length > 100 || !object(value.sources)) throw new Error('Statistiques invalides');
    const sources = {};
    for (const [id, raw] of Object.entries(value.sources)) {
      if (!UUID.test(id) || !object(raw)) throw new Error('Source de statistiques invalide');
      for (const rarity of RARITIES) if (!Number.isSafeInteger(raw[rarity]) || raw[rarity] < 0) throw new Error('Compteur invalide');
      sources[id] = counts(raw);
    }
    return { epoch: { time: value.epoch.time, id: value.epoch.id }, sources };
  }
  function mergePulls(...lists) {
    let result = emptyPulls();
    for (const raw of lists) {
      const incoming = pulls(raw);
      const comparison = epochCompare(incoming.epoch, result.epoch);
      if (comparison > 0) result = incoming;
      else if (comparison === 0) {
        for (const [id, values] of Object.entries(incoming.sources)) {
          const old = result.sources[id] || counts();
          result.sources[id] = Object.fromEntries(RARITIES.map(rarity => [rarity, Math.max(old[rarity], values[rarity])]));
        }
      }
    }
    result.sources = Object.fromEntries(Object.entries(result.sources).sort(([a], [b]) => a.localeCompare(b)));
    return result;
  }
  function totals(value) {
    const result = counts();
    for (const source of Object.values(value.sources)) for (const rarity of RARITIES) {
      result[rarity] += source[rarity];
      if (!Number.isSafeInteger(result[rarity])) throw new Error('Total de statistiques trop élevé');
    }
    return result;
  }
  function readDocument(raw) {
    if (!object(raw) || raw.format !== 'wikimasters-file-sync' || raw.version !== 1 || !UUID.test(raw.writer)
      || !object(raw.prices)) throw new Error('Fichier de synchronisation incompatible');
    const data = { prices: mergePrices(raw.prices), pulls: pulls(raw.pulls) };
    totals(data.pulls);
    return data;
  }
  function document(writer, prices, stats) {
    if (!UUID.test(writer)) throw new Error('Identifiant de session invalide');
    return { format: 'wikimasters-file-sync', version: 1, writer, prices: mergePrices(prices), pulls: mergePulls(stats) };
  }
  const api = { RARITIES, UUID, counts, price, mergePrices, emptyPulls, mergePulls, totals, readDocument, document };
  globalThis.WMFileSyncModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
