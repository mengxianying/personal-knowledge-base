const repository = 'https://api.github.com/repos/mengxianying/personal-knowledge-base-private';
const documentPath = /^documents\/([\w-]{1,120})\.json$/;
const revision = /^[a-f0-9]{40}$/;
const MAX_BYTES = 25_000_000;

function validateDocument(doc) {
  const { id, title, category, tags, date, source, body } = doc ?? {};
  if (![id, title, category, date, source, body].every(item => typeof item === 'string') ||
    !documentPath.test(`documents/${id}.json`) || !title.trim() || !body.trim() ||
    !Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')) {
    throw new Error('云端文档格式有误。');
  }
  return { id, title, category, tags, date, source, body };
}

function encode(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function openPrivateDocuments(token, request = fetch) {
  function error(message) {
    return Object.assign(new Error(message), { name: 'CloudDocumentError' });
  }

  async function call(path, { method, data, accept = 'application/vnd.github+json' } = {}) {
    let result;
    try {
      result = await request(repository + path, {
        method,
        headers: { Accept: accept, Authorization: `Bearer ${token}`, ...(data && { 'Content-Type': 'application/json' }) },
        body: data && JSON.stringify(data),
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(method ? 75_000 : 35_000),
      });
    } catch {
      throw error('无法连接云端文档仓库。请检查网络后重试。');
    }
    if (result.status === 409 || result.status === 422 || (result.status === 404 && method)) {
      throw error('文档可能已在其他设备更新。请重新登录后打开最新版本，保存前先复制当前更改。');
    }
    if ([401, 403, 404].includes(result.status)) {
      throw error('云端仓库无法访问。请检查令牌是否包含两个知识库仓库的 Contents 读写权限。');
    }
    if (!result.ok) throw error('云端文档请求失败，请稍后重试。');
    return result.json();
  }

  async function getBranch() {
    const repo = await call('');
    if (repo.private !== true || typeof repo.default_branch !== 'string') {
      throw error('云端文档仓库必须设为私有。');
    }
    return repo.default_branch;
  }

  async function list() {
    const branch = await getBranch();
    const { tree, truncated } = await call(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    if (!Array.isArray(tree) || truncated) throw error('无法读取完整的云端文档列表。');
    const files = tree.filter(file => file.type === 'blob' && documentPath.test(file.path));
    const documents = [];
    for (let offset = 0; offset < files.length; offset += 6) {
      const batch = await Promise.all(files.slice(offset, offset + 6).map(async file => {
        if (!revision.test(file.sha)) throw error('云端文档版本无效。');
        const data = await call(`/git/blobs/${file.sha}`, { accept: 'application/vnd.github.raw+json' });
        const doc = validateDocument(data);
        if (file.path !== `documents/${doc.id}.json`) throw error('云端文档编号不匹配。');
        return { ...doc, sha: file.sha, cloud: true };
      }));
      documents.push(...batch);
    }
    return documents;
  }

  async function save(document, sha) {
    const doc = validateDocument(document);
    const bytes = new TextEncoder().encode(JSON.stringify(doc));
    if (bytes.length > MAX_BYTES) throw error('云端文档超过 25 MB，请缩小图片或拆分文档。');
    if (sha && !revision.test(sha)) throw error('云端文档版本无效。');
    const branch = await getBranch();
    const result = await call(`/contents/documents/${doc.id}.json`, {
      method: 'PUT',
      data: { branch, message: sha ? 'Update private document' : 'Add private document', content: encode(bytes), ...(sha && { sha }) },
    });
    if (!revision.test(result.content?.sha)) throw error('无法确认云端保存结果，请重新登录检查。');
    return { ...doc, sha: result.content.sha, cloud: true };
  }

  async function remove({ id, sha }) {
    if (!documentPath.test(`documents/${id}.json`) || !revision.test(sha)) throw error('云端文档版本无效。');
    const branch = await getBranch();
    await call(`/contents/documents/${id}.json`, { method: 'DELETE', data: { branch, sha, message: 'Delete private document' } });
  }

  return { list, save, remove };
}
