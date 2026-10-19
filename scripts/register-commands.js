import { REST } from 'discord.js';
import { readConfig } from '../src/config.js';
import { commands } from '../src/commands.js';
import {registerCommands} from '../src/registration.js';

try {
  const config=readConfig();
  const rest = new REST({ version: '10' }).setToken(config.token);
  await registerCommands(rest,config,commands);
  console.log(config.publicMode?`${commands.length} comandos globais registrados. Novos servidores não precisam de configuração manual.`:`${commands.length} comandos registrados em ${config.guildIds.length} servidores autorizados.`);
} catch {
  console.error('Falhou o registro. Confira os três valores do .env, a aplicação instalada no servidor e o scope applications.commands. Nenhum token foi impresso.');
  process.exitCode = 1;
}
