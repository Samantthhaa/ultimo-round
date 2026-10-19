import { load } from 'cheerio/slim';

export const sourceUrls = { upcoming: 'https://www.vlr.gg/matches', results: 'https://www.vlr.gg/matches/results' };
const clean = text => text.replace(/\s+/g, ' ').trim();
export const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = new Map([['furia','furia'],['mibr','mibr'],['loud','loud'],['vitality','team vitality'],['100t','100 thieves'],['c9','cloud9'],['nrg','nrg']]);
export const teamSearchQuery = name => aliases.get(normalize(name)) ?? name.trim();

export function parseMatches(html, kind) {
  if (!Object.hasOwn(sourceUrls, kind)) throw new Error('Tipo de consulta inválido.');
  const $ = load(html);
  const rows = $('a.match-item');
  if (!rows.length) throw new Error('A fonte não apresentou a lista esperada.');
  const matches = [];
  rows.each((_, element) => {
    const row = $(element);
    const teams = row.find('.match-item-vs-team').toArray().map(team => {
      const item = $(team);
      const flag = item.find('.flag').attr('class') ?? '';
      const scoreText = clean(item.find('.match-item-vs-team-score').text());
      return { name: clean(item.find('.match-item-vs-team-name').text()), country: flag.match(/\bmod-([a-z]{2})\b/)?.[1] ?? null, score: /^\d+$/.test(scoreText) ? Number(scoreText) : null };
    });
    if (teams.length !== 2 || teams.some(team => !team.name)) return;
    const href = row.attr('href');
    if (!href || !/^\/\d+\//.test(href)) return;
    const url = new URL(href, 'https://www.vlr.gg');
    if (url.origin !== 'https://www.vlr.gg') return;
    const event = row.find('.match-item-event').clone();
    event.find('.match-item-event-series').remove();
    const dateLabel = row.closest('.wf-card').prevAll('.wf-label').first().clone();
    dateLabel.find('span').remove();
    const status = clean(row.find('.ml-status').text());
    if (kind === 'results' && (!/completed/i.test(status) || teams.some(team => team.score === null))) return;
    matches.push({ teams, event: clean(event.text()), stage: clean(row.find('.match-item-event-series').text()), dateLabel: clean(dateLabel.text()), timeLabel: clean(row.find('.match-item-time').text()), status, url: url.href });
  });
  if (!matches.length) throw new Error('Não foi possível interpretar os jogos da fonte.');
  return matches;
}

export function selectMatches(matches, { team = '', focus = 'br', limit = 5 } = {}) {
  const query = normalize(team);
  const target = aliases.get(query) ?? query;
  return matches.filter(match => {
    if (target) return match.teams.some(t => {
      const name = normalize(t.name);
      return (` ${name} `).includes(` ${target} `);
    });
    return focus === 'global' || match.teams.some(t => t.country === 'br') || /\b(brazil|brasil|brasileiro)\b/i.test(match.event);
  }).slice(0, limit);
}

export class VlrSource {
  constructor({ fetcher = fetch, now = Date.now, ttlMs = 600_000 } = {}) {
    this.fetcher = fetcher; this.now = now; this.ttlMs = ttlMs;
    this.cache = new Map(); this.inFlight = new Map();
  }
  async get(kind) {
    if (!Object.hasOwn(sourceUrls, kind)) throw new Error('Tipo de consulta inválido.');
    const cached = this.cache.get(kind);
    if (cached && this.now() - cached.fetchedAt < this.ttlMs) return cached;
    if (this.inFlight.has(kind)) return this.inFlight.get(kind);
    const task = (async () => {
      const response = await this.fetcher(sourceUrls[kind], {
        headers: { 'User-Agent': 'UltimoRound/0.1 (community Discord bot)', Accept: 'text/html' },
        signal: AbortSignal.timeout(8000), redirect: 'error'
      });
      if (!response.ok) throw new Error(`Fonte indisponível (${response.status}).`);
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error('Resposta da fonte demasiado grande.');
      const result = { matches: parseMatches(html, kind), fetchedAt: this.now(), url: sourceUrls[kind] };
      this.cache.set(kind, result);
      return result;
    })();
    this.inFlight.set(kind, task);
    try { return await task; } finally { this.inFlight.delete(kind); }
  }
}
