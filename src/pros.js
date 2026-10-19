import { load } from 'cheerio/slim';
import { normalize, teamSearchQuery } from './vlr.js';
import { teamPeriod, parseTeamSearch, parseTeam, parseTeamMaps, parseTeamUpcoming } from './teams.js';

const origin = 'https://www.vlr.gg';
const clean = value => value.replace(/\s+/g, ' ').trim();
const country = node => (node.attr('class') ?? '').match(/\bmod-([a-z]{2})\b/)?.[1] ?? null;
export const metrics = { rating2: 'Rating VLR', acs: 'ACS', kd: 'K/D' };

export function parseSearch(html) {
  const $ = load(html);
  if (!$('input[name="q"]').length || !$('select[name="type"] option[value="players"]').length) throw new Error('Pesquisa indisponível.');
  return $('a.search-item').toArray().flatMap(element => {
    const row = $(element), id = row.attr('href')?.match(/^\/search\/r\/player\/(\d+)\/idx$/)?.[1];
    const name = clean(row.find('.search-item-title').text());
    return id && name ? [{ id, name, url: `${origin}/player/${id}` }] : [];
  });
}

export function parsePlayer(html, id) {
  const $ = load(html), header = $('.player-header');
  const name = clean(header.find('h1').text());
  if (!name) throw new Error('Perfil indisponível.');
  const heading = $('h2').filter((_, el) => normalize($(el).text()) === 'current teams').first();
  const teams = heading.next('.wf-card').find('a[href^="/team/"]').toArray().map(el => {
    const copy = $(el).clone();
    copy.find('img,.ge-text-light').remove();
    return clean(copy.text());
  }).filter(Boolean);
  return { id, name, country: country(header.find('.flag').first()), teams, url: `${origin}/player/${id}` };
}

export function parseStats(html, { period = '60d', metric = 'rating2' } = {}) {
  const $ = load(html);
  // Validate the actual selection: the source may redirect and drop query parameters.
  const selections = { tier: 'vct', region: 'all', span: period, side: 'all', role: 'all', agent: 'all', map_id: 'all', min_rating: '0' };
  for (const [name, value] of Object.entries(selections)) {
    if ($(`select[name="${name}"] option:selected`).val() !== value) throw new Error('Filtros da fonte não confirmados.');
  }
  if ($('input[name="min_rounds"]').val() !== '200' || $('input[name="sort"]').val() !== metric || $('input[name="dir"]').val() !== 'desc' || !$('#st-table').length) throw new Error('Tabela da fonte não confirmada.');
  const rows = $('#st-table tbody tr').toArray().flatMap(el => {
    const row = $(el), link = row.find('.mod-player a'), id = link.attr('href')?.match(/^\/player\/(\d+)(?:\/|$)/)?.[1];
    const name = clean(row.find('.st-pl-name').text());
    const number = col => { const value = clean(row.find(`[data-col="${col}"]`).text()); return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null; };
    const player = { id, name, team: clean(row.find('.st-pl-country').text()), country: country(row.find('.flag').first()), rounds: number('rnd'), rating2: number('rating2'), acs: number('acs'), kd: number('kd'), url: `${origin}/player/${id}` };
    return id && name && player.rounds >= 200 && Object.keys(metrics).every(key => player[key] !== null) ? [player] : [];
  });
  if ($('#st-table tbody tr').length && !rows.length) throw new Error('Não foi possível interpretar as estatísticas.');
  return rows;
}

export class ProSource {
  constructor({ fetcher = fetch, now = Date.now, ttlMs = 600_000 } = {}) {
    this.fetcher = fetcher; this.now = now; this.ttlMs = ttlMs;
    this.cache = new Map(); this.inFlight = new Map();
  }
  async html(original) {
    // Ephemeral public-site cookies only; never uses Discord credentials or browser cookies.
    const jar = new Map(), signal = AbortSignal.timeout(20_000);
    let url = original;
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await this.fetcher(url, { redirect: 'manual', signal, headers: {
        'User-Agent': 'UltimoRound/0.1 (community Discord bot)', Accept: 'text/html',
        Cookie: [...jar].map(([key,value]) => `${key}=${value}`).join('; ')
      } });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';')[0], split = pair.indexOf('=');
        if (split > 0) jar.set(pair.slice(0, split), pair.slice(split + 1));
      }
      if ([301,302,303,307,308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirecionamento inválido.');
        const target = new URL(location, url);
        if (target.origin !== origin) throw new Error('Redirecionamento externo recusado.');
        url = target.href; continue;
      }
      if (!response.ok) throw new Error('Fonte indisponível.');
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error('Resposta demasiado grande.');
      if (url !== original) { url = original; continue; }
      return html;
    }
    throw new Error('A fonte não confirmou a consulta.');
  }
  async cached(key, read) {
    const cached = this.cache.get(key);
    if (cached && this.now() - cached.fetchedAt < this.ttlMs) return cached;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const task = (async () => {
      const data = { ...await read(), fetchedAt: this.now() };
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, data); return data;
    })();
    this.inFlight.set(key, task);
    try { return await task; } finally { this.inFlight.delete(key); }
  }
  async player(query) {
    query = String(query).trim();
    if (query.length < 2 || query.length > 50) throw new Error('Nome inválido.');
    return this.cached(`player:${query.toLowerCase()}`, async () => {
      const url = `${origin}/search/?${new URLSearchParams({ q: query, type: 'players' })}`;
      const candidates = parseSearch(await this.html(url));
      const exact = candidates.filter(player => normalize(player.name) === normalize(query));
      const selected = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : null;
      return selected ? { player: parsePlayer(await this.html(selected.url), selected.id), url: selected.url } : { candidates: candidates.slice(0, 5), url };
    });
  }
  async stats({ period = '60d', metric = 'rating2' } = {}) {
    if (!['30d','60d','90d'].includes(period) || !Object.hasOwn(metrics, metric)) throw new Error('Filtro inválido.');
    return this.cached(`stats:${period}:${metric}`, async () => {
      const url = `${origin}/stats?${new URLSearchParams({ tier: 'vct', region: 'all', span: period, min_rounds: '200', sort: metric, dir: 'desc' })}`;
      return { rows: parseStats(await this.html(url), { period, metric }), period, metric, url };
    });
  }
  async team(query) {
    query = String(query).trim();
    if (query.length < 2 || query.length > 50) throw new Error('Nome inválido.');
    const period = teamPeriod(this.now());
    return this.cached(`team:${query.toLowerCase()}:${period.end}`, async () => {
      const url = `${origin}/search/?${new URLSearchParams({ q: query, type: 'teams' })}`;
      const candidates = parseTeamSearch(await this.html(url));
      const exact = candidates.filter(team=>normalize(team.name) === normalize(query));
      const selected = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : null;
      if (!selected) return { candidates: candidates.slice(0,5), period, url };
      const team = parseTeam(await this.html(selected.url), selected.id, period);
      let maps = null, statsUrl = null;
      if (team.statsUrl) {
        statsUrl = `${team.statsUrl}?${new URLSearchParams({ event_id: 'all', series_id: 'all', date_start: period.start, date_end: period.end })}`;
        // A statistics outage should not hide a valid roster or prize history.
        try { maps = parseTeamMaps(await this.html(statsUrl), period); } catch { /* Render explicitly as unavailable. */ }
      }
      return { team, maps, statsUrl, period, url: team.url };
    });
  }
  async upcoming(query) {
    query = String(query).trim();
    if (query.length < 2 || query.length > 50) throw new Error('Nome inválido.');
    query = teamSearchQuery(query);
    return this.cached(`upcoming:${query.toLowerCase()}`, async () => {
      const url = `${origin}/search/?${new URLSearchParams({q:query,type:'teams'})}`;
      const candidates = parseTeamSearch(await this.html(url));
      const exact = candidates.filter(team=>normalize(team.name) === normalize(query));
      const selected = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : null;
      if (!selected) return { candidates:candidates.slice(0,5), url };
      const schedule = parseTeamUpcoming(await this.html(selected.url));
      if (normalize(schedule.name) !== normalize(selected.name)) throw new Error('Identidade do time não confirmada.');
      return { team:{...selected,name:schedule.name}, matches:schedule.matches, coverage:'team', url:selected.url };
    });
  }
}
