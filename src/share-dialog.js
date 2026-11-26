import { icons } from './icons.js';
import { createShare, createSharePassword, isShareEnvelope, shareFileUrl } from './sharing.js';

export const shareDialog = `
  <dialog id="share-dialog" aria-labelledby="share-heading">
    <form>
      <header class="dialog-header">
        <div><h2 id="share-heading">密码分享</h2><p data-share-summary></p></div>
        <button type="button" class="icon-button" data-share-close aria-label="关闭">${icons.close}</button>
      </header>
      <div class="dialog-body">
        <label class="share-field">访问密码
          <span class="share-inline">
            <input data-share-password type="text" readonly autocomplete="off" spellcheck="false">
            <button type="button" class="button secondary" data-copy-password>复制密码</button>
          </span>
        </label>
        <div data-share-result hidden>
          <p>将下载的加密文件上传到 GitHub 并提交。发布成功后，把链接和密码分别发给访客。</p>
          <a class="button secondary" data-share-upload target="_blank" rel="noopener noreferrer">上传加密文件 ${icons.external}</a>
          <label class="share-field">访客链接
            <span class="share-inline">
              <input data-share-link type="url" readonly>
              <button type="button" class="button secondary" data-copy-link disabled>复制链接</button>
            </span>
          </label>
          <button type="button" class="button secondary" data-check-share>检查发布状态</button>
        </div>
        <p class="share-status" data-share-status role="status"></p>
      </div>
      <div class="dialog-footer">
        <button type="button" class="button secondary" data-share-close>关闭</button>
        <button type="submit" class="button primary">${icons.download} 下载加密文件</button>
      </div>
    </form>
  </dialog>`;

export function installShareDialog(dialog, repository) {
  const find = selector => dialog.querySelector(selector);
  const form = find('form');
  const summary = find('[data-share-summary]');
  const password = find('[data-share-password]');
  const result = find('[data-share-result]');
  const link = find('[data-share-link]');
  const upload = find('[data-share-upload]');
  const copyLink = find('[data-copy-link]');
  const check = find('[data-check-share]');
  const status = find('[data-share-status]');
  const submit = find('[type=submit]');
  let selection;
  let prepared;

  if (repository) upload.href = `${repository}/upload/main/public/shares`;
  else upload.hidden = true;

  dialog.querySelectorAll('[data-share-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => { password.value = ''; selection = undefined; prepared = undefined; });

  async function copy(field, message) {
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = message;
    } catch {
      field.focus();
      field.select();
      status.textContent = '请复制已选中的内容。';
    }
  }

  find('[data-copy-password]').addEventListener('click', () => copy(password, '已复制访问密码。'));
  copyLink.addEventListener('click', () => copy(link, '已复制访客链接。'));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!selection || submit.disabled) return;
    const current = selection;
    submit.disabled = true;
    status.textContent = '正在加密…';
    try {
      if (!prepared) {
        const id = crypto.randomUUID();
        const envelope = await createShare(current.title, current.documents, password.value);
        if (selection !== current || !dialog.open) return;
        prepared = { id, envelope, blob: new Blob([JSON.stringify(envelope)], { type: 'application/json' }) };
      }
      const url = URL.createObjectURL(prepared.blob);
      const download = document.createElement('a');
      download.href = url;
      download.download = `${prepared.id}.json`;
      download.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const visitor = new URL('share.html', location.href);
      visitor.searchParams.set('id', prepared.id);
      link.value = visitor.href;
      result.hidden = false;
      status.textContent = '已下载加密文件。';
    } catch (error) {
      if (selection === current && dialog.open) status.textContent = error.message || '加密失败，请重试。';
    } finally {
      if (selection === current) submit.disabled = false;
    }
  });

  check.addEventListener('click', async () => {
    if (!prepared) return;
    const current = prepared;
    check.disabled = true;
    status.textContent = '正在检查发布状态…';
    try {
      const response = await fetch(shareFileUrl(current.id, location.href), { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const envelope = await response.json();
      if (!isShareEnvelope(envelope) || envelope.ciphertext !== current.envelope.ciphertext) throw new Error();
      if (prepared !== current) return;
      copyLink.disabled = false;
      status.textContent = '分享已发布。';
    } catch {
      if (prepared === current) {
        copyLink.disabled = true;
        status.textContent = '还未找到此分享。请确认文件已提交，并等待网站部署完成。';
      }
    } finally {
      if (prepared === current) check.disabled = false;
    }
  });

  return (title, documents) => {
    selection = { title, documents };
    prepared = undefined;
    summary.textContent = documents.length ? `${title} · ${documents.length} 篇文章。访客输入密码后可查看。` : '当前页面没有可分享的文章。';
    password.value = createSharePassword();
    password.closest('label').hidden = !documents.length;
    link.value = '';
    result.hidden = true;
    copyLink.disabled = true;
    check.disabled = false;
    status.textContent = '';
    submit.disabled = !documents.length;
    dialog.showModal();
  };
}
