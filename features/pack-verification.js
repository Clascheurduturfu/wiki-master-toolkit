(() => {
  const registry = window.__wmAverageFeatures ||= {};
  registry.packVerification = {
    create(runtime) {
      // Public site key read from WikiMasters' own pack page. Tokens go only to
      // the native same-origin human-check endpoint and are never stored.
      const SITEKEY = '0x4AAAAAAEW_2IAWonrk_N5i';
      let current = null;
      function show(detail) {
        if (current) return;
        const overlay = document.createElement('div'); overlay.className = 'wm-modal-overlay'; overlay.id = 'wm-pack-verification';
        const modal = document.createElement('div'); modal.className = 'wm-modal wm-verification-modal';
        const title = document.createElement('h2'); title.textContent = 'Vérification rapide';
        const intro = document.createElement('p'); intro.textContent = `Ouverture en pause · ${detail.openedPacks} paquet(s) déjà ouvert(s). Termine la vérification pour reprendre la suite.`;
        const host = document.createElement('div'); host.id = 'wm-pack-turnstile';
        const status = document.createElement('p'); status.className = 'wm-activity-status'; status.setAttribute('role', 'status'); status.textContent = 'Chargement de la vérification…';
        const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'wm-tool-button'; retry.textContent = 'Réessayer la vérification'; retry.hidden = true;
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'wm-tool-button'; cancel.textContent = 'Arrêter l’ouverture';
        cancel.setAttribute('aria-label', 'Fermer');
        const actions = document.createElement('div'); actions.className = 'wm-modal-actions'; actions.append(retry, cancel);
        modal.append(title, intro, host, status, actions); overlay.append(modal); document.body.append(overlay);
        const state = current = { requestId: detail.requestId, overlay, widget: null, submitting: false, timer: null };
        function finish(ok) {
          if (current !== state) return;
          clearTimeout(state.timer);
          if (state.widget !== null) { try { window.turnstile?.remove(state.widget); } catch (_) {} }
          overlay.remove(); current = null;
          window.dispatchEvent(new CustomEvent('wm-average-pack-verification-result', { detail: { requestId: detail.requestId, ok } }));
        }
        cancel.addEventListener('click', () => finish(false));
        async function verified(token) {
          if (current !== state || state.submitting) return;
          state.submitting = true; cancel.disabled = true; retry.hidden = true; status.textContent = 'Validation par WikiMasters…';
          try {
            const response = await window.__wmAverageBridgeRuntime.core.originalFetch('/api/human-check', {
              method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }), signal: AbortSignal.timeout(30000)
            });
            if (current !== state) return;
            if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Vérification refusée (${response.status}).`);
            finish(true);
          } catch (error) {
            if (current !== state) return;
            status.textContent = error.message || 'Impossible de valider la vérification.'; retry.hidden = false;
            try { window.turnstile?.reset(state.widget); } catch (_) {}
          } finally { state.submitting = false; cancel.disabled = false; }
        }
        function failed() { status.textContent = 'Vérification expirée ou indisponible. Tu peux réessayer.'; retry.hidden = false; }
        function mount() {
          if (current !== state || state.submitting) return;
          retry.hidden = true;
          if (!window.turnstile?.render) { status.textContent = 'Chargement de la vérification…'; load(); return; }
          try {
            if (state.widget !== null) window.turnstile.remove(state.widget);
            state.widget = window.turnstile.render(host, { sitekey: SITEKEY, theme: 'auto', appearance: 'always', size: 'flexible', callback: verified, 'expired-callback': failed, 'error-callback': failed });
            status.textContent = 'Termine la vérification ci-dessus. L’ouverture reprendra automatiquement.';
          } catch (_) { failed(); }
        }
        function load() {
          let script = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
          if (!script) { script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.append(script); }
          const deadline = Date.now() + 15000;
          function poll() {
            if (current !== state) return;
            if (window.turnstile?.render) { mount(); return; }
            if (Date.now() >= deadline) { failed(); return; }
            state.timer = setTimeout(poll, 200);
          }
          poll();
        }
        retry.addEventListener('click', mount); mount();
      }
      window.addEventListener('wm-average-pack-verification-needed', event => show(event.detail));
      return { isWaiting: () => Boolean(current) };
    }
  };
})();
