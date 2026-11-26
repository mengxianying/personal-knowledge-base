import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getOwnerSession, signInWithGitHub } from '../src/github-access.js';

test('admits only the GitHub owner and loads repository documents after verification', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push([url, options]);
    if (url === 'https://api.github.com/user') return Response.json({ login: 'mengxianying', id: 13862259 });
    if (url.endsWith('/git/trees/main?recursive=1')) {
      return Response.json({ tree: [
        { type: 'blob', sha: 'a'.repeat(40), path: 'content/nested/owner.md' },
        { type: 'blob', sha: 'b'.repeat(40), path: 'public/shares/ignored.json' },
      ] });
    }
    return new Response('# 本人需求\n\n正文');
  });
  assert.equal(getOwnerSession(), null);
  await signInWithGitHub('test-token');
  assert.equal(getOwnerSession().login, 'mengxianying');
  assert.deepEqual(getOwnerSession().documents.map(({ id, title }) => [id, title]), [['nested/owner', '本人需求']]);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(([url, options]) => url.startsWith('https://api.github.com/') &&
    options.headers.Authorization === 'Bearer test-token' && options.redirect === 'error' && options.cache === 'no-store'));
  assert.equal(JSON.stringify(getOwnerSession()).includes('test-token'), false);
});

test('rejects other identities and invalid tokens before fetching any documents', async t => {
  for (const response of [Response.json({ login: 'another-account', id: 456 }), Response.json({ login: 'mengxianying', id: 456 }), new Response(null, { status: 401 })]) {
    const fetch = t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(signInWithGitHub('test-token'), /账号|令牌/);
    assert.equal(getOwnerSession(), null);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('allows local documents after verified login when repository contents are unavailable', async t => {
  t.mock.method(globalThis, 'fetch', async url => url.endsWith('/user')
    ? Response.json({ login: 'mengxianying', id: 13862259 }) : new Response(null, { status: 403 }));
  await signInWithGitHub('test-token');
  assert.equal(getOwnerSession().login, 'mengxianying');
  assert.deepEqual(getOwnerSession().documents, []);
  assert.match(getOwnerSession().repositoryError, /仓库文档/);
});
