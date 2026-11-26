import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishArticleShare, signInWithGitHub } from '../src/github-access.js';
import { readArticleShare, articleShareFileUrl } from '../src/article-share.js';

const page = 'https://mengxianying.github.io/personal-knowledge-base/?show=article#doc/test';
const doc = { title: '分享文章', category: '产品需求', tags: ['流程'], date: '2026-11-26', source: 'https://example.com', body: '仅共享当前正文' };

test('publishes only encrypted article data and returns a link an anonymous visitor can open', async t => {
  let upload;
  t.mock.method(globalThis, 'fetch', async (url, request = {}) => {
    if (url.endsWith('/user')) return Response.json({ login: 'mengxianying', id: 13862259 });
    if (url.includes('/git/trees/main')) return Response.json({ tree: [] });
    if (request.method === 'PUT') {
      upload = [url, request];
      return Response.json({}, { status: 201 });
    }
    assert.equal(request.credentials, 'omit');
    assert.equal(request.headers?.Authorization, undefined);
    const content = JSON.parse(upload[1].body).content;
    return new Response(atob(content));
  });
  await signInWithGitHub('owner-test-token');
  const link = await publishArticleShare(doc, page);
  assert.equal(link.origin + link.pathname, 'https://mengxianying.github.io/personal-knowledge-base/article.html');
  assert.match(link.hash, /^#[\w-]{24}$/);
  assert.equal(link.href.includes('owner-test-token'), false);
  const payload = JSON.parse(upload[1].body);
  assert.equal(payload.branch, 'article-shares');
  assert.match(upload[0], /\/contents\/[a-f0-9-]+\.json$/);
  assert.equal(upload[1].headers.Authorization, 'Bearer owner-test-token');
  const raw = atob(payload.content);
  assert.equal(raw.includes(doc.body), false);
  assert.equal(raw.includes(doc.title), false);
  assert.equal(raw.includes(link.hash.slice(1)), false);
  assert.equal(articleShareFileUrl(link).origin, 'https://raw.githubusercontent.com');
  assert.deepEqual(await readArticleShare(link), { ...doc, id: '1', source: '' });
});

test('generates no link without the owner and reports read-only repository permission', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/user')) return Response.json({ login: 'mengxianying', id: 13862259 });
    if (url.includes('/git/trees/main')) return Response.json({ tree: [] });
    return Response.json({}, { status: 403 });
  });
  await assert.rejects(signInWithGitHub(''), /令牌/);
  await assert.rejects(publishArticleShare(doc, page), /登录/);
  assert.equal(fetch.mock.callCount(), 0);
  await signInWithGitHub('readonly');
  await assert.rejects(publishArticleShare(doc, page), /读写权限/);
});

test('rejects missing and forged link fields before making requests', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('unexpected request');
  });
  for (const url of [new URL(page), new URL('https://example.com/article.html?id=../anything#aaaaaaaaaaaaaaaaaaaaaaaa')]) {
    await assert.rejects(readArticleShare(url), /不完整/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
