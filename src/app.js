import './style.css';
import { filterDocuments, serializeDocument } from './documents.js';
import { loadLegacyDrafts, loadDrafts, loadBookmarks, writeDraft, deleteDraft, saveBookmarks } from './store.js';
import { getOwnerSession } from './github-access.js';
import { icons } from './icons.js';
import { importDialog, installImportDialog } from './import-dialog.js';
import { renderMarkdown } from './render-markdown.js';
import { shareDialog, installShareDialog } from './share-dialog.js';

const categoryInfo = {
  产品需求: { icon: 'file', color: 'violet' },
  项目文档: { icon: 'folder', color: 'blue' },
  工作笔记: { icon: 'notebook', color: 'amber' },
  模板资料: { icon: 'layers', color: 'green' },
};

const ownerSession = getOwnerSession();
if (!ownerSession) throw new Error('访问知识库前需要验证 GitHub 账号。');
const published = ownerSession.documents;
let drafts = loadLegacyDrafts();
let bookmarks = loadBookmarks();
const draftChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('zhiyu-drafts') : null;
const state = { query: '', category: '', scope: '', tag: '', order: 'newest' };

function allDocuments() {
  const publishedIds = new Set(published.map(doc => doc.id));
  return [...published, ...drafts.filter(doc => !publishedIds.has(doc.id))];
}

function categories() {
  return [...new Set([...Object.keys(categoryInfo), ...allDocuments().map(doc => doc.category)])];
}

function escapeHtml(value = '') {
  const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, char => chars[char]);
}

function repoUrl() {
  const raw = import.meta.env.VITE_GITHUB_REPO || '';
  const host = /^([\w-]+)\.github\.io$/i.exec(location.hostname);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  if (/^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/.test(raw)) return raw;
  if (host && repo) return `https://github.com/${host[1]}/${repo}`;
  if (host) return `https://github.com/${host[1]}/${host[1]}.github.io`;
  return '';
}

const repository = repoUrl();
const app = document.getElementById('app');
app.innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar" aria-label="知识库导航">
      <a class="brand" href="#" data-nav="all">
        <span class="brand-mark">${icons.library}</span>
        <span><strong>知屿</strong><small>个人知识库</small></span>
      </a>
      <nav class="side-navigation" aria-label="文档导航"></nav>
      <div class="side-bottom">
        <a class="nav-button" href="#admin" data-nav="admin">${icons.layers}<span>后台管理</span></a>
        <button type="button" class="nav-button" data-action="repository">${icons.github}<span>GitHub 仓库</span>${icons.external}</button>
        <button type="button" class="nav-button" data-action="sign-out">${icons.arrowLeft}<span>退出登录</span></button>
      </div>
    </aside>
    <button class="sidebar-scrim" aria-label="关闭菜单" data-action="menu"></button>
    <div class="workspace">
      <header class="topbar">
        <button type="button" class="icon-button mobile-menu" data-action="menu" aria-label="打开菜单" aria-expanded="false" aria-controls="sidebar">${icons.menu}</button>
        <div class="breadcrumb"><span>知识库</span>${icons.chevronRight}<strong id="breadcrumb-current">总览</strong></div>
        <div class="topbar-actions">
          <label class="search">${icons.search}<input type="search" id="search" placeholder="搜索文档…" aria-label="搜索全部文档"><kbd>/</kbd></label>
          <button type="button" class="button primary" data-action="import">${icons.plus}<span>导入文档</span></button>
        </div>
      </header>
      <main id="main-content" class="content"></main>
    </div>
  </div>
  ${importDialog}
  ${shareDialog}
  <dialog id="publish-dialog" class="publish-dialog" aria-labelledby="publish-title">
    <h2 id="publish-title">发布到 GitHub</h2>
    <p>下载 Markdown 后，上传到仓库的 <code>content/</code> 目录。提交到 <code>main</code> 后，GitHub Actions 会重新部署网站。</p>
    <p>提交的文档将公开展示。仅将适合公开的内容上传到 GitHub。</p>
    <footer class="dialog-footer">
      <button class="button secondary" type="button" data-action="close-publish">关闭</button>
      <button class="button secondary" type="button" data-action="download">${icons.download} 下载 Markdown</button>
      ${repository ? `<a class="button primary" href="${repository}/upload/main/content" target="_blank" rel="noopener noreferrer">打开上传页面 ${icons.external}</a>` : ''}
    </footer>
  </dialog>
  <dialog id="delete-dialog" class="publish-dialog" aria-labelledby="delete-title">
    <h2 id="delete-title">删除本机文档？</h2>
    <p><strong id="delete-document-name"></strong></p>
    <p>这会从当前浏览器里移除文档和它的收藏记录。</p>
    <footer class="dialog-footer">
      <button class="button secondary" type="button" data-action="close-delete" autofocus>取消</button>
      <button class="button danger" type="button" data-action="confirm-delete">删除文档</button>
    </footer>
  </dialog>
  <div class="toast" role="status" aria-live="polite" hidden></div>`;

const main = document.querySelector('#main-content');
const search = document.querySelector('#search');
const nav = document.querySelector('.side-navigation');
const adminLink = document.querySelector('[data-nav="admin"]');
const openImport = installImportDialog(document.querySelector('#import-dialog'), saveDraft, categories);
const openShare = installShareDialog(document.querySelector('#share-dialog'));
let toastTimer;

function toast(message) {
  const notice = document.querySelector('.toast');
  clearTimeout(toastTimer);
  notice.textContent = message;
  notice.hidden = false;
  toastTimer = setTimeout(() => { notice.hidden = true; }, 3000);
}

async function saveDraft(doc, editing) {
  await writeDraft(doc, editing);
  drafts = await loadDrafts();
  draftChannel?.postMessage('changed');
  if (isAdmin()) render();
  else openDocument(doc.id);
  toast('文档已保存到本机');
}

function updateBookmark(id) {
  bookmarks = loadBookmarks();
  const selected = bookmarks.has(id);
  if (selected) bookmarks.delete(id);
  else bookmarks.add(id);
  try {
    saveBookmarks(bookmarks);
  } catch {
    if (selected) bookmarks.add(id);
    else bookmarks.delete(id);
    toast('收藏保存失败，请检查浏览器设置');
    return;
  }
  render();
  const button = [...main.querySelectorAll('[data-action="bookmark"]')].find(item => item.dataset.id === id);
  button?.focus();
  toast(selected ? '已取消收藏' : '已收藏');
}

function documentId() {
  const match = /^#doc\/(.+)$/.exec(location.hash);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return ''; }
}

const currentDocument = () => allDocuments().find(doc => doc.id === documentId());
const documentUrl = id => `#doc/${encodeURIComponent(id)}`;
const isAdmin = () => location.hash === '#admin';

function openDocument(id) {
  const hash = documentUrl(id);
  if (location.hash === hash) render();
  else location.hash = hash;
}

function showLibrary() {
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
  render();
}

function clearFilters() {
  Object.assign(state, { query: '', category: '', scope: '', tag: '' });
  search.value = '';
}

function navButton({ label, icon, value, count, active }) {
  return `<button type="button" class="nav-button${active ? ' active' : ''}" data-nav="${escapeHtml(value)}"${active ? ' aria-current="page"' : ''}>
    ${icons[icon]}<span>${escapeHtml(label)}</span>${count === undefined ? '' : `<small>${count}</small>`}
  </button>`;
}

function renderNav(docs) {
  const current = documentId() ? '' : state.category ? `category/${state.category}` : state.scope || 'all';
  const button = (label, icon, value, count) => navButton({ label, icon, value, count, active: current === value });
  nav.innerHTML = `
    <div class="nav-group"><h2>浏览</h2>
      ${button('全部文档', 'layout', 'all', docs.length)}
      ${button('我的收藏', 'bookmark', 'bookmarks', docs.filter(doc => bookmarks.has(doc.id)).length)}
      ${button('本机文档', 'archive', 'local', docs.filter(doc => doc.local).length)}
    </div>
    <div class="nav-group"><h2>分类</h2>
      ${categories().map(category => button(category, categoryInfo[category]?.icon || 'folder', `category/${category}`, docs.filter(doc => doc.category === category).length)).join('')}
    </div>`;
}

function categoryIcon(category) {
  const { icon, color } = categoryInfo[category] || { icon: 'folder', color: 'blue' };
  return `<span class="category-icon ${color}">${icons[icon]}</span>`;
}

function docPreview(doc) {
  const line = doc.body.split('\n').find(text => text.trim() && !/^(?:[#|<`>-]|!\[)/.test(text.trim())) || '';
  return line.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').slice(0, 120);
}

function formatDate(date) {
  return date.replaceAll('-', '.');
}

function managementControls(doc) {
  if (!doc.local && !repository) return '';
  const path = doc.id.split('/').map(encodeURIComponent).join('/') + '.md';
  return [['edit', '编辑', icons.edit], ['delete', '删除', icons.trash]].map(([action, verb, icon]) => {
    const label = doc.local ? verb : '在 GitHub ' + verb;
    const className = action === 'delete' ? 'button secondary delete-button' : 'button secondary';
    const attributes = `class="${className}" aria-label="${escapeHtml(label + ' ' + doc.title)}" title="${label}"`;
    const content = `${icon}<span>${verb}</span>`;
    if (doc.local) {
      return `<button type="button" ${attributes} data-action="${action}" data-id="${escapeHtml(doc.id)}">${content}</button>`;
    }
    const url = escapeHtml(`${repository}/${action}/main/content/${path}`);
    return `<a ${attributes} href="${url}" target="_blank" rel="noopener noreferrer">${content}</a>`;
  }).join('');
}

function documentRow(doc, managing) {
  const selected = bookmarks.has(doc.id);
  return `
    <article class="document-row">
      <a class="document-link" href="${documentUrl(doc.id)}">
        ${categoryIcon(doc.category)}
        <span class="document-summary">
          <strong>${escapeHtml(doc.title)}${doc.local ? '<small class="local-label">本机</small>' : ''}</strong>
          <span>${escapeHtml(docPreview(doc) || '查看文档正文')}</span>
        </span>
        <span class="row-tags">${doc.tags.slice(0, 2).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span>
        <time datetime="${escapeHtml(doc.date)}">${escapeHtml(formatDate(doc.date))}</time>
      </a>
      <div class="row-actions">
        ${managing ? managementControls(doc) : `<button type="button" class="icon-button bookmark-button" data-action="bookmark" data-id="${escapeHtml(doc.id)}" aria-pressed="${selected}" aria-label="${selected ? '取消收藏' : '收藏'} ${escapeHtml(doc.title)}">${icons.bookmark}</button>`}
      </div>
    </article>`;
}

function visibleDocuments(docs, managing) {
  const visible = managing
    ? filterDocuments(docs, { query: state.query })
    : filterDocuments(docs, state).filter(doc => state.scope !== 'bookmarks' || bookmarks.has(doc.id));
  const direction = state.order === 'newest' ? -1 : 1;
  return visible.sort((first, second) => direction * first.date.localeCompare(second.date) || first.title.localeCompare(second.title, 'zh-CN'));
}

function renderLibrary(docs) {
  const managing = isAdmin();
  const all = !managing && !state.query && !state.category && !state.scope && !state.tag;
  const activeTitle = managing ? '后台管理' : state.query ? '搜索结果' : state.category || (state.scope === 'local' ? '本机文档' : state.scope === 'bookmarks' ? '我的收藏' : state.tag || '总览');
  document.querySelector('#breadcrumb-current').textContent = activeTitle;
  const visible = visibleDocuments(docs, managing);
  main.innerHTML = `
    ${all ? `<section class="hero" aria-labelledby="welcome-title">
      <div class="hero-copy">
        <h1 id="welcome-title">我的知识库</h1>
        <p>集中整理产品需求、项目文档与工作笔记。</p>
        <button type="button" class="button hero-button" data-action="import">${icons.upload} 从飞书导入 ${icons.arrow}</button>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-orbit orbit-outer"></div><div class="art-orbit orbit-inner"></div>
        <div class="art-glow"></div><div class="art-star star-one">✦</div><div class="art-star star-two">✦</div><i class="art-dot"></i>
        <div class="art-paper paper-back"></div><div class="art-paper paper-middle"></div>
        <div class="art-paper paper-front"><i></i><b></b><span></span><span></span><span></span></div>
        <div class="art-chip">${icons.bookmark}</div>
      </div>
    </section>
    <section class="categories" aria-labelledby="categories-heading">
      <div class="section-title"><h2 id="categories-heading">知识分类</h2></div>
      <div class="category-grid">
        ${categories().map(category => `<button class="category-card" type="button" data-nav="category/${escapeHtml(category)}">
          <span class="card-top">${categoryIcon(category)}${icons.external}</span>
          <strong>${escapeHtml(category)}</strong><small>${docs.filter(doc => doc.category === category).length} 篇文档</small>
        </button>`).join('')}
      </div>
    </section>` : ''}
    <section class="document-section" aria-labelledby="documents-heading">
      <div class="section-title list-heading">
        <div><${all ? 'h2' : 'h1'} id="documents-heading">${all ? '最近文档' : escapeHtml(activeTitle)}</${all ? 'h2' : 'h1'}><span class="document-count">${visible.length} 篇</span></div>
        <label class="sort"><select aria-label="排序"><option value="newest" ${state.order === 'newest' ? 'selected' : ''}>最新优先</option><option value="oldest" ${state.order === 'oldest' ? 'selected' : ''}>最早优先</option></select>${icons.chevron}</label>
      </div>
      ${state.tag ? `<button type="button" class="tag active-tag" data-action="clear-tag">${escapeHtml(state.tag)} ${icons.close}</button>` : ''}
      ${managing ? '<p class="management-note">本机文档在这里编辑和删除。已发布文档通过 GitHub 更新。</p>' : ''}
      <div class="document-list${managing ? ' management-list' : ''}">
        ${visible.length ? visible.map(doc => documentRow(doc, managing)).join('') : `<div class="empty">${icons.inbox}<h2>${state.query ? '没有匹配的文档' : '这里还没有文档'}</h2>
          <p>${state.query ? '试试其他关键词。' : state.scope === 'bookmarks' ? '点击文档右侧的收藏按钮，就可以在这里找到它。' : '导入飞书文档或 Markdown，将它加入知识库。'}</p>
          ${state.query ? '<button type="button" class="button secondary" data-action="clear-search">清除搜索</button>' : state.scope === 'bookmarks' ? '<button type="button" class="button secondary" data-nav="all">浏览文档</button>' : '<button type="button" class="button primary" data-action="import">导入文档</button>'}
        </div>`}
      </div>
    </section>`;
}

function renderReader(doc) {
  document.querySelector('#breadcrumb-current').textContent = doc.category;
  const selected = bookmarks.has(doc.id);
  main.innerHTML = `
    <a class="back-link" href="#" data-action="back">${icons.arrowLeft} 返回文档列表</a>
    <div class="reader-layout">
      <article class="reader">
        <header class="reader-header">
          <div class="reader-category">${categoryIcon(doc.category)}<span>${escapeHtml(doc.category)}</span>${doc.local ? '<small class="local-label">本机</small>' : ''}</div>
          <h1>${escapeHtml(doc.title)}</h1>
          <div class="reader-meta"><time datetime="${escapeHtml(doc.date)}">${escapeHtml(formatDate(doc.date))}</time>
            ${doc.tags.map(tag => `<button type="button" class="tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}
            ${doc.source ? `<a href="${escapeHtml(doc.source)}" target="_blank" rel="noopener noreferrer">${icons.link} 查看原文</a>` : ''}
          </div>
          <div class="reader-actions">
            <button type="button" class="button secondary" data-action="share" title="生成无需登录的只读链接">${icons.link} 分享</button>
            <button type="button" class="button secondary" data-action="bookmark" data-id="${escapeHtml(doc.id)}" aria-pressed="${selected}">${icons.bookmark} ${selected ? '已收藏' : '收藏'}</button>
            <button type="button" class="button secondary" data-action="download">${icons.download} Markdown</button>
            ${doc.local ? `<button type="button" class="button primary" data-action="publish">${icons.github} 发布到 GitHub</button>` : ''}
          </div>
        </header>
        <div class="markdown"></div>
      </article>
      <aside class="reader-toc" aria-label="文章目录" hidden><h2>本文目录</h2><div></div></aside>
    </div>`;
  const body = main.querySelector('.markdown');
  body.append(renderMarkdown(doc.body));
  const headings = [...body.querySelectorAll('h2, h3')];
  if (!headings.length) return;
  const toc = main.querySelector('.reader-toc');
  toc.hidden = false;
  toc.querySelector('div').replaceChildren(...headings.map((heading, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = heading.tagName.toLowerCase();
    button.textContent = heading.textContent;
    heading.tabIndex = -1;
    button.addEventListener('click', () => {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
      toc.querySelectorAll('button').forEach((item, position) => item.classList.toggle('active', index === position));
    });
    return button;
  }));
}

function render() {
  const docs = allDocuments();
  const doc = docs.find(item => item.id === documentId());
  const managing = isAdmin();
  adminLink.classList.toggle('active', managing);
  if (managing) adminLink.setAttribute('aria-current', 'page');
  else adminLink.removeAttribute('aria-current');
  search.setAttribute('aria-label', managing ? '搜索管理文档' : '搜索全部文档');
  renderNav(docs);
  if (doc) renderReader(doc);
  else if (documentId()) {
    document.querySelector('#breadcrumb-current').textContent = '文档';
    main.innerHTML = `<div class="empty missing">${icons.inbox}<h1>找不到此文档</h1><p>本机文档只能在保存它的浏览器里打开。</p><button class="button secondary" type="button" data-nav="all">返回全部文档</button></div>`;
  } else renderLibrary(docs);
  document.title = doc ? `${doc.title} · 知屿` : managing ? '后台管理 · 知屿' : '知屿 · 个人知识库';
}

function downloadDocument() {
  const doc = currentDocument();
  if (!doc) return;
  const url = URL.createObjectURL(new Blob([serializeDocument(doc)], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${doc.id.split('/').at(-1)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toggleMenu(open = !app.classList.contains('menu-open')) {
  app.classList.toggle('menu-open', open);
  document.querySelector('.mobile-menu').setAttribute('aria-expanded', String(open));
}

const publishDialog = document.querySelector('#publish-dialog');
const deleteDialog = document.querySelector('#delete-dialog');
const deleteName = document.querySelector('#delete-document-name');
let pendingDelete = '';

deleteDialog.addEventListener('close', () => {
  if (!deleteDialog.open) pendingDelete = '';
});

const actions = {
  import: () => openImport(),
  'sign-out': () => location.reload(),
  share: () => {
    const doc = currentDocument();
    if (doc) openShare(doc);
  },
  edit: button => {
    const doc = drafts.find(item => item.id === button.dataset.id);
    if (doc) openImport(doc);
  },
  back: showLibrary,
  bookmark: button => updateBookmark(button.dataset.id),
  download: downloadDocument,
  publish: () => publishDialog.showModal(),
  'close-publish': () => publishDialog.close(),
  delete: button => {
    const doc = drafts.find(item => item.id === button.dataset.id);
    if (!doc) return;
    pendingDelete = doc.id;
    deleteName.textContent = doc.title;
    deleteDialog.showModal();
  },
  'close-delete': () => deleteDialog.close(),
  'confirm-delete': async button => {
    const id = pendingDelete;
    if (!id || button.disabled) return;
    button.disabled = true;
    try {
      await deleteDraft(id);
      drafts = await loadDrafts();
    } catch {
      toast('删除失败，请检查浏览器存储设置');
      return;
    } finally {
      button.disabled = false;
    }
    draftChannel?.postMessage('changed');
    bookmarks = loadBookmarks();
    bookmarks.delete(id);
    try { saveBookmarks(bookmarks); } catch { /* The removed document is no longer displayed. */ }
    deleteDialog.close();
    render();
    const heading = main.querySelector('#documents-heading');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    toast('已删除本机文档');
  },
  repository: () => {
    if (repository) window.open(repository, '_blank', 'noopener,noreferrer');
    else toast('部署后可从这里打开 GitHub 仓库');
  },
  menu: () => toggleMenu(),
  'clear-tag': () => { state.tag = ''; showLibrary(); },
  'clear-search': () => { state.query = ''; search.value = ''; render(); search.focus(); },
};

app.addEventListener('click', event => {
  const item = event.target.closest('[data-nav], [data-action], [data-tag]');
  if (!item) return;
  event.preventDefault();
  if (item.dataset.nav) {
    clearFilters();
    toggleMenu(false);
    if (item.dataset.nav === 'admin') {
      if (isAdmin()) render();
      else location.hash = 'admin';
      return;
    }
    if (item.dataset.nav.startsWith('category/')) state.category = item.dataset.nav.slice('category/'.length);
    else if (item.dataset.nav !== 'all') state.scope = item.dataset.nav;
    showLibrary();
    window.scrollTo(0, 0);
  } else if (item.dataset.tag) {
    clearFilters();
    state.tag = item.dataset.tag;
    showLibrary();
    window.scrollTo(0, 0);
  } else actions[item.dataset.action]?.(item);
});

search.addEventListener('input', () => {
  const query = search.value;
  clearFilters();
  state.query = search.value = query;
  if (isAdmin()) render();
  else showLibrary();
  window.scrollTo(0, 0);
});

main.addEventListener('change', event => {
  if (event.target.matches('select')) {
    state.order = event.target.value;
    render();
    main.querySelector('select')?.focus();
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
window.addEventListener('popstate', render);
window.addEventListener('storage', () => {
  bookmarks = loadBookmarks();
  render();
});

async function refreshDrafts() {
  try {
    drafts = await loadDrafts();
    render();
  } catch {
    toast('无法读取本机文档，请检查浏览器存储设置');
  }
}

draftChannel?.addEventListener('message', refreshDrafts);

document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]')) return;
  if (event.key === 'Escape' && app.classList.contains('menu-open')) toggleMenu(false);
  if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    search.focus();
  }
});

render();
refreshDrafts();
if (ownerSession.repositoryError) toast(ownerSession.repositoryError);
