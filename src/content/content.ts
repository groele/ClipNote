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

  // Watch for dynamic removals by SPA (Next.js hydration, dynamic routing, etc.)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (node === panel.element && !panel.element.isConnected) {
          document.body.appendChild(panel.element);
        }
        if (node === fab.element && !fab.element.isConnected) {
          document.body.appendChild(fab.element);
        }
        if (node === selection.element && !selection.element.isConnected) {
          document.body.appendChild(selection.element);
        }
      });
    });
  });

  // Start observing body mutations
  observer.observe(document.body, { childList: true });

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
    observer.disconnect();
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
