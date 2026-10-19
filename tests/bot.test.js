import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { simulateClutch, maps } from '../src/clutch.js';
import { parseMatches, selectMatches, VlrSource } from '../src/vlr.js';
import { matchEmbed, clutchEmbed, calendarLabel, clockLabel, playerEmbed, statsEmbed, helpText } from '../src/format.js';
import { ProSource, parseSearch, parsePlayer, parseStats } from '../src/pros.js';
import { cardMessage, helpCard } from '../src/cards.js';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { createHandler } from '../src/handler.js';
import { commands } from '../src/commands.js';
import { readConfig } from '../src/config.js';

const fixture = await readFile(new URL('./fixtures/matches.html', import.meta.url), 'utf8');
const first = { id: '111111111111111111' }, second = { id: '222222222222222222' };

test('clutch: ambas as pessoas podem ganhar; mapa fixo e identidade preservados', () => {
  for (let winner = 0; winner < 2; winner++) {
    let call = 0;
    const result = simulateClutch(first, second, { map: 'Ascent', pick: () => call++ === 0 ? winner : 0 });
    assert.equal(result.winner.id, winner ? second.id : first.id);
    assert.equal(result.loser.id, winner ? first.id : second.id);
    assert.equal(result.map, 'Ascent');
    assert.match(result.text, /<@111111111111111111>/);
    assert.match(result.text, /<@222222222222222222>/);
  }
});
test('clutch: impede duelo consigo próprio, bots e mapas arbitrários', () => {
  assert.throws(() => simulateClutch(first, first), /diferentes/);
  assert.throws(() => simulateClutch({ ...first, bot: true }, second), /bots/);
  assert.throws(() => simulateClutch(first, second, { map: 'https://invalid.example' }), /Mapa/);
  assert.ok(maps.includes(simulateClutch(first, second).map));
});
test('parser: não mistura nomes, etapa, data nem pontuação', () => {
  const games = parseMatches(fixture, 'upcoming');
  assert.equal(games.length, 2);
  assert.equal(games[0].event, 'Evento de Teste');
  assert.equal(games[0].stage, 'Final fictícia');
  assert.equal(games[0].dateLabel, 'Mon, October 19, 2026');
  assert.deepEqual(games[0].teams.map(t => t.score), [2, 0]);
  assert.equal(games[1].teams[0].score, null);
  assert.equal(parseMatches(fixture, 'results').length, 1);
});
test('parser: falha claramente em HTML alterado ou bloqueado e não aceita links externos', () => {
  assert.throws(() => parseMatches('<h1>Access denied</h1>', 'results'), /lista/);
  assert.throws(() => parseMatches(fixture.replaceAll('href="/', 'href="https://evil.example/'), 'upcoming'), /interpretar/);
  assert.throws(() => parseMatches(fixture, 'unknown'), /inválido/);
});
test('filtro: Brasil por padrão; time explícita tem prioridade; aliases e limite', () => {
  const games = parseMatches(fixture, 'upcoming');
  assert.equal(selectMatches(games).length, 1);
  assert.equal(selectMatches(games, { focus: 'global' }).length, 2);
  assert.equal(selectMatches(games, { team: 'c9' })[0].teams[0].name, 'Cloud9');
  assert.equal(selectMatches(games, { team: 'VITALITY' }).length, 1);
  assert.equal(selectMatches(games, { team: 'LOUD' }).length, 0, 'LOUD não deve corresponder à substring em Cloud9');
  assert.equal(selectMatches(games, { team: 'Inexistente' }).length, 0);
  assert.equal(selectMatches(games, { focus: 'global', limit: 1 }).length, 1);
});
test('cache: consultas simultâneas partilham pedido; expira; falhas não viram dados válidos', async () => {
  let calls = 0, now = 100, fail = false;
  const source = new VlrSource({ now: () => now, ttlMs: 50, fetcher: async () => { calls++; if (fail) return new Response('bloqueado', { status: 429 }); return new Response(fixture); } });
  const [a,b] = await Promise.all([source.get('upcoming'), source.get('upcoming')]);
  assert.equal(calls, 1); assert.equal(a, b);
  now = 130; await source.get('upcoming'); assert.equal(calls, 1);
  now = 151; await source.get('upcoming'); assert.equal(calls, 2);
  now = 202; fail = true;
  await assert.rejects(source.get('upcoming'), /429/);
  fail = false; await source.get('upcoming'); assert.equal(calls, 4);
});
test('formatação: crédito, data de consulta, resultados e ausência de resultados honestos', () => {
  const snapshot = { matches: parseMatches(fixture,'upcoming'), url: 'https://www.vlr.gg/matches', fetchedAt: 0 };
  const embed = matchEmbed('results', snapshot);
  assert.equal(embed.fields[0].name, 'Equipe Brasil A 2 — 0 Equipe Europa B');
  assert.match(embed.fields[0].value, /Equipe Brasil A venceu/);
  assert.match(embed.fields[0].value, /\*\*Campeonato:\*\* Evento de Teste/);
  assert.match(embed.fields[0].value, /19\/10\/2026/);
  assert.equal(embed.timestamp, '1970-01-01T00:00:00.000Z');
  assert.match(embed.description, /página atual/);
  assert.match(matchEmbed('upcoming', snapshot).footer.text, /fuso não confirmado/);
  assert.match(matchEmbed('results', snapshot, { team: 'nada' }).description, /não significa/);
});
function interaction(commandName, options = {}) {
  const events = [];
  return { events, commandName, guildId: '333333333333333333', user: first,
    isChatInputCommand: () => true,
    options: { getUser: name => options[name], getString: name => options[name] ?? null },
    reply: async body => { events.push(['reply',body]); },
    deferReply: async () => { events.push(['defer']); },
    editReply: async body => { events.push(['edit',body]); }
  };
}
test('handler: confirma interação antes de consultar a rede e responde à falha sem inventar', async () => {
  const i = interaction('jogos');
  const handle = createHandler({ guildId: i.guildId, source: { get: async () => { assert.equal(i.events[0][0], 'defer'); throw new Error('offline'); } } });
  await handle(i);
  assert.equal(i.events[1][0], 'edit');
  assert.match(i.events[1][1].content, /Não consegui/);
});
test('handler: restringe servidor, desliga menções e aplica cooldown', async () => {
  const i = interaction('clutch', { jogador1: first, jogador2: second });
  const handle = createHandler({ guildId: i.guildId, source: {}, now: () => 100 });
  await handle(i);
  assert.deepEqual(i.events[0][1].allowedMentions.parse, []);
  assert.match(JSON.stringify(i.events[0][1].components), /fictício/);
  await handle(i); assert.match(i.events[1][1].content, /segundos/);
  const other = interaction('jogos'); other.guildId = '444444444444444444';
  await handle(other); assert.match(other.events[0][1].content, /servidores de testes autorizados/);
});

test('vários servidores: permite só a lista configurada e separa o cooldown por servidor', async () => {
  const guildA='333333333333333333',guildB='444444444444444444';
  const handle=createHandler({guildIds:[guildA,guildB],source:{},now:()=>100});
  const a=interaction('ajuda'),b=interaction('ajuda');b.guildId=guildB;
  await handle(a);await handle(b);
  assert.ok(a.events[0][1].components);assert.ok(b.events[0][1].components);
  await handle(b);assert.match(b.events[1][1].content,/segundos/);
  const denied=interaction('ajuda');denied.guildId='555555555555555555';
  await handle(denied);assert.match(denied.events[0][1].content,/autorizados/);
  const dm=interaction('ajuda');dm.guildId=null;
  await handle(dm);assert.match(dm.events[0][1].content,/autorizados/);
});

test('configuração: lista de servidores valida IDs, elimina duplicados e mantém compatibilidade', () => {
  const base={DISCORD_APPLICATION_ID:first.id,DISCORD_GUILD_ID:second.id};
  assert.deepEqual(readConfig(base,{tokenRequired:false}).guildIds,[second.id]);
  assert.deepEqual(readConfig({...base,DISCORD_GUILD_IDS:`${second.id}, 333333333333333333`},{tokenRequired:false}).guildIds,[second.id,'333333333333333333']);
  for(const invalid of ['','*','123','333333333333333333,']) assert.throws(()=>readConfig({...base,DISCORD_GUILD_IDS:invalid},{tokenRequired:false}),/GUILD_IDS/);
});
test('comandos e configuração: contrato válido e sem necessidade de intents privilegiados', () => {
  assert.deepEqual(commands.map(c=>c.name), ['clutch','jogos','resultado','jogador','classificacao','time','feedback','convidar','ajuda']);
  assert.ok(!commands[0].options.find(o => o.name === 'mapa').required);
  assert.ok(helpText.length <= 2000);
  assert.ok(commands.every(c=>c.description.length <= 100));
  assert.throws(()=>readConfig({}), /IDs/);
  assert.throws(()=>readConfig({ DISCORD_APPLICATION_ID:first.id, DISCORD_GUILD_ID:second.id }), /TOKEN/);
  assert.equal(readConfig({ DISCORD_APPLICATION_ID:first.id, DISCORD_GUILD_ID:second.id }, { tokenRequired:false }).guildId, second.id);
});

test('apresentação: mapa sorteado ou escolhido, data PT e relógio 24h sem inventar fuso', () => {
  const duel = simulateClutch(first,second);
  assert.equal(clutchEmbed(duel).fields[0].name, '🎲 Mapa sorteado');
  assert.equal(clutchEmbed(duel,true).fields[0].name, '🗺️ Mapa escolhido');
  assert.equal(calendarLabel('Mon, October 19, 2026'), '19/10/2026');
  assert.equal(clockLabel('12:05 AM'), '00:05');
  assert.equal(clockLabel('1:30 PM'), '13:30');
  assert.equal(clockLabel('TBD'), 'Horário a confirmar');
});

// Deliberately fictional profiles and statistics; never used by the live bot.
const searchPage = '<form><input name="q"><select name="type"><option value="players" selected>Players</option></select></form>';
const searchResult = (id,name) => `<a class="search-item" href="/search/r/player/${id}/idx"><div class="search-item-title">${name}</div></a>`;
const profilePage = '<div class="player-header"><h1>TesteBR</h1><i class="flag mod-br"></i></div><h2>Current Teams</h2><div class="wf-card"><a href="/team/123/test"><div><img></div><div><div>Time Teste</div><div class="ge-text-light">joined yesterday</div></div></a></div>';
function statsPage({ period='60d', metric='rating2', bad=false } = {}) {
  const filters = { tier:'vct', region:'all', span:period, side:'all', role:'all', agent:'all', map_id:'all', min_rating:'0' };
  const selects = Object.entries(filters).map(([key,value])=>`<select name="${key}"><option selected value="${value}"></option></select>`).join('');
  const rows = [['1','TesteBR','br','220','1.10','250','1.20'],['2','TesteINT','ca','300','1.30','230','1.10']].map(([id,name,country,rnd,rating2,acs,kd]) => `<tr><td class="mod-player"><a href="/player/${id}/test"><i class="flag mod-${country}"></i><div class="st-pl-name">${name}</div><div class="st-pl-country">TAG</div></a></td>${Object.entries({rnd,rating2,acs,kd}).map(([col,value])=>`<td data-col="${col}">${bad?'?':value}</td>`).join('')}</tr>`).join('');
  return `${selects}<input name="min_rounds" value="200"><input name="sort" value="${metric}"><input name="dir" value="desc"><table id="st-table"><tbody>${rows}</tbody></table>`;
}

test('profissionais: pesquisa, perfis, ausência e estrutura inválida', () => {
  assert.equal(parseSearch(searchPage).length,0);
  assert.equal(parseSearch(searchPage+searchResult('1','TesteBR'))[0].url,'https://www.vlr.gg/player/1');
  assert.equal(parseSearch(searchPage+'<a class="search-item" href="https://evil.example/player/1">Bad</a>').length,0);
  assert.throws(()=>parseSearch('<h1>Blocked</h1>'));
  const player=parsePlayer(profilePage,'1');
  assert.equal(player.country,'br');
  assert.deepEqual(player.teams,['Time Teste']);
  assert.throws(()=>parsePlayer('<h1>Access denied</h1>','1'));
});

test('estatísticas: valida período e filtros, números, ordem, país e critérios visíveis', () => {
  const rows=parseStats(statsPage());
  assert.equal(rows.length,2);
  assert.throws(()=>parseStats(statsPage({period:'30d'})),/Filtros/);
  assert.throws(()=>parseStats(statsPage({bad:true})),/interpretar/);
  assert.throws(()=>parseStats(statsPage().replace('value="200"','value="100"')),/confirmada/);
  const snapshot={rows,period:'60d',metric:'rating2',fetchedAt:0,url:'https://www.vlr.gg/stats'};
  assert.match(statsEmbed(snapshot).fields[0].name,/TesteINT/);
  assert.match(statsEmbed(snapshot,'br').fields[0].name,/TesteBR/);
  assert.equal(statsEmbed(snapshot,'br').fields.length,1);
  assert.match(statsEmbed(snapshot).description,/60 dias · mínimo 200 rounds/);
  assert.match(statsEmbed(snapshot).footer.text,/Primeira página/);
  assert.match(playerEmbed({candidates:[],fetchedAt:0,url:snapshot.url}).description,/Não encontrei/);
});

test('pesquisa: correspondência exata tem prioridade; ambiguidade não escolhe outra pessoa', async () => {
  const calls=[];
  const source=new ProSource({fetcher:async url=> {calls.push(url);return new Response(url.includes('/search/') ? searchPage+searchResult('1','TesteBR')+searchResult('2','TesteBR2') : profilePage);}});
  const found=await source.player('TesteBR');
  assert.equal(found.player.id,'1'); assert.equal(calls.length,2);
  await source.player('TesteBR'); assert.equal(calls.length,2);
  const ambiguous=await source.player('Teste');
  assert.equal(ambiguous.candidates.length,2); assert.equal(calls.length,3);
});

test('fonte profissional: restabelece filtros após redireção e recusa redireção externa', async () => {
  let calls=0;
  const source=new ProSource({fetcher:async (url,options)=> {
    calls++;
    if(calls===1) return new Response(null,{status:302,headers:{location:'https://www.vlr.gg/stats','set-cookie':'public=ok; Path=/'}});
    assert.equal(options.headers.Cookie,'public=ok');
    return new Response(calls===2?'Default page':statsPage());
  }});
  const [a,b]=await Promise.all([source.stats(),source.stats()]);
  assert.equal(calls,3); assert.equal(a,b); assert.equal(a.rows.length,2);
  const unsafe=new ProSource({fetcher:async()=>new Response(null,{status:302,headers:{location:'https://evil.example/'}})});
  await assert.rejects(unsafe.stats(),/externo/);
  await assert.rejects(source.stats({metric:'nope'}),/inválido/);
});

test('handler: novos comandos adiam antes da rede e respondem com embeds sem menções', async () => {
  for(const command of ['jogador','classificacao']) {
    const i=interaction(command,{nome:'TesteBR'});
    const assertDeferred=()=>assert.equal(i.events[0][0],'defer');
    const pros={player:async()=>{assertDeferred();return {player:parsePlayer(profilePage,'1'),fetchedAt:0,url:'https://www.vlr.gg/player/1'};},stats:async()=>{assertDeferred();return {rows:parseStats(statsPage()),period:'60d',metric:'rating2',fetchedAt:0,url:'https://www.vlr.gg/stats'};}};
    await createHandler({guildId:i.guildId,source:{},pros})(i);
    assert.equal(i.events[1][1].components[0].type,17);
    assert.equal(i.events[1][1].flags,MessageFlags.IsComponentsV2);
    assert.deepEqual(i.events[1][1].allowedMentions.parse,[]);
  }
});

test('cartões: estrutura Discord válida, limites, botões e informação continuam legíveis', () => {
  const snapshot={rows:parseStats(statsPage()),period:'60d',metric:'acs',fetchedAt:0,url:'https://www.vlr.gg/stats'};
  const matchSnapshot={matches:parseMatches(fixture,'results'),url:'https://www.vlr.gg/matches/results',fetchedAt:0};
  const longMatch=matchSnapshot.matches[0];
  const longestMatches={...matchSnapshot,matches:Array.from({length:5},()=>({...longMatch,event:'Evento '.repeat(30),stage:'Etapa '.repeat(30),teams:[{...longMatch.teams[0],name:'Time '.repeat(15)},{...longMatch.teams[1],name:'Outra '.repeat(15)}]}))};
  const cards=[helpCard({iconUrl:'https://cdn.discordapp.com/embed/avatars/0.png'}),cardMessage(statsEmbed(snapshot)),cardMessage(clutchEmbed(simulateClutch(first,second))),cardMessage(playerEmbed({player:parsePlayer(profilePage,'1'),fetchedAt:0,url:'https://www.vlr.gg/player/1'})),cardMessage(matchEmbed('results',longestMatches)),cardMessage(statsEmbed({...snapshot,rows:[]}))];
  for(const card of cards) {
    assert.equal(card.flags,MessageFlags.IsComponentsV2);
    assert.ok(!Object.hasOwn(card,'embeds'));
    new ContainerBuilder(card.components[0]).toJSON();
    let count=0,chars=0;
    const visit=node=>{count++;if(node.type===10)chars+=node.content.length;for(const child of node.components??[])visit(child);if(node.accessory)visit(node.accessory);};
    card.components.forEach(visit);
    assert.ok(count<=40);assert.ok(chars<=4000,`Mensagem tem ${chars} caracteres`);
  }
  const data=JSON.stringify(cards[1]);
  assert.match(data,/🥇/);assert.match(data,/ACS/);assert.match(data,/"style":5/);
});

test('ajuda: resposta privada em cartão, sem texto solto que gere pré-visualização', async () => {
  const i=interaction('ajuda');
  await createHandler({guildId:i.guildId,source:{}})(i);
  const reply=i.events[0][1];
  assert.equal(reply.flags,MessageFlags.Ephemeral|MessageFlags.IsComponentsV2);
  assert.ok(!reply.content);assert.ok(!reply.embeds);
  assert.match(JSON.stringify(reply.components),/classificacao/);
});
