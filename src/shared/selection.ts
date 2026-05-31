export interface DeepSelection {
  text: string;
  rect: DOMRect | null;
}

/**
 * Gets the selected text across the main DOM, inputs, textareas, and deep Shadow DOMs,
 * fully preserving carriage returns, spacing, and formatting.
 */
export function getDeepSelectionText(): string {
  // 1. Try standard Selection in light DOM first
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) {
    return sel.toString();
  }

  // 2. Penetrate Shadow DOMs recursively
  let activeEl = document.activeElement;
  while (activeEl && activeEl.shadowRoot) {
    const shadowRoot = activeEl.shadowRoot;
    
    // Try shadowRoot selection if supported by browser
    const shadowSel = (shadowRoot as any).getSelection ? (shadowRoot as any).getSelection() : null;
    if (shadowSel && shadowSel.toString().trim()) {
      return shadowSel.toString();
    }

    // Check if deep element is input/textarea inside shadow root
    const deepActiveEl = shadowRoot.activeElement;
    if (
      deepActiveEl instanceof HTMLInputElement ||
      deepActiveEl instanceof HTMLTextAreaElement
    ) {
      return deepActiveEl.value.substring(
        deepActiveEl.selectionStart || 0,
        deepActiveEl.selectionEnd || 0
      );
    }
    
    if (deepActiveEl === activeEl) break;
    activeEl = deepActiveEl;
  }

  // 3. Fallback for standard light DOM input/textarea
  const activeElLight = document.activeElement;
  if (
    activeElLight instanceof HTMLInputElement ||
    activeElLight instanceof HTMLTextAreaElement
  ) {
    return activeElLight.value.substring(
      activeElLight.selectionStart || 0,
      activeElLight.selectionEnd || 0
    );
  }

  return "";
}

/**
 * Captures both the text selection and its corresponding viewport layout rectangle.
 */
export function getDeepSelection(e?: MouseEvent): DeepSelection {
  const text = getDeepSelectionText().trim();
  if (!text) return { text: "", rect: null };

  // Try to get bounding rect from light DOM selection
  try {
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { text, rect };
      }
    }
  } catch {}

  // Try to get bounding rect from shadow selection
  let activeEl = document.activeElement;
  while (activeEl && activeEl.shadowRoot) {
    const shadowRoot = activeEl.shadowRoot;
    const shadowSel = (shadowRoot as any).getSelection ? (shadowRoot as any).getSelection() : null;
    if (shadowSel && shadowSel.toString().trim()) {
      try {
        const range = shadowSel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { text, rect };
        }
      } catch {}
    }
    const deepActiveEl = shadowRoot.activeElement;
    if (deepActiveEl === activeEl) break;
    activeEl = deepActiveEl;
  }

  // If we have coordinates from mouseup event, use it as viewport fallback
  if (e) {
    const mouseRect = new DOMRect(e.clientX - 50, e.clientY - 20, 100, 20);
    return { text, rect: mouseRect };
  }

  return { text, rect: null };
}
