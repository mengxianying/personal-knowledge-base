import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, parse } from 'node:path';
import { isShareEnvelope, isShareId } from '../src/sharing.js';

const [source, destination] = process.argv.slice(2);
const entries = await readdir(source, { withFileTypes: true });
const shares = entries.filter(entry => entry.isFile() && extname(entry.name) === '.json' && isShareId(parse(entry.name).name));
await mkdir(destination, { recursive: true });
for (const { name } of shares) {
  const content = await readFile(join(source, name), 'utf8');
  if (!isShareEnvelope(JSON.parse(content))) throw new Error(`Invalid encrypted article share: ${name}`);
  await writeFile(join(destination, name), content);
}
console.log(`Staged ${shares.length} encrypted article shares`);
