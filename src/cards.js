import { MessageFlags } from 'discord.js';

// Discord-native layout: readable headings, separators and a real source button.
export function cardMessage(embed, { iconUrl, linkLabel = 'Abrir no VLR.gg' } = {}) {
  const text = content => ({ type: 10, content });
  const separator = () => ({ type: 14, divider: true, spacing: 1 });
  const heading = [text(`## ${embed.title}`)];
  if (embed.description) heading.push(text(embed.description));
  const components = iconUrl
    ? [{ type: 9, components: heading, accessory: { type: 11, media: { url: iconUrl }, description: 'Mascote pixel art do Último Round' } }]
    : heading;
  if (embed.fields?.length) {
    components.push(separator());
    embed.fields.forEach((field, index) => {
      components.push(text(`### ${field.name}\n${field.value}`));
      if (index < embed.fields.length - 1) components.push(separator());
    });
  }
  if (embed.footer?.text) {
    components.push(separator());
    components.push(text(`-# ${embed.footer.text}${embed.timestamp ? `\n-# Consulta: <t:${Math.floor(Date.parse(embed.timestamp)/1000)}:R>` : ''}`));
  }
  if (embed.url) components.push({ type: 1, components: [{ type: 2, style: 5, label: linkLabel, url: embed.url }] });
  return { flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: 0xa78bc1, components }] };
}

export function helpCard(options) {
  return cardMessage({ title: 'Último Round', description: '**VALORANT entre amigos.**\nUm clutch pela zoeira ou uma olhada no competitivo?',
    fields: [
      { name: '🎲 Bora um duelo?', value: '`/clutch jogador1 jogador2 [mapa]`\nEscolha duas pessoas: há reviravoltas, mapas sorteados e um botão Revanche para repetir. Quem lançou o duelo e os participantes podem usá-lo durante 10 minutos.' },
      { name: '📺 Acompanhar o competitivo', value: '`/jogos [time] [foco]` · próximas partidas; indicar time consulta a sua agenda exata\n`/resultado [time] [foco]` · resultados recentes\n`/time nome` · elenco, rounds e prêmios dos três anos civis mais recentes\nNos jogos/resultados: Brasil por padrão. Indicar um time substitui o foco. Para GC ou Academy, escreva o nome completo.' },
      { name: '🏅 De olho nos jogadores', value: '`/jogador nome` · perfil e time atual\n`/classificacao [criterio] [periodo] [foco]` · comparar estatísticas\nRating VLR, 60 dias e Internacional por padrão. Também tem ACS, K/D e filtro Brasil.' },
      { name: 'Experimente', value: '`/jogador nome:aspas`\n`/classificacao criterio:acs periodo:30d foco:br`\nEspere 5 segundos entre comandos.' },
      {name:'💌 Ajude o bot a melhorar',value:'`/feedback [tipo]` · envie uma ideia ou erro em particular para a desenvolvedora\n`/convidar` · adicione o bot em outro servidor'}
    ], footer: { text: 'Clutches fictícios · Dados VLR.gg, cache 10 min e cobertura da página consultada · Tabela VCT com mínimo 200 rounds · Brasil filtra bandeiras/evento nas partidas e bandeira do jogador na tabela · Sem afiliação à Riot, Discord ou VLR.gg' },
    url: 'https://www.vlr.gg'
  }, { ...options, linkLabel: 'Explorar o competitivo' });
}
