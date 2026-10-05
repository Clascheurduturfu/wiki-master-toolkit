(() => {
  const registry = window.__wmBridgeFeatures ||= {};

  registry.bridgePacks = {
    create(runtime) {
      const { originalFetch, MAX_BULK_PACKS, mapPackCards } = runtime.core;
      let running = false;
      function waitForVerification(requestId, openedPacks, cardsCount) {
        return new Promise((resolve, reject) => {
          const done = event => {
            if (event.detail?.requestId !== requestId) return;
            window.removeEventListener('wm-average-pack-verification-result', done);
            event.detail.ok ? resolve() : reject(new Error('Ouverture arrêtée pendant la vérification. Les cartes déjà ouvertes sont conservées.'));
          };
          window.addEventListener('wm-average-pack-verification-result', done);
          window.dispatchEvent(new CustomEvent('wm-average-pack-verification-needed', { detail: { requestId, openedPacks, cardsCount } }));
        });
      }

      async function openAllPacks(requestId) {
        if (running) return;
        running = true;
        const allCards = [];
        let openedPacks = 0;
        let packsRemaining = null;

        try {
          for (let index = 0; index < MAX_BULK_PACKS; index += 1) {
            let json = null;

            while (true) {
              const response = await originalFetch('/api/packs/open', {
                method: 'POST',
                credentials: 'include',
                headers: { accept: '*/*' }
              });

              try {
                json = await response.json();
              } catch (_) {
                json = null;
              }

              const retryAt = Date.parse(json?.retry_after || '');
              // This explicit rejection confirms no pack was opened. Other failed
              // or ambiguous POSTs are never replayed automatically.
              if (!response.ok && json?.human_verification_required === true) {
                await waitForVerification(requestId, openedPacks, allCards.length);
                continue;
              }
              const canRetryRateLimit =
                Boolean(json?.rate_limited) &&
                !json?.rate_limit_daily &&
                Number.isFinite(retryAt);

              if (canRetryRateLimit) {
                packsRemaining = Number(json?.packs_remaining);

                const waitMs = Math.max(250, retryAt - Date.now() + 200);

                window.dispatchEvent(new CustomEvent('wm-average-open-all-packs-progress', {
                  detail: {
                    requestId,
                    openedPacks,
                    cardsCount: allCards.length,
                    packsRemaining: Number.isFinite(packsRemaining) ? packsRemaining : null,
                    waiting: true,
                    retryAfter: json.retry_after,
                    waitMs
                  }
                }));

                await new Promise((resolve) => setTimeout(resolve, waitMs));
                continue;
              }

              if (!response.ok) {
                const message =
                  json?.error ||
                  json?.message ||
                  (json?.rate_limit_daily ? 'Limite quotidienne atteinte.' : null) ||
                  (response.status === 400 ? 'Aucun paquet disponible.' : `HTTP ${response.status}`);
                throw new Error(message);
              }

              break;
            }

            const cards = mapPackCards(json);
            if (!cards.length) {
              throw new Error('Le paquet ouvert ne contient aucune carte.');
            }

            openedPacks += 1;
            allCards.push(...cards);
            packsRemaining = Number(json?.packs_remaining);

            window.dispatchEvent(new CustomEvent('wm-average-open-all-packs-progress', {
              detail: {
                requestId,
                openedPacks,
                cardsCount: allCards.length,
                packsRemaining: Number.isFinite(packsRemaining) ? packsRemaining : null,
                waiting: false,
                cards
              }
            }));

            if (Number.isFinite(packsRemaining) && packsRemaining <= 0) {
              break;
            }

            // Small extra jitter on top of WikiMasters' own pacing/rate-limit delay.
            // This applies to both manual « Tout ouvrir » and automatic opening.
            const extraDelayMs = Math.round(500 + Math.random() * 1500);

            window.dispatchEvent(new CustomEvent('wm-average-open-all-packs-progress', {
              detail: {
                requestId,
                openedPacks,
                cardsCount: allCards.length,
                packsRemaining: Number.isFinite(packsRemaining) ? packsRemaining : null,
                waiting: true,
                extraDelay: true,
                waitMs: extraDelayMs
              }
            }));

            await new Promise((resolve) => setTimeout(resolve, extraDelayMs));
          }

          window.dispatchEvent(new CustomEvent('wm-average-open-all-packs-result', {
            detail: {
              requestId,
              ok: true,
              openedPacks,
              cards: allCards,
              packsRemaining: Number.isFinite(packsRemaining) ? packsRemaining : null
            }
          }));
        } catch (error) {
          window.dispatchEvent(new CustomEvent('wm-average-open-all-packs-result', {
            detail: {
              requestId,
              ok: false,
              openedPacks,
              cards: allCards,
              packsRemaining: Number.isFinite(packsRemaining) ? packsRemaining : null,
              error: String(error?.message || error)
            }
          }));
        } finally { running = false; }
      }


      return { openAllPacks };
    }
  };
})();
