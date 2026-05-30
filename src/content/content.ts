import { initFloatingButton, type FloatingButtonHandle } from "./floating-button";
import { initQuickPanel, type QuickPanelHandle } from "./quick-panel";
import { initSelectionCapture } from "./selection-capture";

const INIT_FLAG = "__clipnote_initialized__";

function main() {
  // If we already initialized on this exact window context, return
  if ((window as any)[INIT_FLAG]) return;
  (window as any)[INIT_FLAG] = true;

  // Clean up any stale elements from previous installations/injections
  const staleElements = document.querySelectorAll(
    "clipnote-fab-host, clipnote-panel-host, clipnote-selection-host"
  );
  staleElements.forEach((el) => {
    try {
      el.remove();
    } catch (e) {
      console.warn("Failed to remove stale element:", e);
    }
  });

  const panel: QuickPanelHandle = initQuickPanel();
  const fab: FloatingButtonHandle = initFloatingButton(panel);
  const selection = initSelectionCapture();

  let currentBody = document.body;
  let bodyObserver: MutationObserver | null = null;

  function setupBodyObserver() {
    if (bodyObserver) {
      bodyObserver.disconnect();
    }

    bodyObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === panel.element && !panel.element.isConnected) {
            document.body?.appendChild(panel.element);
          }
          if (node === fab.element && !fab.element.isConnected) {
            document.body?.appendChild(fab.element);
          }
          if (node === selection.element && !selection.element.isConnected) {
            document.body?.appendChild(selection.element);
          }
        });
      });
    });

    if (document.body) {
      bodyObserver.observe(document.body, { childList: true });
    }
  }

  // Inject host elements and setup initial body observer if body is ready
  if (document.body) {
    if (!panel.element.isConnected) document.body.appendChild(panel.element);
    if (!fab.element.isConnected) document.body.appendChild(fab.element);
    if (!selection.element.isConnected) document.body.appendChild(selection.element);
    setupBodyObserver();
  }

  // Parent observer to handle SPA whole-body swaps (like Turbo/pjax on GitHub, YouTube, etc.)
  // and handle late body creation if body is initially missing
  const htmlObserver = new MutationObserver((mutations) => {
    let bodySwappedOrAdded = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === "BODY") {
          bodySwappedOrAdded = true;
        }
      });
    });

    if (bodySwappedOrAdded && document.body && document.body !== currentBody) {
      currentBody = document.body;

      // Re-append hosts to the new/added body
      if (!panel.element.isConnected) document.body.appendChild(panel.element);
      if (!fab.element.isConnected) document.body.appendChild(fab.element);
      if (!selection.element.isConnected) document.body.appendChild(selection.element);

      setupBodyObserver();
    }
  });

  htmlObserver.observe(document.documentElement, { childList: true });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "OPEN_PANEL") {
      panel.open();
    }
    if (message.type === "CLIP_SAVED") {
      panel.refresh();
    }
  });

  chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
      cleanup();
    });
  });

  function cleanup() {
    htmlObserver.disconnect();
    if (bodyObserver) {
      bodyObserver.disconnect();
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

