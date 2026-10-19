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

Os clutches são ficção, com vencedor sorteado 50/50. O bot não ouve chamadas, não lê conversas nem usa estatísticas reais para decidir esses duelos. O mesmo par evita as três últimas histórias durante a sessão. Há um intervalo de cinco segundos entre usos por pessoa e servidor.

## Executar

Requer Node.js 22.13 ou superior.

1. Execute `npm ci`.
2. Copie `.env.example` para `.env` e preencha o token, o ID da aplicação e o servidor principal.
3. Para outros servidores autorizados, informe seus IDs em `DISCORD_GUILD_IDS`, separados por vírgulas.
4. Instale a aplicação em cada servidor com os escopos `bot` e `applications.commands`. Permissões: Ver canais, Enviar mensagens e Incorporar links. Não exige Administrador nem intents privilegiadas.
5. Execute `npm run register` para registrar os comandos nos servidores configurados. A migração renomeia o antigo `/equipa` para `/time` e preserva comandos de outros projetos.
6. Execute `npm start`.

A instalação deve ser autorizada por alguém com Gerenciar servidor. O bot responde apenas nos servidores configurados e permanece online enquanto o processo Node estiver em execução. O GitHub armazena o código; não hospeda a conexão do bot ao Discord.

## Verificação

- `npm test`: 38 testes locais, sem token e sem rede.
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

Projeto independente, sem afiliação à Riot Games, Discord ou VLR.gg.
