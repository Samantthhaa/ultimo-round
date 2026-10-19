const stages = [
  ['Upper Quarterfinals','Quartas de final da chave superior'],['Lower Quarterfinals','Quartas de final da chave inferior'],
  ['Upper Semifinals','Semifinais da chave superior'],['Lower Semifinals','Semifinais da chave inferior'],
  ['Upper Final','Final da chave superior'],['Lower Final','Final da chave inferior'],['Grand Final','Grande final'],
  ['Upper Round','Rodada da chave superior'],['Lower Round','Rodada da chave inferior'],
  ['Group Stage','Fase de grupos'],['Main Event','Evento principal'],['Regular Season','Temporada regular'],
  ['Round Robin','Todos contra todos'],['Quarterfinals','Quartas de final'],['Semifinals','Semifinais'],
  ['Group','Grupo'],['Phase','Fase'],['Round','Rodada'],['Decider','Decisiva']
];
export function stageLabel(value) {
  let text=String(value);
  for(const [original,translated] of stages) text=text.replace(new RegExp(`\\b${original}\\b`,'gi'),translated);
  return text.replace(/\b(\d+)(?:st|nd|rd|th)\b/g,'$1º');
}
export function roleLabel(value) {
  return ({'head coach':'Treinador principal','assistant coach':'Auxiliar técnico','performance coach':'Treinador de desempenho',coach:'Treinador',manager:'Gerente',analyst:'Analista',substitute:'Reserva',sub:'Reserva',inactive:'Inativo',loan:'Emprestado',captain:'Capitão'})[value.toLowerCase()] ?? value;
}
export const decimal = value => new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
