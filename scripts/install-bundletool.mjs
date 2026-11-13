import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Pin the tool; never silently pick a newer release for a reproducible build.
const version = '1.18.3';
const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, '.tools', 'android');
const name = `bundletool-all-${version}.jar`;
const output = path.join(dir, name);
const release = await fetch(`https://api.github.com/repos/google/bundletool/releases/tags/${version}`, {
  headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30_000),
});
if (!release.ok) throw new Error(`Cannot read the official bundletool release: HTTP ${release.status}`);
const asset = (await release.json()).assets.find(item => item.name === name);
if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) {
  throw new Error('The official release does not provide a SHA-256 digest; refusing an unverified download.');
}
const expected = asset.digest.slice('sha256:'.length);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  const bytes = await fs.readFile(output);
  if (hash(bytes) === expected) {
    console.log(`bundletool ${version} already installed and verified.`);
    process.exit(0);
  }
  throw new Error('Existing bundletool checksum differs. Inspect it before replacing it.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (asset.browser_download_url !== `https://github.com/google/bundletool/releases/download/${version}/${name}`) {
  throw new Error('Unexpected official download location.');
}
const response = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(120_000) });
if (!response.ok) throw new Error(`Cannot download bundletool: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length !== asset.size || hash(bytes) !== expected) throw new Error('bundletool checksum or size mismatch.');
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(output, bytes, { flag: 'wx' });
await fs.writeFile(output + '.sha256', `${expected}  ${name}\n`, { flag: 'wx' });
console.log(`Installed bundletool ${version}; official SHA-256 verified.`);
