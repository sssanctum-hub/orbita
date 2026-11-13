// Read-only check: never sends messages or prints the bot token.
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
async function api(method, params = {}) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params), signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new Error(`Telegram ${method}: connection failed.`); }
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`Telegram ${method}: invalid response.`); }
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method}: HTTP ${response.status}, code ${data.error_code ?? 'unknown'}.`);
  return data.result;
}
try {
  if (!token || !chatId) throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
  const bot = await api('getMe');
  if (bot.username?.toLowerCase() !== 'davaivorbitu_ai') throw new Error('Token belongs to a different bot.');
  const chat = await api('getChat', { chat_id: chatId });
  if (chat.type !== 'channel') throw new Error('Configured destination is not a channel.');
  const member = await api('getChatMember', { chat_id: chatId, user_id: bot.id });
  if (member.status !== 'administrator' || !member.can_post_messages) {
    throw new Error('Add @davaivorbitu_ai as channel administrator with permission to post messages.');
  }
  console.log('Verified @davaivorbitu_ai: token valid, channel accessible, posting permission enabled. No message sent.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
