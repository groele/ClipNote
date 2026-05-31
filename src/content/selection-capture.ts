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

  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  function positionButton(x: number, y: number) {
    const btnRect = saveBtn.getBoundingClientRect();
    const pad = 10;
    const left = Math.min(Math.max(x, pad), window.innerWidth - btnRect.width - pad);
    const top = Math.max(y - btnRect.height - pad, pad);
    saveBtn.style.left = `${left}px`;
    saveBtn.style.top = `${top}px`;
  }

  function showButton(x: number, y: number) {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    positionButton(x, y);
    saveBtn.classList.add("clipnote-selection-btn--visible");
  }

  function hideButton() {
    saveBtn.classList.remove("clipnote-selection-btn--visible");
  }

  function handleMouseUp(e: MouseEvent) {
    // Ignore clicks on our own UI
    if (host.contains(e.target as Node)) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      const range = selection!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showButton(
        rect.left + rect.width / 2 - saveBtn.offsetWidth / 2,
        rect.top
      );
    } else {
      hideButton();
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (!host.contains(e.target as Node)) {
      hideButton();
    }
  }

  async function handleSaveClick() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
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

    window.getSelection()?.removeAllRanges();
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
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("mousedown", handleMouseDown, true);
    document.removeEventListener("keydown", handleKeyDown, true);
    if (hideTimeout) clearTimeout(hideTimeout);
    host.remove();
  }

  return { element: host, destroy };
}
