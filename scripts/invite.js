import { readConfig } from '../src/config.js';
try {
  const { appId, guildId } = readConfig(process.env, { tokenRequired: false });
  const url = new URL('https://discord.com/oauth2/authorize');
  url.search = new URLSearchParams({ client_id: appId, scope: 'bot applications.commands', permissions: '19456', guild_id: guildId, disable_guild_select: 'true' });
  // View Channels (1024), Send Messages (2048), Embed Links (16384). No Administrator.
  console.log(url.href);
} catch (error) { console.error(error.message); process.exitCode = 1; }
