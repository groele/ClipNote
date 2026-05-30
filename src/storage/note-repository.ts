import type { Note } from "../shared/types";
import { db } from "./indexeddb";

function generateId(): string {
  return crypto.randomUUID();
}

export async function createNote(partial: Partial<Note>): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: generateId(),
    title: partial.title ?? "Untitled",
    markdown: partial.markdown ?? "",
    plainText: partial.plainText ?? "",
    sourceUrl: partial.sourceUrl,
    sourceTitle: partial.sourceTitle,
    tags: partial.tags ?? [],
    projectId: partial.projectId,
    status: partial.status ?? "inbox",
    createdAt: now,
    updatedAt: now,
  };
  await db.addNote(note);
  return note;
}

export async function searchNotes(query: string): Promise<Note[]> {
  const notes = await db.getAllNotes();
  const lower = query.toLowerCase();
  return notes.filter(note =>
    note.title.toLowerCase().includes(lower) ||
    note.plainText.toLowerCase().includes(lower)
  );
}

export async function getNotesByTag(tag: string): Promise<Note[]> {
  const notes = await db.getAllNotes();
  return notes.filter(note => note.tags.includes(tag));
}

export async function getNotesByStatus(status: Note["status"]): Promise<Note[]> {
  const notes = await db.getAllNotes();
  return notes.filter(note => note.status === status);
}
