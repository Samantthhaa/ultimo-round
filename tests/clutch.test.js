import test from 'node:test';
import assert from 'node:assert/strict';
import { ContainerBuilder } from 'discord.js';
import { maps, simulateClutch, clutchSceneIds } from '../src/clutch.js';
import { clutchEmbed } from '../src/format.js';
import { cardMessage } from '../src/cards.js';
import { createHandler } from '../src/handler.js';

const first={id:'111111111111111111'},second={id:'222222222222222222'},owner={id:'333333333333333333'};
test('clutch: todas as histórias funcionam para ambos os vencedores e todos os mapas', () => {
  assert.equal(new Set(clutchSceneIds).size,14);
  for(const map of maps) for(let scene=0;scene<clutchSceneIds.length;scene++) for(let winner=0;winner<2;winner++) {
    let call=0;
    const duel=simulateClutch(first,second,{map,pick:()=>[winner,scene,0][call++]});
    assert.equal(duel.sceneId,clutchSceneIds[scene]);
    assert.equal(duel.winner.id,winner?second.id:first.id);
    assert.equal(duel.map,map);assert.ok(['A','B','C'].includes(duel.site));
    assert.equal(duel.beats.length,3);assert.ok(duel.hp>0&&duel.hp<=100);
    assert.ok(duel.beats[2].includes(`<@${duel.winner.id}>`));
    assert.ok(duel.text.includes(`<@${duel.loser.id}>`));
    assert.doesNotMatch(duel.text,/chamada|microfone|🎙️|\bcall\b/i);
    const embed=clutchEmbed(duel,true),card=cardMessage(embed);
    assert.ok(embed.description.indexOf(first.id)<embed.description.indexOf(second.id),'a ordem do confronto não revela o vencedor');
    new ContainerBuilder(card.components[0]).toJSON();
    assert.ok(card.components[0].components.filter(c=>c.type===10).reduce((n,c)=>n+c.content.length,0)<4000);
  }
});
test('clutch: exclui histórias recentes e recupera quando todas foram excluídas', () => {
  const excluded=clutchSceneIds.slice(0,3);
  const duel=simulateClutch(first,second,{map:'Bind',excludeScenes:excluded,pick:()=>0});
  assert.equal(duel.sceneId,clutchSceneIds[3]);
  assert.ok(clutchSceneIds.includes(simulateClutch(first,second,{excludeScenes:clutchSceneIds,pick:()=>0}).sceneId));
});
function interaction({button,user=owner,map='Haven',guildId='444444444444444444'}={}) {
  const events=[];
  return {events,guildId,user,commandName:button?undefined:'clutch',customId:button,
    isButton:()=>Boolean(button),isChatInputCommand:()=>!button,
    options:{getUser:name=>name==='jogador1'?first:second,getString:()=>map},
    reply:async body=>events.push(body)};
}
const buttonId = reply => reply.components[0].components.at(-1).components[0].custom_id;

test('revanche: participante pode repetir, mapa escolhido mantém-se e cooldown evita duplicações',async()=>{
  let now=0;const i=interaction();
  const handle=createHandler({guildId:i.guildId,source:{},now:()=>now});
  await handle(i);const id=buttonId(i.events[0]);
  assert.match(id,/^clutch:replay:[a-f0-9]{16}$/);
  new ContainerBuilder(i.events[0].components[0]).toJSON();
  const repeat=interaction({button:id,user:first});
  await handle(repeat);
  assert.match(JSON.stringify(repeat.events[0]),/rodada 2/);
  assert.match(JSON.stringify(repeat.events[0]),/Haven/);
  assert.deepEqual(repeat.events[0].allowedMentions.parse,[]);
  await handle(repeat);assert.match(repeat.events[1].content,/segundos/);
  now=5001;await handle(repeat);assert.ok(repeat.events[2].components);
});
test('revanche: bloqueia terceiros, outro servidor, ID inventado e botão expirado',async()=>{
  let now=0;const i=interaction();
  const handle=createHandler({guildIds:[i.guildId,'555555555555555555'],source:{},now:()=>now});
  await handle(i);const id=buttonId(i.events[0]);
  const stranger=interaction({button:id,user:{id:'999999999999999999'}});
  await handle(stranger);assert.match(stranger.events[0].content,/participantes/);
  const other=interaction({button:id,guildId:'555555555555555555'});
  await handle(other);assert.match(other.events[0].content,/expirou/);
  const fake=interaction({button:'clutch:replay:inventado'});
  await handle(fake);assert.match(fake.events[0].content,/expirou/);
  now=600001;const expired=interaction({button:id});
  await handle(expired);assert.match(expired.events[0].content,/expirou/);
});
test('revanche: o par evita as últimas três histórias, mesmo com a ordem dos participantes invertida',async()=>{
  let now=0;const i=interaction();
  const handle=createHandler({guildId:i.guildId,source:{},now:()=>now});
  const titles=[];
  for(let n=0;n<10;n++) {
    const next=interaction();
    if(n%2) next.options.getUser=name=>name==='jogador1'?second:first;
    await handle(next);
    const texts=next.events[0].components[0].components.filter(c=>c.type===10);
    const title=texts[1].content.split('\n')[0];
    assert.ok(!titles.slice(-3).includes(title));
    titles.push(title);now+=5001;
  }
});
