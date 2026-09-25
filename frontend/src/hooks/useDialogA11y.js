import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared dialog accessibility behavior for the repo's hand-rolled modals.
 * - Closes on Escape (bubble phase, so inner handlers such as the mention
 *   popover can consume the key first via stopPropagation).
 * - Traps Tab focus inside the dialog while open.
 * - Locks body scroll (reference-counted so stacked dialogs restore correctly).
 * - Moves focus into the dialog on open and restores it on close.
 *
 * Usage (visual markup and CSS classes stay untouched):
 *   const dialogRef = useDialogA11y(isOpen, onClose);
 *   <div className="modal-container" ref={dialogRef} role="dialog"
 *        aria-modal="true" aria-label="...">…</div>
 */
export function useDialogA11y(isOpen, onClose) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const node = dialogRef.current;
    if (!node) return;
    if (!node.hasAttribute('tabindex')) {
      node.setAttribute('tabindex', '-1');
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const openCount = Number(document.body.dataset.dialogsOpen || 0);
    document.body.dataset.dialogsOpen = String(openCount + 1);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const target = node.querySelector(FOCUSABLE_SELECTOR);
      (target || node).focus();
    }, 0);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      const remaining = Number(document.body.dataset.dialogsOpen || 1) - 1;
      if (remaining <= 0) {
        delete document.body.dataset.dialogsOpen;
        document.body.style.overflow = prevOverflow;
      } else {
        document.body.dataset.dialogsOpen = String(remaining);
      }
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
