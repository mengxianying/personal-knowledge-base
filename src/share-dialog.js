import { icons } from './icons.js';
import { publishArticleShare } from './github-access.js';

export const shareDialog = `
  <dialog id="share-dialog" aria-labelledby="share-heading">
    <header class="dialog-header">
      <div><h2 id="share-heading">分享文章</h2><p data-share-title></p></div>
      <button type="button" class="icon-button" data-share-close aria-label="关闭">${icons.close}</button>
    </header>
    <div class="dialog-body">
      <p class="share-description">任何持有链接的人都可以直接阅读这篇文章。</p>
      <label class="share-field" data-share-result hidden>分享链接
        <span class="share-inline">
          <input data-share-link type="url" readonly>
          <button type="button" class="button primary" data-copy-link>复制链接</button>
        </span>
      </label>
      <p class="share-status" data-share-status role="status"></p>
    </div>
  </dialog>`;

export function installShareDialog(dialog) {
  const title = dialog.querySelector('[data-share-title]');
  const result = dialog.querySelector('[data-share-result]');
  const link = dialog.querySelector('[data-share-link]');
  const copyLink = dialog.querySelector('[data-copy-link]');
  const status = dialog.querySelector('[data-share-status]');
  const close = dialog.querySelector('[data-share-close]');
  const published = new WeakMap();

  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    if (close.disabled) event.preventDefault();
  });

  copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      status.textContent = '已复制分享链接。';
    } catch {
      link.focus();
      link.select();
      status.textContent = '请复制已选中的链接。';
    }
  });

  return async doc => {
    if (dialog.open) return;
    title.textContent = doc.title;
    result.hidden = true;
    status.textContent = '正在生成分享链接…';
    close.disabled = true;
    dialog.showModal();
    try {
      const url = published.get(doc) ?? await publishArticleShare(doc, location.href);
      published.set(doc, url);
      link.value = url.href;
      result.hidden = false;
      status.textContent = '';
      copyLink.focus();
    } catch (error) {
      status.textContent = error.message || '生成链接失败，请重试。';
    } finally {
      close.disabled = false;
    }
  };
}
