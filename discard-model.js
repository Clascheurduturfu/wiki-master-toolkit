// Keep catalogue IDs (prices) separate from owned-copy IDs (discard requests).
(() => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const RARITIES = ['L', 'UR', 'SR', 'R', 'PC', 'C'];
  const DEFAULT_RARITIES = ['C', 'PC'];
  function rarities(value = DEFAULT_RARITIES) {
    if (!Array.isArray(value) || value.some(rarity => !RARITIES.includes(rarity))) throw Error('Choisis des raretés valides.');
    return [...RARITIES].reverse().filter(rarity => value.includes(rarity));
  }
  function threshold(value) {
    if (typeof value === 'string' && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) throw Error('Choisis un seuil positif ou nul.');
    const n = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) throw Error('Choisis un seuil positif ou nul.');
    return n;
  }
  function entry(raw) {
    if (!UUID.test(raw?.id) || !UUID.test(raw?.card_id) || raw.card?.id !== raw.card_id
      || !RARITIES.includes(raw.card?.rarity) || typeof raw.starred !== 'boolean' || typeof raw.is_shiny !== 'boolean'
      || (raw.count != null && raw.count !== 1)) throw Error('Exemplaire ou protections incomplets : analyse arrêtée.');
    return { ownedId: raw.id, cardId: raw.card_id, rarity: raw.card.rarity,
      title: String(raw.card.wikipedia_title || raw.card_id), imageUrl: raw.card.image_url || null,
      starred: raw.starred, shiny: raw.is_shiny };
  }
  function protection(pending, selling) {
    if (!Array.isArray(pending) || !Array.isArray(selling)) throw Error('Protections échanges/enchères indisponibles.');
    const tradeIds = new Set(), saleIds = new Set();
    for (const id of pending) {
      if (!UUID.test(id)) throw Error('Protection échange invalide.');
      tradeIds.add(id);
    }
    for (const auction of selling) {
      if (!UUID.test(auction?.card_id)) throw Error('Protection enchère invalide.');
      // The endpoint exposes catalogue IDs. Protect every copy of that card.
      saleIds.add(auction.card_id);
    }
    return { tradeIds, saleIds };
  }
  function average(hit, rarity) {
    if (hit?.ok !== true || !Number.isFinite(hit.fetchedAt) || hit.fetchedAt <= 0
      || !hit.averages || typeof hit.averages !== 'object' || Array.isArray(hit.averages)) return null;
    const value = hit?.averages?.[rarity];
    // A completed summary without an average is the UI's “Moy. —”.
    // This rule is for discard selection only, never for price display/storage.
    if (value == null) return 0;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  }
  function plan(entries, getPrice, maximum, protectedCards, selectedRarities = DEFAULT_RARITIES) {
    maximum = threshold(maximum);
    const allowedRarities = rarities(selectedRarities);
    const selected = [], excluded = { favorite: 0, shiny: 0, trade: 0, sale: 0, unknown: 0, above: 0, rarity: 0 };
    const seen = new Set();
    for (const row of entries) {
      if (seen.has(row.ownedId)) throw Error('Exemplaire répété : recharge l’analyse.');
      seen.add(row.ownedId);
      if (!allowedRarities.includes(row.rarity)) { excluded.rarity++; continue; }
      const reason = row.starred ? 'favorite' : row.shiny ? 'shiny'
        : protectedCards.tradeIds.has(row.cardId) || protectedCards.tradeIds.has(row.ownedId) ? 'trade'
        : protectedCards.saleIds.has(row.cardId) ? 'sale' : null;
      if (reason) { excluded[reason]++; continue; }
      const hit = getPrice(row.cardId), price = average(hit, row.rarity);
      if (price === null) { excluded.unknown++; continue; }
      if (price > maximum) { excluded.above++; continue; }
      selected.push({ ...row, average: price, noAverage: hit.averages[row.rarity] == null, fetchedAt: hit.fetchedAt });
    }
    selected.sort((a, b) => a.average - b.average || a.title.localeCompare(b.title, 'fr') || a.ownedId.localeCompare(b.ownedId));
    return { maximum, rarities: allowedRarities, selected, excluded, total: entries.length };
  }
  function verifyApproved(approved, currentPlan) {
    if (!Array.isArray(approved) || !approved.length) throw Error('Aucun exemplaire sélectionné.');
    const current = new Map(currentPlan.selected.map(row => [row.ownedId, row]));
    const seen = new Set();
    for (const old of approved) {
      const row = current.get(old.ownedId);
      if (seen.has(old.ownedId) || !row || row.cardId !== old.cardId || row.rarity !== old.rarity || row.average !== old.average) {
        throw Error('La collection, ses protections ou les prix ont changé. Rouvre Discard et confirme le nouvel aperçu.');
      }
      seen.add(old.ownedId);
    }
    return approved.map(old => current.get(old.ownedId));
  }
  const api = { UUID, RARITIES, DEFAULT_RARITIES, rarities, threshold, entry, protection, average, plan, verifyApproved };
  globalThis.WMDiscardModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
