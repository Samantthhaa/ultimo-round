# Último Round

Bot de VALORANT para Discord, desenvolvido por Samantha. Interface em português do Brasil, com cartões, links para as fontes e clutches fictícios entre amigos.

## Comandos

| Comando | O que faz |
| --- | --- |
| `/clutch jogador1 jogador2 [mapa]` | Sorteia um duelo com 14 histórias. Sem mapa informado, sorteia um. O botão Revanche funciona para quem iniciou e para os participantes por até 10 minutos. |
| `/jogos [time] [foco]` | Com time informado, consulta o perfil exato e sua agenda, sem misturar GC ou Academy. Sem time, usa a página geral, com foco Brasil por padrão. |
| `/resultado [time] [foco]` | Até cinco resultados recentes da página da fonte. O nome do time tem prioridade sobre o foco. |
| `/jogador nome` | Pesquisa um perfil competitivo. |
| `/classificacao [criterio] [periodo] [foco]` | Compara Rating VLR, ACS ou K/D no VCT, com mínimo de 200 rounds e períodos de 30, 60 ou 90 dias. |
| `/time nome` | Mostra elenco atual, comissão técnica, rounds, mapas, premiações anuais e participações dos três anos civis mais recentes. |
| `/ajuda` | Mostra os comandos em uma resposta privada. |
| `/feedback [tipo]` | Abre um formulário e envia a mensagem em particular para a dona da aplicação. Só confirma o recebimento depois da entrega. |
| `/convidar` | Mostra um convite para adicionar o bot em outro servidor, sem compartilhar credenciais. |

Os clutches são ficção, com vencedor sorteado 50/50. O bot não ouve chamadas, não lê conversas nem usa estatísticas reais para decidir esses duelos. O mesmo par evita as três últimas histórias durante a sessão. Há um intervalo de cinco segundos entre usos por pessoa e servidor.

## Executar

Requer Node.js 22.13 ou superior.

1. Execute `npm ci`.
2. Copie `.env.example` para `.env`, preencha o token e o ID da aplicação e mantenha `DISCORD_PUBLIC=true`.
3. No modo público, não precisa preencher IDs de servidores. Para testes restritos, use `DISCORD_PUBLIC=false` e configure `DISCORD_GUILD_ID` e, se necessário, `DISCORD_GUILD_IDS`.
4. Instale a aplicação em cada servidor com os escopos `bot` e `applications.commands`. Permissões: Ver canais, Enviar mensagens e Incorporar links. Não exige Administrador nem intents privilegiadas.
5. Execute `npm run register`. No modo público, registra os comandos globalmente, com uso apenas em servidores, e remove cópias locais antigas deste projeto nos servidores de teste configurados. Comandos de outros projetos são preservados. No modo restrito, registra somente nos servidores configurados.
6. Execute `npm start`.

A instalação deve ser autorizada por alguém com Gerenciar servidor. No Developer Portal, mantenha Public Bot ativo, Guild Install habilitado e os escopos `bot` e `applications.commands`. Depois basta compartilhar o link de `/convidar` ou executar `npm run invite`; novos servidores recebem os comandos sem configuração manual. DMs não são aceitas como local de uso dos comandos.

O bot permanece online enquanto o processo Node estiver em execução. O GitHub armazena o código; não hospeda a conexão do bot ao Discord. Para hospedar, escolha Node.js 22.13 ou superior, instale com `npm ci` e inicie com `npm start`. Configure `DISCORD_TOKEN`, `DISCORD_APPLICATION_ID` e `DISCORD_PUBLIC=true` como variáveis do serviço. Nunca coloque o token no GitHub.

O pacote `discloud.config` prepara o plano gratuito de 100 MB da Discloud, sujeito a disponibilidade e validação de memória. O Bot-Hosting.net oferece outro plano gratuito, de 256 MB, com renovação manual no painel a cada quatro dias. A hospedagem externa deve ser validada pelo painel e pelos comandos antes de desligar o processo local.

## Verificação

- `npm test`: 45 testes locais, sem token e sem rede.
- `npm run demo`: demonstra uma narração fictícia.
- `npm run check:source`: verifica as páginas públicas de jogos e resultados.

## Dados e limites

A fonte é o VLR.gg, por leitura de HTML público. Não é uma API oficial da Riot ou do VLR. Há cache em memória de dez minutos; alterações na estrutura da fonte podem interromper uma consulta. O bot informa indisponibilidade em vez de inventar dados.

Horários são os exibidos na fonte, com fuso não confirmado. A classificação cobre a primeira página da seleção VCT e não é um ranking absoluto de habilidade. O filtro Brasil na tabela usa a bandeira do jogador; na agenda geral, usa a bandeira dos times ou o nome do evento. A agenda de um time usa seu perfil exato.

As premiações somam somente valores em USD informados na fonte, separados por ano. Ausência de valor não significa prêmio zero. O histórico pode incluir elencos anteriores e não representa toda a receita da organização. O elenco é o atual no momento da consulta.

## Organização

- `src/`: conexão Discord, comandos, cartões, localização pt-BR, histórias e consultas.
- `scripts/`: registro, convite, demonstração e verificação de fonte.
- `tests/`: testes e dados fictícios.
- `assets/`: mascote do projeto.
- `docs/`: guia técnico e verificação da versão inicial. Esses documentos estão pausados e ainda não refletem todas as mudanças; este README descreve a versão atual.

## Segredos

Nunca publique `.env`, tokens ou credenciais. O repositório contém somente `.env.example`, sem valores reais. `node_modules` também fica fora do Git. O bot não armazena mensagens; intervalos, histórico recente de histórias e revanches ficam temporariamente na memória e são apagados ao reiniciar.

O `/feedback` é uma exceção explícita de envio de texto: o formulário avisa que a mensagem, o nome/ID do autor e o nome/ID do servidor serão enviados por DM para a dona da aplicação Discord. Não envia o feedback ao GitHub, aos moderadores do servidor nem a um canal público. Não há banco de feedbacks na hospedagem: o histórico fica na conversa do Discord. São permitidos até 1.200 caracteres e um envio por minuto por usuário. Se a DM for bloqueada, o bot informa que não conseguiu entregar.

Projeto independente, sem afiliação à Riot Games, Discord ou VLR.gg.
