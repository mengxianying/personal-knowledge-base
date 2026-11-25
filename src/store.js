import { parseDocument } from './documents.js';

const DRAFTS_KEY = 'zhiyu-documents-v1';
const BOOKMARKS_KEY = 'zhiyu-bookmarks-v1';

export function loadPublished() {
  const files = import.meta.glob('../content/**/*.md', { eager: true, query: '?raw', import: 'default' });
  return Object.entries(files).map(([path, markdown]) => {
    const id = path.slice('../content/'.length, -3);
    return parseDocument(markdown, { id, fallbackTitle: id.split('/').at(-1) });
  });
}

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export const loadBookmarks = () => new Set(readList(BOOKMARKS_KEY));
export const saveBookmarks = bookmarks => localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]));

const validDraft = doc => doc && typeof doc.id === 'string' && typeof doc.body === 'string' && Array.isArray(doc.tags);
export const loadLegacyDrafts = () => readList(DRAFTS_KEY).filter(validDraft);

const databaseName = 'zhiyu-local-documents';
const storeName = 'drafts';
let databasePromise;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function useStore(database, mode, run) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function migrateLegacyDrafts(database) {
  let legacy;
  try { legacy = localStorage.getItem(DRAFTS_KEY); } catch { return; }
  if (legacy === null) return;
  const drafts = loadLegacyDrafts();
  await useStore(database, 'readwrite', store => {
    for (const doc of drafts) {
      const request = store.getKey(doc.id);
      request.onsuccess = () => {
        if (request.result === undefined) store.add(doc);
      };
    }
  });
  try {
    if (localStorage.getItem(DRAFTS_KEY) === legacy) localStorage.removeItem(DRAFTS_KEY);
  } catch { /* The migrated documents remain available in IndexedDB. */ }
}

function getDatabase() {
  databasePromise ??= openDatabase().then(async database => {
    await migrateLegacyDrafts(database);
    return database;
  }).catch(error => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

export async function loadDrafts() {
  const database = await getDatabase();
  return useStore(database, 'readonly', store => store.getAll());
}

export async function writeDraft(doc, editing) {
  const database = await getDatabase();
  let written = false;
  await useStore(database, 'readwrite', store => {
    if (!editing) {
      store.add(doc);
      written = true;
      return;
    }
    const request = store.getKey(doc.id);
    request.onsuccess = () => {
      if (request.result === undefined) return;
      store.put(doc);
      written = true;
    };
  });
  if (!written) {
    const error = new Error('这篇文档已被删除。');
    error.name = 'MissingDraftError';
    throw error;
  }
}

export async function deleteDraft(id) {
  const database = await getDatabase();
  return useStore(database, 'readwrite', store => store.delete(id));
}
