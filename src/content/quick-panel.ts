import { MessageType, sendMessage } from "../shared/message-bus";
import contentStyles from "./content.css?inline";

interface Clip {
  id: string;
  text: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface QuickPanelHandle {
  element: HTMLElement;
  open: (fabRect?: DOMRect) => void;
  close: () => void;
  toggle: (fabRect?: DOMRect) => void;
  refresh: () => void;
  isOpen: () => boolean;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function isSensitive(text: string): boolean {
  // Common sensitive labels
  const labelRegex = /(password|pwd|passwd|secret|key|token|auth|pin|credentials|密码|帐户|密钥)\s*[:：=]\s*/i;
  if (labelRegex.test(text)) return true;

  // Private Keys
  if (/-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----/i.test(text)) return true;

  // API Keys
  if (/(sk-[a-zA-Z0-9]{20,})|(sk_live_[0-9a-zA-Z]{20,})|(AIzaSy[A-Za-z0-9_-]{33})/i.test(text)) return true;

  // Credit Card Numbers
  const ccRegex = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11})\b/;
  if (ccRegex.test(text)) return true;

  // Heuristic: a single word without spaces that is 16+ chars containing letters, numbers, and symbols (likely a secret token)
  const words = text.trim().split(/\s+/);
  if (words.length === 1 && words[0].length >= 16) {
    if (/\d/.test(words[0]) && (/[a-zA-Z]/.test(words[0]) || /[^a-zA-Z0-9]/.test(words[0]))) {
      return true;
    }
  }

  return false;
}

export function initQuickPanel(): QuickPanelHandle {
  const host = document.createElement("clipnote-panel-host");
  host.classList.add("clipnote-panel-host");

  const shadow = host.attachShadow({ mode: "closed" });

  const root = document.createElement("div");
  root.classList.add("clipnote-extension-root");
  root.setAttribute("data-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const styleEl = document.createElement("style");
  styleEl.textContent = contentStyles;

  const panel = document.createElement("div");
  panel.classList.add("clipnote-panel");

  // Header
  const header = document.createElement("div");
  header.classList.add("clipnote-panel__header");

  const title = document.createElement("h2");
  title.classList.add("clipnote-panel__title");
  title.textContent = "ClipNote Quick Notes";

  // Search Input Container (slides in dynamically)
  const searchContainer = document.createElement("div");
  searchContainer.classList.add("clipnote-panel__search-container");

  const searchInput = document.createElement("input");
  searchInput.classList.add("clipnote-panel__search-input");
  searchInput.placeholder = "Search quick notes...";
  searchInput.type = "text";
  searchContainer.appendChild(searchInput);

  // Header Actions Wrapper
  const headerActions = document.createElement("div");
  headerActions.classList.add("clipnote-panel__header-actions");

  const searchBtn = document.createElement("button");
  searchBtn.classList.add("clipnote-panel__search-btn");
  searchBtn.title = "Search notes";
  searchBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="M21 21l-4.35-4.35"></path>
  </svg>`;

  const closeBtn = document.createElement("button");
  closeBtn.classList.add("clipnote-panel__close");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => close());

  headerActions.appendChild(searchBtn);
  headerActions.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(searchContainer);
  header.appendChild(headerActions);

  // Search & Security State
  let isSearching = false;
  let currentSearchQuery = "";
  const revealedClipIds = new Set<string>();
  let allClips: Clip[] = [];

  searchBtn.addEventListener("click", () => {
    isSearching = !isSearching;
    if (isSearching) {
      header.classList.add("clipnote-panel__header--searching");
      setTimeout(() => searchInput.focus(), 150);
    } else {
      header.classList.remove("clipnote-panel__header--searching");
      searchInput.value = "";
      currentSearchQuery = "";
      loadClips();
    }
  });

  searchInput.addEventListener("input", () => {
    currentSearchQuery = searchInput.value;
    loadClips();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      isSearching = false;
      header.classList.remove("clipnote-panel__header--searching");
      searchInput.value = "";
      currentSearchQuery = "";
      loadClips();
    }
  });

  // List
  const list = document.createElement("div");
  list.classList.add("clipnote-panel__list");

  // Input area
  const inputArea = document.createElement("div");
  inputArea.classList.add("clipnote-input-area");

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Write a quick note...";
  textarea.rows = 1;

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + "px";
  });

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  });

  const sendBtn = document.createElement("button");
  sendBtn.classList.add("clipnote-send");
  sendBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" fill="currentColor"/>
  </svg>`;
  sendBtn.addEventListener("click", handleSave);

  inputArea.appendChild(textarea);
  inputArea.appendChild(sendBtn);

  panel.appendChild(header);
  panel.appendChild(list);
  panel.appendChild(inputArea);

  root.appendChild(panel);
  shadow.appendChild(styleEl);
  shadow.appendChild(root);
  document.body.appendChild(host);

  // Dragging support for ClipNote Quick Notes panel (using header)
  let isPanelDragging = false;
  let panelStartX = 0;
  let panelStartY = 0;
  let panelLeft = 0;
  let panelTop = 0;

  header.style.cursor = "move";
  header.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement;
    // Only drag on left click and not on the close button or search button/input/container
    if (
      e.button !== 0 ||
      target.tagName === "INPUT" ||
      target.tagName === "BUTTON" ||
      target.closest("button") ||
      target.closest("input") ||
      target.classList.contains("clipnote-panel__search-container") ||
      target.closest(".clipnote-panel__search-container")
    ) return;

    isPanelDragging = true;
    panelStartX = e.clientX;
    panelStartY = e.clientY;

    const rect = panel.getBoundingClientRect();
    panelLeft = rect.left;
    panelTop = rect.top;

    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanelDragging) return;

    const dx = e.clientX - panelStartX;
    const dy = e.clientY - panelStartY;

    let newLeft = panelLeft + dx;
    let newTop = panelTop + dy;

    // Bounds check to keep panel fully visible
    const pad = 10;
    const panelWidth = 360;
    const panelHeight = 480;
    const maxLeft = window.innerWidth - panelWidth - pad;
    const maxTop = window.innerHeight - panelHeight - pad;
    newLeft = Math.max(pad, Math.min(newLeft, maxLeft));
    newTop = Math.max(pad, Math.min(newTop, maxTop));

    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  });

  window.addEventListener("mouseup", async () => {
    if (!isPanelDragging) return;
    isPanelDragging = false;

    // Save panel position
    const rect = panel.getBoundingClientRect();
    await chrome.storage.local.set({
      panelPosition: { left: rect.left, top: rect.top }
    });
  });

  async function handleSave() {
    const text = textarea.value.trim();
    if (!text) return;
    await saveClip(text);
    textarea.value = "";
    textarea.style.height = "auto";
  }

  async function loadClips(forceFetchFromStorage = false): Promise<void> {
    if (forceFetchFromStorage || allClips.length === 0) {
      const result = await chrome.storage.local.get("clips");
      allClips = result.clips ?? [];
    }
    let clips = allClips;
    if (currentSearchQuery.trim() !== "") {
      const query = currentSearchQuery.toLowerCase();
      clips = clips.filter((clip) => clip.text.toLowerCase().includes(query));
    }
    renderClips(clips);
  }

  async function saveClip(text: string): Promise<void> {
    try {
      await sendMessage(MessageType.SAVE_CLIP, {
        text,
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
      });
      refresh();
    } catch (e) {
      console.error("Failed to save clip via MessageBus:", e);
    }
  }

  async function deleteClip(id: string): Promise<void> {
    const result = await chrome.storage.local.get("clips");
    const clips: Clip[] = result.clips ?? [];
    const filtered = clips.filter((c) => c.id !== id);
    await chrome.storage.local.set({ clips: filtered });
    allClips = filtered;
    loadClips(false);
  }

  function showToast(message: string, container: HTMLElement) {
    const existing = container.querySelector(".clipnote-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.classList.add("clipnote-toast");
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("clipnote-toast--visible");
    });

    setTimeout(() => {
      toast.classList.remove("clipnote-toast--visible");
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  function renderClips(clips: Clip[]) {
    list.innerHTML = "";

    if (clips.length === 0) {
      const empty = document.createElement("div");
      empty.classList.add("clipnote-empty");
      empty.textContent = "No clips yet. Select text and right-click to save.";
      list.appendChild(empty);
      return;
    }

    for (const clip of clips) {
      const item = document.createElement("div");
      item.classList.add("clipnote-note");

      const textEl = document.createElement("p");
      textEl.classList.add("clipnote-note__text");

      const sensitive = isSensitive(clip.text);
      const isRevealed = revealedClipIds.has(clip.id);

      if (sensitive && !isRevealed) {
        textEl.textContent = "••••••••••••";
        textEl.classList.add("clipnote-note__text--masked");
      } else {
        textEl.textContent = truncate(clip.text, 150);
      }

      const meta = document.createElement("div");
      meta.classList.add("clipnote-note__meta");

      const domain = document.createElement("span");
      domain.classList.add("clipnote-note__domain");
      domain.textContent = getDomain(clip.url);
      domain.title = clip.url;

      const time = document.createElement("span");
      time.classList.add("clipnote-note__time");
      time.textContent = relativeTime(clip.timestamp);

      // Eye Reveal Button for Sensitive Content
      let revealBtn: HTMLButtonElement | null = null;
      if (sensitive) {
        revealBtn = document.createElement("button");
        revealBtn.classList.add("clipnote-note__reveal-btn");
        revealBtn.title = isRevealed ? "Mask sensitive data" : "Reveal sensitive data";
        
        if (isRevealed) {
          revealBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>`;
        } else {
          revealBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <path d="M1 1L23 23"></path>
          </svg>`;
        }

        revealBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (isRevealed) {
            revealedClipIds.delete(clip.id);
          } else {
            revealedClipIds.add(clip.id);
          }
          renderClips(clips);
        });
      }

      const del = document.createElement("button");
      del.classList.add("clipnote-note__delete");
      del.title = "Delete note";
      del.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteClip(clip.id);
      });

      item.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(clip.text);
          showToast("Copied to clipboard!", root);
        } catch (err) {
          console.error("Clipboard copy failed:", err);
        }
      });

      meta.appendChild(domain);
      meta.appendChild(time);
      item.appendChild(textEl);
      item.appendChild(meta);
      if (revealBtn) {
        item.appendChild(revealBtn);
      }
      item.appendChild(del);
      list.appendChild(item);
    }
  }

  function positionPanel(fabRect: DOMRect) {
    const pad = 20;
    const panelWidth = 360;
    const panelHeight = 480;

    let left = fabRect.right - panelWidth;
    let top = fabRect.top - panelHeight - 15;

    // Horizontal alignment based on FAB position
    if (fabRect.left < window.innerWidth / 2) {
      left = fabRect.left;
    } else {
      left = fabRect.right - panelWidth;
    }

    // Vertical alignment based on FAB position
    if (fabRect.top > window.innerHeight / 2) {
      top = fabRect.top - panelHeight - 15;
    } else {
      top = fabRect.bottom + 15;
    }

    // Boundary checks to keep it fully visible inside the viewport
    left = Math.min(Math.max(pad, left), window.innerWidth - panelWidth - pad);
    top = Math.min(Math.max(pad, top), window.innerHeight - panelHeight - pad);

    panel.style.bottom = "auto";
    panel.style.right = "auto";
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  async function open(fabRect?: DOMRect) {
    // Reset search state on every open Safely
    isSearching = false;
    currentSearchQuery = "";
    if (searchInput) searchInput.value = "";
    if (header) header.classList.remove("clipnote-panel__header--searching");

    panel.classList.add("clipnote-panel--open");
    
    const data = await chrome.storage.local.get("panelPosition");
    if (data.panelPosition) {
      const { left, top } = data.panelPosition;
      panel.style.bottom = "auto";
      panel.style.right = "auto";
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    } else if (fabRect) {
      positionPanel(fabRect);
    } else {
      panel.style.left = "auto";
      panel.style.top = "auto";
      panel.style.right = "20px";
      panel.style.bottom = "80px";
    }
    loadClips(true);
  }

  function close() {
    panel.classList.remove("clipnote-panel--open");
  }

  function isOpen() {
    return panel.classList.contains("clipnote-panel--open");
  }

  function toggle(fabRect?: DOMRect) {
    if (isOpen()) {
      close();
    } else {
      open(fabRect);
    }
  }

  function refresh() {
    loadClips(true);
  }

  return { element: host, open, close, toggle, refresh, isOpen };
}
