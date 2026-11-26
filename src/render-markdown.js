import DOMPurify from 'dompurify';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' });
turndown.use(gfm);

export function clipboardMarkdown(html) {
  const cleaned = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'form'],
    FORBID_ATTR: ['srcset'],
    RETURN_DOM_FRAGMENT: true,
  });
  cleaned.querySelectorAll('img').forEach(img => {
    const source = img.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(source)) img.replaceWith(img.alt || '');
  });
  return turndown.turndown(cleaned);
}

export function renderMarkdown(markdown, { readOnly = false } = {}) {
  const fragment = DOMPurify.sanitize(marked.parse(markdown), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'iframe', 'input', 'button', ...(readOnly
      ? ['select', 'textarea', 'details', 'summary', 'audio', 'video', 'dialog'] : [])],
    FORBID_ATTR: ['style', 'srcset', 'id', 'name', ...(readOnly
      ? ['contenteditable', 'role', 'tabindex', 'download'] : [])],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const link of fragment.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (/^https?:\/\//i.test(href)) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    } else if (readOnly) link.removeAttribute('href');
  }
  for (const image of fragment.querySelectorAll('img')) {
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
  }
  return fragment;
}
