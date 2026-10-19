import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainerBuilder, MessageFlags } from 'discord.js';
import { teamPeriod, parseTeamSearch, parseTeam, parseTeamMaps } from '../src/teams.js';
import { ProSource } from '../src/pros.js';
import { teamEmbed } from '../src/format.js';
import { cardMessage } from '../src/cards.js';
import { createHandler } from '../src/handler.js';

const now = Date.parse('2026-10-19T17:00:00Z'), period = teamPeriod(now);
const search = '<input name="q"><select name="type"><option value="teams" selected>Teams</option></select>';
const result = (id,name) => `<a class="search-item" href="/search/r/team/${id}/idx"><div class="search-item-title">${name}</div></a>`;
const person = (id,name,role='') => `<div class="team-roster-item"><a href="/player/${id}/example"><div class="team-roster-item-name-alias">${name}</div><div class="team-roster-item-name-role">${role}</div></a></div>`;
const event = (id,year,amount='') => `<a class="team-event-item" href="/event/${id}/example"><div><div class="text-of">Evento ${id}</div><span class="team-event-item-series">Playoffs – 2nd</span>${amount?`<span>${amount}</span>`:''}</div><div>${year}</div></a>`;
const profile = `<div class="team-header"><h1>Teste</h1><div class="team-header-country">Brazil</div></div><a href="/team/stats/1/teste/">Stats</a><h2>Current Roster</h2><div class="wf-card"><div class="wf-module-label">players</div><div>${person('11','Ana')}${person('12','Bia','loan')}</div><div class="wf-module-label">staff</div><div>${person('13','Carla','head coach')}</div></div><h2>Event Placements</h2>${event('10',2026,'$1,000.50')}${event('11',2026)}${event('12',2025)}${event('13',2024,'$250')}${event('14',2023,'$999,999')}${event('10',2026,'$1,000.50')}`;
function stats({ start=period.start, missing=false, detail=true } = {}) {
  const headings=['Map (#)','Expand','WIN%','W','L','ATK 1st','DEF 1st','ATK RWin%','RW','RL','DEF RWin%','RW','RL','Agent Compositions'];
  const cells=['Bind (3)','','67%','2','1','1','2','50%',missing?'?':'20','10','60%','12','8',''];
  return `<input name="date_start" value="${start}"><input name="date_end" value="${period.end}"><select name="event_id"><option selected value="all">All</option></select><table class="mod-team-maps"><thead><tr>${headings.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody><tr>${cells.map(c=>`<td class="mod-supercell"><div class="mod-first">${c}</div><div>999</div></td>`).join('')}</tr>${detail?'<tr><td colspan="14">Detalhes do mapa: 999 rounds</td></tr>':''}</tbody></table>`;
}

test('time: três anos civis, incluindo o atual, seguem o dia em Lisboa', () => {
  assert.deepEqual(period,{start:'2024-01-01',end:'2026-10-19',years:[2024,2025,2026]});
  assert.equal(teamPeriod(Date.parse('2026-10-18T23:30:00Z')).end,'2026-10-19');
  assert.deepEqual(teamPeriod(Date.parse('2027-01-01T00:00:00Z')).years,[2025,2026,2027]);
});
test('time: pesquisa não aceita links externos e distingue elenco, técnico e prêmio em falta', () => {
  assert.equal(parseTeamSearch(search).length,0);
  assert.equal(parseTeamSearch(search+result('1','Teste'))[0].url,'https://www.vlr.gg/team/1');
  assert.equal(parseTeamSearch(search+'<a class="search-item" href="https://evil.example/search/r/team/1/idx">Teste</a>').length,0);
  assert.throws(()=>parseTeamSearch('<h1>Blocked</h1>'));
  assert.throws(()=>parseTeam('<h1>Blocked</h1>','1',period));
  const team=parseTeam(profile,'1',period);
  assert.equal(team.roster.filter(p=>!p.staff).length,2);
  assert.equal(team.roster.filter(p=>p.staff)[0].name,'Carla');
  assert.equal(team.roster[1].role,'loan');
  assert.equal(team.events.length,4,'exclui 2023 e duplicado');
  assert.equal(team.events.find(e=>e.id==='10').cents,100050);
  assert.equal(team.events.find(e=>e.id==='11').cents,null);
  assert.equal(team.statsUrl,'https://www.vlr.gg/team/stats/1/teste/');
});
test('rounds: soma ataque e defesa uma vez, ignora sublinhas e valida as datas e colunas', () => {
  assert.deepEqual(parseTeamMaps(stats(),period),{roundsWon:32,roundsLost:18,rounds:50,mapsWon:2,mapsLost:1,maps:3});
  assert.throws(()=>parseTeamMaps(stats({start:'2020-01-01'}),period),/Período/);
  assert.throws(()=>parseTeamMaps(stats({missing:true}),period),/informado/);
  assert.throws(()=>parseTeamMaps(stats().replaceAll('<th>RW</th>','<th>Changed</th>'),period),/Colunas/);
});
test('cartão time: prêmios em falta não viram zero, montantes anuais e limites Discord', () => {
  const snapshot={team:parseTeam(profile,'1',period),maps:parseTeamMaps(stats(),period),statsUrl:'https://www.vlr.gg/team/stats/1/teste/',period,url:'https://www.vlr.gg/team/1',fetchedAt:now};
  const embed=teamEmbed(snapshot), prizes=embed.fields.find(f=>f.name.includes('Prêmios')).value;
  assert.match(prizes,/2025[^\n]+sem valores monetários informados/);
  assert.match(prizes,/1\.000,50/);
  assert.match(prizes,/2024[^\n]+250,00/);
  assert.doesNotMatch(prizes,/999/);
  const card=cardMessage(embed);
  new ContainerBuilder(card.components[0]).toJSON();
  assert.ok(card.components[0].components.filter(c=>c.type===10).reduce((n,c)=>n+c.content.length,0)<4000);
  assert.match(JSON.stringify(teamEmbed({...snapshot,maps:null})),/Não consegui confirmar os rounds/);
});
test('time: falha de estatísticas preserva perfil e prêmios; pesquisa ambígua não escolhe outro time', async () => {
  let calls=0;
  const source=new ProSource({now:()=>now,fetcher:async url=>{calls++;if(url.includes('/search/'))return new Response(search+result('1','Teste')+result('2','Teste GC'));if(url.includes('/team/stats/'))return new Response('offline',{status:503});return new Response(profile);}});
  const found=await source.team('Teste');
  assert.equal(found.team.name,'Teste');assert.equal(found.maps,null);assert.equal(found.team.events.length,4);
  await source.team('Teste');assert.equal(calls,3);
  const ambiguous=await source.team('Tes');assert.equal(ambiguous.candidates.length,2);assert.equal(calls,4);
});
test('time: handler adia a resposta antes da rede e devolve cartão sem menções', async () => {
  const events=[];
  const i={commandName:'time',guildId:'test-guild',user:{id:'test-user'},isChatInputCommand:()=>true,options:{getString:()=> 'Teste'},deferReply:async()=>events.push('defer'),editReply:async body=>events.push(body)};
  const pros={team:async()=>{assert.equal(events[0],'defer');return {team:parseTeam(profile,'1',period),maps:null,period,url:'https://www.vlr.gg/team/1',fetchedAt:now};}};
  await createHandler({guildId:i.guildId,source:{},pros})(i);
  assert.equal(events[1].flags,MessageFlags.IsComponentsV2);
  assert.deepEqual(events[1].allowedMentions.parse,[]);
  assert.match(JSON.stringify(events[1]),/Elenco atual/);
});
