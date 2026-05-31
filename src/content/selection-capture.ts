import { MessageType, sendMessage } from "../shared/message-bus";
import contentStyles from "./content.css?inline";

interface SelectionCaptureHandle {
  element: HTMLElement;
  destroy: () => void;
}

function showToast(message: string, root: HTMLElement) {
  const existing = root.querySelector(".clipnote-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.classList.add("clipnote-toast");
  toast.textContent = message;
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("clipnote-toast--visible");
  });

  setTimeout(() => {
    toast.classList.remove("clipnote-toast--visible");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

interface DeepSelection {
  text: string;
  rect: DOMRect | null;
}

function getDeepSelection(e: MouseEvent): DeepSelection {
  // 1. Try standard Selection in light DOM first
  const sel = window.getSelection();
  if (sel && sel.toString().trim()) {
    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { text: sel.toString().trim(), rect };
      }
    } catch {}
  }

  // 2. Penetrate Shadow DOMs recursively
  let activeEl = document.activeElement;
  while (activeEl && activeEl.shadowRoot) {
    const shadowRoot = activeEl.shadowRoot;
    
    // Try shadowRoot selection if supported
    const shadowSel = (shadowRoot as any).getSelection ? (shadowRoot as any).getSelection() : null;
    if (shadowSel && shadowSel.toString().trim()) {
      try {
        const range = shadowSel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { text: shadowSel.toString().trim(), rect };
        }
      } catch {}
    }

    // Check if deep element is input/textarea inside shadow root
    const deepActiveEl = shadowRoot.activeElement;
    if (
      deepActiveEl instanceof HTMLInputElement ||
      deepActiveEl instanceof HTMLTextAreaElement
    ) {
      const text = deepActiveEl.value.substring(
        deepActiveEl.selectionStart || 0,
        deepActiveEl.selectionEnd || 0
      ).trim();
      
      if (text) {
        const mouseRect = new DOMRect(e.clientX - 50, e.clientY - 20, 100, 20);
        return { text, rect: mouseRect };
      }
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
    const text = activeElLight.value.substring(
      activeElLight.selectionStart || 0,
      activeElLight.selectionEnd || 0
    ).trim();
    if (text) {
      const mouseRect = new DOMRect(e.clientX - 50, e.clientY - 20, 100, 20);
      return { text, rect: mouseRect };
    }
  }

  return { text: "", rect: null };
}

export function initSelectionCapture(): SelectionCaptureHandle {
  const host = document.createElement("clipnote-selection-host");
  host.classList.add("clipnote-selection-host");

  const shadow = host.attachShadow({ mode: "closed" });

  const root = document.createElement("div");
  root.classList.add("clipnote-extension-root");
  root.setAttribute("data-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const styleEl = document.createElement("style");
  styleEl.textContent = contentStyles;

  const saveBtn = document.createElement("button");
  saveBtn.classList.add("clipnote-selection-btn");
  saveBtn.textContent = "Save to ClipNote";

  root.appendChild(saveBtn);
  shadow.appendChild(styleEl);
  shadow.appendChild(root);

  let currentSettings: any = {};
  let lastCapturedText = "";

  chrome.storage.local.get("settings").then((data) => {
    if (data.settings) {
      currentSettings = data.settings;
    }
  }).catch(() => {});

  const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === "local" && changes.settings) {
      currentSettings = changes.settings.newValue || {};
      if (currentSettings.showSelectionCapture === false) {
        hideButton();
      }
    }
  };
  chrome.storage.onChanged.addListener(storageListener);

  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  function positionButton(x: number, y: number) {
    const btnRect = saveBtn.getBoundingClientRect();
    const pad = 10;
    const left = Math.min(Math.max(x, pad), window.innerWidth - btnRect.width - pad);
    const top = Math.max(y - btnRect.height - pad, pad);
    saveBtn.style.left = `${left}px`;
    saveBtn.style.top = `${top}px`;
  }

  function showButton(x: number, y: number, text: string) {
    lastCapturedText = text;
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    positionButton(x, y);
    saveBtn.classList.add("clipnote-selection-btn--visible");
  }

  function hideButton() {
    saveBtn.classList.remove("clipnote-selection-btn--visible");
    lastCapturedText = "";
  }

  function handleMouseUp(e: MouseEvent) {
    // Ignore clicks on our own UI
    if (host.contains(e.target as Node)) return;

    // Skip if selection capture is disabled
    if (currentSettings.showSelectionCapture === false) {
      hideButton();
      return;
    }

    // Let mouseup finish so selection state is fully populated inside DOM
    setTimeout(() => {
      const { text, rect } = getDeepSelection(e);

      if (text && rect) {
        showButton(
          rect.left + rect.width / 2 - saveBtn.offsetWidth / 2,
          rect.top,
          text
        );
      } else {
        hideButton();
      }
    }, 0);
  }

  function handleMouseDown(e: MouseEvent) {
    if (!host.contains(e.target as Node)) {
      hideButton();
    }
  }

  async function handleSaveClick() {
    const text = lastCapturedText.trim();
    if (!text) return;

    try {
      await sendMessage(MessageType.SAVE_CLIP, {
        text,
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
      });
    } catch {
      // Service worker may be inactive
    }

    // Clear ranges in light DOM
    window.getSelection()?.removeAllRanges();

    // Clear ranges inside active shadow root
    let activeEl = document.activeElement;
    while (activeEl && activeEl.shadowRoot) {
      const shadowSel = (activeEl.shadowRoot as any).getSelection ? (activeEl.shadowRoot as any).getSelection() : null;
      if (shadowSel) {
        shadowSel.removeAllRanges();
      }
      activeEl = activeEl.shadowRoot.activeElement;
    }

    hideButton();
    showToast("Saved!", root);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      hideButton();
    }
  }

  saveBtn.addEventListener("click", handleSaveClick);
  document.addEventListener("mouseup", handleMouseUp, true);
  document.addEventListener("mousedown", handleMouseDown, true);
  document.addEventListener("keydown", handleKeyDown, true);

  function destroy() {
    chrome.storage.onChanged.removeListener(storageListener);
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("mousedown", handleMouseDown, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    if (hideTimeout) clearTimeout(hideTimeout);
    host.remove();
  }

  return { element: host, destroy };
}
