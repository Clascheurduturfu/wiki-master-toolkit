(() => {
  const registry = window.__wmBridgeFeatures ||= {};
  registry.bridgePrices = {
    create(runtime) {
      const { originalFetch } = runtime.core;
      const observed = window.__wmAverageObservedPrices ||= new Map();

      function averagesFromSummary(json) {
        if (!json?.summary || typeof json.summary !== 'object' || Array.isArray(json.summary)) throw new Error('Réponse invalide');
        const averages = {};
        for (const [rarity, value] of Object.entries(json.summary)) {
          const average = value?.average;
          if (average == null || average === '') continue;
          if (!['C', 'PC', 'R', 'SR', 'UR', 'L'].includes(rarity)) continue;
          if (typeof average === 'boolean' || !Number.isFinite(Number(average))) throw new Error('Réponse invalide');
          averages[rarity] = Number(average);
        }
        return averages;
      }
      function cardIdFromSummaryUrl(url) {
        try {
          const parsed = new URL(url, location.origin);
          if (parsed.origin !== location.origin || parsed.searchParams.get('scope') !== 'summary') return null;
          return parsed.pathname.match(/^\/api\/marketplace\/cards\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/sales\/?$/i)?.[1] || null;
        } catch { return null; }
      }
      function captureSummaryResponse(url, json) {
        const id = cardIdFromSummaryUrl(url);
        if (!id) return;
        try {
          const detail = { id, ok: true, averages: averagesFromSummary(json), title: json.wikipedia_title || null, fetchedAt: Date.now() };
          observed.set(id, detail);
          window.dispatchEvent(new CustomEvent('wm-average-observed-price', { detail }));
        } catch { /* Malformed or unrelated site responses must not poison the cache. */ }
      }
      window.addEventListener('wm-average-request', async event => {
        const { id, requestId } = event.detail || {};
        if (!id || !requestId) return;
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          try {
            const response = await originalFetch(`/api/marketplace/cards/${encodeURIComponent(id)}/sales?scope=summary`, {
              method: 'GET', credentials: 'include', headers: { accept: '*/*' }, signal: controller.signal
            });
            if (!response.ok) {
              const error = new Error(`HTTP ${response.status}`);
              error.status = response.status;
              const body = await response.json().catch(() => ({}));
              error.automationLimit = body?.code === 'automation_limit';
              const retry = response.headers.get('Retry-After');
              const seconds = Number(retry);
              error.retryAfterMs = retry ? Math.max(1000, Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now()) : 60000;
              throw error;
            }
            const json = await response.json().catch(() => { throw new Error('Réponse invalide'); });
            const averages = averagesFromSummary(json);
            window.dispatchEvent(new CustomEvent('wm-average-response', {
              detail: { requestId, id, ok: true, title: json.wikipedia_title || null, averages }
            }));
            return;
          } catch (error) {
            lastError = error;
            const retryable = error.message !== 'Réponse invalide' && (!error.status || error.status >= 500);
            if (!retryable || attempt === 3) break;
          } finally { clearTimeout(timer); }
          await new Promise(resolve => setTimeout(resolve, 300 * attempt));
        }
        window.dispatchEvent(new CustomEvent('wm-average-response', {
          detail: {
            requestId, id, ok: false, status: lastError?.status || null,
            automationLimit: Boolean(lastError?.automationLimit), retryAfterMs: lastError?.retryAfterMs || 60000,
            error: lastError?.name === 'AbortError' ? 'Délai dépassé' : String(lastError?.message || 'Erreur réseau')
          }
        }));
      });
      return { averagesFromSummary, cardIdFromSummaryUrl, captureSummaryResponse };
    }
  };
})();
