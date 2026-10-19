export function readConfig(env = process.env, { tokenRequired = true } = {}) {
  const appId = env.DISCORD_APPLICATION_ID?.trim();
  const guildId = env.DISCORD_GUILD_ID?.trim();
  const token = env.DISCORD_TOKEN?.trim();
  if (env.DISCORD_PUBLIC !== undefined && !['true','false'].includes(env.DISCORD_PUBLIC)) throw new Error('DISCORD_PUBLIC deve ser true ou false.');
  const publicMode=env.DISCORD_PUBLIC==='true';
  if (!/^\d{16,22}$/.test(appId ?? '') || (!publicMode&&!/^\d{16,22}$/.test(guildId ?? '')) || (guildId&&!/^\d{16,22}$/.test(guildId))) {
    throw new Error('Preencha DISCORD_APPLICATION_ID e DISCORD_GUILD_ID no .env com os IDs do Discord.');
  }
  const extraGuildIds = env.DISCORD_GUILD_IDS === undefined ? [] : env.DISCORD_GUILD_IDS.split(',').map(value=>value.trim());
  if (extraGuildIds.some(id=>!/^\d{16,22}$/.test(id))) throw new Error('DISCORD_GUILD_IDS deve conter IDs de servidores separados por vírgulas.');
  const guildIds = [...new Set([guildId,...extraGuildIds].filter(Boolean))];
  if (tokenRequired && (!token || /^(exemplo|your|cola|token)/i.test(token))) {
    throw new Error('Preencha DISCORD_TOKEN no .env. Não envie o token para o chat.');
  }
  return { appId, guildId, guildIds, token, publicMode };
}
