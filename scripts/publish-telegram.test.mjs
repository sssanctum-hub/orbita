import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareRelease, publish } from './publish-telegram.mjs';

const repo = 'sssanctum-hub/orbita';
const release = { tag_name: 'v2.0.25', assets: [{ name: 'orbita.apk', size: 3,
  browser_download_url: `https://github.com/${repo}/releases/download/v2.0.25/orbita.apk` }] };

test('reject incomplete, prerelease and foreign APK releases', () => {
  for (const invalid of [
    { ...release, assets: [] }, { ...release, prerelease: true },
    { ...release, assets: [release.assets[0], release.assets[0]] },
    { ...release, assets: [{ ...release.assets[0], browser_download_url: 'https://example.com/file.apk' }] },
  ]) assert.throws(() => prepareRelease(invalid, repo, 'https://example.com'));
});

test('send APK bytes and web link to configured channel without network', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'orbita-telegram-'));
  try {
    const event = path.join(dir, 'event.json');
    await writeFile(event, JSON.stringify({ release }));
    let sends = 0;
    await publish({ TELEGRAM_BOT_TOKEN: 'test-only', TELEGRAM_CHAT_ID: 'test-channel',
      TELEGRAM_BOT_USERNAME: 'davaivorbitu_ai', GITHUB_EVENT_PATH: event,
      GITHUB_REPOSITORY: repo, ORBITA_WEB_URL: 'https://example.com' }, async (url, options) => {
      if (url.endsWith('/getMe')) return Response.json({ ok: true, result: { username: 'davaivorbitu_ai' } });
      if (url.endsWith('/sendDocument')) {
        sends++;
        assert.equal(options.body.get('chat_id'), 'test-channel');
        assert.equal(options.body.get('document').size, 3);
        assert.match(options.body.get('caption'), /https:\/\/example.com/);
        return Response.json({ ok: true, result: { message_id: 1 } });
      }
      assert.equal(url, release.assets[0].browser_download_url);
      return new Response(new Uint8Array([1, 2, 3]));
    });
    assert.equal(sends, 1);
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert.ok(path.basename(dir).startsWith('orbita-telegram-'));
    await rm(dir, { recursive: true, force: true });
  }
});
