export function inviteUrl(appId) {
  if (!/^\d{16,22}$/.test(appId ?? '')) throw new Error('ID da aplicação inválido.');
  const url=new URL('https://discord.com/oauth2/authorize');
  url.search=new URLSearchParams({client_id:appId,scope:'bot applications.commands',permissions:'19456',integration_type:'0'});
  return url.href;
}
