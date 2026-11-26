import assert from 'node:assert/strict';
import test from 'node:test';
import { createShare, openShare, createSharePassword } from '../src/sharing.js';

const docs = [{
  id: 'local/private-id', title: '私有标题', category: '产品需求', tags: ['原型'],
  date: '2026-11-25', source: 'https://example.com/原型', body: '私有正文\n![配图](data:image/png;base64,AQID)',
  local: true,
}];

test('encrypts titles and full document details and opens them with the original password', async () => {
  const password = createSharePassword();
  const encrypted = await createShare('产品需求', docs, password);
  const raw = JSON.stringify(encrypted);
  for (const secret of [password, '私有标题', '私有正文', '产品需求', 'private-id', 'example.com']) {
    assert.equal(raw.includes(secret), false);
  }
  const snapshot = await openShare(JSON.parse(raw), password);
  assert.equal(snapshot.title, '产品需求');
  const { local, ...document } = docs[0];
  assert.deepEqual(snapshot.documents, [{ ...document, id: '1' }]);
});

test('rejects a wrong password and ciphertext changed after encryption', async () => {
  const password = createSharePassword();
  const encrypted = await createShare('示例', docs, password);
  await assert.rejects(openShare(encrypted, createSharePassword()));
  const first = encrypted.ciphertext.startsWith('A') ? 'B' : 'A';
  await assert.rejects(openShare({ ...encrypted, ciphertext: first + encrypted.ciphertext.slice(1) }, password));
});

test('uses unique ciphertext for each share and rejects unsupported data versions', async () => {
  const password = createSharePassword();
  const first = await createShare('示例', docs, password);
  const second = await createShare('示例', docs, password);
  assert.notEqual(first.ciphertext, second.ciphertext);
  await assert.rejects(openShare({ ...first, version: 2 }, password), /分享文件/);
});
