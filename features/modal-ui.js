(() => {
  const registry = window.__wmAverageFeatures ||= {};

  registry.modalUi = {
    create() {
      const adopted = new WeakSet();
      let dialogCounter = 0;
      function topOverlay() { return [...document.querySelectorAll('.wm-modal-overlay')].at(-1); }
      function focusables(modal) {
        return [...modal.querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex="0"]')]
          .filter(node => !node.disabled && !node.hidden && node.getClientRects().length);
      }
      function closeControl(overlay) {
        return [...overlay.querySelectorAll('button')].find(node => !node.hidden &&
          (/^(Fermer|Annuler|×)/.test(node.textContent.trim()) || node.getAttribute('aria-label') === 'Fermer'));
      }
      function adopt(overlay) {
        if (adopted.has(overlay)) return;
        const modal = overlay.querySelector('.wm-modal, .wm-family-modal, .wm-family-picker-modal'); if (!modal) return;
        overlay.classList.add('wm-modal-overlay'); modal.classList.add('wm-modal');
        modal.querySelectorAll('.wm-family-primary, .wm-family-secondary').forEach(button => {
          button.classList.add('wm-tool-button'); if (button.classList.contains('wm-family-primary')) button.classList.add('wm-primary-button');
        });
        adopted.add(overlay);
        document.body.classList.add('wm-dialog-open');
        document.querySelectorAll('.wm-modal-overlay').forEach((node, index) => { node.style.zIndex = String(2147483000 + index); });
        const previousFocus = document.activeElement;
        modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.tabIndex = -1;
        const title = modal.querySelector('h2, h3');
        if (title) { title.id ||= 'wm-dialog-title-' + (++dialogCounter); modal.setAttribute('aria-labelledby', title.id); }
        // Existing feature handlers used to dismiss on backdrop click. Consume that click
        // before their handlers, including the click emitted after dragging from an input.
        overlay.addEventListener('click', event => {
          if (event.target === overlay) { event.preventDefault(); event.stopImmediatePropagation(); }
        }, true);
        overlay.addEventListener('click', event => event.stopPropagation());
        overlay.addEventListener('pointerdown', event => event.stopPropagation());
        queueMicrotask(() => { if (overlay.isConnected && topOverlay() === overlay) (focusables(modal).find(node => node.tagName === 'INPUT') || closeControl(overlay) || modal).focus({ preventScroll: true }); });
        const cleanup = new MutationObserver(() => {
          if (overlay.isConnected) return;
          cleanup.disconnect();
          if (!topOverlay()) document.body.classList.remove('wm-dialog-open');
          if (!topOverlay() && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
          else if (topOverlay()) topOverlay().querySelector('.wm-modal')?.focus({ preventScroll: true });
        }); cleanup.observe(document.body, { childList: true });
      }
      document.addEventListener('keydown', event => {
        const overlay = topOverlay(); if (!overlay) return;
        if (event.key === 'Escape') {
          event.preventDefault(); event.stopImmediatePropagation();
          const close = closeControl(overlay); if (close && !close.disabled) close.click();
        } else if (event.key === 'Tab') {
          const modal = overlay.querySelector('.wm-modal'), nodes = focusables(modal);
          if (!nodes.length) { event.preventDefault(); modal.focus(); return; }
          const index = nodes.indexOf(document.activeElement);
          if (event.shiftKey && index <= 0) { event.preventDefault(); nodes.at(-1).focus(); }
          else if (!event.shiftKey && (index === nodes.length - 1 || index === -1)) { event.preventDefault(); nodes[0].focus(); }
        }
      }, true);
      function observe() {
        if (!document.body) { document.addEventListener('DOMContentLoaded', observe, { once: true }); return; }
        new MutationObserver(mutations => {
          for (const mutation of mutations) for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.matches('.wm-modal-overlay, .wm-family-modal-overlay')) adopt(node);
            node.querySelectorAll('.wm-modal-overlay, .wm-family-modal-overlay').forEach(adopt);
          }
        }).observe(document.body, { childList: true });
        document.querySelectorAll('.wm-modal-overlay, .wm-family-modal-overlay').forEach(adopt);
      }
      observe();
      function showInfoModal(titleText, message) {
        const overlay = document.createElement('div');
        overlay.className = 'wm-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'wm-modal wm-confirm-modal';

        const title = document.createElement('h2');
        title.textContent = titleText;

        const text = document.createElement('p');
        text.textContent = message;

        const actions = document.createElement('div');
        actions.className = 'wm-modal-actions';

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'wm-tool-button';
        closeButton.textContent = 'Fermer';

        const close = () => overlay.remove();
        closeButton.addEventListener('click', close);
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) close();
        });

        actions.append(closeButton);
        modal.append(title, text, actions);
        overlay.append(modal);
        document.body.append(overlay);
      }

      function showConfirmModal(titleText, message, {
        confirmLabel = 'Confirmer',
        cancelLabel = 'Annuler'
      } = {}) {
        return new Promise((resolve) => {
          const overlay = document.createElement('div');
          overlay.className = 'wm-modal-overlay';

          const modal = document.createElement('div');
          modal.className = 'wm-modal wm-confirm-modal';

          const title = document.createElement('h2');
          title.textContent = titleText;

          const text = document.createElement('p');
          text.textContent = message;

          const actions = document.createElement('div');
          actions.className = 'wm-modal-actions';

          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.className = 'wm-tool-button wm-secondary-button';
          cancel.textContent = cancelLabel;

          const confirm = document.createElement('button');
          confirm.type = 'button';
          confirm.className = 'wm-tool-button wm-danger-button';
          confirm.textContent = confirmLabel;

          const close = (value) => {
            overlay.remove();
            resolve(value);
          };

          cancel.addEventListener('click', () => close(false));
          confirm.addEventListener('click', () => close(true));
          overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close(false);
          });

          actions.append(cancel, confirm);
          modal.append(title, text, actions);
          overlay.append(modal);
          document.body.append(overlay);
        });
      }

      return { showInfoModal, showConfirmModal, adopt };
    }
  };
})();
