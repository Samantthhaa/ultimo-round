import { MessageFlags } from 'discord.js';
import { simulateClutch } from './clutch.js';
import { matchEmbed, clutchEmbed, playerEmbed, statsEmbed, teamEmbed, teamScheduleEmbed } from './format.js';
import { cardMessage, helpCard } from './cards.js';
import { sourceUrls } from './vlr.js';
import { randomBytes } from 'node:crypto';

const mentions = { parse: [], repliedUser: false };
export function createHandler({ guildId, guildIds = [guildId], source, pros, now = Date.now, cooldownMs = 5000 }) {
  const allowedGuilds = new Set(guildIds.filter(Boolean));
  const lastCalls = new Map();
  const duels = new Map(), recentScenes = new Map();
  // Bounded by expiry; no permanent storage of people or messages.
  let nextSweep = 0;
  return async function handle(interaction) {
    const replay = interaction.isButton?.() && interaction.customId.startsWith('clutch:replay:');
    if (!replay && !interaction.isChatInputCommand()) return;
    const privateReply = content => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: mentions });
    if (!interaction.guildId || !allowedGuilds.has(interaction.guildId)) return privateReply('Esta versão só funciona nos servidores de testes autorizados.');
    if (!replay && !['clutch','jogos','resultado','jogador','classificacao','time','ajuda'].includes(interaction.commandName)) return;
    const timestamp = now();
    const saved = replay ? duels.get(interaction.customId) : null;
    if (replay && (!saved || saved.expires <= timestamp || saved.guildId !== interaction.guildId)) return privateReply('Esta revanche expirou. Comece um novo duelo com /clutch.');
    if (replay && ![saved.owner,saved.first.id,saved.second.id].includes(interaction.user.id)) return privateReply('A revanche é para quem lançou o duelo e para os dois participantes. Você pode começar o seu com /clutch!');
    if (timestamp >= nextSweep) {
      for (const [key, expiry] of lastCalls) if (expiry <= timestamp) lastCalls.delete(key);
      for (const [key, duel] of duels) if (duel.expires <= timestamp) duels.delete(key);
      for (const [key, recent] of recentScenes) if (recent.expires <= timestamp) recentScenes.delete(key);
      nextSweep = timestamp + 60_000;
    }
    const key = `${interaction.guildId}:${interaction.user.id}`;
    if ((lastCalls.get(key) ?? 0) > timestamp) return privateReply('Espere 5 segundos entre comandos.');
    lastCalls.set(key, timestamp + cooldownMs);
    const iconUrl = interaction.client?.user?.displayAvatarURL({ extension: 'png', size: 128 });
    if (interaction.commandName === 'ajuda') {
      const card = helpCard({ iconUrl });
      return interaction.reply({ ...card, flags: card.flags | MessageFlags.Ephemeral, allowedMentions: mentions });
    }
    if (replay || interaction.commandName === 'clutch') {
      let duel;
      const input = replay ? saved : { first: interaction.options.getUser('jogador1', true), second: interaction.options.getUser('jogador2', true), mapOption: interaction.options.getString('mapa') ?? undefined, owner: interaction.user.id, round: 0 };
      const pairKey = `${interaction.guildId}:${[input.first?.id,input.second?.id].sort().join(':')}`;
      try {
        duel = simulateClutch(input.first, input.second, { map: input.mapOption, excludeScenes: recentScenes.get(pairKey)?.ids ?? [] });
      } catch (error) { return privateReply(error.message); }
      if (recentScenes.size >= 200 && !recentScenes.has(pairKey)) recentScenes.delete(recentScenes.keys().next().value);
      recentScenes.set(pairKey, { ids: [...(recentScenes.get(pairKey)?.ids ?? []),duel.sceneId].slice(-3), expires: timestamp + 1_800_000 });
      const customId = `clutch:replay:${randomBytes(8).toString('hex')}`;
      if (duels.size >= 200) duels.delete(duels.keys().next().value);
      const round = input.round + 1;
      duels.set(customId, { first: { id: input.first.id, bot: false }, second: { id: input.second.id, bot: false }, mapOption: input.mapOption, owner: input.owner, round, guildId: interaction.guildId, expires: timestamp + 600_000 });
      const card = cardMessage(clutchEmbed(duel, Boolean(input.mapOption), round), { iconUrl });
      card.components[0].components.push({ type: 1, components: [{ type: 2, style: 1, custom_id: customId, label: 'Revanche', emoji: { name: '🔁' } }] });
      return interaction.reply({ ...card, allowedMentions: mentions });
    }
    // Acknowledge before any network call: Discord requires an initial response in 3 seconds.
    await interaction.deferReply();
    if (interaction.commandName === 'jogos' && interaction.options.getString('time')) {
      let snapshot;
      try { snapshot = await pros.upcoming(interaction.options.getString('time')); }
      catch { return interaction.editReply({content:'Não consegui confirmar a agenda desse time no VLR.gg. Tente novamente mais tarde. Não vou substituir por jogos de outro time.',allowedMentions:mentions}); }
      return interaction.editReply({...cardMessage(teamScheduleEmbed(snapshot),{iconUrl,linkLabel:'Ver agenda do time'}),allowedMentions:mentions});
    }
    if (['jogador','classificacao','time'].includes(interaction.commandName)) {
      let embed;
      try {
        embed = interaction.commandName === 'time'
          ? teamEmbed(await pros.team(interaction.options.getString('nome', true)))
          : interaction.commandName === 'jogador'
          ? playerEmbed(await pros.player(interaction.options.getString('nome', true)))
          : statsEmbed(await pros.stats({ metric: interaction.options.getString('criterio') ?? 'rating2', period: interaction.options.getString('periodo') ?? '60d' }), interaction.options.getString('foco') ?? 'global');
      } catch {
        return interaction.editReply({ content: 'Não consegui confirmar os dados do VLR.gg agora. Tente novamente mais tarde ou consulte https://www.vlr.gg/stats. Não vou apresentar estatísticas inventadas.', allowedMentions: mentions });
      }
      return interaction.editReply({ ...cardMessage(embed, { iconUrl, linkLabel: interaction.commandName === 'time' ? 'Explorar time' : interaction.commandName === 'jogador' ? 'Perfil e estatísticas' : 'Ver tabela no VLR.gg' }), allowedMentions: mentions });
    }
    const kind = interaction.commandName === 'jogos' ? 'upcoming' : 'results';
    let snapshot;
    try { snapshot = await source.get(kind); }
    catch {
      return interaction.editReply({ content: `Não consegui consultar a fonte agora. Tente novamente mais tarde ou abra ${sourceUrls[kind]}. Não vou inventar dados.`, allowedMentions: mentions });
    }
    return interaction.editReply({ ...cardMessage(matchEmbed(kind, snapshot, { team: interaction.options.getString('time') ?? '', focus: interaction.options.getString('foco') ?? 'br' }), { iconUrl, linkLabel: kind === 'results' ? 'Mais resultados' : 'Abrir calendário' }), allowedMentions: mentions });
  };
}
