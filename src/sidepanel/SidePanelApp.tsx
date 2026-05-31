import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { Note, AppSettings } from "../shared/types";
import { SearchBar } from "./SearchBar";
import { NoteList } from "./NoteList";
import { MarkdownEditor } from "./MarkdownEditor";
import { db } from "../storage/indexeddb";

type ActiveView = "list" | "editor" | "settings";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  autoTag: true,
  maxQuickClips: 20,
  iconColor: "indigo",
  fabOpacity: 35,
  fabSize: 48,
  showSelectionCapture: true,
  showFab: true,
  enablePrivacyMask: true,
  enableProximityAwareness: true,
};

export function SidePanelApp() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<ActiveView>("list");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stats, setStats] = useState({ totalNotes: 0, totalClips: 0, storageUsed: "0 KB" });
  const [exportStatus, setExportStatus] = useState("");
  const [notebooks, setNotebooks] = useState<string[]>(["Inbox", "Work", "Study", "Personal"]);
  const [selectedNotebook, setSelectedNotebook] = useState<string>("All");
  const [clips, setClips] = useState<any[]>([]);
  const [newNotebookName, setNewNotebookName] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await chrome.storage.local.get(["clips", "notes"]);
        const clipsList = data.clips ?? [];
        const notesList = data.notes ?? [];
        const storageBytes = JSON.stringify(data).length;
        const storageStr = storageBytes < 1024 ? `${storageBytes} B`
          : storageBytes < 1024 * 1024 ? `${(storageBytes / 1024).toFixed(1)} KB`
          : `${(storageBytes / (1024 * 1024)).toFixed(1)} MB`;
        setStats({ totalNotes: notesList.length, totalClips: clipsList.length, storageUsed: storageStr });
      } catch {}
    }
    loadStats();
  }, [notes, clips]);

  const handleExportJSON = useCallback(async () => {
    try {
      const data = await chrome.storage.local.get(["clips", "notes", "settings"]);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clipnote-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("✅ Exported successfully!");
      setTimeout(() => setExportStatus(""), 3000);
    } catch (e) {
      setExportStatus("❌ Export failed");
      setTimeout(() => setExportStatus(""), 3000);
    }
  }, []);

  const handleExportMarkdown = useCallback(async () => {
    try {
      const data = await chrome.storage.local.get("notes");
      const allNotes: Note[] = data.notes ?? [];
      const md = allNotes.map((n) =>
        `# ${n.title || "Untitled"}\n\n${n.markdown}\n\n---\n*Source: ${n.sourceUrl || "N/A"} | Created: ${new Date(n.createdAt).toLocaleString()}*\n`
      ).join("\n\n");
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clipnote-notes-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("✅ Markdown exported!");
      setTimeout(() => setExportStatus(""), 3000);
    } catch {
      setExportStatus("❌ Export failed");
      setTimeout(() => setExportStatus(""), 3000);
    }
  }, []);

  const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.notes) {
          const standardizedNotes: Note[] = (data.notes as any[]).map((n) => ({
            id: n.id || crypto.randomUUID(),
            title: n.title || "Untitled Note",
            markdown: n.markdown || "",
            plainText: n.plainText || n.markdown || "",
            tags: Array.isArray(n.tags) ? n.tags : [],
            projectId: n.projectId || "Inbox",
            status: n.status || "inbox",
            createdAt: n.createdAt || Date.now(),
            updatedAt: n.updatedAt || Date.now()
          }));
          const merged = [...standardizedNotes, ...notes];
          const unique = merged.filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i);
          setNotes(unique);
          await chrome.storage.local.set({ notes: unique });
          for (const note of unique) {
            await db.addNote(note);
          }
        }
        if (data.clips) {
          const standardizedClips = (data.clips as any[]).map((c) => ({
            id: c.id || crypto.randomUUID(),
            text: c.text || "",
            sourceUrl: c.sourceUrl || c.url || "",
            sourceTitle: c.sourceTitle || c.title || "",
            capturedAt: c.capturedAt || c.timestamp || Date.now()
          }));
          await chrome.storage.local.set({ clips: standardizedClips });
          for (const clip of standardizedClips) {
            await db.addClip(clip);
          }
        }
        if (data.settings) {
          const merged = { ...settings, ...data.settings };
          setSettings(merged);
          await chrome.storage.local.set({ settings: merged });
        }
        setExportStatus("✅ Import successful!");
        setTimeout(() => setExportStatus(""), 3000);
      } catch {
        setExportStatus("❌ Invalid file format");
        setTimeout(() => setExportStatus(""), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [notes, settings]);

  const handleClearAllData = useCallback(async () => {
    if (!confirm("⚠️ Are you sure you want to delete ALL ClipNote data? This cannot be undone.")) return;
    await chrome.storage.local.clear();
    await db.clearAll();
    setNotes([]);
    setSettings(DEFAULT_SETTINGS);
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    setExportStatus("🗑️ All data cleared");
    setTimeout(() => setExportStatus(""), 3000);
  }, []);

  const handleAddNotebook = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed && !notebooks.includes(trimmed)) {
      const next = [...notebooks, trimmed];
      setNotebooks(next);
      chrome.storage.local.set({ notebooks: next });
    }
  }, [notebooks]);

  const handleDeleteNotebook = useCallback((name: string) => {
    if (name === "Inbox") return;
    if (confirm(`⚠️ Are you sure you want to delete the notebook "${name}"? Notes inside will be moved to Inbox.`)) {
      const nextNotebooks = notebooks.filter((n) => n !== name);
      setNotebooks(nextNotebooks);
      chrome.storage.local.set({ notebooks: nextNotebooks });
      
      const nextNotes = notes.map((note) =>
        note.projectId === name ? { ...note, projectId: "Inbox", updatedAt: Date.now() } : note
      );
      setNotes(nextNotes);
      chrome.storage.local.set({ notes: nextNotes });
      
      // Synchronize migrated notes to IndexedDB
      nextNotes.forEach((note) => {
        if (note.projectId === "Inbox") {
          db.updateNote(note).catch((err) => console.error("Failed to sync migrated note to IndexedDB:", err));
        }
      });
      
      if (selectedNotebook === name) {
        setSelectedNotebook("All");
      }
    }
  }, [notebooks, notes, selectedNotebook]);

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
    chrome.storage.local.get(["notes", "settings", "notebooks", "clips"]).then((data) => {
      if (data.notes) setNotes(data.notes);
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      if (data.notebooks) setNotebooks(data.notebooks);
      if (data.clips) setClips(data.clips || []);
    });
  }, []);

  useEffect(() => {
    function handleMessage(msg: any) {
      if (msg.type === "CLIP_SAVED" || msg.type === "SAVE_CLIP") {
        chrome.storage.local.get(["notes", "clips"]).then((data) => {
          if (data.notes) setNotes(data.notes);
          if (data.clips) setClips(data.clips || []);
        });
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const filteredNotes = useMemo(() => {
    let list = notes;
    if (selectedNotebook !== "All") {
      list = list.filter((n) => (n.projectId || "Inbox") === selectedNotebook);
    }
    if (!searchQuery.trim()) return list;
    const keywords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return list;
    return list.filter((n) => {
      const title = n.title.toLowerCase();
      const plainText = n.plainText.toLowerCase();
      const tags = n.tags.map((t) => t.toLowerCase());
      const notebook = (n.projectId || "Inbox").toLowerCase();
      return keywords.every(
        (kw) =>
          title.includes(kw) ||
          plainText.includes(kw) ||
          tags.some((t) => t.includes(kw)) ||
          notebook.includes(kw)
      );
    });
  }, [notes, searchQuery, selectedNotebook]);

  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setActiveView("editor");
  }, []);

  const handleNoteChange = useCallback((updated: Note) => {
    setSelectedNote(updated);
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }, []);

  const handleDeleteNote = useCallback(
    async (id: string) => {
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      await chrome.storage.local.set({ notes: next });
      try {
        await db.deleteNote(id);
      } catch (err) {
        console.error("Failed to delete note from IndexedDB:", err);
      }
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setActiveView("list");
      }
    },
    [notes, selectedNote]
  );

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      const next = notes.map((n) =>
        n.id === id
          ? { ...n, status: (n.status === "favorite" ? "inbox" : "favorite") as Note["status"], updatedAt: Date.now() }
          : n
      );
      setNotes(next);
      await chrome.storage.local.set({ notes: next });
      const updated = next.find((n) => n.id === id);
      if (updated) {
        try {
          await db.updateNote(updated);
        } catch (err) {
          console.error("Failed to sync note status to IndexedDB:", err);
        }
      }
      if (selectedNote?.id === id) {
        setSelectedNote(updated || null);
      }
    },
    [notes, selectedNote]
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const next = notes.map((n) =>
        n.id === id
          ? { ...n, status: (n.status === "archived" ? "inbox" : "archived") as Note["status"], updatedAt: Date.now() }
          : n
      );
      setNotes(next);
      await chrome.storage.local.set({ notes: next });
      const updated = next.find((n) => n.id === id);
      if (updated) {
        try {
          await db.updateNote(updated);
        } catch (err) {
          console.error("Failed to sync note status to IndexedDB:", err);
        }
      }
      if (selectedNote?.id === id) {
        setSelectedNote(updated || null);
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

  const handleNewNote = useCallback(async () => {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "",
      markdown: "",
      plainText: "",
      tags: [],
      status: "inbox",
      projectId: selectedNotebook !== "All" ? selectedNotebook : "Inbox",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [note, ...notes];
    setNotes(next);
    await chrome.storage.local.set({ notes: next });
    try {
      await db.addNote(note);
    } catch (err) {
      console.error("Failed to add note to IndexedDB:", err);
    }
    setSelectedNote(note);
    setActiveView("editor");
  }, [notes, selectedNotebook]);

  const heatmapData = useMemo(() => {
    const dates: { [key: string]: number } = {};
    
    notes.forEach((note) => {
      const d = new Date(note.createdAt).toLocaleDateString();
      dates[d] = (dates[d] || 0) + 1;
    });
    
    clips.forEach((clip) => {
      const ts = clip.capturedAt || (clip as any).timestamp || Date.now();
      const d = new Date(ts).toLocaleDateString();
      dates[d] = (dates[d] || 0) + 1;
    });

    const result = [];
    const startDay = new Date();
    startDay.setDate(startDay.getDate() - 41);
    
    const dayOfWeek = startDay.getDay();
    startDay.setDate(startDay.getDate() - dayOfWeek);

    for (let i = 0; i < 42; i++) {
      const current = new Date(startDay);
      current.setDate(startDay.getDate() + i);
      const key = current.toLocaleDateString();
      const count = dates[key] || 0;
      result.push({
        date: current,
        count,
        level: count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3,
      });
    }
    return result;
  }, [notes, clips]);

  const topSources = useMemo(() => {
    const counts: { [key: string]: number } = {};
    clips.forEach((clip) => {
      if (clip.sourceUrl) {
        try {
          const domain = new URL(clip.sourceUrl).hostname.replace(/^www\./, "");
          counts[domain] = (counts[domain] || 0) + 1;
        } catch {}
      }
    });
    
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
      
    const total = clips.filter((c) => c.sourceUrl).length || 1;
    return sorted.map(([domain, count]) => ({
      domain,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [clips]);

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
            <div className="sidebar-notebook-select-wrapper">
              <select
                className="sidebar-notebook-select"
                value={selectedNotebook}
                onChange={(e) => setSelectedNotebook(e.target.value)}
              >
                <option value="All">📂 All Notebooks</option>
                {notebooks.map((nb) => (
                  <option key={nb} value={nb}>
                    {nb === "Inbox" ? "📥" : "📓"} {nb}
                  </option>
                ))}
              </select>
            </div>
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
                <div className="settings-section-title">🎨 Appearance</div>
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
                    <option value="light">☀️ Light</option>
                    <option value="dark">🌙 Dark</option>
                    <option value="auto">🔄 System</option>
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
                    <option value="indigo">💜 Indigo (Default)</option>
                    <option value="blue">💙 Blue (Ocean)</option>
                    <option value="green">💚 Green (Emerald)</option>
                    <option value="rose">❤️ Rose (Crimson)</option>
                    <option value="amber">🧡 Amber (Sunset)</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Custom FAB Icon</div>
                    <div className="settings-description">Upload SVG, PNG, or animated GIF</div>
                  </div>
                  <div className="settings-file-upload-wrapper">
                    {settings.customFabIcon ? (
                      <div className="settings-file-preview-container">
                        <img className="settings-file-preview" src={settings.customFabIcon} alt="Custom FAB Icon" />
                        <button className="settings-file-remove-btn" onClick={() => handleSettingsChange({ customFabIcon: undefined })}>Remove</button>
                      </div>
                    ) : (
                      <label className="settings-file-upload-label">
                        Upload Icon
                        <input type="file" accept="image/*" className="settings-file-input" onChange={handleFabIconUpload} />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">📂 Workspaces & Notebooks</div>
                <div className="settings-row" style={{ borderBottom: "none", paddingBottom: 0 }}>
                  <div>
                    <div className="settings-label">Create Custom Notebook</div>
                    <div className="settings-description">Add a new workspace folder for notes</div>
                  </div>
                </div>
                <div className="settings-notebook-create-bar">
                  <input
                    type="text"
                    className="settings-notebook-input"
                    placeholder="Notebook name..."
                    value={newNotebookName}
                    onChange={(e) => setNewNotebookName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddNotebook(newNotebookName);
                        setNewNotebookName("");
                      }
                    }}
                  />
                  <button
                    className="settings-btn settings-btn--primary"
                    style={{ padding: "8px 16px" }}
                    onClick={() => {
                      handleAddNotebook(newNotebookName);
                      setNewNotebookName("");
                    }}
                  >
                    Add
                  </button>
                </div>
                <div className="settings-notebooks-list">
                  {notebooks.map((nb) => (
                    <div key={nb} className="settings-notebook-item">
                      <div className="settings-notebook-item-left">
                        <span>{nb === "Inbox" ? "📥" : "📓"}</span>
                        <span className="settings-notebook-item-name">{nb}</span>
                      </div>
                      {nb !== "Inbox" && (
                        <button
                          className="settings-notebook-delete-btn"
                          onClick={() => handleDeleteNotebook(nb)}
                          title="Delete notebook"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">⚙️ Floating Button (FAB)</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Show Floating Button</div>
                    <div className="settings-description">Display the FAB on all web pages</div>
                  </div>
                  <div
                    className={`settings-toggle${settings.showFab !== false ? " active" : ""}`}
                    onClick={() => handleSettingsChange({ showFab: !settings.showFab })}
                    role="switch"
                    aria-checked={settings.showFab !== false}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Proximity Awareness</div>
                    <div className="settings-description">FAB brightens as cursor approaches</div>
                  </div>
                  <div
                    className={`settings-toggle${settings.enableProximityAwareness !== false ? " active" : ""}`}
                    onClick={() => handleSettingsChange({ enableProximityAwareness: !settings.enableProximityAwareness })}
                    role="switch"
                    aria-checked={settings.enableProximityAwareness !== false}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Selection Capture Button</div>
                    <div className="settings-description">Show "Save to ClipNote" on text selection</div>
                  </div>
                  <div
                    className={`settings-toggle${settings.showSelectionCapture !== false ? " active" : ""}`}
                    onClick={() => handleSettingsChange({ showSelectionCapture: !settings.showSelectionCapture })}
                    role="switch"
                    aria-checked={settings.showSelectionCapture !== false}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Floating Button Size</div>
                    <div className="settings-description">Adjust FAB size: {settings.fabSize || 48}px</div>
                  </div>
                  <input
                    type="range"
                    min="32"
                    max="64"
                    step="4"
                    value={settings.fabSize || 48}
                    onChange={(e) => handleSettingsChange({ fabSize: Number(e.target.value) })}
                    style={{ width: "100px", cursor: "pointer" }}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Floating Button Opacity</div>
                    <div className="settings-description">Adjust default idle opacity: {settings.fabOpacity !== undefined ? settings.fabOpacity : 35}%</div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.fabOpacity !== undefined ? settings.fabOpacity : 35}
                    onChange={(e) => handleSettingsChange({ fabOpacity: Number(e.target.value) })}
                    style={{ width: "100px", cursor: "pointer" }}
                  />
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">🔒 Privacy & Security</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">Visual Shield (Privacy Mask)</div>
                    <div className="settings-description">Auto-mask passwords, API keys, and secrets</div>
                  </div>
                  <div
                    className={`settings-toggle${settings.enablePrivacyMask !== false ? " active" : ""}`}
                    onClick={() => handleSettingsChange({ enablePrivacyMask: !settings.enablePrivacyMask })}
                    role="switch"
                    aria-checked={settings.enablePrivacyMask !== false}
                  />
                </div>
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
                    <div className="settings-label">Max Quick Clips</div>
                    <div className="settings-description">Number of recent clips to keep in panel</div>
                  </div>
                  <select
                    className="settings-select"
                    value={settings.maxQuickClips}
                    onChange={(e) => handleSettingsChange({ maxQuickClips: Number(e.target.value) })}
                  >
                    <option value="10">10</option>
                    <option value="20">20 (Default)</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                  </select>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">📊 Statistics & Analytics</div>
                <div className="settings-stats-grid">
                  <div className="settings-stat-card">
                    <div className="settings-stat-value">{stats.totalNotes}</div>
                    <div className="settings-stat-label">Total Notes</div>
                  </div>
                  <div className="settings-stat-card">
                    <div className="settings-stat-value">{stats.totalClips}</div>
                    <div className="settings-stat-label">Quick Clips</div>
                  </div>
                  <div className="settings-stat-card">
                    <div className="settings-stat-value">{stats.storageUsed}</div>
                    <div className="settings-stat-label">Storage Used</div>
                  </div>
                </div>

                <div className="settings-sub-section-title">📅 Clipping Activity (Past 6 Weeks)</div>
                <div className="settings-heatmap-container">
                  <div className="settings-heatmap-grid">
                    {heatmapData.map((day, idx) => (
                      <div
                        key={idx}
                        className={`settings-heatmap-cell level-${day.level}`}
                        title={`${day.date.toLocaleDateString()}: ${day.count} entries`}
                      />
                    ))}
                  </div>
                  <div className="settings-heatmap-legend">
                    <span>Less</span>
                    <div className="settings-heatmap-cell level-0" />
                    <div className="settings-heatmap-cell level-1" />
                    <div className="settings-heatmap-cell level-2" />
                    <div className="settings-heatmap-cell level-3" />
                    <span>More</span>
                  </div>
                </div>

                {topSources.length > 0 && (
                  <>
                    <div className="settings-sub-section-title">🌐 Top Clipping Sources</div>
                    <div className="settings-sources-list">
                      {topSources.map((src, idx) => (
                        <div key={idx} className="settings-source-row">
                          <div className="settings-source-info">
                            <span className="settings-source-domain">{src.domain}</span>
                            <span className="settings-source-count">{src.count} clips ({src.percentage}%)</span>
                          </div>
                          <div className="settings-source-bar-bg">
                            <div className="settings-source-bar-fill" style={{ width: `${src.percentage}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="settings-section">
                <div className="settings-section-title">💾 Data Management</div>
                {exportStatus && <div className="settings-export-status">{exportStatus}</div>}
                <div className="settings-btn-group">
                  <button className="settings-btn settings-btn--primary" onClick={handleExportJSON}>
                    📦 Export JSON Backup
                  </button>
                  <button className="settings-btn settings-btn--primary" onClick={handleExportMarkdown}>
                    📝 Export as Markdown
                  </button>
                  <label className="settings-btn settings-btn--secondary">
                    📥 Import JSON Backup
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportJSON} />
                  </label>
                  <button className="settings-btn settings-btn--danger" onClick={handleClearAllData}>
                    🗑️ Clear All Data
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">⌨️ Keyboard Shortcuts</div>
                <div className="settings-shortcut-list">
                  <div className="settings-shortcut-row">
                    <span>Open Side Panel</span>
                    <kbd>Ctrl+Shift+K</kbd>
                  </div>
                  <div className="settings-shortcut-row">
                    <span>Save Selection (via right-click)</span>
                    <kbd>Right Click → Save to ClipNote</kbd>
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">ℹ️ About</div>
                <div className="settings-about">
                  <div className="settings-about-name">ClipNote <span className="settings-about-version">v0.1.0</span></div>
                  <div className="settings-about-desc">Browser-native clipboard & Markdown notebook</div>
                  <div className="settings-about-links">
                    <a href="https://github.com/groele/ClipNote" target="_blank" rel="noopener noreferrer">GitHub</a>
                    <span>·</span>
                    <a href="https://github.com/groele/ClipNote/issues" target="_blank" rel="noopener noreferrer">Report Issue</a>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedNote ? (
            <MarkdownEditor
              key={selectedNote.id}
              note={selectedNote}
              notebooks={notebooks}
              onChange={handleNoteChange}
            />
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
