import { VlrSource, selectMatches } from '../src/vlr.js';
const source = new VlrSource();
try {
  for (const kind of ['upcoming','results']) {
    const snapshot = await source.get(kind);
    console.log(JSON.stringify({ kind, matches: snapshot.matches.length, brazilian: selectMatches(snapshot.matches, { limit: 100 }).length, source: snapshot.url, fetchedAt: new Date(snapshot.fetchedAt).toISOString() }));
  }
} catch { console.error('A fonte falhou ou mudou de estrutura. O bot continua a permitir /clutch; os dados competitivos ficam indisponíveis até a fonte recuperar ou o parser ser atualizado.'); process.exitCode = 1; }
