import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPrivateDocuments } from '../src/private-documents.js';

const path = 'documents/2026-11-27-test.json';
const sha = 'a'.repeat(40);
const document = {
  id: '2026-11-27-test', title: '私有文档', category: '产品需求',
  tags: ['原型'], date: '2026-11-27', source: 'https://example.com', body: '# 正文',
};

test('reads server-backed documents from a fresh session', async () => {
  const calls = [];
  const store = openPrivateDocuments('test-token', async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/personal-knowledge-base-private')) return Response.json({ private: true, default_branch: 'main' });
    if (url.includes('/git/trees/')) return Response.json({ tree: [{ path, sha, type: 'blob' }] });
    return Response.json(document);
  });
  assert.deepEqual(await store.list(), [{ ...document, sha, cloud: true }]);
  assert.ok(calls.every(([url, options]) => url.startsWith('https://api.github.com/repos/mengxianying/personal-knowledge-base-private')
    && options.headers.Authorization === 'Bearer test-token' && options.redirect === 'error'));
});

test('writes and deletes with the revision read by the editor', async () => {
  const mutations = [];
  const store = openPrivateDocuments('test-token', async (url, options) => {
    if (!options.method) return Response.json({ private: true, default_branch: 'main' });
    mutations.push([url, options.method, JSON.parse(options.body)]);
    return Response.json({ content: { sha } });
  });
  const saved = await store.save(document, sha);
  await store.remove(saved);
  assert.equal(mutations[0][2].sha, sha);
  assert.deepEqual(JSON.parse(Buffer.from(mutations[0][2].content, 'base64').toString('utf8')), document);
  assert.equal(mutations[1][1], 'DELETE');
  assert.equal(mutations[1][2].sha, sha);
  assert.ok(mutations.every(([url]) => url.endsWith('/contents/' + path)));
});

test('blocks a public repository and surfaces write conflicts', async () => {
  let calls = 0;
  const publicStore = openPrivateDocuments('test-token', async () => {
    calls++;
    return Response.json({ private: false, default_branch: 'main' });
  });
  await assert.rejects(publicStore.save(document), /私有/);
  assert.equal(calls, 1);
  const conflictStore = openPrivateDocuments('test-token', async (_, options) => options.method
    ? new Response(null, { status: 409 })
    : Response.json({ private: true, default_branch: 'main' }));
  await assert.rejects(conflictStore.save(document, sha), /其他设备/);
});

test('does not report a failed read as an empty library', async () => {
  const store = openPrivateDocuments('test-token', async (url) => url.includes('/git/trees/')
    ? new Response(null, { status: 503 })
    : Response.json({ private: true, default_branch: 'main' }));
  await assert.rejects(store.list(), /云端/);
});
