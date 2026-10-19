import test from 'node:test';
import assert from 'node:assert/strict';
import { ProSource } from '../src/pros.js';
import { parseTeamUpcoming } from '../src/teams.js';
import { teamScheduleEmbed } from '../src/format.js';
import { createHandler } from '../src/handler.js';

const search='<input name="q"><select name="type"><option selected value="teams">Teams</option></select>';
const result=(id,name)=>`<a class="search-item" href="/search/r/team/${id}/idx"><div class="search-item-title">${name}</div></a>`;
const main='<div class="team-header"><h1>MIBR</h1></div><h2>Recent Results</h2><div><a class="m-item" href="/123/past">Resultado passado</a></div><h2>Current Roster</h2>';
const upcoming=`<div class="team-header"><h1>MIBR GC</h1></div><h2>Upcoming matches</h2><div><a class="m-item" href="/12345/fennel-gc-vs-mibr-gc"><div class="m-item-event"><div class="text-of">Campeonato Fictício 2026</div>Upper Round 1</div><span class="m-item-team-name">MIBR GC</span><span class="m-item-team-name">FENNEL GC</span><div class="m-item-result mod-tbd"></div><div class="m-item-date"><div>2026/10/22</div>6:00 pm</div></a></div><h2>Recent Results</h2><div><a class="m-item" href="/12346/past">Resultado passado</a></div>`;

test('agenda: recolhe só próximas partidas, campeonato, fase e data do time',()=>{
  const schedule=parseTeamUpcoming(upcoming);
  assert.equal(schedule.matches.length,1);
  assert.equal(schedule.matches[0].event,'Campeonato Fictício 2026');
  assert.equal(schedule.matches[0].stage,'Upper Round 1');
  assert.equal(schedule.matches[0].dateLabel,'2026/10/22');
  assert.equal(schedule.matches[0].timeLabel,'6:00 pm');
  assert.equal(parseTeamUpcoming(main).matches.length,0);
  assert.throws(()=>parseTeamUpcoming('<h1>Blocked</h1>'));
  assert.throws(()=>parseTeamUpcoming(upcoming.replace('/12345/fennel-gc-vs-mibr-gc','https://evil.example/12345/match')));
  assert.throws(()=>parseTeamUpcoming(upcoming.replace('m-item-event','changed-event')));
});
test('filtro: MIBR e MIBR GC consultam IDs diferentes e nunca substituem elencos',async()=>{
  const urls=[];
  const source=new ProSource({fetcher:async url=>{
    urls.push(url);
    if(url.includes('/search/'))return new Response(search+result('1','MIBR')+result('2','MIBR GC')+result('3','MIBR Academy'));
    return new Response(url.endsWith('/team/1')?main:upcoming);
  }});
  const a=await source.upcoming('MIBR');
  assert.equal(a.team.id,'1');assert.equal(a.matches.length,0);
  assert.match(teamScheduleEmbed(a).description,/não tem próximas partidas publicadas/);
  const b=await source.upcoming('MIBR GC');
  assert.equal(b.team.id,'2');assert.equal(b.matches.length,1);
  const embed=teamScheduleEmbed(b);
  assert.match(embed.fields[0].value,/Campeonato Fictício 2026/);
  assert.match(embed.fields[0].value,/22\/10\/2026 · 18:00/);
  assert.match(embed.description,/MIBR GC/);
  assert.equal(urls.filter(url=>url.endsWith('/team/1')).length,1);
  await source.upcoming('MIBR');assert.equal(urls.length,4,'cache evita repetir pesquisa e perfil');
});
test('agenda: ambiguidade, ausência e identidade inesperada não viram jogos de outro time',async()=>{
  const source=new ProSource({fetcher:async url=>new Response(url.includes('/search/')?search+result('1','MIBR')+result('2','MIBR GC'):upcoming)});
  const ambiguous=await source.upcoming('MI');assert.equal(ambiguous.candidates.length,2);
  assert.match(teamScheduleEmbed(ambiguous).description,/vários times/);
  await assert.rejects(source.upcoming('MIBR'),/Identidade/);
  const empty=new ProSource({fetcher:async()=>new Response(search)});
  assert.match(teamScheduleEmbed(await empty.upcoming('Inexistente')).description,/Não encontrei/);
});
test('agenda: alias c9 resolve Cloud9 sem confundir outros times',async()=>{
  const source=new ProSource({fetcher:async url=>{
    if(url.includes('/search/')){assert.equal(new URL(url).searchParams.get('q'),'cloud9');return new Response(search+result('9','Cloud9')+result('10','Cloud9 GC'));}
    assert.equal(url,'https://www.vlr.gg/team/9');return new Response(main.replace('MIBR','Cloud9'));
  }});
  assert.equal((await source.upcoming('c9')).team.id,'9');
});
test('handler: time explícita consulta agenda própria mesmo com foco Brasil',async()=>{
  const events=[];
  const i={guildId:'test',user:{id:'user'},commandName:'jogos',isChatInputCommand:()=>true,options:{getString:name=>name==='time'?'MIBR GC':'br'},deferReply:async()=>events.push('defer'),editReply:async body=>events.push(body)};
  const source={get:async()=>assert.fail('Não deve usar calendário geral para um time explícita')};
  const pros={upcoming:async query=>{assert.equal(events[0],'defer');assert.equal(query,'MIBR GC');return {...parseTeamUpcoming(upcoming),team:{name:'MIBR GC'},coverage:'team',url:'https://www.vlr.gg/team/2',fetchedAt:0};}};
  await createHandler({guildId:'test',source,pros})(i);
  assert.match(JSON.stringify(events[1]),/MIBR GC/);
  assert.match(JSON.stringify(events[1]),/Campeonato Fictício 2026/);
  assert.deepEqual(events[1].allowedMentions.parse,[]);
});
