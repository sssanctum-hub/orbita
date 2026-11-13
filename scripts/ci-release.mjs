import { readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const pkg = await json('package.json');
const config = await json('src-tauri/tauri.conf.json');
const version = pkg.version;
const tag = `v${version}`;
const output = path.join(root, 'release-output');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function metadata() {
  if (!/^\d+\.\d+\.\d+$/.test(version) || config.version !== version) throw Error('Package and Tauri versions must match.');
  const cargo = await readFile('src-tauri/Cargo.toml', 'utf8');
  if (!cargo.includes(`version = "${version}"`)) throw Error('Cargo version does not match.');
  const lock = await json('package-lock.json');
  if (lock.version !== version || lock.packages[''].version !== version) throw Error('npm lock version does not match.');
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== tag) throw Error('Tag must match application version.');
  if (!Number.isSafeInteger(config.bundle.android.versionCode)) throw Error('Android versionCode is invalid.');
  return { version, tag, versionCode: config.bundle.android.versionCode, commit: process.env.GITHUB_SHA || 'local' };
}

async function filesUnder(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(file));
    else result.push(file);
  }
  return result;
}

async function sign() {
  const info = await metadata();
  if (!process.env.ANDROID_KEYSTORE_BASE64 || !process.env.ANDROID_KEYSTORE_PASSWORD) throw Error('Android signing secrets are missing.');
  const tools = path.join(process.env.ANDROID_HOME, 'build-tools', '37.0.0');
  const candidates = (await filesUnder('unsigned-apk')).filter(file => file.endsWith('.apk'));
  if (candidates.length !== 1) throw Error('Expected exactly one unsigned release APK.');
  const manifest = run(path.join(tools, 'aapt2'), ['dump', 'badging', candidates[0]]);
  if (!manifest.includes(`versionName='${version}'`) || !manifest.includes(`versionCode='${info.versionCode}'`) ||
      !manifest.includes("name='ru.personalassistant.desktop'") || !manifest.includes("native-code: 'arm64-v8a'")) {
    throw Error('APK package, architecture or version does not match source metadata.');
  }
  await mkdir(output, { recursive: true });
  const key = path.join(process.env.RUNNER_TEMP, 'orbita-release.p12');
  const aligned = path.join(process.env.RUNNER_TEMP, 'orbita-aligned.apk');
  const apk = path.join(output, `orbita-${version}-arm64.apk`);
  try {
    await writeFile(key, Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, 'base64'), { mode: 0o600 });
    run(path.join(tools, 'zipalign'), ['-P', '16', '-f', '4', candidates[0], aligned]);
    run(path.join(tools, 'apksigner'), ['sign', '--ks', key, '--ks-key-alias', 'orbita',
      '--ks-pass', 'env:ANDROID_KEYSTORE_PASSWORD', '--out', apk, aligned]);
    const signature = run(path.join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', apk]);
    const expected = process.env.ANDROID_CERT_SHA256?.toLowerCase().replaceAll(':', '');
    const actual = signature.match(/certificate SHA-256 digest: ([a-fA-F0-9]+)/)?.[1].toLowerCase();
    if (!expected || actual !== expected) throw Error('APK signing certificate does not match the existing application.');
    run(path.join(tools, 'zipalign'), ['-c', '-P', '16', '4', apk]);
    await writeFile(apk + '.verification.txt', signature + '\n' + manifest);
    await writeFile(apk + '.sha256', digest(await readFile(apk)) + '  ' + path.basename(apk) + '\n');
    console.log('APK signed and verified with the existing certificate.');
  } finally {
    await rm(key, { force: true });
    await rm(aligned, { force: true });
  }
}

async function verifyWeb() {
  const info = await metadata();
  const base = new URL(process.env.ORBITA_WEB_URL);
  if (base.protocol !== 'https:') throw Error('Web URL must be HTTPS.');
  for (const file of ['index.html', 'sw.js', 'release.json']) {
    const url = new URL(file, base);
    url.searchParams.set('release-check', `${info.commit}-${Date.now()}`);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok || digest(Buffer.from(await response.arrayBuffer())) !== digest(await readFile(`dist/${file}`))) {
      throw Error(`Published ${file} does not match this build. Telegram publication stopped.`);
    }
  }
  console.log('Public website matches the built release.');
}

try {
  const mode = process.argv[2];
  if (mode === 'metadata') {
    const info = await metadata();
    console.log(JSON.stringify(info));
    if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `version=${version}\ntag=${tag}\n`, { flag: 'a' });
  } else if (mode === 'web-manifest') {
    await writeFile('dist/release.json', JSON.stringify(await metadata()) + '\n');
  } else if (mode === 'sign') await sign();
  else if (mode === 'verify-web') await verifyWeb();
  else throw Error('Unknown release command.');
} catch (error) {
  // Child process errors can include environment-sensitive arguments; keep diagnostics bounded.
  console.error(error.status !== undefined ? `Release tool failed with exit code ${error.status}.` : error.message);
  process.exitCode = 1;
}
