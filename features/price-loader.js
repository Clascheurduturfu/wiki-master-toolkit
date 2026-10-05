(() => {
  const registry = window.__wmAverageFeatures ||= {};

  registry.priceLoader = {
    create(runtime) {
      const {
        MAX_CONCURRENT, ERROR_CACHE_TTL, cardMetaById, idByTitle, cacheMemory,
        normalizeTitle, cacheKey, storageGet, storageSet, isCacheEntryValid,
        registerCards, reportError
      } = runtime.core;
      const WORK_KEY = 'wm_atlas_unpriced_cards_v1';
      const PAUSE_KEY = 'wm_atlas_price_pause_v1';
      const queued = [], queuedIds = new Set(), inFlightIds = new Set();
      const pendingByRequestId = new Map(), forceIds = new Set(), errors = new Map();
      const bulkPendingIds = new Set();
      const sharedWaits = new Map(), leaseTokens = new Map();
      const savedWork = new Map(Object.entries(storageGet(WORK_KEY)[WORK_KEY] || {}));
      let activeRequests = 0, bulkBatchActive = false, bulkTotal = 0, wakeTimer;
      let pause = storageGet(PAUSE_KEY)[PAUSE_KEY] || null;

      function persistWork() { storageSet({ [WORK_KEY]: Object.fromEntries(savedWork) }); }
      function notifyBulkProgress() { runtime.collectionBulk?.updateBulkProgress(bulkTotal, bulkPendingIds.size); }
      function completeBulkCard(id) {
        if (!bulkPendingIds.delete(id)) return;
        notifyBulkProgress();
        if (bulkBatchActive && bulkPendingIds.size === 0) {
          bulkBatchActive = false;
          runtime.collectionBulk?.finishBulkLoad();
        }
      }
      function goodPrice(id) {
        const memory = cacheMemory.get(id);
        if (memory?.ok === true && isCacheEntryValid(memory)) return memory;
        const stored = storageGet(cacheKey(id))[cacheKey(id)];
        return stored?.ok === true && isCacheEntryValid(stored) ? stored : null;
      }
      function getStatus(id) {
        if (sharedWaits.has(id)) return 'Chargement dans un autre panneau…';
        if (inFlightIds.has(id)) return 'Chargement…';
        if (queuedIds.has(id)) {
          if (pause?.until > Date.now()) return pause.label;
          if ((savedWork.get(id)?.retryAt || 0) > Date.now()) return `${errors.get(id) || 'Erreur temporaire'} · nouvel essai prévu`;
          return 'En attente';
        }
        return errors.get(id) || '';
      }
      function loadCacheForCards(cards, options = {}) {
        if (runtime.sharedPrices?.present) return runtime.sharedPrices.lookup(cards).then(() => loadLocalCacheForCards(cards, options));
        return loadLocalCacheForCards(cards, options);
      }
      function loadLocalCacheForCards(cards, { forceRarities = null, forceCardIds = null, markBulk = false } = {}) {
        const unique = [...new Map(cards.filter(card => card?.id).map(card => [card.id, card])).values()];
        registerCards(unique);
        if (markBulk) {
          bulkBatchActive = true;
          bulkPendingIds.clear();
          bulkTotal = unique.length;
        }
        for (const card of unique) {
          const force = Boolean(forceCardIds?.has(card.id) || forceRarities?.has(card.rarity));
          const entry = goodPrice(card.id) || storageGet(cacheKey(card.id))[cacheKey(card.id)];
          if (entry && isCacheEntryValid(entry)) cacheMemory.set(card.id, entry);
          else cacheMemory.delete(card.id);
          if (force) { forceIds.add(card.id); errors.delete(card.id); }
          if (force || !isCacheEntryValid(entry) || (entry?.ok === false && savedWork.has(card.id))) {
            if (markBulk) bulkPendingIds.add(card.id);
            const previous = savedWork.get(card.id);
            savedWork.set(card.id, { ...previous, id: card.id, title: card.title, rarity: card.rarity, retryAt: previous?.retryAt || 0 });
            if (entry?.ok === false && entry.error) errors.set(card.id, entry.error);
            enqueue(card.id);
          } else if (entry.ok === true) savedWork.delete(card.id);
          runtime.priceUi.renderKnownCard(card.id);
        }
        persistWork();
        if (markBulk) notifyBulkProgress();
        pumpQueue();
        if (markBulk && bulkPendingIds.size === 0) {
          bulkBatchActive = false;
          runtime.collectionBulk?.finishBulkLoad();
        }
      }
      function enqueue(id) {
        if (queuedIds.has(id) || inFlightIds.has(id)) return;
        if (!forceIds.has(id) && goodPrice(id)) return;
        queued.push(id); queuedIds.add(id);
      }
      function scheduleWake(at) {
        clearTimeout(wakeTimer);
        wakeTimer = setTimeout(pumpQueue, Math.max(1, at - Date.now()));
      }
      function pumpQueue() {
        const persistedPause = storageGet(PAUSE_KEY)[PAUSE_KEY];
        if (persistedPause?.until > (pause?.until || 0)) pause = persistedPause;
        if (pause?.until > Date.now()) {
          for (const id of queued) runtime.priceUi.renderKnownCard(id);
          if (queued.length) scheduleWake(pause.until);
          return;
        }
        let earliest = Infinity;
        while (activeRequests < MAX_CONCURRENT && queued.length) {
          const index = queued.findIndex(id => forceIds.has(id) || (savedWork.get(id)?.retryAt || 0) <= Date.now());
          if (index < 0) {
            earliest = Math.min(...queued.map(id => savedWork.get(id)?.retryAt || 0));
            break;
          }
          const [id] = queued.splice(index, 1); queuedIds.delete(id);
          const cached = goodPrice(id);
          if (!forceIds.has(id) && cached) {
            cacheMemory.set(id, cached); savedWork.delete(id); completeBulkCard(id);
            runtime.priceUi.renderKnownCard(id); persistWork();
            continue;
          }
          if (inFlightIds.has(id)) continue;
          requestAverage(id);
        }
        if (Number.isFinite(earliest)) scheduleWake(earliest);
      }
      async function requestAverage(id) {
        activeRequests++; inFlightIds.add(id);
        if (runtime.sharedPrices?.present) {
          const reservation = await runtime.sharedPrices.reserve(id, forceIds.has(id));
          if (reservation?.entry || reservation?.waiting) {
            activeRequests--; inFlightIds.delete(id);
            if (reservation.entry) { forceIds.delete(id); saveSuccess({ id, ...reservation.entry, shared: true }); completeBulkCard(id); }
            else {
              sharedWaits.set(id, reservation.until);
              setTimeout(() => {
                if (!sharedWaits.delete(id)) return;
                enqueue(id); pumpQueue();
              }, Math.max(1, reservation.until - Date.now()));
            }
            runtime.priceUi.renderKnownCard(id); pumpQueue(); return;
          }
          if (reservation?.token) leaseTokens.set(id, reservation.token);
        }
        const requestId = `${id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        pendingByRequestId.set(requestId, id);
        runtime.priceUi.renderKnownCard(id);
        window.dispatchEvent(new CustomEvent('wm-average-request', { detail: { id, requestId } }));
      }
      function saveSuccess(detail) {
        if (!detail.id || !detail.averages || typeof detail.averages !== 'object') return;
        const entry = { fetchedAt: detail.fetchedAt || Date.now(), averages: detail.averages, ok: true, retryAfterMs: null };
        cacheMemory.set(detail.id, entry);
        storageSet({ [cacheKey(detail.id)]: entry });
        if (sharedWaits.delete(detail.id)) { forceIds.delete(detail.id); completeBulkCard(detail.id); }
        errors.delete(detail.id); savedWork.delete(detail.id); persistWork();
        const queuedIndex = queued.indexOf(detail.id);
        if (queuedIndex >= 0 && !forceIds.has(detail.id)) {
          queued.splice(queuedIndex, 1); queuedIds.delete(detail.id); completeBulkCard(detail.id);
        }
        if (detail.title) {
          const meta = { ...(cardMetaById.get(detail.id) || {}), id: detail.id, title: detail.title };
          cardMetaById.set(detail.id, meta); idByTitle.set(normalizeTitle(detail.title), detail.id);
        }
        runtime.priceUi.renderKnownCard(detail.id);
      }
      function finishRequest(detail) {
        const id = pendingByRequestId.get(detail.requestId);
        if (!id) return;
        pendingByRequestId.delete(detail.requestId); inFlightIds.delete(id);
        forceIds.delete(id); activeRequests--;
        if (detail.ok) saveSuccess({ ...detail, id });
        else {
          const label = detail.automationLimit ? 'Limite du site'
            : detail.status === 429 ? 'Pause serveur 429'
            : detail.status ? `Erreur API ${detail.status}` : detail.error || 'Erreur réseau';
          errors.set(id, label);
          const work = savedWork.get(id);
          const failures = (work?.failures || 0) + 1;
          const retryAfterMs = Math.max(Number(detail.retryAfterMs) || ERROR_CACHE_TTL, Math.min(900000, ERROR_CACHE_TTL * 2 ** Math.min(failures - 1, 4)));
          const old = goodPrice(id);
          // Failed manual refreshes never replace a successful persistent price.
          if (old) { cacheMemory.set(id, old); savedWork.delete(id); }
          else {
            const entry = { fetchedAt: Date.now(), averages: {}, ok: false, retryAfterMs, error: label };
            cacheMemory.set(id, entry); storageSet({ [cacheKey(id)]: entry });
            if (work) savedWork.set(id, { ...work, failures, retryAt: Date.now() + retryAfterMs });
            // Resume transient failures without requiring another page visit.
            // Permanent HTTP/data errors remain visible until a later visit/retry.
            const transient = detail.status === 429 || detail.status >= 500
              || (!detail.status && detail.error !== 'Réponse invalide');
            if (work && transient) enqueue(id);
          }
          if ([401, 403, 429].includes(detail.status)) {
            pause = { until: Date.now() + Math.max(detail.status === 429 ? 1000 : 120000, retryAfterMs), label };
            storageSet({ [PAUSE_KEY]: pause });
          }
          persistWork(); runtime.priceUi.renderKnownCard(id);
        }
        completeBulkCard(id);
        const lease = leaseTokens.get(id); leaseTokens.delete(id);
        runtime.sharedPrices?.release(id, lease);
        pumpQueue();
      }
      window.addEventListener('wm-average-response', event => {
        try { finishRequest(event.detail || {}); } catch (error) { reportError('réponse', error); }
      });
      window.addEventListener('wm-average-observed-price', event => {
        try { saveSuccess(event.detail || {}); pumpQueue(); } catch (error) { reportError('prix du site', error); }
      });
      window.addEventListener('wm-average-shared-price-released', event => {
        const id = event.detail?.id;
        if (!sharedWaits.delete(id)) return;
        enqueue(id); pumpQueue();
      });
      // Native page requests can complete before the UI modules finish loading.
      for (const detail of window.__wmAverageObservedPrices?.values() || []) saveSuccess(detail);
      window.__wmAverageObservedPrices?.clear();
      // Resume unfinished pulls or collection work after navigation/restart.
      setTimeout(() => loadCacheForCards([...savedWork.values()]), 0);
      return { loadCacheForCards, getStatus, isPending: id => queuedIds.has(id) || inFlightIds.has(id) || sharedWaits.has(id) };
    }
  };
})();
