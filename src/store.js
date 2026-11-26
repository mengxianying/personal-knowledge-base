const DRAFTS_KEY = 'zhiyu-documents-v1';
const BOOKMARKS_KEY = 'zhiyu-bookmarks-v1';

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
let indexedDbDisabled = false;

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
    let request;
    try {
      request = run(transaction.objectStore(storeName));
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error);
    transaction.onabort = () => reject(transaction.error || request?.error);
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
  if (indexedDbDisabled) return Promise.reject(new Error('IndexedDB unavailable'));
  databasePromise ??= openDatabase().then(async database => {
    await migrateLegacyDrafts(database);
    return database;
  }).catch(error => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

function storageError(cause) {
  const error = new Error('浏览器本机存储不可用或空间不足。请退出无痕模式、允许此网站使用存储空间，或清理站点数据后重试。', { cause });
  error.name = 'StorageUnavailableError';
  return error;
}

async function legacyDrafts(database) {
  const localDrafts = loadLegacyDrafts();
  if (!database) return localDrafts;
  try {
    const databaseDrafts = await useStore(database, 'readonly', store => store.getAll());
    const byId = new Map(localDrafts.map(doc => [doc.id, doc]));
    for (const doc of databaseDrafts) byId.set(doc.id, doc);
    return [...byId.values()];
  } catch {
    return localDrafts;
  }
}

async function writeLegacyDraft(doc, editing, database) {
  const drafts = await legacyDrafts(database);
  if (editing && !drafts.some(item => item.id === doc.id)) {
    const error = new Error('这篇文档已被删除。');
    error.name = 'MissingDraftError';
    throw error;
  }
  const next = editing
    ? drafts.map(item => item.id === doc.id ? doc : item)
    : [doc, ...drafts.filter(item => item.id !== doc.id)];
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  } catch (error) {
    throw storageError(error);
  }
}

export async function loadDrafts() {
  if (indexedDbDisabled) return loadLegacyDrafts();
  try {
    const database = await getDatabase();
    return await useStore(database, 'readonly', store => store.getAll());
  } catch (error) {
    indexedDbDisabled = true;
    databasePromise = undefined;
    return loadLegacyDrafts();
  }
}

export async function writeDraft(doc, editing) {
  if (indexedDbDisabled) return writeLegacyDraft(doc, editing);
  let database;
  try {
    database = await getDatabase();
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
  } catch (error) {
    indexedDbDisabled = true;
    databasePromise = undefined;
    if (error.name === 'MissingDraftError') throw error;
    try {
      await writeLegacyDraft(doc, editing, database);
    } catch (fallbackError) {
      if (fallbackError.name === 'MissingDraftError') throw fallbackError;
      throw storageError(error);
    }
  }
}

export async function deleteDraft(id) {
  if (indexedDbDisabled) return deleteLegacyDraft(id);
  try {
    const database = await getDatabase();
    return await useStore(database, 'readwrite', store => store.delete(id));
  } catch (error) {
    indexedDbDisabled = true;
    databasePromise = undefined;
    try {
      return await deleteLegacyDraft(id, database);
    } catch {
      throw storageError(error);
    }
  }
}

async function deleteLegacyDraft(id, database) {
  const drafts = await legacyDrafts(database);
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.filter(doc => doc.id !== id)));
  } catch (error) {
    throw storageError(error);
  }
}
