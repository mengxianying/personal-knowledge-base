import { parse, stringify } from 'yaml';

export const DEFAULT_CATEGORY = '产品需求';

export function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
      return url.href;
    }
  } catch {
    return '';
  }
  return '';
}

export function parseDocument(markdown, { id, fallbackTitle = '未命名文档' } = {}) {
  let body = markdown.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  const frontMatter = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(body);
  let meta = {};
  if (frontMatter) {
    meta = parse(frontMatter[1], { maxAliasCount: 0 }) ?? {};
    body = body.slice(frontMatter[0].length).trim();
  }
  const heading = /^#\s+([^\n]+)(?:\n|$)/.exec(body);
  const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : heading?.[1].trim() || fallbackTitle;
  if (heading?.[1].trim() === title) body = body.slice(heading[0].length).trim();

  return {
    id,
    title,
    category: typeof meta.category === 'string' && meta.category.trim() ? meta.category.trim() : DEFAULT_CATEGORY,
    tags: Array.isArray(meta.tags) ? meta.tags.filter(tag => typeof tag === 'string' && tag.trim()).map(tag => tag.trim()) : [],
    date: typeof meta.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? meta.date : '',
    source: safeHttpUrl(meta.source),
    body,
  };
}

export function serializeDocument({ title, category, tags, date, source, body }) {
  const metadata = { title, category, tags, date };
  if (source) metadata.source = source;
  return `---\n${stringify(metadata, { lineWidth: 0 })}---\n\n${body.trim()}\n`;
}

export function filterDocuments(documents, { query = '', category = '', scope = '', tag = '' } = {}) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return documents.filter(doc => {
    if (category && doc.category !== category) return false;
    if (scope === 'local' && !doc.local) return false;
    if (scope === 'published' && doc.local) return false;
    if (tag && !doc.tags.includes(tag)) return false;
    const searchable = [doc.title, doc.category, ...doc.tags, doc.body].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}
