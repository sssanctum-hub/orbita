import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function prepareRelease(release, repository, webUrl) {
  if (!release || release.draft || release.prerelease) throw new Error('A published stable release is required.');
  if (!/^v?\d+\.\d+\.\d+$/.test(release.tag_name)) throw new Error('Expected a version tag such as v2.0.26.');
  const web = new URL(webUrl);
  if (web.protocol !== 'https:' || web.username || web.password) throw new Error('Web URL must use HTTPS without credentials.');
  const apks = (release.assets || []).filter(asset => asset.name.endsWith('.apk'));
  if (apks.length !== 1) throw new Error('Attach exactly one signed APK before publishing the release.');
  const apk = apks[0];
  if (!apk.size || apk.size > 49 * 1024 * 1024) throw new Error('APK is empty or exceeds the upload size limit.');
  const url = new URL(apk.browser_download_url);
  if (url.origin !== 'https://github.com' || !url.pathname.startsWith(`/${repository}/releases/download/`)) {
    throw new Error('APK must belong to this GitHub repository.');
  }
  return { apk, caption: `Орбита ${release.tag_name}\n\nAndroid: APK во вложении.\nВеб-версия: ${web.href}` };
}

export async function publish(env = process.env, request = fetch) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Add TELEGRAM_BOT_TOKEN in GitHub Actions secrets.');
  if (!env.TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is missing.');
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  const { apk, caption } = prepareRelease(event.release, env.GITHUB_REPOSITORY, env.ORBITA_WEB_URL);
  // Never log Telegram URLs: the token is part of the URL.
  const botRequest = async (method, options = {}) => {
    let response;
    try {
      response = await request(`https://api.telegram.org/bot${token}/${method}`, {
        ...options, signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new Error(`Telegram ${method} connection failed. Check the channel before retrying; delivery may have succeeded.`);
    }
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed (HTTP ${response.status}, code ${data.error_code ?? 'unknown'}).`);
    return data.result;
  };
  const bot = await botRequest('getMe');
  if (bot.username?.toLowerCase() !== env.TELEGRAM_BOT_USERNAME?.toLowerCase()) {
    throw new Error('Token belongs to a different bot.');
  }
  const response = await request(apk.browser_download_url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`APK download failed: HTTP ${response.status}.`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== apk.size) throw new Error('Downloaded APK size does not match release metadata.');
  const form = new FormData();
  form.set('chat_id', env.TELEGRAM_CHAT_ID);
  form.set('caption', caption);
  form.set('document', new Blob([bytes], { type: 'application/vnd.android.package-archive' }), apk.name);
  const message = await botRequest('sendDocument', { method: 'POST', body: form });
  console.log(`Published Telegram message ${message.message_id}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publish().catch(error => { console.error(error.message); process.exitCode = 1; });
}
