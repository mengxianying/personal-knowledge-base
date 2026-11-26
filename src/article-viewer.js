import './style.css';
import { readArticleShare } from './article-share.js';
import { renderMarkdown } from './render-markdown.js';

const main = document.querySelector('#shared-article');
const article = main.querySelector('article');

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

try {
  const doc = await readArticleShare(new URL(location.href));
  const header = element('header', '', 'reader-header');
  header.append(element('h1', doc.title));
  const meta = element('div', '', 'reader-meta shared-meta');
  for (const tag of [doc.category, ...doc.tags].filter(Boolean)) {
    meta.append(element('span', tag, 'tag'));
  }
  if (doc.date) {
    const date = element('time', doc.date);
    date.dateTime = doc.date;
    meta.append(date);
  }
  header.append(meta);
  const body = element('div', '', 'markdown');
  body.append(renderMarkdown(doc.body, { readOnly: true }));
  article.replaceChildren(header, body);
  document.title = `${doc.title} · 知屿`;
} catch (error) {
  article.replaceChildren(element('p', error.message || '文章加载失败。'));
} finally {
  main.removeAttribute('aria-busy');
}
