import { createShare, createSharePassword, isShareEnvelope, isShareId, openShare } from './sharing.js';

export const ARTICLE_SHARE_BRANCH = 'article-shares';
const RAW_URL = 'https://raw.githubusercontent.com/mengxianying/personal-knowledge-base/';

export async function prepareArticleShare({ title, category, tags, date, body }, pageUrl) {
  const id = crypto.randomUUID();
  const key = createSharePassword();
  const envelope = await createShare(title, [{ title, category, tags, date, body, source: '' }], key);
  const link = new URL('article.html', pageUrl);
  link.searchParams.set('id', id);
  link.hash = key;
  return { id, link, content: btoa(JSON.stringify(envelope)) };
}

export function articleShareFileUrl(link) {
  const id = link.searchParams.get('id');
  return isShareId(id) ? new URL(`${ARTICLE_SHARE_BRANCH}/${id}.json`, RAW_URL) : null;
}

export async function readArticleShare(link) {
  const file = articleShareFileUrl(link);
  const key = link.hash.slice(1);
  if (!file || !/^[\w-]{24}$/.test(key)) throw new Error('分享链接不完整。');
  const sameOriginFile = new URL(`article-shares/${link.searchParams.get('id')}.json`, link);
  let envelope;
  let errorMessage;
  for (const url of [sameOriginFile, file]) {
    try {
      const response = await fetch(url.href, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
      if (!response.ok) {
        errorMessage = response.status === 404 ? '此分享暂时无法访问。' : '文章加载失败，请刷新页面重试。';
        continue;
      }
      const data = await response.json();
      if (isShareEnvelope(data)) {
        envelope = data;
        break;
      }
      errorMessage = '文章加载失败，请刷新页面重试。';
    } catch {
      errorMessage = '网络连接不稳定，请刷新页面重试。';
    }
  }
  if (!envelope) throw new Error(errorMessage);
  try {
    const { documents } = await openShare(envelope, key);
    if (documents.length !== 1) throw new Error();
    return documents[0];
  } catch {
    throw new Error('无法打开文章，请检查分享链接是否完整。');
  }
}
