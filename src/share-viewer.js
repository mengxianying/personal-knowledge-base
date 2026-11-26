import './style.css';
import { icons } from './icons.js';
import { filterDocuments, safeHttpUrl } from './documents.js';
import { renderMarkdown } from './render-markdown.js';
import { isShareEnvelope, isShareId, openShare, shareFileUrl } from './sharing.js';

const id = new URLSearchParams(location.search).get('id');
const app = document.getElementById('share-app');
app.innerHTML = `
  <header class="topbar shared-topbar">
    <div class="brand"><span class="brand-mark">${icons.library}</span><span><strong>知屿</strong><small>只读分享</small></span></div>
    <button type="button" class="button secondary" data-lock hidden>锁定分享</button>
  </header>
  <main class="shared-main">
    <section class="reader shared-gate" aria-labelledby="unlock-heading">
      <h1 id="unlock-heading">打开分享</h1>
      <p>输入访问密码，查看共享文章。</p>
      <form data-unlock>
        <label class="share-field">访问密码<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>
        <button type="submit" class="button primary">解锁查看</button>
      </form>
      <p class="share-status" data-status role="status"></p>
    </section>
    <section data-content hidden></section>
  </main>`;

const gate = app.querySelector('.shared-gate');
const form = app.querySelector('[data-unlock]');
const status = app.querySelector('[data-status]');
const password = form.elements.password;
const submit = form.querySelector('button');
const lockButton = app.querySelector('[data-lock]');
const content = app.querySelector('[data-content]');
const fileUrl = isShareId(id) ? shareFileUrl(id, location.href) : null;
let snapshot;
let query = '';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function addMeta(parent, doc) {
  const meta = element('div', '', 'reader-meta shared-meta');
  meta.append(element('span', doc.category, 'tag'));
  doc.tags.forEach(tag => meta.append(element('span', tag, 'tag')));
  if (doc.date) {
    const date = element('time', doc.date);
    date.dateTime = doc.date;
    meta.append(date);
  }
  parent.append(meta);
}

function renderList() {
  const title = element('h1', snapshot.title);
  const header = element('header', '', 'shared-heading');
  const label = element('label', '', 'search');
  label.innerHTML = icons.search;
  const search = element('input');
  search.type = 'search';
  search.placeholder = '搜索共享文章…';
  search.setAttribute('aria-label', '搜索共享文章');
  search.value = query;
  label.append(search);
  header.append(title, label);
  const list = element('div', '', 'document-list shared-list');

  function populate() {
    const documents = filterDocuments(snapshot.documents, { query });
    list.replaceChildren();
    for (const doc of documents) {
      const row = element('a', '', 'shared-row');
      row.href = `#doc/${doc.id}`;
      row.append(element('strong', doc.title));
      addMeta(row, doc);
      list.append(row);
    }
    if (!documents.length) list.append(element('p', '没有匹配的文章。', 'empty'));
  }
  search.addEventListener('input', () => {
    query = search.value;
    populate();
  });
  populate();
  content.replaceChildren(header, list);
}

function renderArticle(doc) {
  const back = element('a', '返回文章列表', 'back-link');
  back.href = '#';
  const article = element('article', '', 'reader');
  const header = element('header', '', 'reader-header');
  header.append(element('h1', doc.title));
  addMeta(header, doc);
  const source = safeHttpUrl(doc.source);
  if (source) {
    const original = element('a', '查看来源');
    original.href = source;
    original.target = '_blank';
    original.rel = 'noopener noreferrer';
    header.querySelector('.reader-meta').append(original);
  }
  const body = element('div', '', 'markdown');
  const rendered = renderMarkdown(doc.body);
  // The shared view only navigates to external HTTP links and its own in-page routes.
  for (const link of rendered.querySelectorAll('a[href]')) {
    if (!safeHttpUrl(link.getAttribute('href'))) link.removeAttribute('href');
  }
  body.append(rendered);
  article.append(header, body);
  content.replaceChildren(back, article);
}

function renderUnlocked() {
  if (!snapshot) return;
  const articleId = /^#doc\/(\d+)$/.exec(location.hash)?.[1];
  const doc = snapshot.documents.find(item => item.id === articleId);
  document.title = `${doc?.title || snapshot.title} · 知屿分享`;
  if (doc) renderArticle(doc);
  else renderList();
}

if (!fileUrl) {
  form.hidden = true;
  status.textContent = '分享链接不完整。';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!fileUrl || submit.disabled) return;
  submit.disabled = true;
  status.textContent = '正在打开分享…';
  try {
    const response = await fetch(fileUrl, { cache: 'no-cache' });
    if (!response.ok) {
      status.textContent = response.status === 404 ? '这个分享暂时无法打开，可能尚未发布。' : '分享加载失败，请重试。';
      return;
    }
    const envelope = await response.json();
    if (!isShareEnvelope(envelope)) {
      status.textContent = '分享文件无法读取。';
      return;
    }
    try {
      snapshot = await openShare(envelope, password.value);
    } catch (error) {
      status.textContent = error.name === 'OperationError' ? '访问密码不正确，请重试。' : '分享无法解锁，请重试。';
      password.select();
      return;
    }
    password.value = '';
    status.textContent = '';
    gate.hidden = true;
    content.hidden = false;
    lockButton.hidden = false;
    renderUnlocked();
    content.tabIndex = -1;
    content.focus();
  } catch {
    status.textContent = '分享加载失败，请重试。';
  } finally {
    submit.disabled = false;
  }
});

lockButton.addEventListener('click', () => {
  snapshot = undefined;
  query = '';
  content.replaceChildren();
  content.hidden = true;
  lockButton.hidden = true;
  gate.hidden = false;
  document.title = '只读分享 · 知屿';
  password.focus();
});

window.addEventListener('hashchange', () => {
  renderUnlocked();
  window.scrollTo(0, 0);
});
