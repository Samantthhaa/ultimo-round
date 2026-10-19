import { REST, Routes } from 'discord.js';
import { readConfig } from '../src/config.js';
import { commands } from '../src/commands.js';

try {
  const { appId, guildIds, token } = readConfig();
  const rest = new REST({ version: '10' }).setToken(token);
  // Individual upserts preserve any other commands registered to this application.
  for (const guildId of guildIds) {
    const existing = await rest.get(Routes.applicationGuildCommands(appId,guildId));
    const legacy = existing.find(command=>command.name === 'equipa' && command.type === 1);
    const brazilian = commands.find(command=>command.name === 'time');
    if (legacy && !existing.some(command=>command.name === 'time')) {
      await rest.patch(Routes.applicationGuildCommand(appId,guildId,legacy.id),{body:brazilian});
    }
    for (const command of commands) await rest.post(Routes.applicationGuildCommands(appId, guildId), { body: command });
  }
  console.log(`${commands.length} comandos registrados em ${guildIds.length} servidores autorizados. Execute npm start.`);
} catch {
  console.error('Falhou o registro. Confira os três valores do .env, a aplicação instalada no servidor e o scope applications.commands. Nenhum token foi impresso.');
  process.exitCode = 1;
}
