import { parseDocument } from './documents.js';
import { ARTICLE_SHARE_BRANCH, prepareArticleShare } from './article-share.js';

const OWNER_LOGIN = 'mengxianying';
const OWNER_ID = 13862259;
const API = 'https://api.github.com';
const REPOSITORY = `/repos/${OWNER_LOGIN}/personal-knowledge-base`;
let ownerSession = null;
let ownerToken = '';

export function getOwnerSession() {
  return ownerSession;
}

function githubRequest(path, token, accept = 'application/vnd.github+json') {
  return fetch(API + path, {
    headers: { Accept: accept, Authorization: `Bearer ${token}` },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
}

async function readRepositoryDocuments(token) {
  const response = await githubRequest(`${REPOSITORY}/git/trees/main?recursive=1`, token);
  if (!response.ok) throw new Error('无法读取仓库目录');
  const { tree, truncated } = await response.json();
  if (!Array.isArray(tree) || truncated) throw new Error('无法读取完整仓库目录');
  const files = tree.filter(file => file.type === 'blob' && /^[a-f0-9]{40}$/.test(file.sha)
    && file.path.startsWith('content/') && file.path.endsWith('.md'));
  const results = await Promise.allSettled(files.map(async file => {
    const raw = await githubRequest(`${REPOSITORY}/git/blobs/${file.sha}`, token, 'application/vnd.github.raw+json');
    if (!raw.ok) throw new Error('无法读取文档');
    const id = file.path.slice('content/'.length, -3);
    return parseDocument(await raw.text(), { id, fallbackTitle: id.split('/').at(-1) });
  }));
  return {
    documents: results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []),
    repositoryError: results.some(result => result.status === 'rejected') ? '部分仓库文档未能加载。' : '',
  };
}

export async function signInWithGitHub(value) {
  ownerSession = null;
  ownerToken = '';
  const token = value.trim();
  if (!token) throw new Error('请输入 GitHub 访问令牌。');
  let response;
  try {
    response = await githubRequest('/user', token);
  } catch {
    throw new Error('无法连接 GitHub，请稍后重试。');
  }
  if (response.status === 401) throw new Error('GitHub 访问令牌无效或已过期。');
  if (!response.ok) throw new Error('GitHub 暂时无法验证令牌，请稍后重试。');
  const { login, id } = await response.json();
  if (typeof login !== 'string' || login.toLowerCase() !== OWNER_LOGIN || id !== OWNER_ID) {
    throw new Error('此 GitHub 账号没有访问权限。');
  }
  const repository = await readRepositoryDocuments(token).catch(() => ({
    documents: [],
    repositoryError: '仓库文档未能加载，请检查令牌的 Contents 读取权限后重新登录。',
  }));
  ownerSession = { login: OWNER_LOGIN, ...repository };
  ownerToken = token;
}

export async function publishArticleShare(doc, pageUrl) {
  if (!ownerSession || !ownerToken) throw new Error('请先登录知识库。');
  const token = ownerToken;
  const { id, link, content } = await prepareArticleShare(doc, pageUrl);
  let response;
  try {
    response = await fetch(`${API}${REPOSITORY}/contents/${id}.json`, {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ branch: ARTICLE_SHARE_BRANCH, message: 'Publish encrypted article share', content }),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(75_000),
    });
  } catch {
    throw new Error('无法连接 GitHub，请关闭弹窗后重试。');
  }
  if (response.status === 401) throw new Error('访问令牌已失效，请重新登录。');
  if ([403, 404].includes(response.status)) {
    throw new Error('生成分享链接需要此仓库的 Contents 读写权限。请使用有该权限的令牌重新登录。');
  }
  if (!response.ok) throw new Error('GitHub 未能发布文章，请关闭弹窗后重试。');
  return link;
}
