import { DEFAULT_CATEGORY, parseDocument, safeHttpUrl } from './documents.js';
import { icons } from './icons.js';
import { clipboardMarkdown } from './render-markdown.js';

const MAX_DOCUMENT_SIZE = 25_000_000;

export function installImportDialog(dialog, save, categories) {
  const form = dialog.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const notice = dialog.querySelector('.form-error');
  const fileInput = dialog.querySelector('input[type=file]');
  const submitButton = form.querySelector('[type=submit]');
  let existing;

  function fill(doc, preserveDate = false) {
    field('title').value = doc.title;
    field('category').value = doc.category;
    field('tags').value = doc.tags.join('、');
    field('source').value = doc.source;
    if (!preserveDate || doc.date) field('date').value = doc.date || '';
    field('body').value = doc.body;
  }

  async function loadFile() {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      if (file.size > MAX_DOCUMENT_SIZE) throw new Error('文件过大，请选择 25 MB 以内的文档。');
      const doc = parseDocument(await file.text(), { fallbackTitle: file.name.replace(/\.(md|markdown|txt)$/i, '') });
      fill(doc, true);
      notice.textContent = '';
      field('title').focus();
    } catch (error) {
      notice.textContent = error instanceof SyntaxError || error.name.startsWith('YAML')
        ? 'Markdown 文档的开头信息格式有误。请修改后重试，或直接粘贴正文。' : error.message;
    }
    fileInput.value = '';
  }

  fileInput.addEventListener('change', loadFile);
  dialog.querySelector('[data-file-button]').addEventListener('click', () => fileInput.click());
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  field('body').addEventListener('paste', event => {
    const html = event.clipboardData?.getData('text/html');
    if (!html) return;
    const markdown = clipboardMarkdown(html);
    if (!markdown) return;
    event.preventDefault();
    const body = field('body');
    body.setRangeText(markdown, body.selectionStart, body.selectionEnd, 'end');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitButton.disabled) return;
    const markdown = field('body').value.trim();
    if (!markdown) {
      notice.textContent = '请粘贴正文或导入文件。';
      field('body').focus();
      return;
    }
    if (markdown.length > MAX_DOCUMENT_SIZE) {
      notice.textContent = '正文超过 25 MB，请缩小图片或拆分文档。';
      return;
    }
    const source = field('source').value.trim();
    if (source && !safeHttpUrl(source)) {
      notice.textContent = '请填写有效的 http 或 https 原文链接。';
      field('source').focus();
      return;
    }
    submitButton.disabled = true;
    try {
      const doc = parseDocument(markdown);
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
      await save({
        id: existing?.id || `${date}-${crypto.randomUUID()}`,
        title: field('title').value.trim() || doc.title,
        category: field('category').value.trim() || doc.category,
        tags: [...new Set(field('tags').value.split(/[,，、]/).map(tag => tag.trim()).filter(Boolean))],
        source: safeHttpUrl(source),
        date: field('date').value,
        body: doc.title === '未命名文档' ? markdown : doc.body || markdown,
        local: true,
      }, Boolean(existing));
      dialog.close();
    } catch (error) {
      if (error.name === 'MissingDraftError') notice.textContent = error.message;
      else if (error.name === 'StorageUnavailableError') notice.textContent = error.message;
      else notice.textContent = error.name.startsWith('YAML')
        ? '无法读取正文开头的 Markdown 元数据。' : '保存失败，请检查浏览器存储空间或隐私设置。';
    } finally {
      submitButton.disabled = false;
    }
  });

  return doc => {
    existing = doc;
    form.reset();
    notice.textContent = '';
    dialog.querySelector('h2').textContent = doc ? '编辑本机文档' : '导入文档';
    const categoryOptions = dialog.querySelector('datalist');
    categoryOptions.replaceChildren(...categories().map(category => {
      const option = document.createElement('option');
      option.value = category;
      return option;
    }));
    if (doc) fill(doc);
    else {
      field('category').value = DEFAULT_CATEGORY;
      field('date').value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
    }
    dialog.showModal();
    field(doc ? 'title' : 'body').focus();
  };
}

export const importDialog = `
  <dialog id="import-dialog" aria-labelledby="import-title">
    <form>
      <header class="dialog-header">
        <div><h2 id="import-title">导入文档</h2>
          <p>复制飞书正文后粘贴，或选择 Markdown / TXT 文件。</p></div>
        <button class="icon-button" type="button" data-close aria-label="关闭">${icons.close}</button>
      </header>
      <div class="dialog-body">
        <div class="field-row">
          <label>文档标题<input name="title" maxlength="120" placeholder="留空时从正文读取"></label>
          <label>分类<input name="category" maxlength="40" list="categories" required><datalist id="categories"></datalist></label>
        </div>
        <div class="field-row">
          <label>标签<input name="tags" maxlength="150" placeholder="用逗号分隔"></label>
          <label>原文链接 <span>可选</span><input name="source" type="url" placeholder="https://…"></label>
        </div>
        <div class="field-row">
          <label>日期<input name="date" type="date"></label>
        </div>
        <div class="body-label"><label for="import-body">正文</label>
          <button type="button" class="text-button" data-file-button>${icons.upload} 选择文件</button>
          <input type="file" hidden accept=".md,.markdown,.txt">
        </div>
        <textarea name="body" id="import-body" rows="8" maxlength="25000000" placeholder="在这里粘贴飞书文档或 Markdown…"></textarea>
        <p class="form-error" aria-live="polite"></p>
      </div>
      <footer class="dialog-footer">
        <span>保存在当前浏览器</span>
        <button type="button" class="button secondary" data-close>取消</button>
        <button type="submit" class="button primary">保存到本机</button>
      </footer>
    </form>
  </dialog>`;
