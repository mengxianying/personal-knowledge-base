import './style.css';
import { icons } from './icons.js';
import { signInWithGitHub } from './github-access.js';

const app = document.querySelector('#app');
const tokenSettings = new URL('https://github.com/settings/personal-access-tokens/new');
tokenSettings.searchParams.set('name', '知屿只读登录');
tokenSettings.searchParams.set('target_name', 'mengxianying');
tokenSettings.searchParams.set('contents', 'read');

app.innerHTML = `
  <main class="owner-sign-in">
    <section class="reader owner-sign-in-card" aria-labelledby="sign-in-title">
      <div class="brand"><span class="brand-mark">${icons.library}</span><span><strong>知屿</strong><small>个人知识库</small></span></div>
      <h1 id="sign-in-title">登录知识库</h1>
      <p>此入口仅向 GitHub 账号 <strong>mengxianying</strong> 开放。</p>
      <form>
        <label class="share-field">GitHub 访问令牌
          <input type="password" required autocomplete="off" spellcheck="false" maxlength="256" aria-describedby="sign-in-help">
        </label>
        <p id="sign-in-help">创建令牌时选择 <code>personal-knowledge-base</code> 仓库，并给 Contents「只读」权限。</p>
        <div class="owner-sign-in-actions">
          <button type="submit" class="button primary">验证并登录</button>
          <a href="${tokenSettings.href}" target="_blank" rel="noopener noreferrer">在 GitHub 创建令牌 ${icons.external}</a>
        </div>
      </form>
      <p class="share-status" role="status"></p>
    </section>
  </main>`;

const form = app.querySelector('form');
const credential = form.querySelector('input');
const submit = form.querySelector('button');
const status = app.querySelector('[role=status]');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const token = credential.value;
  credential.value = '';
  submit.disabled = true;
  credential.disabled = true;
  status.textContent = '正在验证 GitHub 账号…';
  try {
    await signInWithGitHub(token);
  } catch (error) {
    status.textContent = error.message || '验证失败，请重试。';
    credential.disabled = false;
    submit.disabled = false;
    credential.focus();
    return;
  }
  try {
    await import('./app.js');
  } catch {
    status.textContent = '知识库加载失败，请刷新页面重试。';
  }
});

window.addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
