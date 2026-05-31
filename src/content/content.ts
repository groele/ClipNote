import { initFloatingButton, type FloatingButtonHandle } from "./floating-button";
import { initQuickPanel, type QuickPanelHandle } from "./quick-panel";
import { initSelectionCapture } from "./selection-capture";

const INIT_FLAG = "__clipnote_initialized__";

/**
 * Safely check if the Chrome extension context is still valid.
 * After an extension reload/update, all chrome.* APIs throw
 * "Extension context invalidated". We must detect this and bail
 * gracefully instead of leaving broken observers running.
 */
function isExtensionContextValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function main() {
  // Skip iframes — only run in the top-level window
  try {
    if (window !== window.top) return;
  } catch {
    // Cross-origin iframe — window.top access throws. Skip.
    return;
  }

  // If we already initialized on this exact window context, return
  if ((window as any)[INIT_FLAG]) return;
  (window as any)[INIT_FLAG] = true;

  // Verify extension context is alive before proceeding
  if (!isExtensionContextValid()) {
    delete (window as any)[INIT_FLAG];
    return;
  }

  // Clean up any stale elements from previous installations/injections
  const staleElements = document.querySelectorAll(
    "clipnote-fab-host, clipnote-panel-host, clipnote-selection-host"
  );
  staleElements.forEach((el) => {
    try {
      el.remove();
    } catch (e) {
      console.warn("ClipNote: Failed to remove stale element:", e);
    }
  });

  const panel: QuickPanelHandle = initQuickPanel();
  const fab: FloatingButtonHandle = initFloatingButton(panel);
  const selection = initSelectionCapture();

  // Collect host elements for easy iteration
  const hostElements = [panel.element, fab.element, selection.element];

  let currentBody = document.body;
  let bodyObserver: MutationObserver | null = null;

  /**
   * Ensure all three host elements are attached to the current document.body.
   * Safe to call repeatedly — only appends if not already connected.
   */
  function ensureHostsAttached() {
    const target = document.body;
    if (!target) return;
    for (const el of hostElements) {
      if (!el.isConnected) {
        target.appendChild(el);
      }
    }
  }

  /**
   * Set up a MutationObserver on the active document.body.
   * If any of our host elements get removed (e.g. React hydration,
   * SPA client-side route cleanup), re-append them immediately.
   */
  function setupBodyObserver() {
    if (bodyObserver) {
      bodyObserver.disconnect();
    }

    bodyObserver = new MutationObserver((mutations) => {
      // Check extension context on each mutation batch
      if (!isExtensionContextValid()) {
        cleanup();
        return;
      }

      let needsReattach = false;
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (hostElements.includes(node as HTMLElement)) {
            needsReattach = true;
            break;
          }
        }
        if (needsReattach) break;
      }

      if (needsReattach) {
        ensureHostsAttached();
      }
    });

    const target = document.body;
    if (target) {
      bodyObserver.observe(target, { childList: true });
    }
  }

  // Initial attachment
  ensureHostsAttached();
  setupBodyObserver();

  /**
   * Parent-level observer on <html> to detect whole-body swaps.
   * SPAs like GitHub (Turbo/pjax) and YouTube replace the entire
   * <body> element during navigation. This observer detects that,
   * migrates the bodyObserver to the new body, and re-injects hosts.
   *
   * Observing documentElement with { childList: true } only (no subtree)
   * fires exclusively when <head> or <body> are added/removed — zero CPU cost.
   */
  const htmlObserver = new MutationObserver((mutations) => {
    if (!isExtensionContextValid()) {
      cleanup();
      return;
    }

    let bodyChanged = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === "BODY") {
          bodyChanged = true;
          break;
        }
      }
      if (bodyChanged) break;
    }

    if (bodyChanged && document.body && document.body !== currentBody) {
      currentBody = document.body;
      ensureHostsAttached();
      setupBodyObserver();
    }
  });

  htmlObserver.observe(document.documentElement, { childList: true });

  // Listen for messages from the service worker
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (!isExtensionContextValid()) return;
      if (message.type === "OPEN_PANEL") {
        panel.open();
      }
      if (message.type === "CLIP_SAVED") {
        panel.refresh();
      }
    });
  } catch {
    // Extension context invalidated during setup
  }

  // Detect extension context invalidation via port disconnect
  try {
    chrome.runtime.onConnect.addListener((port) => {
      port.onDisconnect.addListener(() => {
        cleanup();
      });
    });
  } catch {
    // Extension context invalidated during setup
  }

  function cleanup() {
    htmlObserver.disconnect();
    if (bodyObserver) {
      bodyObserver.disconnect();
      bodyObserver = null;
    }
    selection.destroy();
    fab.destroy();
    panel.element.remove();
    delete (window as any)[INIT_FLAG];
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", main);
} else {
  main();
}
