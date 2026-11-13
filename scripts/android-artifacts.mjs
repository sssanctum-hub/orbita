import fs from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

// Release artifacts are small ZIPs. Fail closed for ZIP64 or encrypted entries.
export function readZip(buffer) {
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0) throw new Error('ZIP end directory missing.');
  if (buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('Multi-disk ZIP is unsupported.');
  const count = buffer.readUInt16LE(end + 10);
  if (count === 65_535) throw new Error('ZIP64 is unsupported.');
  const files = new Map();
  let offset = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central directory.');
    if (buffer.readUInt16LE(offset + 8) & 1) throw new Error('Encrypted ZIP is unsupported.');
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameSize = buffer.readUInt16LE(offset + 28);
    const extraSize = buffer.readUInt16LE(offset + 30);
    const commentSize = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    if ([compressedSize, size, local].includes(0xffffffff)) throw new Error('ZIP64 is unsupported.');
    const name = buffer.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
    if (files.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    expanded += size;
    if (expanded > 512 * 1024 * 1024) throw new Error('Unexpectedly large release archive.');
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error(`Invalid local ZIP header: ${name}`);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressedSize > buffer.length) throw new Error(`Truncated ZIP entry: ${name}`);
    const packed = buffer.subarray(start, start + compressedSize);
    const bytes = compression === 0 ? packed : compression === 8 ? inflateRawSync(packed, { maxOutputLength: Math.max(size, 1) }) : null;
    if (!bytes || bytes.length !== size) throw new Error(`Invalid ZIP content: ${name}`);
    files.set(name, bytes);
    offset += 46 + nameSize + extraSize + commentSize;
  }
  return files;
}

export function verifyArm64Elf(bytes, name = 'native library') {
  if (bytes.length < 64 || bytes.readUInt32LE(0) !== 0x464c457f || bytes[4] !== 2 || bytes[5] !== 1 || bytes.readUInt16LE(18) !== 183) {
    throw new Error(`${name}: expected a little-endian arm64 ELF64 library.`);
  }
  const table = Number(bytes.readBigUInt64LE(32));
  const size = bytes.readUInt16LE(54), count = bytes.readUInt16LE(56);
  if (!Number.isSafeInteger(table) || size < 56 || table + size * count > bytes.length) throw new Error(`${name}: invalid ELF segment table.`);
  let loadSegments = 0;
  for (let i = 0; i < count; i++) {
    const offset = table + i * size;
    if (bytes.readUInt32LE(offset) !== 1) continue;
    loadSegments++;
    const fileOffset = bytes.readBigUInt64LE(offset + 8);
    const address = bytes.readBigUInt64LE(offset + 16);
    const alignment = bytes.readBigUInt64LE(offset + 48);
    if (alignment < 16_384n || fileOffset % 16_384n !== address % 16_384n) {
      throw new Error(`${name}: LOAD segment does not support 16 KB pages.`);
    }
  }
  if (!loadSegments) throw new Error(`${name}: no LOAD segments.`);
  return `${name}: ${loadSegments} LOAD segments support 16 KB pages.`;
}

async function filesUnder(dir) {
  const result = [];
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...await filesUnder(file));
    else if (item.isFile()) result.push(file);
  }
  return result;
}

export async function assertCurrentNative(root, library) {
  const compiled = await fs.stat(library);
  const inputs = [
    ...await filesUnder(path.join(root, 'src-tauri', 'src')),
    ...await filesUnder(path.join(root, 'dist')),
    ...['Cargo.toml', 'Cargo.lock', 'build.rs', 'tauri.conf.json'].map(file => path.join(root, 'src-tauri', file)),
  ];
  for (const file of inputs) {
    if ((await fs.stat(file)).mtimeMs > compiled.mtimeMs) {
      throw new Error(`Native library is older than ${path.relative(root, file)}. Run the Android Rust build first; do not package stale code.`);
    }
  }
  const config = JSON.parse(await fs.readFile(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'));
  const properties = await fs.readFile(path.join(root, 'src-tauri', 'gen', 'android', 'app', 'tauri.properties'), 'utf8');
  if (!properties.split(/\r?\n/).includes(`tauri.android.versionName=${config.version}`) ||
      !properties.split(/\r?\n/).includes(`tauri.android.versionCode=${config.bundle.android.versionCode}`)) {
    throw new Error('Generated Android version differs from the project. Run the Android build first.');
  }
  verifyArm64Elf(await fs.readFile(library));
}
