// KickerStars – gemeinsame Kern-Logik (läuft im Browser UND im Node-Server)
// Alle Änderungen am Zustand laufen über reduce(state, action).
// IDs und Zeitstempel kommen mit der Aktion, damit Client und Server identisch rechnen.

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS = {
  minGames: 10,            // ab so vielen Spielen wird man gewertet
  showUnranked: true,      // Ungewertete trotzdem anzeigen
  rankingMode: 'punkte',   // 'punkte' | 'quote' | 'elo'
  tables: ['Tisch 1', 'Tisch 2', 'Tisch 3'],
  pointsSingle: 2,         // 1:1 – Punkte für den Sieger
  pointsDoubleEach: 1,     // 2:2 – Punkte für jeden Sieger
  winGoals: 10,            // mit so vielen Toren gewinnt man (Schnell-Eingabe)
  eloStart: 1000,
  eloK: 32,
  adminPin: '',            // PIN des Spielleiters ('' = noch nicht eingerichtet)
};

// Aktionen, die nur der Spielleiter ausführen darf (Aktion muss die richtige PIN mitschicken)
export const ADMIN_ACTIONS = new Set([
  'addPlayer', 'renamePlayer', 'deletePlayer', 'deleteGame',
  'updateSettings', 'importState', 'reset', 'setPin', 'verifyPin',
]);

/** Ist ein Spielleiter eingerichtet? (Server liefert die PIN nicht aus, nur hasPin) */
export function hasPin(state) {
  return !!(state.settings.adminPin || state.settings.hasPin);
}

export function emptyState() {
  return {
    schema: SCHEMA_VERSION,
    rev: 0,
    settings: { ...DEFAULT_SETTINGS, tables: [...DEFAULT_SETTINGS.tables] },
    players: [],
    games: [],
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Bringt einen geladenen/importierten Zustand in gültige Form. */
export function normalizeState(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== 'object') return s;
  s.rev = Number.isFinite(raw.rev) ? raw.rev : 0;
  s.settings = { ...s.settings, ...(raw.settings || {}) };
  if (!Array.isArray(s.settings.tables) || s.settings.tables.length === 0) {
    s.settings.tables = [...DEFAULT_SETTINGS.tables];
  }
  s.players = Array.isArray(raw.players) ? raw.players.filter(p => p && p.id && p.name) : [];
  s.games = Array.isArray(raw.games) ? raw.games.filter(g => g && g.id && Array.isArray(g.teamA) && Array.isArray(g.teamB)) : [];
  return s;
}

export class ActionError extends Error {}
const fail = (msg) => { throw new ActionError(msg); };

const cleanName = (n) => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 30);

export function findPlayerByName(state, name) {
  const n = cleanName(name).toLowerCase();
  return state.players.find(p => p.name.toLowerCase() === n);
}

export function liveGames(state) {
  return state.games.filter(g => g.status === 'live');
}

function validateTeams(state, { mode, teamA, teamB, table }, ignoreGameId) {
  const size = mode === '2v2' ? 2 : mode === '1v1' ? 1 : fail('Unbekannter Spielmodus.');
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length !== size || teamB.length !== size) {
    fail(mode === '2v2' ? 'Bitte je Team zwei Spieler wählen.' : 'Bitte zwei Spieler wählen.');
  }
  const all = [...teamA, ...teamB];
  if (all.some(id => !id)) fail('Bitte alle Spieler auswählen.');
  if (new Set(all).size !== all.length) fail('Ein Spieler kann nicht doppelt mitspielen.');
  for (const id of all) {
    if (!state.players.some(p => p.id === id)) fail('Unbekannter Spieler.');
  }
  if (!Number.isInteger(table) || table < 0 || table >= state.settings.tables.length) fail('Bitte einen Tisch wählen.');
  return all;
}

function validateScore(scoreA, scoreB) {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 99 || scoreB > 99) {
    fail('Bitte gültige Tore eintragen.');
  }
  if (scoreA === scoreB) fail('Unentschieden gibt es nicht – ein Team muss gewinnen.');
}

/** Wendet eine Aktion an und liefert einen NEUEN Zustand (wirft ActionError bei ungültigen Eingaben). */
export function reduce(state, action) {
  const p = action.payload || {};
  if (ADMIN_ACTIONS.has(action.type) && state.settings.adminPin && String(action.pin ?? '') !== state.settings.adminPin) {
    fail(action.type === 'verifyPin' ? 'Falsche PIN.' : 'Das darf nur der Spielleiter.');
  }
  if (action.type === 'verifyPin') return state;
  const s = structuredClone(state);
  switch (action.type) {
    case 'addPlayer': {
      const name = cleanName(p.name);
      if (name.length < 2) fail('Der Name muss mindestens 2 Zeichen haben.');
      if (findPlayerByName(s, name)) return state; // existiert schon -> nichts tun
      s.players.push({ id: p.id || uid(), name, createdAt: p.at || Date.now() });
      break;
    }
    case 'renamePlayer': {
      const pl = s.players.find(x => x.id === p.id) || fail('Spieler nicht gefunden.');
      const name = cleanName(p.name);
      if (name.length < 2) fail('Der Name muss mindestens 2 Zeichen haben.');
      const other = findPlayerByName(s, name);
      if (other && other.id !== pl.id) fail('Diesen Namen gibt es schon.');
      pl.name = name;
      break;
    }
    case 'deletePlayer': {
      if (s.games.some(g => [...g.teamA, ...g.teamB].includes(p.id))) {
        fail('Spieler hat schon Spiele und kann nicht gelöscht werden.');
      }
      s.players = s.players.filter(x => x.id !== p.id);
      break;
    }
    case 'startGame': {
      const all = validateTeams(s, p);
      const live = liveGames(s);
      if (live.some(g => g.table === p.table)) fail('Auf diesem Tisch läuft schon ein Spiel.');
      const busy = live.flatMap(g => [...g.teamA, ...g.teamB]);
      if (all.some(id => busy.includes(id))) fail('Ein Spieler steht gerade an einem anderen Tisch.');
      s.games.push({
        id: p.id || uid(), table: p.table, mode: p.mode,
        teamA: [...p.teamA], teamB: [...p.teamB],
        status: 'live', scoreA: null, scoreB: null,
        startedAt: p.at || Date.now(), endedAt: null, by: p.by || null,
      });
      break;
    }
    case 'recordGame': { // bereits gespieltes Spiel direkt eintragen
      validateTeams(s, p);
      validateScore(p.scoreA, p.scoreB);
      const at = p.at || Date.now();
      s.games.push({
        id: p.id || uid(), table: p.table, mode: p.mode,
        teamA: [...p.teamA], teamB: [...p.teamB],
        status: 'done', scoreA: p.scoreA, scoreB: p.scoreB,
        startedAt: at, endedAt: at, by: p.by || null,
      });
      break;
    }
    case 'finishGame': {
      const g = s.games.find(x => x.id === p.id) || fail('Spiel nicht gefunden.');
      if (g.status !== 'live') fail('Das Spiel ist schon beendet.');
      validateScore(p.scoreA, p.scoreB);
      g.scoreA = p.scoreA; g.scoreB = p.scoreB;
      g.status = 'done'; g.endedAt = p.at || Date.now();
      if (p.by) g.finishedBy = p.by;
      break;
    }
    case 'cancelGame': {
      const g = s.games.find(x => x.id === p.id);
      if (!g || g.status !== 'live') fail('Spiel nicht gefunden.');
      s.games = s.games.filter(x => x.id !== p.id);
      break;
    }
    case 'deleteGame': {
      s.games = s.games.filter(x => x.id !== p.id);
      break;
    }
    case 'setPin': {
      const pin = String(p.newPin ?? '').trim();
      if (!/^\d{4,8}$/.test(pin)) fail('Die PIN muss aus 4 bis 8 Ziffern bestehen.');
      s.settings.adminPin = pin;
      break;
    }
    case 'updateSettings': {
      const { adminPin: _a, hasPin: _h, ...rest } = p;
      const next = { ...s.settings, ...rest };
      next.minGames = clampInt(next.minGames, 0, 999, DEFAULT_SETTINGS.minGames);
      next.pointsSingle = clampInt(next.pointsSingle, 0, 99, DEFAULT_SETTINGS.pointsSingle);
      next.pointsDoubleEach = clampInt(next.pointsDoubleEach, 0, 99, DEFAULT_SETTINGS.pointsDoubleEach);
      next.winGoals = clampInt(next.winGoals, 1, 99, DEFAULT_SETTINGS.winGoals);
      next.eloK = clampInt(next.eloK, 1, 100, DEFAULT_SETTINGS.eloK);
      next.eloStart = clampInt(next.eloStart, 0, 5000, DEFAULT_SETTINGS.eloStart);
      next.showUnranked = !!next.showUnranked;
      if (!['punkte', 'quote', 'elo'].includes(next.rankingMode)) next.rankingMode = 'punkte';
      next.tables = (Array.isArray(next.tables) ? next.tables : []).map(t => cleanName(t)).filter(Boolean).slice(0, 12);
      if (next.tables.length === 0) fail('Mindestens ein Tisch wird gebraucht.');
      const maxLiveTable = Math.max(-1, ...liveGames(s).map(g => g.table));
      if (maxLiveTable >= next.tables.length) fail('Auf einem entfernten Tisch läuft noch ein Spiel.');
      s.settings = next;
      break;
    }
    case 'importState': {
      const imported = normalizeState(p.state);
      imported.rev = s.rev;
      imported.settings.adminPin = s.settings.adminPin; // PIN bleibt beim Import erhalten
      delete imported.settings.hasPin;
      Object.assign(s, imported);
      break;
    }
    case 'reset': {
      const fresh = emptyState();
      fresh.rev = s.rev;
      fresh.settings = s.settings;
      Object.assign(s, fresh);
      break;
    }
    default:
      fail('Unbekannte Aktion: ' + action.type);
  }
  s.rev = (state.rev || 0) + 1;
  return s;
}

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}

/** Punkte, die jeder Spieler des Siegerteams für dieses Spiel bekommt. */
export function pointsPerWinner(settings, mode) {
  return mode === '2v2' ? settings.pointsDoubleEach : settings.pointsSingle;
}

/**
 * Berechnet die Statistik aller Spieler aus den beendeten Spielen.
 * Liefert { rows, eloChange } – eloChange[gameId][playerId] = Elo-Differenz dieses Spiels.
 */
export function computeStats(state) {
  const st = state.settings;
  const rows = new Map();
  for (const p of state.players) {
    rows.set(p.id, {
      id: p.id, name: p.name,
      games: 0, wins: 0, losses: 0,
      singles: 0, doubles: 0,
      points: 0, maxPoints: 0,
      goalsFor: 0, goalsAgainst: 0,
      elo: st.eloStart, streak: 0, form: [],
    });
  }
  const eloChange = {};
  const done = state.games
    .filter(g => g.status === 'done')
    .sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));

  for (const g of done) {
    const ppw = pointsPerWinner(st, g.mode);
    const aWon = g.scoreA > g.scoreB;
    const teamRating = (team) => team.reduce((sum, id) => sum + (rows.get(id)?.elo ?? st.eloStart), 0) / team.length;
    const rA = teamRating(g.teamA), rB = teamRating(g.teamB);
    const expA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
    const deltaA = st.eloK * ((aWon ? 1 : 0) - expA);
    eloChange[g.id] = {};

    const apply = (team, gf, ga, won, delta) => {
      for (const id of team) {
        const r = rows.get(id);
        if (!r) continue;
        r.games++;
        if (g.mode === '2v2') r.doubles++; else r.singles++;
        r.maxPoints += ppw;
        r.goalsFor += gf; r.goalsAgainst += ga;
        if (won) { r.wins++; r.points += ppw; r.streak = r.streak > 0 ? r.streak + 1 : 1; }
        else { r.losses++; r.streak = r.streak < 0 ? r.streak - 1 : -1; }
        r.form.push(won ? 'S' : 'N');
        if (r.form.length > 5) r.form.shift();
        r.elo += delta;
        eloChange[g.id][id] = delta;
      }
    };
    apply(g.teamA, g.scoreA, g.scoreB, aWon, deltaA);
    apply(g.teamB, g.scoreB, g.scoreA, !aWon, -deltaA);
  }

  for (const r of rows.values()) {
    r.goalDiff = r.goalsFor - r.goalsAgainst;
    r.quote = r.maxPoints > 0 ? r.points / r.maxPoints : 0;
    r.winRate = r.games > 0 ? r.wins / r.games : 0;
    r.elo = Math.round(r.elo);
  }
  return { rows: [...rows.values()], eloChange };
}

const metric = {
  punkte: r => r.points,
  quote: r => r.quote,
  elo: r => r.elo,
};

/** Sortiert Spieler nach Modus; Gleichstand: Tordifferenz, Tore, weniger Spiele, Name. */
export function ranking(state, mode = state.settings.rankingMode) {
  const { rows } = computeStats(state);
  const m = metric[mode] || metric.punkte;
  const sorted = rows
    .sort((a, b) =>
      (m(b) - m(a)) ||
      (b.goalDiff - a.goalDiff) ||
      (b.goalsFor - a.goalsFor) ||
      (a.games - b.games) ||
      a.name.localeCompare(b.name, 'de'));
  const min = state.settings.minGames;
  const ranked = sorted.filter(r => r.games >= min);
  const unranked = sorted.filter(r => r.games < min).sort((a, b) => (b.games - a.games) || (m(b) - m(a)));
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    r.rank = prev && m(prev) === m(r) && prev.goalDiff === r.goalDiff && prev.goalsFor === r.goalsFor ? prev.rank : i + 1;
  });
  return { ranked, unranked, mode };
}
