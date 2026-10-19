import { load } from 'cheerio';
import { normalize } from './vlr.js';

const origin = 'https://www.vlr.gg';
const clean = text => text.replace(/\s+/g, ' ').trim();
export function teamPeriod(now = Date.now()) {
  const end = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  const year = Number(end.slice(0,4));
  return { start: `${year - 2}-01-01`, end, years: [year - 2, year - 1, year] };
}

export function parseTeamSearch(html) {
  const $ = load(html);
  if (!$('input[name="q"]').length || !$('select[name="type"] option[value="teams"]').length) throw new Error('Pesquisa de times indisponível.');
  return $('a.search-item').toArray().flatMap(el => {
    const row = $(el), id = row.attr('href')?.match(/^\/search\/r\/team\/(\d+)\/idx$/)?.[1];
    const name = clean(row.find('.search-item-title').text());
    return id && name ? [{ id, name, url: `${origin}/team/${id}` }] : [];
  });
}

export function parseTeamUpcoming(html) {
  const $ = load(html);
  const name = clean($('.team-header h1').text());
  if (!name) throw new Error('Agenda do time indisponível.');
  const heading = $('h2').filter((_,el)=>normalize($(el).text()) === 'upcoming matches').first();
  if (!heading.length) {
    const knownProfile = $('h2').toArray().some(el=>['recent results','current roster'].includes(normalize($(el).text())));
    if (!knownProfile || $('.m-item-result.mod-tbd').length) throw new Error('Agenda do time não confirmada.');
    return { name, matches: [] };
  }
  const section = heading.nextUntil('h2');
  const rows = section.find('a.m-item').add(section.filter('a.m-item')).toArray();
  const matches = rows.map(el=> {
    const row = $(el), href = row.attr('href');
    if (!/^\/\d+\/[a-zA-Z0-9_/-]+$/.test(href ?? '')) throw new Error('Ligação da partida inválida.');
    const names = row.find('.m-item-team-name').toArray().map(el=>clean($(el).text()));
    const eventNode = row.find('.m-item-event'), event = clean(eventNode.children('.text-of').first().text());
    const stageNode = eventNode.clone(); stageNode.children().remove();
    const dateNode = row.find('.m-item-date'), dateLabel = clean(dateNode.children('div').first().text());
    const timeNode = dateNode.clone(); timeNode.children().remove();
    if (names.length !== 2 || names.some(name=>!name) || !event || !row.find('.m-item-result.mod-tbd,.m-item-result.mod-live').length) throw new Error('Partida agendada não confirmada.');
    return { teams: names.map(name=>({name,country:null,score:null})), event, stage: clean(stageNode.text()), dateLabel, timeLabel: clean(timeNode.text()), status: row.find('.m-item-result.mod-live').length ? 'Live' : 'Upcoming', url: `${origin}${href}` };
  });
  if (!matches.length) throw new Error('Agenda vazia sem confirmação.');
  return { name, matches };
}

export function parseTeam(html, id, period) {
  const $ = load(html), header = $('.team-header');
  const name = clean(header.find('h1').text());
  if (!name) throw new Error('Perfil de time indisponível.');
  const heading = title => $('h2').filter((_,el) => normalize($(el).text()) === title).first();
  const rosterHeading = heading('current roster');
  const roster = rosterHeading.length ? rosterHeading.next('.wf-card').find('.team-roster-item').toArray().flatMap(el => {
    const row = $(el), link = row.find('a[href^="/player/"]').first();
    const playerId = link.attr('href')?.match(/^\/player\/(\d+)(?:\/|$)/)?.[1];
    const alias = clean(row.find('.team-roster-item-name-alias').text());
    const group = normalize(row.parent().prevAll('.wf-module-label').first().text());
    const role = clean(row.find('.team-roster-item-name-role').text());
    return playerId && alias ? [{ id: playerId, name: alias, role, staff: group === 'staff', url: `${origin}/player/${playerId}` }] : [];
  }) : null;
  const eventsHeading = heading('event placements');
  const events = eventsHeading.length ? $('a.team-event-item').toArray().flatMap(el => {
    const row = $(el), eventId = row.attr('href')?.match(/^\/event\/(\d+)(?:\/|$)/)?.[1];
    const yearText = clean(row.children('div').last().text());
    const eventName = clean(row.find('.text-of').first().text());
    if (!eventId || !eventName || !/^\d{4}$/.test(yearText) || !period.years.includes(Number(yearText))) return [];
    const amounts = row.find('span').toArray().map(span=>clean($(span).text())).filter(text=>/^\$[\d,]+(?:\.\d{1,2})?$/.test(text));
    const cents = amounts.length ? amounts.reduce((sum,value)=>sum + Math.round(Number(value.replace(/[$,]/g,''))*100),0) : null;
    return [{ id: eventId, name: eventName, year: Number(yearText), cents, placement: clean(row.find('.team-event-item-series').first().text()), url: `${origin}/event/${eventId}` }];
  }) : null;
  // De-duplicate events before summing money: a repeated card is not another prize.
  const uniqueEvents = events && [...new Map(events.map(event=>[event.id,event])).values()];
  const statsHref = $('a[href]').toArray().map(el=>$(el).attr('href')).find(href=>new RegExp(`^/team/stats/${id}/[a-zA-Z0-9_-]+/$`).test(href));
  const countryCode = (header.find('.team-header-country .flag').attr('class') ?? '').match(/\bmod-([a-z]{2})\b/)?.[1] ?? null;
  return { id, name, country: clean(header.find('.team-header-country').text()), countryCode, roster, events: uniqueEvents, statsUrl: statsHref ? `${origin}${statsHref}` : null, url: `${origin}/team/${id}` };
}

export function parseTeamMaps(html, period) {
  const $ = load(html), table = $('table.mod-team-maps');
  if (!table.length || $('input[name="date_start"]').val() !== period.start || $('input[name="date_end"]').val() !== period.end || $('select[name="event_id"]').val() !== 'all') throw new Error('Período dos rounds não confirmado.');
  const headings = table.find('thead th').toArray().map(el=>normalize($(el).text()));
  if (headings[8] !== 'rw' || headings[9] !== 'rl' || headings[11] !== 'rw' || headings[12] !== 'rl') throw new Error('Colunas de rounds alteradas.');
  const rows = table.children('tbody').children('tr').filter((_,el)=>$(el).children('td.mod-supercell').length > 0).toArray();
  if (!rows.length) throw new Error('Sem estatísticas de mapas confirmadas.');
  let roundsWon = 0, roundsLost = 0, mapsWon = 0, mapsLost = 0;
  for (const el of rows) {
    const cells = $(el).children('td');
    const number = index => {
      const value = clean(cells.eq(index).find('.mod-first').first().text());
      if (!/^\d+$/.test(value)) throw new Error('Round ou mapa não informado.');
      return Number(value);
    };
    mapsWon += number(3); mapsLost += number(4);
    roundsWon += number(8) + number(11);
    roundsLost += number(9) + number(12);
  }
  return { roundsWon, roundsLost, rounds: roundsWon + roundsLost, mapsWon, mapsLost, maps: mapsWon + mapsLost };
}
