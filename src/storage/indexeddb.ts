import type { Note, Clip } from "../shared/types";

const DB_NAME = "clipnote-db";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("notes")) {
        db.createObjectStore("notes", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("clips")) {
        db.createObjectStore("clips", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (!dbInstance) {
    dbInstance = await openDB();
  }
  return dbInstance;
}

function txRequest<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return getDB().then(db => {
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

export const db = {
  addNote(note: Note): Promise<void> {
    return txRequest("notes", "readwrite", store => store.put(note)).then(() => {});
  },

  getNote(id: string): Promise<Note | undefined> {
    return txRequest("notes", "readonly", store => store.get(id));
  },

  getAllNotes(): Promise<Note[]> {
    return txRequest<Note[]>("notes", "readonly", store => store.getAll());
  },

  updateNote(note: Note): Promise<void> {
    return txRequest("notes", "readwrite", store => store.put(note)).then(() => {});
  },

  deleteNote(id: string): Promise<void> {
    return txRequest("notes", "readwrite", store => store.delete(id)).then(() => {});
  },

  addClip(clip: Clip): Promise<void> {
    return txRequest("clips", "readwrite", store => store.put(clip)).then(() => {});
  },

  getAllClips(): Promise<Clip[]> {
    return txRequest<Clip[]>("clips", "readonly", store => store.getAll());
  },

  deleteClip(id: string): Promise<void> {
    return txRequest("clips", "readwrite", store => store.delete(id)).then(() => {});
  },

  clearAll(): Promise<void> {
    return Promise.all([
      txRequest("notes", "readwrite", store => store.clear()),
      txRequest("clips", "readwrite", store => store.clear())
    ]).then(() => {});
  }
};
