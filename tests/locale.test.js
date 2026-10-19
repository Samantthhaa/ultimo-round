import test from 'node:test';
import assert from 'node:assert/strict';
import {stageLabel,roleLabel,decimal} from '../src/locale.js';
import {commands} from '../src/commands.js';
import {helpCard} from '../src/cards.js';
import {clutchSceneIds,simulateClutch} from '../src/clutch.js';
import {clutchEmbed} from '../src/format.js';

test('pt-BR: fases, funções e números usam os termos brasileiros',()=>{
  assert.equal(stageLabel('Main Event–Upper Round 1'),'Evento principal–Rodada da chave superior 1');
  assert.equal(stageLabel('Group Stage – 3rd–4th'),'Fase de grupos – 3º–4º');
  assert.equal(roleLabel('head coach'),'Treinador principal');
  assert.equal(roleLabel('loan'),'Emprestado');
  assert.equal(decimal(1.21),'1,21');
});
test('pt-BR: comandos, ajuda e histórias não usam os antigos termos portugueses',()=>{
  assert.ok(commands.some(c=>c.name==='time'));
  assert.ok(!commands.some(c=>c.name==='equipa'));
  for(const name of ['jogos','resultado']) assert.ok(commands.find(c=>c.name===name).options.some(o=>o.name==='time'));
  const texts=[JSON.stringify(commands),JSON.stringify(helpCard())];
  for(let scene=0;scene<clutchSceneIds.length;scene++) {
    let call=0;const duel=simulateClutch({id:'1'},{id:'2'},{map:'Haven',pick:()=>[0,scene][call++]});
    texts.push(JSON.stringify(clutchEmbed(duel)));
  }
  for(const text of texts) assert.doesNotMatch(text,/desforra|equipa|espreitadela|espreita|bocadinho|controlo|aterragem|por defeito|ronda|prémio/i);
});
