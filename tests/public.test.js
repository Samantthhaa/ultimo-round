import test from 'node:test';
import assert from 'node:assert/strict';
import {ModalBuilder,MessageFlags,Routes} from 'discord.js';
import {createFeedback} from '../src/feedback.js';
import {createHandler} from '../src/handler.js';
import {readConfig} from '../src/config.js';
import {inviteUrl} from '../src/invite.js';
import {registerCommands} from '../src/registration.js';

const appId='111111111111111111',userId='222222222222222222',guildId='333333333333333333';
function interaction({command='feedback',customId,user=userId,guild=guildId,message='Gostaria de acompanhar mais times.'}={}) {
 const events=[];
 return {events,commandName:command,customId,user:{id:user,username:'Teste'},guildId:guild,guild:{name:'Servidor teste'},deferred:false,
 isChatInputCommand:()=>!customId,isModalSubmit:()=>Boolean(customId),options:{getString:()=>null},fields:{getTextInputValue:()=>message},
 showModal:async body=>events.push(['modal',body]),reply:async body=>events.push(['reply',body]),
 deferReply:async function(body){this.deferred=true;events.push(['defer',body]);},editReply:async body=>events.push(['edit',body])};
}
test('instalação pública: configuração dispensa IDs e convite deixa escolher servidor',()=>{
 const config=readConfig({DISCORD_APPLICATION_ID:appId,DISCORD_PUBLIC:'true'},{tokenRequired:false});
 assert.equal(config.publicMode,true);assert.deepEqual(config.guildIds,[]);
 assert.throws(()=>readConfig({DISCORD_APPLICATION_ID:appId,DISCORD_PUBLIC:'qualquer'},{tokenRequired:false}),/PUBLIC/);
 const url=new URL(inviteUrl(appId));
 assert.equal(url.searchParams.get('permissions'),'19456');
 assert.equal(url.searchParams.get('scope'),'bot applications.commands');
 assert.ok(!url.searchParams.has('guild_id'));assert.ok(!url.searchParams.has('disable_guild_select'));
});
test('instalação pública: novo servidor usa comandos sem lista manual; DMs continuam bloqueadas',async()=>{
 const handle=createHandler({publicMode:true,appId,source:{}});
 const i=interaction({command:'convidar'});await handle(i);
 assert.ok(i.events[0][1].flags&MessageFlags.Ephemeral);
 assert.match(JSON.stringify(i.events[0][1]),/Adicionar ao servidor/);
 const dm=interaction({command:'ajuda',guild:null});await handle(dm);
 assert.match(dm.events[0][1].content,/servidor onde o bot foi instalado/);
});
test('registro público: publica antes de migrar; não remove comandos alheios ou menus',async()=>{
 const events=[];
 const rest={post:async(path,body)=>events.push(['post',path,body]),get:async()=>[{id:'1',type:1,name:'ajuda'},{id:'2',type:1,name:'outro-projeto'},{id:'3',type:2,name:'ajuda'}],delete:async path=>events.push(['delete',path])};
 await registerCommands(rest,{appId,guildIds:[guildId],publicMode:true},[{name:'ajuda'},{name:'feedback'}]);
 assert.equal(events[0][1],Routes.applicationCommands(appId));
 assert.deepEqual(events[0][2].body.contexts,[0]);
 assert.deepEqual(events[0][2].body.integration_types,[0]);
 assert.equal(events.length,3);assert.equal(events[2][1],Routes.applicationGuildCommand(appId,guildId,'1'));
 let deleted=false;
 await assert.rejects(registerCommands({post:async()=>{throw new Error('offline');},delete:async()=>deleted=true},{appId,guildIds:[guildId],publicMode:true},[{name:'ajuda'}]));
 assert.equal(deleted,false);
});
test('feedback: formulário válido informa destino; confirma só depois da entrega privada',async()=>{
 let submit;const feedback=createFeedback({deliver:async payload=>{
   assert.equal(submit.events[0][0],'defer');assert.deepEqual(payload.allowedMentions.parse,[]);
   assert.match(payload.embeds[0].description,/acompanhar/);return {id:'987654321'};
 }});
 const start=interaction();await feedback.open(start);
 const modal=start.events[0][1];new ModalBuilder(modal).toJSON();
 assert.match(JSON.stringify(modal),/mensagem privada/);
 submit=interaction({customId:modal.custom_id});await feedback.submit(submit);
 assert.equal(submit.events[0][1].flags,MessageFlags.Ephemeral);
 assert.match(submit.events[1][1].content,/entregue em particular/);
 assert.match(submit.events[1][1].content,/987654321/);
});
test('feedback: impede replay, outro usuário, outro servidor e envio frequente',async()=>{
 let time=0,calls=0;const feedback=createFeedback({now:()=>time,deliver:async()=>{calls++;return {id:'1'};}});
 const start=interaction();await feedback.open(start);const customId=start.events[0][1].custom_id;
 for(const options of [{user:'999'},{guild:'999'}]) {
  const bad=interaction({...options,customId});await feedback.submit(bad);assert.match(bad.events[0][1].content,/expirou/);
 }
 const good=interaction({customId});await feedback.submit(good);assert.equal(calls,1);
 await feedback.submit(good);assert.match(good.events.at(-1)[1].content,/expirou/);
 const next=interaction();await feedback.open(next);const nextId=next.events[0][1].custom_id;
 const fast=interaction({customId:nextId});await feedback.submit(fast);assert.match(fast.events[0][1].content,/um minuto/);assert.equal(calls,1);
 time=600001;const expired=interaction({customId:nextId});await feedback.submit(expired);assert.match(expired.events[0][1].content,/expirou/);
});
test('feedback: falha de entrega não é confirmada como sucesso e permite nova tentativa',async()=>{
 let fail=true;const feedback=createFeedback({deliver:async()=>{if(fail)throw new Error('DM bloqueada');return {id:'1'};}});
 const start=interaction();await feedback.open(start);const customId=start.events[0][1].custom_id;
 const failed=interaction({customId});await feedback.submit(failed);assert.match(failed.events[1][1].content,/não foi confirmado como recebido/);
 fail=false;const retry=interaction({customId});await feedback.submit(retry);assert.match(retry.events[1][1].content,/entregue/);
});
test('handler: feedback funciona em novo servidor e encaminha formulário ao serviço',async()=>{
 let opened=false,submitted=false;
 const handle=createHandler({publicMode:true,appId,source:{},feedback:{open:async()=>opened=true,submit:async()=>submitted=true}});
 await handle(interaction());await handle(interaction({customId:'feedback:example'}));
 assert.equal(opened,true);assert.equal(submitted,true);
});
