const FAB_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 2a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2V4a2 2 0 0 0-2-2H8zm0 2h8v1H8V4zm-4 5h16v10H4V9zm2 3a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1zm0 4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1z"/>
</svg>`;

import type { QuickPanelHandle } from "./quick-panel";
import contentStyles from "./content.css?inline";

export interface FloatingButtonHandle {
  element: HTMLElement;
  toggle: () => void;
  destroy: () => void;
}

export function initFloatingButton(panel: QuickPanelHandle): FloatingButtonHandle {
  const existing = document.querySelector("clipnote-fab-host") as HTMLElement;
  if (existing) {
    return { element: existing, toggle: () => {}, destroy: () => {} };
  }

  const host = document.createElement("clipnote-fab-host");
  host.classList.add("clipnote-fab-host");

  const shadow = host.attachShadow({ mode: "closed" });

  const root = document.createElement("div");
  root.classList.add("clipnote-extension-root");
  root.setAttribute("data-theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  const styleEl = document.createElement("style");
  styleEl.textContent = contentStyles;

  const fab = document.createElement("button");
  fab.classList.add("clipnote-fab", "clipnote-fab--pulse");
  fab.setAttribute("aria-label", "ClipNote - Quick Notes");

  const tooltip = document.createElement("span");
  tooltip.classList.add("clipnote-fab-tooltip");
  tooltip.textContent = "ClipNote - Quick Notes";

  // Set FAB icon dynamically based on settings
  chrome.storage.local.get("settings").then((data) => {
    const settings = data.settings;
    if (settings && settings.customFabIcon) {
      fab.innerHTML = `<img src="${settings.customFabIcon}" class="clipnote-fab-custom-img" style="width: 24px; height: 24px; border-radius: 50%; object-fit: contain; pointer-events: none;" />`;
    } else {
      fab.innerHTML = FAB_SVG;
    }
    fab.appendChild(tooltip);
  }).catch(() => {
    fab.innerHTML = FAB_SVG;
    fab.appendChild(tooltip);
  });

  // Dynamic settings update listener
  const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === "local" && changes.settings) {
      const newSettings = changes.settings.newValue;
      if (newSettings) {
        if (newSettings.customFabIcon) {
          fab.innerHTML = `<img src="${newSettings.customFabIcon}" class="clipnote-fab-custom-img" style="width: 24px; height: 24px; border-radius: 50%; object-fit: contain; pointer-events: none;" />`;
        } else {
          fab.innerHTML = FAB_SVG;
        }
        fab.appendChild(tooltip);
      }
    }
  };
  chrome.storage.onChanged.addListener(storageListener);

  root.appendChild(fab);
  shadow.appendChild(styleEl);
  shadow.appendChild(root);
  document.body.appendChild(host);

  setTimeout(() => {
    fab.classList.remove("clipnote-fab--pulse");
  }, 3000);

  // Proximity Proactive Awareness (Within 150px range of FAB center)
  function handleProximity(e: MouseEvent) {
    if (isDragging) return;
    const rect = fab.getBoundingClientRect();
    const fabCenterX = rect.left + rect.width / 2;
    const fabCenterY = rect.top + rect.height / 2;
    const dx = e.clientX - fabCenterX;
    const dy = e.clientY - fabCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 150) {
      fab.classList.add("clipnote-fab--nearby");
    } else {
      fab.classList.remove("clipnote-fab--nearby");
    }
  }

  document.addEventListener("mousemove", handleProximity, true);

  // Dragging Implementation
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let fabLeft = 0;
  let fabTop = 0;

  // Retrieve saved position if any
  chrome.storage.local.get("fabPosition").then((data) => {
    if (data && data.fabPosition) {
      const { left, top } = data.fabPosition;
      fab.style.bottom = "auto";
      fab.style.right = "auto";
      fab.style.left = `${left}px`;
      fab.style.top = `${top}px`;
    }
  }).catch((err) => {
    console.warn("ClipNote: Failed to load FAB position (extension context might have updated):", err);
  });

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Only left click
    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = fab.getBoundingClientRect();
    fabLeft = rect.left;
    fabTop = rect.top;

    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMoved = true;
    }

    let newLeft = fabLeft + dx;
    let newTop = fabTop + dy;

    // Bounds checking inside viewport
    const padding = 10;
    const maxLeft = window.innerWidth - 48 - padding;
    const maxTop = window.innerHeight - 48 - padding;
    newLeft = Math.max(padding, Math.min(newLeft, maxLeft));
    newTop = Math.max(padding, Math.min(newTop, maxTop));

    fab.style.bottom = "auto";
    fab.style.right = "auto";
    fab.style.left = `${newLeft}px`;
    fab.style.top = `${newTop}px`;
  }

  async function handleMouseUp(e: MouseEvent) {
    if (!isDragging) return;
    isDragging = false;

    if (hasMoved) {
      const rect = fab.getBoundingClientRect();
      await chrome.storage.local.set({
        fabPosition: { left: rect.left, top: rect.top },
        panelPosition: null // Clear panelPosition to snap back to the new FAB position!
      });
    } else {
      // Direct click! Toggle quick panel next to FAB rect
      panel.toggle(fab.getBoundingClientRect());
    }
  }

  fab.addEventListener("mousedown", handleMouseDown);
  window.addEventListener("mousemove", handleMouseMove, true);
  window.addEventListener("mouseup", handleMouseUp, true);

  function toggle() {
    panel.toggle(fab.getBoundingClientRect());
  }

  function destroy() {
    chrome.storage.onChanged.removeListener(storageListener);
    document.removeEventListener("mousemove", handleProximity, true);
    fab.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mousemove", handleMouseMove, true);
    window.removeEventListener("mouseup", handleMouseUp, true);
    host.remove();
  }

  return { element: host, toggle, destroy };
}
