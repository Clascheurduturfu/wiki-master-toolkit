(() => {
  const registry = window.__wmAverageFeatures ||= {};
  registry.sharedPrices = {
    create(runtime) {
      const api = window.atlasPrices, core = runtime.core;
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let active = Boolean(api), applying = false, timer, flushing = Promise.resolve();
      const pending = new Map();
      function apply(entries) {
        applying = true;
        try {
          for (const [id, entry] of Object.entries(entries || {})) {
            if (UUID.test(id) && entry === null) { window.dispatchEvent(new CustomEvent('wm-average-shared-price-released', { detail: { id } })); continue; }
            if (!UUID.test(id) || entry?.ok !== true) continue;
            const old = core.cacheMemory.get(id) || core.readLocalValue(core.cacheKey(id));
            if (old?.ok === true && old.fetchedAt >= entry.fetchedAt) continue;
            window.dispatchEvent(new CustomEvent('wm-average-observed-price', { detail: { id, ...entry, shared: true } }));
          }
        } finally { applying = false; }
      }
      async function flush() {
        clearTimeout(timer);
        const entries = [...pending].map(([id, entry]) => ({ id, entry })); pending.clear();
        if (!entries.length || !active) return flushing;
        flushing = flushing.then(async () => {
          for (let index = 0; index < entries.length; index += 500) apply(await api.put(entries.slice(index, index + 500)));
        }).catch(error => { core.reportError('base de prix locale', error); });
        return flushing;
      }
      function publish(id, entry) {
        if (!active || applying || !UUID.test(id) || entry?.ok !== true) return;
        pending.set(id, entry); clearTimeout(timer); timer = setTimeout(flush, 25);
      }
      api?.subscribe(apply);
      const ready = (async () => {
        if (!active) return;
        try {
          const available = await api.get([]);
          if (available?.unavailable) { active = false; return; }
          // Import the existing session when it opens; never remove its cache.
          for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index);
            if (key?.startsWith('wm_avg_v3_')) publish(key.slice('wm_avg_v3_'.length), core.readLocalValue(key));
          }
          await flush();
        } catch (error) { active = false; core.reportError('base de prix locale', error); }
      })();
      window.addEventListener('wm-file-sync-local-change', event => {
        const key = event.detail?.key;
        if (key?.startsWith('wm_avg_v3_')) publish(key.slice('wm_avg_v3_'.length), core.readLocalValue(key));
      });
      return {
        present: Boolean(api), ready,
        async lookup(cards) {
          await ready;
          if (!active) return;
          const ids = [...new Set(cards.map(card => card.id).filter(id => UUID.test(id)))];
          try { for (let index = 0; index < ids.length; index += 500) apply(await api.get(ids.slice(index, index + 500))); }
          catch (error) { core.reportError('lecture des prix locaux', error); }
        },
        async reserve(id, force) {
          await ready;
          if (!active) return null;
          try { const result = await api.reserve(id, force); if (result.entry) apply({ [id]: result.entry }); return result; }
          catch (error) { core.reportError('coordination des prix', error); return null; }
        },
        async release(id, token) {
          if (!token || !active) return;
          await flush();
          try { await api.release(id, token); } catch (_) { /* A closed panel also releases its reservations. */ }
        }
      };
    }
  };
})();
