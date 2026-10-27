(() => {
  const registry = window.__wmAverageFeatures ||= {};
  registry.packVerification = {
    create() {
      let current = null;

      function show(detail) {
        if (current || typeof detail?.requestId !== 'string') return;

        // Verification belongs to the website. This feature only pauses the
        // batch and offers an explicit resume action; it loads no remote code,
        // handles no challenge tokens and performs no verification requests.
        const notice = document.createElement('aside');
        notice.id = 'wm-pack-verification';
        notice.className = 'wm-verification-notice';
        notice.setAttribute('role', 'region');
        notice.setAttribute('aria-labelledby', 'wm-pack-verification-title');

        const title = document.createElement('h2');
        title.id = 'wm-pack-verification-title';
        title.textContent = 'Vérification sur WikiMasters';
        const intro = document.createElement('p');
        intro.setAttribute('role', 'status');
        intro.textContent = `Lot en pause · ${detail.openedPacks} paquet(s) déjà ouvert(s). Effectue la vérification dans les contrôles du site, puis reprends ici.`;
        const hint = document.createElement('p');
        hint.className = 'wm-muted';
        hint.textContent = 'Si le contrôle n’apparaît pas, utilise le bouton d’ouverture de WikiMasters. Le site peut ouvrir un paquet après validation ; ses cartes restent dans ta collection.';

        const resume = document.createElement('button');
        resume.type = 'button';
        resume.className = 'wm-tool-button';
        resume.textContent = 'Vérification terminée · reprendre';
        resume.dataset.role = 'resume';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'wm-tool-button';
        cancel.textContent = 'Arrêter le lot';
        cancel.dataset.role = 'cancel';
        const actions = document.createElement('div');
        actions.className = 'wm-modal-actions';
        actions.append(resume, cancel);
        notice.append(title, intro, hint, actions);

        const state = current = { requestId: detail.requestId, notice };
        document.body.classList.add('wm-native-verification-active');
        document.body.append(notice);

        function finish(ok) {
          if (current !== state) return;
          current = null;
          notice.remove();
          document.body.classList.remove('wm-native-verification-active');
          // This is user confirmation, not a claim that verification succeeded.
          // WikiMasters checks the next opening and may request verification
          // again. Ambiguous failed openings are still never replayed.
          window.dispatchEvent(new CustomEvent('wm-average-pack-verification-result', {
            detail: { requestId: state.requestId, ok }
          }));
        }

        resume.addEventListener('click', () => finish(true));
        cancel.addEventListener('click', () => finish(false));
      }

      window.addEventListener('wm-average-pack-verification-needed', event => show(event.detail));
      return { isWaiting: () => Boolean(current) };
    }
  };
})();
