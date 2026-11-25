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

export const loadDrafts = () => readList(DRAFTS_KEY).filter(doc => doc && typeof doc.id === 'string' && typeof doc.body === 'string' && Array.isArray(doc.tags));
export const loadBookmarks = () => new Set(readList(BOOKMARKS_KEY));
export const saveDrafts = drafts => localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
export const saveBookmarks = bookmarks => localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarks]));
