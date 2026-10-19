import { escapeMarkdown } from 'discord.js';
import { selectMatches } from './vlr.js';
import { metrics } from './pros.js';
import { stageLabel, roleLabel, decimal } from './locale.js';

const safe = (text, max = 160) => escapeMarkdown(String(text).replace(/@/g, '@\u200b').slice(0, max));
export function calendarLabel(value) {
  const numeric = value.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/);
  if (numeric) return `${numeric[3]}/${numeric[2]}/${numeric[1]}`;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const match = value.match(/(?:\w+,\s*)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match || !months.includes(match[1])) return safe(value || 'Data a confirmar');
  return `${match[2].padStart(2,'0')}/${String(months.indexOf(match[1]) + 1).padStart(2,'0')}/${match[3]}`;
}
export function clockLabel(value) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return safe(value === 'TBD' || !value ? 'Horário a confirmar' : value);
  const hour = Number(match[1]) % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return `${String(hour).padStart(2,'0')}:${match[2]}`;
}

export function clutchEmbed(duel, chosenMap = false, round = 1) {
  return { color: 0x685170, title: `🎯 Clutch fictício · rodada ${round}`, description: `**${safe(duel.title)}**\n<@${duel.participants[0].id}> **vs** <@${duel.participants[1].id}>\n\n${duel.beats[0]}`,
    fields: [
      { name: chosenMap ? '🗺️ Mapa escolhido' : '🎲 Mapa sorteado', value: `\`${duel.map} · Site ${duel.site} · 1v1\``, inline: true },
      { name: '💥 Aconteceu isso…', value: `${duel.beats[1]}\n\n**${duel.beats[2]}**` },
      { name: '🏆 Levou o round', value: `<@${duel.winner.id}> · **${duel.hp} HP** · ${safe(duel.weapon)}` }
    ], footer: { text: 'Ficção entre amigos · Vencedor sorteado 50/50 · Revanche disponível durante 10 min, com 5 s entre utilizações' } };
}
export function matchEmbed(kind, snapshot, options = {}) {
  const matches = snapshot.coverage === 'team' ? snapshot.matches.slice(0,5) : selectMatches(snapshot.matches, options);
  const results = kind === 'results';
  return {
    color: 0x685170,
    title: results ? '🏁 Resultados recentes' : '📅 Próximos jogos',
    url: snapshot.url,
    description: matches.length
      ? `**${snapshot.team ? `Time: ${safe(snapshot.team.name,50)}` : options.team ? `Time: ${safe(options.team,50)}` : options.focus === 'global' ? 'Internacional' : 'Foco Brasil'}** · ${matches.length} ${matches.length === 1 ? 'partida' : 'partidas'}\n${snapshot.coverage === 'team' ? 'Agenda do time no VLR.gg; elencos distintos têm consultas separadas.' : 'Seleção da página atual do VLR.gg.'}`
      : snapshot.coverage === 'team' ? `**${safe(snapshot.team.name,60)}** não tem próximas partidas publicadas na agenda do time nesta consulta.\nNão substituí por jogos de GC, Academy ou outros times com nomes semelhantes. Novos jogos podem ser anunciados mais tarde.` : 'Não encontrei jogos com este filtro na página atual da fonte. Tente outro nome ou foco Internacional; isto não significa que não existam outros jogos.',
    fields: matches.map(match => ({
      name: `${safe(match.teams[0].name,70)} ${results ? `${match.teams[0].score} — ${match.teams[1].score}` : '×'} ${safe(match.teams[1].name,70)}`,
      value: [
        results ? (match.teams[0].score === match.teams[1].score ? '**Empate**' : `🏆 **${safe(match.teams[match.teams[0].score > match.teams[1].score ? 0 : 1].name,70)} venceu**`) : /live/i.test(match.status) ? '🔴 **Ao vivo na fonte**' : '🕒 **Agendado**',
        `**Campeonato:** ${safe(match.event)}`,
        match.stage ? `**Fase:** ${safe(stageLabel(match.stage))}` : '',
        `**Data:** ${calendarLabel(match.dateLabel)}${results ? '' : ` · ${clockLabel(match.timeLabel)}`}`,
        `[Detalhes da partida ↗](${match.url})`
      ].filter(Boolean).join('\n'), inline: false
    })),
    footer: { text: results ? 'Fonte não oficial · Consulta com cache de 10 minutos · Não é um placar ao vivo' : 'Datas e horários conforme a fonte; fuso não confirmado · Confira no link da partida' },
    timestamp: new Date(snapshot.fetchedAt).toISOString()
  };
}

export function teamScheduleEmbed(snapshot) {
  if (snapshot.team) return matchEmbed('upcoming',snapshot);
  return { title:'🔎 Qual time você quer acompanhar?', url:snapshot.url, color:0xa78bc1,
    description:snapshot.candidates.length ? `Há vários times com esse nome. Use o nome exato em /jogos time:\n\n${snapshot.candidates.map(team=>`• [${safe(team.name,70)}](${team.url})`).join('\n')}` : 'Não encontrei o time nesta pesquisa. Confira o nome; não vou mostrar a agenda de outro time.',
    footer:{text:'VLR.gg · Pesquisa de times · Cache 10 min'},timestamp:new Date(snapshot.fetchedAt).toISOString() };
}

export function playerEmbed(snapshot) {
  const common = { color: 0x685170, url: snapshot.url, timestamp: new Date(snapshot.fetchedAt).toISOString(), footer: { text: 'VLR.gg · Fonte não oficial · Cache de 10 minutos' } };
  if (!snapshot.player) return { ...common, title: '🔎 Pesquisa de jogadores', description: snapshot.candidates.length
    ? `Encontrei vários perfis. Use o nome exato com /jogador:\n\n${snapshot.candidates.map(p => `• [${safe(p.name,60)}](${p.url})`).join('\n')}`
    : 'Não encontrei perfis nesta pesquisa. Confira o nick; isso não prova que o jogador não exista.' };
  const p = snapshot.player;
  const region = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
  const flag = p.country ? String.fromCodePoint(...[...p.country.toUpperCase()].map(c=>127397+c.charCodeAt(0))) : '';
  return { ...common, title: `🎮 ${safe(p.name,80)}`, description: '**Dentro do servidor, falamos dos pros.**\nPerfil competitivo de VALORANT.', fields: [
    { name: 'Representa', value: p.teams.length ? `**${safe(p.teams.join(' · '),250)}**` : 'Sem time indicado na fonte', inline: true },
    { name: 'País', value: p.country ? `${flag} ${region.of(p.country.toUpperCase())}` : 'Não indicado', inline: true },
    { name: 'Quer comparar os números?', value: 'Use `/classificacao` para ver Rating, ACS e K/D por período.\nO botão abaixo abre o perfil completo na fonte.' }
  ] };
}

export function statsEmbed(snapshot, focus = 'global') {
  const rows = snapshot.rows.filter(p => focus !== 'br' || p.country === 'br').sort((a,b) => b[snapshot.metric] - a[snapshot.metric] || b.rounds - a.rounds).slice(0,5);
  return { color: 0x685170, title: `🏅 Competitivo · ${metrics[snapshot.metric]}`, url: snapshot.url,
    description: `**VCT · últimos ${snapshot.period.slice(0,-1)} dias · mínimo 200 rounds**\n${focus === 'br' ? '🇧🇷 Jogadores brasileiros' : '🌐 Internacional'} · maior ${metrics[snapshot.metric]} primeiro.${rows.length ? '' : '\n\nSem jogadores neste recorte. Tente outro período ou o foco Internacional.'}`,
    fields: rows.map((p,i) => {
      const values = { rating2: decimal(p.rating2), acs: String(p.acs), kd: decimal(p.kd) };
      const others = Object.keys(metrics).filter(key=>key!==snapshot.metric).map(key=>`${metrics[key]} \`${values[key]}\``).join('  ·  ');
      return { name: `${['🥇','🥈','🥉','④','⑤'][i]} ${safe(p.name,60)}${p.team ? ` · ${safe(p.team,40)}` : ''}`, value: `**${metrics[snapshot.metric]}  \`${values[snapshot.metric]}\`**\n${others}\n${p.rounds} rounds  ·  [Ver jogador](${p.url})`, inline: false };
    }),
    footer: { text: 'VLR.gg · Primeira página da seleção, não ranking absoluto de habilidade · Rating: avaliação VLR; ACS: combate médio; K/D: abates/mortes · Cache 10 min' },
    timestamp: new Date(snapshot.fetchedAt).toISOString()
  };
}

export function teamEmbed(snapshot) {
  const common = { color: 0xa78bc1, url: snapshot.url, timestamp: new Date(snapshot.fetchedAt).toISOString() };
  if (!snapshot.team) return { ...common, title: '🔎 Buscar time', description: snapshot.candidates.length
    ? `Há várias correspondências. Use o nome exato com /time:\n\n${snapshot.candidates.map(t=>`• [${safe(t.name,70)}](${t.url})`).join('\n')}`
    : 'Não encontrei um time nesta pesquisa. Confira o nome ou a sigla.', footer: { text: 'Pesquisa VLR.gg · Cache 10 min' } };
  const { team, maps, period } = snapshot;
  const players = team.roster?.filter(p=>!p.staff), staff = team.roster?.filter(p=>p.staff);
  const people = list => list.slice(0,8).map(p=>`• [${safe(p.name,45)}](${p.url})${p.role ? ` · ${safe(roleLabel(p.role),35)}` : ''}`).join('\n') + (list.length > 8 ? `\n+ ${list.length - 8} no perfil da fonte` : '');
  const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 2 }).format(cents/100);
  const prizes = team.events === null ? 'Histórico de prêmios indisponível nesta consulta.' : period.years.map(year=> {
    const events = team.events.filter(e=>e.year===year), known = events.filter(e=>e.cents!==null);
    const missing = events.length-known.length;
    return `**${year}${year===period.years[2] ? ' · até agora' : ''}** — ${known.length ? `**${money(known.reduce((sum,e)=>sum+e.cents,0))}** registrados` : 'sem valores monetários informados'}${missing ? `\n↳ ${missing} ${missing===1?'evento sem valor informado':'eventos sem valor informado'}` : ''}`;
  }).join('\n\n');
  const recent = team.events?.slice().sort((a,b)=>b.year-a.year).slice(0,3);
  const fields = [
    { name: '🎮 Elenco atual', value: players?.length ? people(players) : 'Elenco não indicado na fonte.' },
    ...(staff?.length ? [{ name: '🧠 Comissão técnica', value: people(staff) }] : []),
    { name: '📊 Rounds e mapas · período selecionado', value: maps
      ? `**${maps.rounds.toLocaleString('pt-BR')} rounds** · ${maps.maps} mapas\nRounds: **${maps.roundsWon} ganhos** · ${maps.roundsLost} perdidos\nMapas: **${maps.mapsWon} ganhos** · ${maps.mapsLost} perdidos\n[Estatísticas por mapa](${snapshot.statsUrl})`
      : 'Não consegui confirmar os rounds deste período. O elenco e os prêmios abaixo são consultas independentes.' },
    { name: '💰 Prêmios monetários registrados', value: `${prizes}\n\nValores do time em USD; campo ausente não significa prêmio zero.` },
    ...(recent?.length ? [{ name: '🏆 Participações recentes · até 3', value: recent.map(e=>`[${safe(e.name,85)}](${e.url})\n${e.year} · ${safe(stageLabel(e.placement || 'Posição não informada'),85)}`).join('\n\n') }] : [])
  ];
  const country = team.countryCode ? new Intl.DisplayNames(['pt-BR'],{type:'region'}).of(team.countryCode.toUpperCase()) : team.country === 'Brazil' ? 'Brasil' : team.country;
  return { ...common, title: `🛡️ ${safe(team.name,80)}`, description: `**${safe(country || 'País não indicado',50)}**\nHistórico: **${period.start.split('-').reverse().join('/')} a ${period.end.split('-').reverse().join('/')}**\nTrês anos civis, incluindo o atual. O elenco é o indicado agora pela fonte.`, fields,
    footer: { text: 'VLR.gg · Dados registrados na fonte, não receita total da organização · Histórico pode incluir elencos anteriores · Cache 10 min · Sem afiliação à Riot ou ao VLR' } };
}

export const helpText = [
  '**Último Round · VALORANT entre amigos**',
  '`/clutch jogador1 jogador2 [mapa]` — duelo fictício; sem mapa indicado, sorteio um cenário.',
  '`/jogos [time] [foco]` — até 5 jogos da página de calendário; Brasil por padrão.',
  '`/resultado [time] [foco]` — até 5 resultados recentes; não pesquisa todo o histórico.',
  '`/jogador nome` — procura um perfil competitivo (ex.: aspas).',
  '`/classificacao [criterio] [periodo] [foco]` — estatísticas VCT, mínimo 200 rounds; Rating, 60 dias e Internacional por padrão. Brasil filtra a bandeira do jogador. Cobre a primeira página da fonte.',
  'Ao indicar um time, o nome tem prioridade sobre o foco. Brasil usa a bandeira do time ou o nome do evento; não identifica a nacionalidade de todos os jogadores.',
  'Fonte: https://www.vlr.gg/ · Informações sob demanda, com cache. Sem notícias automáticas nem perguntas livres nesta versão.',
  'Não afiliado à Riot Games, à Discord ou ao VLR.gg.'
].join('\n\n');
