import { randomBytes } from 'node:crypto';
import { escapeMarkdown, MessageFlags } from 'discord.js';

const mentions={parse:[],repliedUser:false};
const categories={bug:'Erro',sugestao:'Sugestão',outro:'Outro'};
const safe=value=>escapeMarkdown(String(value).replace(/@/g,'@\u200b'));
export function createFeedback({deliver,now=Date.now,cooldownMs=60_000}) {
  const forms=new Map(),lastSent=new Map(),sending=new Set();
  return {
    async open(interaction) {
      const timestamp=now();
      for(const [key,form] of forms) if(form.expires<=timestamp) forms.delete(key);
      for(const [key,expiry] of lastSent) if(expiry<=timestamp) lastSent.delete(key);
      if(forms.size>=200) forms.delete(forms.keys().next().value);
      const type=interaction.options.getString('tipo')??'sugestao';
      if(!Object.hasOwn(categories,type)) throw new Error('Tipo de feedback inválido.');
      const customId=`feedback:${randomBytes(12).toString('hex')}`;
      forms.set(customId,{userId:interaction.user.id,guildId:interaction.guildId,type,expires:timestamp+600_000});
      await interaction.showModal({custom_id:customId,title:`Feedback · ${categories[type]}`,components:[{type:18,label:'Sua mensagem para a desenvolvedora',description:'Vai por mensagem privada, com seu ID e o do servidor. Não envie senhas ou tokens.',component:{type:4,custom_id:'mensagem',style:2,min_length:10,max_length:1200,required:true,placeholder:'Conte o que aconteceu ou qual é a sua ideia.'}}]});
    },
    async submit(interaction) {
      const reply=content=>interaction.reply({content,flags:MessageFlags.Ephemeral,allowedMentions:mentions});
      const form=forms.get(interaction.customId),timestamp=now();
      if(!form||form.expires<=timestamp||form.userId!==interaction.user.id||form.guildId!==interaction.guildId) return reply('Este formulário expirou. Abra /feedback novamente.');
      const userId=interaction.user.id;
      if(sending.has(userId)||(lastSent.get(userId)??0)>timestamp) return reply('Espere um minuto entre envios de feedback.');
      const message=interaction.fields.getTextInputValue('mensagem').trim();
      if(message.length<10||message.length>1200) return reply('Escreva entre 10 e 1.200 caracteres no feedback.');
      sending.add(userId);
      let result;
      try {
        await interaction.deferReply({flags:MessageFlags.Ephemeral});
        result=await deliver({embeds:[{color:0xa78bc1,title:`Último Round · ${categories[form.type]}`,description:safe(message),fields:[{name:'Enviado por',value:safe(`${interaction.user.username??'Usuário'} · ${userId}`)},{name:'Servidor',value:safe(`${interaction.guild?.name??'Servidor'} · ${form.guildId}`)}],timestamp:new Date(timestamp).toISOString()}],allowedMentions:mentions});
      } catch {
        const body={content:'Não consegui entregar o feedback. Ele não foi confirmado como recebido. Tente /feedback novamente mais tarde.',allowedMentions:mentions};
        if(interaction.deferred) return interaction.editReply(body);
        return reply(body.content);
      } finally {sending.delete(userId);}
      forms.delete(interaction.customId);lastSent.set(userId,now()+cooldownMs);
      return interaction.editReply({content:`Feedback entregue em particular para a desenvolvedora. Obrigada!${result?.id?`\nProtocolo: \`${result.id}\``:''}`,allowedMentions:mentions});
    }
  };
}
