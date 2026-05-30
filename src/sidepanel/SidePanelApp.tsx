import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Note, AppSettings } from "../shared/types";
import { SearchBar } from "./SearchBar";
import { NoteList } from "./NoteList";
import { MarkdownEditor } from "./MarkdownEditor";

type ActiveView = "list" | "editor" | "settings";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  autoTag: true,
  maxQuickClips: 20,
  iconColor: "indigo",
};

export function SidePanelApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("list");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    const filename = settings.iconColor === "indigo" ? "icon.svg" : `icon-${settings.iconColor}.svg`;
    chrome.action.setIcon({
      path: {
        "16": `icons/${filename}`,
        "48": `icons/${filename}`,
        "128": `icons/${filename}`
      }
    }).catch(e => console.error("Failed to set toolbar icon:", e));
  }, [settings.iconColor]);

  useEffect(() => {
    chrome.storage.local.get(["notes", "settings"]).then((data) => {
      if (data.notes) setNotes(data.notes);
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    });
  }, []);

  useEffect(() => {
    function handleMessage(msg: any) {
      if (msg.type === "CLIP_SAVED" || msg.type === "SAVE_CLIP") {
        chrome.storage.local.get("notes").then((data) => {
          if (data.notes) setNotes(data.notes);
        });
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.plainText.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, searchQuery]);

  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setActiveView("editor");
  }, []);

  const handleNoteChange = useCallback((updated: Note) => {
    setSelectedNote(updated);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const handleDeleteNote = useCallback(
    (id: string) => {
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      chrome.storage.local.set({ notes: next });
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setActiveView("list");
      }
    },
    [notes, selectedNote]
  );

  const handleToggleFavorite = useCallback(
    (id: string) => {
      const next = notes.map((n) =>
        n.id === id
          ? { ...n, status: (n.status === "favorite" ? "inbox" : "favorite") as Note["status"], updatedAt: Date.now() }
          : n
      );
      setNotes(next);
      chrome.storage.local.set({ notes: next });
      if (selectedNote?.id === id) {
        setSelectedNote(next.find((n) => n.id === id) || null);
      }
    },
    [notes, selectedNote]
  );

  const handleArchive = useCallback(
    (id: string) => {
      const next = notes.map((n) =>
        n.id === id
          ? { ...n, status: (n.status === "archived" ? "inbox" : "archived") as Note["status"], updatedAt: Date.now() }
          : n
      );
      setNotes(next);
      chrome.storage.local.set({ notes: next });
      if (selectedNote?.id === id) {
        setSelectedNote(next.find((n) => n.id === id) || null);
      }
    },
    [notes, selectedNote]
  );

  const handleSettingsChange = useCallback(
    (updates: Partial<AppSettings>) => {
      const next = { ...settings, ...updates };
      setSettings(next);
      chrome.storage.local.set({ settings: next });
    },
    [settings]
  );

  const handleFabIconUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large! Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleSettingsChange({ customFabIcon: dataUrl });
    };
    reader.readAsDataURL(file);
  }, [handleSettingsChange]);

  const handleNewNote = useCallback(() => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      markdown: "",
      plainText: "",
      tags: [],
      status: "inbox",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [note, ...notes];
    setNotes(next);
    chrome.storage.local.set({ notes: next });
    setSelectedNote(note);
    setActiveView("editor");
  }, [notes]);

  return (
    <>
      <header className="topbar">
        <span className="topbar-title">ClipNote</span>
        <div className="topbar-actions">
          <button
            className={`topbar-btn${activeView === "list" ? " active" : ""}`}
            onClick={() => setActiveView("list")}
            title="Notes"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </button>
          <button className="topbar-btn" onClick={handleNewNote} title="New note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            className={`topbar-btn${sidebarCollapsed ? "" : " active"}`}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
          <button
            className={`topbar-btn${activeView === "settings" ? " active" : ""}`}
            onClick={() => setActiveView(activeView === "settings" ? "list" : "settings")}
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="main-layout">
        <aside className={`sidebar${sidebarCollapsed ? " collapsed" : ""}`}>
          <div className="sidebar-header">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
          </div>
          <NoteList
            notes={filteredNotes}
            selectedId={selectedNote?.id}
            onSelect={handleSelectNote}
            onDelete={handleDeleteNote}
            onToggleFavorite={handleToggleFavorite}
            onArchive={handleArchive}
          />
        </aside>

        <main className="content-area">
          {activeView === "settings" ? (
            <div className="settings-view fade-in">
              <div className="settings-section">
                <div className="settings-section-title">Appearance</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Theme</div>
                    <div className="settings-description">Choose your preferred color scheme</div>
                  </div>
                  <select
                    className="settings-select"
                    value={settings.theme}
                    onChange={(e) => handleSettingsChange({ theme: e.target.value as AppSettings["theme"] })}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">System</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Toolbar Icon Color</div>
                    <div className="settings-description">Customize the extension logo color</div>
                  </div>
                  <select
                    className="settings-select"
                    value={settings.iconColor || "indigo"}
                    onChange={(e) => handleSettingsChange({ iconColor: e.target.value as AppSettings["iconColor"] })}
                  >
                    <option value="indigo">Indigo (Default)</option>
                    <option value="blue">Blue (Ocean)</option>
                    <option value="green">Green (Emerald)</option>
                    <option value="rose">Rose (Crimson)</option>
                    <option value="amber">Amber (Sunset)</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Custom Floating Button (FAB) Icon</div>
                    <div className="settings-description">Upload your own SVG, PNG, or animated GIF for the FAB!</div>
                  </div>
                  <div className="settings-file-upload-wrapper">
                    {settings.customFabIcon ? (
                      <div className="settings-file-preview-container">
                        <img className="settings-file-preview" src={settings.customFabIcon} alt="Custom FAB Icon" />
                        <button className="settings-file-remove-btn" onClick={() => handleSettingsChange({ customFabIcon: undefined })}>Remove</button>
                      </div>
                    ) : (
                      <label className="settings-file-upload-label">
                        Upload Icon/GIF
                        <input
                          type="file"
                          accept="image/*"
                          className="settings-file-input"
                          onChange={handleFabIconUpload}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
              <div className="settings-section">
                <div className="settings-section-title">Behavior</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Auto-tag</div>
                    <div className="settings-description">Automatically suggest tags for new notes</div>
                  </div>
                  <div
                    className={`settings-toggle${settings.autoTag ? " active" : ""}`}
                    onClick={() => handleSettingsChange({ autoTag: !settings.autoTag })}
                    role="switch"
                    aria-checked={settings.autoTag}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Max quick clips</div>
                    <div className="settings-description">Number of recent clips to keep</div>
                  </div>
                  <select
                    className="settings-select"
                    value={settings.maxQuickClips}
                    onChange={(e) => handleSettingsChange({ maxQuickClips: Number(e.target.value) })}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>
            </div>
          ) : selectedNote ? (
            <MarkdownEditor key={selectedNote.id} note={selectedNote} onChange={handleNoteChange} />
          ) : (
            <div className="empty-content fade-in">
              <div className="empty-content-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div className="empty-content-title">Select a note</div>
              <div className="empty-content-desc">Choose a note from the list or create a new one</div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
