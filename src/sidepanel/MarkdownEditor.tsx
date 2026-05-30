import React, { useState, useCallback, useRef, useEffect } from "react";
import { renderMarkdown } from "../shared/markdown";
import type { Note } from "../shared/types";

interface MarkdownEditorProps {
  note: Note;
  onChange: (note: Note) => void;
}

type ViewMode = "edit" | "preview" | "split";

export function MarkdownEditor({ note, onChange }: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [tagInput, setTagInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number>();

  const updateNote = useCallback(
    (updates: Partial<Note>) => {
      const updated = { ...note, ...updates, updatedAt: Date.now() };
      onChange(updated);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        chrome.storage.local.get("notes").then((data) => {
          const notes: Note[] = data.notes || [];
          const idx = notes.findIndex((n) => n.id === note.id);
          if (idx >= 0) {
            notes[idx] = updated;
            chrome.storage.local.set({ notes });
          }
        });
      }, 500);
    },
    [note, onChange]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const insertMarkdown = useCallback(
    (before: string, after: string = "") => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = note.markdown.slice(start, end);
      const newText =
        note.markdown.slice(0, start) +
        before +
        selected +
        after +
        note.markdown.slice(end);
      updateNote({ markdown: newText });

      requestAnimationFrame(() => {
        textarea.focus();
        const cursorPos = start + before.length + selected.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      });
    },
    [note.markdown, updateNote]
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const tag = tagInput.trim().toLowerCase();
        if (tag && !note.tags.includes(tag)) {
          updateNote({ tags: [...note.tags, tag] });
        }
        setTagInput("");
      } else if (e.key === "Backspace" && !tagInput && note.tags.length > 0) {
        updateNote({ tags: note.tags.slice(0, -1) });
      }
    },
    [tagInput, note.tags, updateNote]
  );

  const removeTag = useCallback(
    (tag: string) => {
      updateNote({ tags: note.tags.filter((t) => t !== tag) });
    },
    [note.tags, updateNote]
  );

  const cycleStatus = useCallback(() => {
    const order: Note["status"][] = ["inbox", "favorite", "archived"];
    const idx = order.indexOf(note.status);
    updateNote({ status: order[(idx + 1) % order.length] });
  }, [note.status, updateNote]);

  const sourceDomain = note.sourceUrl
    ? (() => {
        try {
          return new URL(note.sourceUrl).hostname.replace(/^www\./, "");
        } catch {
          return note.sourceUrl;
        }
      })()
    : null;

  return (
    <div className="editor-container">
      <div className="editor-header">
        <input
          className="editor-title-input"
          type="text"
          placeholder="Note title..."
          value={note.title}
          onChange={(e) => updateNote({ title: e.target.value })}
        />
        <div className="editor-meta">
          <button className="editor-status-btn" onClick={cycleStatus} title="Toggle status">
            {note.status === "favorite" ? "★" : note.status === "archived" ? "↓" : "○"}{" "}
            {note.status}
          </button>
          {sourceDomain && (
            <a
              className="editor-source-link"
              href={note.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={note.sourceUrl}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {sourceDomain}
            </a>
          )}
          <span style={{ color: "var(--text-tertiary)" }}>
            {new Date(note.updatedAt).toLocaleString()}
          </span>
        </div>
        <div className="editor-tags">
          {note.tags.map((tag) => (
            <span key={tag} className="editor-tag">
              {tag}
              <button className="editor-tag-remove" onClick={() => removeTag(tag)}>
                ×
              </button>
            </span>
          ))}
          <input
            className="editor-tag-input"
            type="text"
            placeholder={note.tags.length === 0 ? "Add tags..." : ""}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
          />
        </div>
      </div>

      <div className="editor-toolbar">
        <button className="toolbar-btn" onClick={() => insertMarkdown("**", "**")} title="Bold (Ctrl+B)">
          <strong>B</strong>
        </button>
        <button className="toolbar-btn" onClick={() => insertMarkdown("*", "*")} title="Italic (Ctrl+I)">
          <em>I</em>
        </button>
        <button className="toolbar-btn" onClick={() => insertMarkdown("`", "`")} title="Code">
          {"</>"}
        </button>
        <button className="toolbar-btn" onClick={() => insertMarkdown("[", "](url)")} title="Link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={() => insertMarkdown("- ")} title="List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button className="toolbar-btn" onClick={() => insertMarkdown("## ")} title="Heading">
          H
        </button>

        <span className="toolbar-spacer" />

        <div className="view-toggle">
          <button
            className={`view-toggle-btn${viewMode === "edit" ? " active" : ""}`}
            onClick={() => setViewMode("edit")}
          >
            Edit
          </button>
          <button
            className={`view-toggle-btn${viewMode === "split" ? " active" : ""}`}
            onClick={() => setViewMode("split")}
          >
            Split
          </button>
          <button
            className={`view-toggle-btn${viewMode === "preview" ? " active" : ""}`}
            onClick={() => setViewMode("preview")}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="editor-body">
        {(viewMode === "edit" || viewMode === "split") && (
          <div className="editor-pane">
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={note.markdown}
              onChange={(e) => updateNote({ markdown: e.target.value, plainText: e.target.value })}
              placeholder="Write your note in Markdown..."
              spellCheck
            />
          </div>
        )}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className="preview-pane"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.markdown) }}
          />
        )}
      </div>
    </div>
  );
}
