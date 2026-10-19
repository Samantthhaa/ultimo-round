import { SlashCommandBuilder } from 'discord.js';
import { maps } from './clutch.js';

const focusChoices = [{ name: 'Brasil', value: 'br' }, { name: 'Internacional', value: 'global' }];
export const commands = [
  new SlashCommandBuilder().setName('clutch').setDescription('Narra um duelo fictício entre duas pessoas do servidor.')
    .addUserOption(o => o.setName('jogador1').setDescription('Primeira pessoa').setRequired(true))
    .addUserOption(o => o.setName('jogador2').setDescription('Segunda pessoa').setRequired(true))
    .addStringOption(o => o.setName('mapa').setDescription('Opcional: se você não escolher, sorteio um mapa para o duelo').addChoices(...maps.map(name => ({ name, value: name })))),
  new SlashCommandBuilder().setName('jogos').setDescription('Consulta jogos agendados na página atual do VLR.gg.')
    .addStringOption(o => o.setName('time').setDescription('Nome ou sigla; substitui o filtro de foco').setMinLength(2).setMaxLength(50))
    .addStringOption(o => o.setName('foco').setDescription('Brasil por padrão').addChoices(...focusChoices)),
  new SlashCommandBuilder().setName('resultado').setDescription('Consulta resultados recentes listados no VLR.gg.')
    .addStringOption(o => o.setName('time').setDescription('Nome ou sigla; substitui o filtro de foco').setMinLength(2).setMaxLength(50))
    .addStringOption(o => o.setName('foco').setDescription('Brasil por padrão').addChoices(...focusChoices)),
  new SlashCommandBuilder().setName('jogador').setDescription('Pesquisa o perfil de um jogador do competitivo de VALORANT.')
    .addStringOption(o => o.setName('nome').setDescription('Nick competitivo, por exemplo aspas').setRequired(true).setMinLength(2).setMaxLength(50)),
  new SlashCommandBuilder().setName('classificacao').setDescription('Compara estatísticas VCT por período, com pelo menos 200 rounds.')
    .addStringOption(o => o.setName('criterio').setDescription('Ordenação: Rating VLR por padrão').addChoices({ name: 'Rating VLR', value: 'rating2' }, { name: 'ACS · combate médio', value: 'acs' }, { name: 'K/D · abates por morte', value: 'kd' }))
    .addStringOption(o => o.setName('periodo').setDescription('Período: últimos 60 dias por padrão').addChoices({ name: 'Últimos 30 dias', value: '30d' }, { name: 'Últimos 60 dias', value: '60d' }, { name: 'Últimos 90 dias', value: '90d' }))
    .addStringOption(o => o.setName('foco').setDescription('Internacional por padrão; Brasil usa a bandeira do jogador').addChoices(...focusChoices)),
  new SlashCommandBuilder().setName('time').setDescription('Pesquisa elenco, rounds e prêmios nos três anos civis mais recentes.')
    .addStringOption(o => o.setName('nome').setDescription('Nome do time, por exemplo LOUD, MIBR ou FURIA').setRequired(true).setMinLength(2).setMaxLength(50)),
  new SlashCommandBuilder().setName('feedback').setDescription('Envie uma sugestão ou um erro em particular para a desenvolvedora.')
    .addStringOption(o=>o.setName('tipo').setDescription('O que você quer enviar?').addChoices({name:'Sugestão',value:'sugestao'},{name:'Erro',value:'bug'},{name:'Outro',value:'outro'})),
  new SlashCommandBuilder().setName('convidar').setDescription('Mostra o link para adicionar o Último Round em outro servidor.'),
  new SlashCommandBuilder().setName('ajuda').setDescription('Mostra os comandos e explica os limites desta versão.')
].map(command => command.toJSON());
