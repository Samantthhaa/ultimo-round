import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { readConfig } from './config.js';
import { createHandler } from './handler.js';
import { VlrSource } from './vlr.js';
import { ProSource } from './pros.js';
import {createFeedback} from './feedback.js';

let config;
try { config = readConfig(); }
catch (error) { console.error(error.message); process.exit(1); }
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [], repliedUser: false } });
const feedback=createFeedback({deliver:async payload=>{
  const application=await client.application.fetch();
  const ownerId=application.owner?.ownerId??application.owner?.id;
  if(!ownerId) throw new Error('Responsável pelo bot indisponível.');
  const channel=await client.users.createDM(ownerId);
  return channel.send(payload);
}});
const handle = createHandler({ guildIds: config.guildIds, publicMode:config.publicMode, appId:config.appId, feedback, source: new VlrSource(), pros: new ProSource() });
client.once(Events.ClientReady, () => console.log('Último Round ligado. Pronto para slash commands nos servidores autorizados.'));
client.on(Events.InteractionCreate, async interaction => {
  try { await handle(interaction); }
  catch {
    // Never log raw Discord errors: they may include request or credential details.
    console.error('Não foi possível concluir uma interação. Verifique a conexão e as permissões.');
    if (!interaction.isRepliable()) return;
    try {
      const body = { content: 'Ocorreu um erro ao responder. Tente novamente dentro de alguns segundos.', allowedMentions: { parse: [] } };
      if (interaction.deferred) await interaction.editReply(body);
      else if (!interaction.replied) await interaction.reply({ ...body, flags: MessageFlags.Ephemeral });
    } catch { /* The interaction may have expired or the connection may be down. */ }
  }
});
client.on(Events.Error, () => console.error('Erro de conexão ao Discord.'));
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { client.destroy(); process.exit(0); });
try { await client.login(config.token); }
catch { console.error('Não foi possível ligar ao Discord. Confira o token no .env e a conexão com a internet.'); client.destroy(); process.exitCode = 1; }
