import React, { useState, useCallback, useEffect } from "react";
import type { Note } from "../shared/types";

interface NoteListProps {
  notes: Note[];
  selectedId?: string;
  onSelect: (note: Note) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onArchive: (id: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  note: Note;
}

function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function domainFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function displayTitle(note: Note): string {
  if (note.title) return note.title;
  const firstLine = note.markdown.split("\n").find((l) => l.trim());
  if (!firstLine) return "Untitled";
  return firstLine.replace(/^#+\s*/, "").slice(0, 80);
}

function statusIcon(status: Note["status"]): string {
  switch (status) {
    case "favorite":
      return "★";
    case "archived":
      return "↓";
    default:
      return "";
  }
}

export function NoteList({ notes, selectedId, onSelect, onDelete, onToggleFavorite, onArchive }: NoteListProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (contextMenu) {
      document.addEventListener("click", closeContextMenu);
      return () => document.removeEventListener("click", closeContextMenu);
    }
  }, [contextMenu, closeContextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, note });
  }, []);

  const copyAsMarkdown = useCallback((note: Note) => {
    navigator.clipboard.writeText(note.markdown);
  }, []);

  const sorted = [...notes].sort((a, b) => {
    if (a.status === "favorite" && b.status !== "favorite") return -1;
    if (a.status !== "favorite" && b.status === "favorite") return 1;
    return b.updatedAt - a.updatedAt;
  });

  if (sorted.length === 0) {
    return (
      <div className="note-list-empty">
        <div className="note-list-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div>No notes yet</div>
      </div>
    );
  }

  return (
    <>
      <div className="note-list">
        {sorted.map((note) => (
          <div
            key={note.id}
            className={`note-item${note.id === selectedId ? " selected" : ""}`}
            onClick={() => onSelect(note)}
            onContextMenu={(e) => handleContextMenu(e, note)}
          >
            <div className="note-item-header">
              <span className="note-item-title">{displayTitle(note)}</span>
              {note.status !== "inbox" && (
                <span className="note-item-status">{statusIcon(note.status)}</span>
              )}
            </div>
            <div className="note-item-meta">
              <span className="note-item-time">{relativeTime(note.updatedAt)}</span>
              {domainFromUrl(note.sourceUrl) && (
                <span className="note-item-source">{domainFromUrl(note.sourceUrl)}</span>
              )}
            </div>
            {note.tags.length > 0 && (
              <div className="note-item-tags">
                {note.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="tag-badge">{tag}</span>
                ))}
                {note.tags.length > 3 && <span className="tag-badge">+{note.tags.length - 3}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onToggleFavorite(contextMenu.note.id);
              closeContextMenu();
            }}
          >
            {contextMenu.note.status === "favorite" ? "★ Unfavorite" : "☆ Favorite"}
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onArchive(contextMenu.note.id);
              closeContextMenu();
            }}
          >
            ↓ Archive
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item"
            onClick={() => {
              copyAsMarkdown(contextMenu.note);
              closeContextMenu();
            }}
          >
            Copy as Markdown
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item danger"
            onClick={() => {
              onDelete(contextMenu.note.id);
              closeContextMenu();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}
