import assert from 'node:assert/strict';
import test from 'node:test';

function localStorageStub() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

test('falls back to local storage when IndexedDB is unavailable', async () => {
  const previousStorage = globalThis.localStorage;
  const previousIndexedDB = globalThis.indexedDB;
  globalThis.localStorage = localStorageStub();
  globalThis.indexedDB = { open() { throw Object.assign(new Error('blocked'), { name: 'SecurityError' }); } };
  try {
    const store = await import(`./src/store.js?fallback=${Date.now()}`);
    const document = { id: 'fallback-doc', title: '降级保存', category: '产品需求', tags: [], source: '', date: '2026-11-26', body: '正文', local: true };
    await store.writeDraft(document, false);
    assert.deepEqual(await store.loadDrafts(), [document]);
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.indexedDB = previousIndexedDB;
  }
});
