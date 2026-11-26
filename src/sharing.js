const VERSION = 1;
const ITERATIONS = 600_000;
const MAX_SHARE_BYTES = 18_000_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

function encode(bytes) {
  const chunks = [];
  const chunkSize = 24_576;
  for (let start = 0; start < bytes.length; start += chunkSize) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(start, start + chunkSize))));
  }
  return chunks.join('').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value) {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function createSharePassword() {
  return encode(randomBytes(18));
}

function projectDocument({ title, category, tags, date, source, body }, index) {
  return { id: String(index + 1), title, category, tags, date, source, body };
}

async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function createShare(title, documents, password) {
  if (!documents.length) throw new Error('请选择至少一篇文档');
  const payload = encoder.encode(JSON.stringify({ title, documents: documents.map(projectDocument) }));
  if (payload.byteLength > MAX_SHARE_BYTES) throw new Error('分享内容超过 18 MB，请减少选择的文章');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  return { version: VERSION, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
}

export function isShareEnvelope(value) {
  return value?.version === VERSION
    && typeof value.salt === 'string' && /^[\w-]{22}$/.test(value.salt)
    && typeof value.iv === 'string' && /^[\w-]{16}$/.test(value.iv)
    && typeof value.ciphertext === 'string'
    && value.ciphertext.length >= 22 && value.ciphertext.length <= Math.ceil((MAX_SHARE_BYTES + 16) * 4 / 3)
    && /^[\w-]+$/.test(value.ciphertext);
}

export async function openShare(envelope, password) {
  if (!isShareEnvelope(envelope)) throw new Error('分享文件格式无效');
  const key = await deriveKey(password, decode(envelope.salt));
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv) }, key, decode(envelope.ciphertext));
  const snapshot = JSON.parse(decoder.decode(bytes));
  const valid = snapshot && typeof snapshot.title === 'string' && Array.isArray(snapshot.documents)
    && snapshot.documents.length && snapshot.documents.every((doc, index) =>
      doc?.id === String(index + 1) && [doc.title, doc.category, doc.date, doc.source, doc.body].every(value => typeof value === 'string')
      && Array.isArray(doc.tags) && doc.tags.every(tag => typeof tag === 'string'));
  if (!valid) throw new Error('分享文件内容无效');
  return snapshot;
}

export const isShareId = value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value ?? '');

export function shareFileUrl(id, pageUrl) {
  return new URL(`shares/${id}.json`, pageUrl);
}
