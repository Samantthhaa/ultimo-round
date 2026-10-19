import { randomInt } from 'node:crypto';

export const maps = ['Ascent', 'Haven', 'Lotus', 'Bind', 'Split'];
// Cenários de ficção; não representam a rotação competitiva atual.
const sites = { Ascent: 'A', Haven: 'C', Lotus: 'C', Bind: 'B', Split: 'B' };
const scenes = [
  { id: 'one-hp', title: 'O pixel da fé', weapon: 'Sheriff', hp: 1,
    tell: (w,l,site) => [
      `${l} tem a spike plantada no ${site}. ${w} chega ao retake com **1 HP e uma Sheriff**. A margem de erro? Não veio para este round.`,
      `${w} toca na spike. ${l} abre o ângulo para impedir o defuse… **PÁ.** Uma bala. Um silêncio muito específico.`,
      `${w} desarma antes da explosão. O próximo round vai ter de esperar.`] },
  { id: 'empty-rifle', title: 'A arma secundária tem sentimentos', weapon: 'Classic', hp: 12,
    tell: (w,l,site) => [
      `Último duelo no ${site}. ${w} tenta disparar a Vandal. **Click.** Zero balas. ${l} ouve e avança sem pedir licença.`,
      `A troca para a Classic é mais pânico do que técnica. Dois disparos falham. O terceiro encontra exatamente quem vinha cobrar o round.`,
      `${w} ganha o duelo. A Vandal fica só olhando, carregador vazio e orgulho ferido.`] },
  { id: 'ninja', title: 'O defuse mais mal-educado da noite', weapon: 'Kit de defuse', hp: 8,
    tell: (w,l,site) => [
      `${l} planta no ${site} e recua para segurar o ângulo. ${w} entra numa smoke junto à spike.`,
      `O defuse começa. ${l} espera pelo fake. Espera só mais um pouquinho. **Não era fake.**`,
      `Spike desarmada por ${w}, sem disparar uma bala. ${l} ainda estava esperando alguém aparecer.`] },
  { id: 'spray', title: 'Controle de spray: opcional', weapon: 'Phantom', hp: 23,
    tell: (w,l,site) => [
      `${w} e ${l} encontram-se no ${site}. Os dois disparam ao mesmo tempo. A parede recebe a maior parte da conversa.`,
      `O spray desenha uma assinatura, uma constelação e, por acidente, encontra ${l}.`,
      `${w} fica com o round e com uma obra de arte que ninguém encomendou.`] },
  { id: 'reload', title: 'Ouviu o reload, perdeu a educação', weapon: 'Vandal', hp: 17,
    tell: (w,l,site) => [
      `Um contra um no ${site}. ${l} dispara para fazer pressão e fica sem balas. ${w} deixa de fazer barulho.`,
      `O som da recarga mal começa e ${w} já abre o ângulo. Um tiro na cabeça encerra a negociação.`,
      `${w} leva o round. A recarga de ${l} fica oficialmente para depois.`] },
  { id: 'spike-clock', title: 'O relógio não aceitou desculpas', weapon: 'Spike', hp: 6,
    tell: (w,l,site) => [
      `${w} tem a spike plantada no ${site} e quase nenhuma vida. ${l} precisa de desarmar. O bip está cada vez menos simpático.`,
      `${l} começa o defuse. ${w} aparece só o suficiente para forçar a parada e se esconde de novo.`,
      `**BOOM.** ${w} ganha pelo tempo. ${l} descobre que ganhar espaço não vem com segundos extra.`] },
  { id: 'knife', title: 'Era só clicar no mouse', weapon: 'Vandal', hp: 35,
    tell: (w,l,site) => [
      `${l} pega ${w} de costas no ${site}. Em vez de atirar, decide que isso merece uma faca.`,
      `O primeiro golpe não alcança. ${w} se vira, puxa a Vandal e interrompe o espetáculo. A faca ainda estava no meio da coreografia.`,
      `${w} ganha. A tentativa de humilhação acaba de pedir transferência.`] },
  { id: 'wide', title: 'O ângulo estava pago', weapon: 'Operator', hp: 74,
    tell: (w,l,site) => [
      `${w} está imóvel, de Operator, segurando a entrada do ${site}. ${l} decide dar uma olhadinha.`,
      `Não foi uma olhadinha discreta. Foi uma visita guiada ao ângulo inteiro. **BANG.**`,
      `${w} fecha o round. ${l} queria só um pouquinho de informação. Recebeu o calibre completo.`] },
  { id: 'fake-rotation', title: 'O GPS estava mentindo', weapon: 'Phantom', hp: 28,
    tell: (w,l,site) => [
      `A spike ainda não foi plantada. ${w} faz barulho saindo do ${site}. ${l} rotaciona para tentar interceptar.`,
      `${w} para, volta em silêncio e encontra ${l} checando o caminho errado. Uma rajada resolve o desencontro.`,
      `Round para ${w}. A rotação de ${l} tinha boas intenções e nenhuma informação.`] },
  { id: 'spectre', title: 'O plano era não ter plano', weapon: 'Spectre', hp: 19,
    tell: (w,l,site) => [
      `${l} guarda o ${site} com uma Vandal. ${w} tem uma Spectre e confiança suficiente para tomar más decisões.`,
      `${w} encurta a distância pela smoke. Quando os dois se veem, já não há espaço para uma discussão sobre economia.`,
      `${w} ganha de perto. A Spectre acaba o round com uma autoestima perigosíssima.`] },
  { id: 'jump', title: 'A informação saiu cara', weapon: 'Vandal', hp: 41,
    tell: (w,l,site) => [
      `${l} tenta um pulo para pegar informação no ${site}. ${w} está com a mira esperando a queda.`,
      `A informação chega: ${w} estava mesmo ali. A Vandal confirma antes de haver tempo para recuar.`,
      `${w} ganha o round. ${l} encontrou exatamente o que procurava. O problema foi a hora de cair.`] },
  { id: 'fake-defuse', title: 'O fake tinha um fake', weapon: 'Sheriff', hp: 14,
    tell: (w,l,site) => [
      `${l} defende a spike plantada no ${site}. ${w} toca no defuse e solta. Ninguém aparece.`,
      `${w} toca outra vez. Desta vez ${l} vem confirmar… diretamente para a Sheriff.`,
      `${w} elimina o último adversário e ainda desarma. A segunda opinião de ${l} veio com custos.`] },
  { id: 'last-bullet', title: 'Uma bala, ego demais', weapon: 'Vandal', hp: 3,
    tell: (w,l,site) => [
      `Última pessoa de cada lado no ${site}. ${w} tem **3 HP e uma bala**. ${l} tem razões perfeitamente válidas para acreditar.`,
      `${w} não recarrega. Espera pelo passo, ajusta um pixel e dispara. **Headshot.**`,
      `O round é de ${w}. Uma bala gasta, nenhuma sobrando. O orçamento foi cumprido à risca.`] },
  { id: 'trigger', title: 'Paciência com consequências', weapon: 'Phantom', hp: 52,
    tell: (w,l,site) => [
      `${w} se esconde no ${site}. ${l} passa, para, quase confere o canto… e decide que está limpo.`,
      `${w} espera um segundo inteiro antes de sair. O disparo da Phantom interrompe uma rotação tranquila demais.`,
      `Round para ${w}. A revisão dos cantos de ${l} acaba de ganhar mais um item.`] }
];
export const clutchSceneIds = scenes.map(scene=>scene.id);
export function simulateClutch(first, second, { map, excludeScenes = [], pick = n => randomInt(n) } = {}) {
  if (!first?.id || !second?.id || first.id === second.id) throw new Error('Escolha duas pessoas diferentes.');
  if (first.bot || second.bot) throw new Error('Este duelo é entre pessoas, não entre bots.');
  if (map && !maps.includes(map)) throw new Error('Mapa inválido.');
  const winner = pick(2) === 0 ? first : second;
  const loser = winner.id === first.id ? second : first;
  const eligible = scenes.filter(scene=>!excludeScenes.includes(scene.id));
  const pool = eligible.length ? eligible : scenes;
  const scene = pool[pick(pool.length)];
  const chosenMap = map ?? maps[pick(maps.length)];
  const beats = scene.tell(`<@${winner.id}>`, `<@${loser.id}>`, sites[chosenMap]);
  return {
    map: chosenMap, site: sites[chosenMap], participants: [first, second], winner, loser, weapon: scene.weapon,
    sceneId: scene.id, title: scene.title, hp: scene.hp, beats,
    text: beats.join('\n\n')
  };
}
