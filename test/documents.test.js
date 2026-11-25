import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDocument, serializeDocument, filterDocuments, safeHttpUrl } from '../src/documents.js';

test('imports a Markdown title and normalizes its line endings', () => {
  const doc = parseDocument('# 柜台需求\r\n\r\n## 背景\r\n调整产品入口', { id: 'test' });
  assert.equal(doc.title, '柜台需求');
  assert.equal(doc.body, '## 背景\n调整产品入口');
});

test('round-trips publication metadata and body', () => {
  const doc = {
    id: 'demo', title: '记录「发布: 需求」', category: '产品需求', tags: ['移动端', '流程'],
    date: '2026-11-25', source: 'https://example.feishu.cn/wiki/abc', body: '正文\n\n## 验收',
  };
  assert.deepEqual(parseDocument(serializeDocument(doc), { id: doc.id }), doc);
});

test('filters by category, source, title and content together', () => {
  const docs = [
    { id: 'a', title: '体验优化', body: '支付对账流程', tags: [], category: '产品需求', local: true },
    { id: 'b', title: '体验优化', body: '支付对账流程', tags: [], category: '产品需求' },
    { id: 'c', title: '需求', body: '支付对账流程', tags: [], category: '产品需求', local: true },
  ];
  assert.deepEqual(filterDocuments(docs, { query: '体验 对账', category: '产品需求', scope: 'local' }).map(doc => doc.id), ['a']);
});

test('accepts HTTPS source URLs and excludes non-web schemes', () => {
  assert.equal(safeHttpUrl('https://example.feishu.cn/wiki/abc'), 'https://example.feishu.cn/wiki/abc');
  assert.equal(safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(safeHttpUrl('http://name:secret@example.com/'), '');
});
