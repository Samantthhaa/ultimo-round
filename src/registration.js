import {Routes} from 'discord.js';

export async function registerCommands(rest,{appId,guildIds,publicMode},commands) {
  if(publicMode) {
    // Publish before removing legacy guild copies, so the working commands stay available.
    for(const command of commands) await rest.post(Routes.applicationCommands(appId),{body:{...command,contexts:[0],integration_types:[0]}});
    const names=new Set([...commands.map(c=>c.name),'equipa']);
    for(const guildId of guildIds) {
      const previous=await rest.get(Routes.applicationGuildCommands(appId,guildId));
      for(const command of previous) if(command.type===1&&names.has(command.name)) await rest.delete(Routes.applicationGuildCommand(appId,guildId,command.id));
    }
    return;
  }
  for(const guildId of guildIds) {
    const existing=await rest.get(Routes.applicationGuildCommands(appId,guildId));
    const legacy=existing.find(command=>command.name==='equipa'&&command.type===1);
    const brazilian=commands.find(command=>command.name==='time');
    if(legacy&&brazilian&&!existing.some(command=>command.name==='time')) await rest.patch(Routes.applicationGuildCommand(appId,guildId,legacy.id),{body:brazilian});
    for(const command of commands) await rest.post(Routes.applicationGuildCommands(appId,guildId),{body:command});
  }
}
