// KickerStars – Oberfläche
import { computeStats, ranking, liveGames, pointsPerWinner, findPlayerByName, uid, hasPin } from './core.js';
import { createStore } from './store.js';
import { demoState } from './demo.js';

const USER_KEY = 'kickerstars.user';
const $main = document.getElementById('main');
const $nav = document.getElementById('nav');
const $user = document.getElementById('user');
const $conn = document.getElementById('conn');

let store;
let state;
let me = localStorage.getItem(USER_KEY) || null;
const PIN_KEY = 'kickerstars.leiterPin';
let adminPin = localStorage.getItem(PIN_KEY) || null;   // gesetzt = Spielleiter ist angemeldet
const isAdmin = () => !!adminPin;
function setAdmin(pin) {
  adminPin = pin || null;
  if (pin) localStorage.setItem(PIN_KEY, pin); else localStorage.removeItem(PIN_KEY);
}

// Entwürfe, damit Eingaben bei Aktualisierungen (z. B. vom Server) nicht verloren gehen
const draft = { table: null, mode: '1v1', a1: '', a2: '', b1: '', b2: '', direct: false };
const scoreDraft = {};      // gameId ('draft' = neues Spiel) -> {winner, loser, manual, a, b}
const newResult = () => ({ winner: null, loser: null, manual: false, a: '', b: '' });
let rankMode = null;         // Ansicht im Ranking (null = Standard aus Einstellungen)
let addOpen = false;         // „Spieler hinzufügen“ aufgeklappt?

// ---------- Hilfsfunktionen ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = (id) => state.players.find(p => p.id === id)?.name ?? 'Unbekannt';
const team = (ids) => ids.map(nameOf).map(esc).join(' &amp; ');
const initials = (n) => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
const avatar = (id, size = '') => {
  const n = nameOf(id);
  return `<span class="avatar ${size}" style="--h:${hue(n)}">${esc(initials(n))}</span>`;
};
const fmtTime = (ts) => new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ts) => {
  const d = new Date(ts), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Heute';
  if (d.toDateString() === y.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
const pct = (x) => Math.round(x * 100) + ' %';
const signed = (n) => (n > 0 ? '+' : '') + n;

function toast(msg, kind = 'error') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

async function act(type, payload, okMsg) {
  try {
    await store.dispatch({ type, payload, pin: adminPin || undefined });
    if (okMsg) toast(okMsg, 'ok');
    return true;
  } catch (e) {
    toast(e.message || 'Fehler');
    return false;
  }
}

function route() {
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(query || '') };
}

// ---------- Seiten ----------
function pageLogin() {
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const head = `
    <div class="login-logo">${logoSvg()}</div>
    <h1>Kicker<span>Stars</span></h1>`;

  // Erster Start: Spielleiter einrichten
  if (!hasPin(state)) {
    return `
    <section class="login">
      ${head}
      <p class="muted">Willkommen! Zuerst wird der <b>Spielleiter</b> eingerichtet.<br>Er trägt die Spieler ein und verwaltet die Einstellungen.</p>
      <form id="setupForm" class="card login-card" autocomplete="off">
        <label class="label" for="pin1">Spielleiter-PIN festlegen (4–8 Ziffern)</label>
        <input id="pin1" class="input big pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="••••" required>
        <label class="label" for="pin2">PIN wiederholen</label>
        <input id="pin2" class="input big pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="••••" required>
        <button class="btn primary block">Spielleiter einrichten</button>
      </form>
      <div class="demo-box">
        <p class="muted small">Erst mal reinschnuppern?</p>
        <button class="btn ghost block" id="demoBtn">🎮 Demo mit Beispieldaten laden</button>
      </div>
    </section>`;
  }

  return `
  <section class="login">
    ${head}
    <p class="muted">Wer steht am Tisch? Tippe auf deinen Namen.</p>
    ${players.length ? `
      <div class="chips">
        ${players.map(p => `<button class="chip" data-login="${p.id}">${avatar(p.id, 'sm')}${esc(p.name)}</button>`).join('')}
      </div>` : `<div class="card empty">Noch keine Spieler eingetragen.<br>Der Spielleiter muss zuerst die Namen eintragen.</div>`}
    <p class="muted small">Dein Name fehlt? Sag dem Spielleiter Bescheid.</p>
    <details class="card leiter-login" ${players.length ? '' : 'open'}>
      <summary>🔑 Anmelden als Spielleiter</summary>
      <form id="adminLoginForm" class="row" autocomplete="off">
        <input id="adminPin" class="input grow pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="PIN" required>
        <button class="btn primary">Anmelden</button>
      </form>
    </details>
  </section>`;
}

function pageOverview() {
  const live = liveGames(state);
  const done = state.games.filter(g => g.status === 'done').sort((a, b) => b.endedAt - a.endedAt);
  const today = new Date().toDateString();
  const todayGames = done.filter(g => new Date(g.endedAt).toDateString() === today);
  const goals = done.reduce((s, g) => s + g.scoreA + g.scoreB, 0);
  const { eloChange } = computeStats(state);

  const tableCard = (name, i) => {
    const g = live.find(x => x.table === i);
    if (!g) {
      return `
      <article class="card table-card free">
        <header><span class="table-name">${esc(name)}</span><span class="badge free">Frei</span></header>
        <div class="free-body">
          <div class="mini-table"></div>
          <a class="btn primary" href="#/spiel?t=${i}">Spiel starten</a>
        </div>
      </article>`;
    }
    const sd = scoreDraft[g.id];
    return `
    <article class="card table-card live">
      <header>
        <span class="table-name">${esc(name)}</span>
        <span class="badge live"><i class="pulse"></i>Live · <span data-since="${g.startedAt}">0:00</span></span>
      </header>
      <div class="matchup">
        <div class="side a">${g.teamA.map(id => `<div class="pl">${avatar(id)}<span>${esc(nameOf(id))}</span></div>`).join('')}</div>
        <div class="vs">${g.mode === '2v2' ? '2:2' : '1:1'}</div>
        <div class="side b">${g.teamB.map(id => `<div class="pl">${avatar(id)}<span>${esc(nameOf(id))}</span></div>`).join('')}</div>
      </div>
      ${sd ? `
        ${resultEntry(g.id, g.teamA, g.teamB)}
        <div class="row">
          <button class="btn ghost" data-score-cancel="${g.id}">Zurück</button>
          <button class="btn primary grow" data-score-save="${g.id}">Speichern</button>
        </div>` : `
        <div class="row">
          <button class="btn ghost danger" data-confirm data-cancel-game="${g.id}">Abbrechen</button>
          <button class="btn primary grow" data-score-open="${g.id}">Ergebnis eintragen</button>
        </div>`}
    </article>`;
  };

  return `
  <section class="stats-strip">
    <div><b>${todayGames.length}</b><span>Spiele heute</span></div>
    <div><b>${done.length}</b><span>Spiele gesamt</span></div>
    <div><b>${goals}</b><span>Tore</span></div>
    <div><b>${state.players.length}</b><span>Spieler</span></div>
  </section>

  <h2 class="section-title">Tische</h2>
  <section class="tables">${state.settings.tables.map(tableCard).join('')}</section>

  <h2 class="section-title">Letzte Spiele</h2>
  ${done.length ? `<section class="card list">${done.slice(0, 20).map(g => gameRow(g, eloChange)).join('')}</section>`
    : `<div class="empty card">Noch keine Spiele. Ab an den Tisch! ⚽</div>`}`;
}

// Ergebnis-Eingabe: Gewinner antippen -> Tore des Verlierers antippen (Gewinner hat automatisch winGoals Tore)
function resultEntry(gid, teamA, teamB) {
  const r = scoreDraft[gid] ||= newResult();
  const W = state.settings.winGoals;
  const label = (ids, fallback) => ids.filter(Boolean).length ? team(ids.filter(Boolean)) : fallback;
  const nameA = label(teamA, 'Team Blau'), nameB = label(teamB, 'Team Rot');
  if (r.manual) {
    return `
    <div class="result">
      <div class="score-entry">
        ${stepper('a', gid, r.a)}
        <span class="colon">:</span>
        ${stepper('b', gid, r.b)}
      </div>
      <button type="button" class="link center-link" data-quick-toggle="${gid}">← Schnell-Eingabe (Sieg mit ${W} Toren)</button>
    </div>`;
  }
  const loserName = r.winner === 'a' ? nameB : nameA;
  return `
  <div class="result">
    <span class="label">Wer hat gewonnen?</span>
    <div class="winner-pick">
      <button type="button" class="win-btn a ${r.winner === 'a' ? 'on' : ''}" data-winner="a" data-game="${gid}"><span>🏆</span>${nameA}</button>
      <button type="button" class="win-btn b ${r.winner === 'b' ? 'on' : ''}" data-winner="b" data-game="${gid}"><span>🏆</span>${nameB}</button>
    </div>
    ${r.winner ? `
      <span class="label">Tore von ${loserName}</span>
      <div class="goal-chips">
        ${Array.from({ length: W }, (_, i) => `<button type="button" class="goal-chip ${r.loser === i ? 'on' : ''}" data-loser="${i}" data-game="${gid}">${i}</button>`).join('')}
      </div>
      ${r.loser !== null ? `<div class="result-preview">
        <span class="${r.winner === 'a' ? 'win' : ''}">${nameA}</span>
        <b>${r.winner === 'a' ? W : r.loser} : ${r.winner === 'b' ? W : r.loser}</b>
        <span class="${r.winner === 'b' ? 'win' : ''}">${nameB}</span>
      </div>` : ''}` : ''}
    <button type="button" class="link center-link" data-quick-toggle="${gid}">Anderes Ergebnis eintragen</button>
  </div>`;
}

function stepper(side, gameId, val) {
  return `
  <div class="stepper ${side}">
    <button type="button" class="step" data-step="${side}" data-dir="-1" data-game="${gameId}" aria-label="weniger">−</button>
    <input class="score-input" inputmode="numeric" pattern="[0-9]*" data-score-input="${side}" data-game="${gameId}" value="${val}" placeholder="0">
    <button type="button" class="step" data-step="${side}" data-dir="1" data-game="${gameId}" aria-label="mehr">+</button>
  </div>`;
}

function gameRow(g, eloChange, highlight) {
  const aWon = g.scoreA > g.scoreB;
  const ppw = pointsPerWinner(state.settings, g.mode);
  const tName = state.settings.tables[g.table] ?? `Tisch ${g.table + 1}`;
  const deltaFor = highlight && eloChange?.[g.id]?.[highlight];
  return `
  <div class="game-row">
    <div class="game-meta">
      <span>${fmtDay(g.endedAt)} · ${fmtTime(g.endedAt)}</span>
      <span>${esc(tName)} · ${g.mode === '2v2' ? '2:2' : '1:1'}</span>
    </div>
    <div class="game-main">
      <span class="t a ${aWon ? 'win' : ''}">${team(g.teamA)}</span>
      <span class="score"><b class="${aWon ? 'win' : ''}">${g.scoreA}</b>:<b class="${!aWon ? 'win' : ''}">${g.scoreB}</b></span>
      <span class="t b ${!aWon ? 'win' : ''}">${team(g.teamB)}</span>
    </div>
    <div class="game-foot">
      <span class="pts">+${ppw} ${ppw === 1 ? 'Punkt' : 'Punkte'} ${g.mode === '2v2' ? 'pro Sieger' : ''}</span>
      ${deltaFor !== undefined && deltaFor !== false ? `<span class="elo ${deltaFor >= 0 ? 'up' : 'down'}">Elo ${signed(Math.round(deltaFor))}</span>` : ''}
      ${isAdmin() ? `<button class="link danger" data-confirm data-delete-game="${g.id}">Löschen</button>` : ''}
    </div>
  </div>`;
}

function pageNewGame(q) {
  const live = liveGames(state);
  const busy = new Set(live.flatMap(g => [...g.teamA, ...g.teamB]));
  const tables = state.settings.tables;
  if (q.has('t') && draft.table === null) draft.table = Number(q.get('t'));
  if (draft.table === null || live.some(g => g.table === draft.table) || draft.table >= tables.length) {
    const free = tables.findIndex((_, i) => !live.some(g => g.table === i));
    draft.table = free >= 0 ? free : 0;
  }
  if (!draft.a1 && me && !busy.has(me)) draft.a1 = me;
  const slots = draft.mode === '2v2' ? ['a1', 'a2', 'b1', 'b2'] : ['a1', 'b1'];
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const select = (slot, label) => {
    const taken = new Set(slots.filter(s => s !== slot).map(s => draft[s]).filter(Boolean));
    return `
    <label class="field">
      <span class="label">${label}</span>
      <select class="input" data-slot="${slot}">
        <option value="">– Spieler wählen –</option>
        ${players.map(p => {
          const dis = taken.has(p.id) || (busy.has(p.id) && !draft.direct);
          return `<option value="${p.id}" ${draft[slot] === p.id ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(p.name)}${busy.has(p.id) ? ' (spielt gerade)' : ''}</option>`;
        }).join('')}
      </select>
    </label>`;
  };

  return `
  <h1 class="page-title">Neues Spiel</h1>
  <form id="gameForm" class="stack" autocomplete="off">
    <section class="card">
      <span class="label">Tisch</span>
      <div class="segmented">
        ${tables.map((t, i) => {
          const occ = live.some(g => g.table === i);
          return `<button type="button" class="seg ${draft.table === i ? 'on' : ''}" data-table="${i}" ${occ && !draft.direct ? 'disabled' : ''}>${esc(t)}${occ ? '<small>belegt</small>' : ''}</button>`;
        }).join('')}
      </div>
      <span class="label">Modus</span>
      <div class="segmented two">
        <button type="button" class="seg ${draft.mode === '1v1' ? 'on' : ''}" data-mode="1v1">1 gegen 1<small>Sieger +${state.settings.pointsSingle}</small></button>
        <button type="button" class="seg ${draft.mode === '2v2' ? 'on' : ''}" data-mode="2v2">2 gegen 2<small>je Sieger +${state.settings.pointsDoubleEach}</small></button>
      </div>
    </section>

    <section class="teams">
      <div class="card team-box a">
        <h3>Team Blau</h3>
        ${select('a1', draft.mode === '2v2' ? 'Abwehr / Spieler 1' : 'Spieler')}
        ${draft.mode === '2v2' ? select('a2', 'Sturm / Spieler 2') : ''}
      </div>
      <div class="vs-badge">VS</div>
      <div class="card team-box b">
        <h3>Team Rot</h3>
        ${select('b1', draft.mode === '2v2' ? 'Abwehr / Spieler 1' : 'Spieler')}
        ${draft.mode === '2v2' ? select('b2', 'Sturm / Spieler 2') : ''}
      </div>
    </section>

    <section class="card">
      <label class="switch">
        <input type="checkbox" id="direct" ${draft.direct ? 'checked' : ''}>
        <span class="track"></span>
        <span>Spiel ist schon vorbei – Ergebnis direkt eintragen</span>
      </label>
      ${draft.direct ? resultEntry('draft',
        draft.mode === '2v2' ? [draft.a1, draft.a2] : [draft.a1],
        draft.mode === '2v2' ? [draft.b1, draft.b2] : [draft.b1]) : ''}
    </section>

    <button class="btn primary block big">${draft.direct ? 'Ergebnis speichern' : 'Spiel starten'}</button>
  </form>

  ${isAdmin() ? `<details class="card add-player" ${addOpen ? 'open' : ''}>
    <summary>Spieler fehlt? Hier schnell hinzufügen</summary>
    <form id="addPlayerForm" class="row">
      <input class="input grow" id="newPlayer" maxlength="30" placeholder="Name">
      <button class="btn">Hinzufügen</button>
    </form>
  </details>` : `<p class="muted small center add-player">Spieler fehlt? Den trägt der Spielleiter ein.</p>`}`;
}

const MODE_INFO = {
  punkte: { label: 'Punkte', desc: 'Summe aller Punkte (1:1-Sieg +2, 2:2-Sieg je +1). Wer mehr spielt, kann mehr sammeln.' },
  quote: { label: 'Quote', desc: 'Geholte Punkte ÷ mögliche Punkte. Unabhängig von der Anzahl der Spiele und fair zwischen 1:1 und 2:2.' },
  elo: { label: 'Elo', desc: 'Spielstärke-Wertung: Siege gegen starke Gegner bringen mehr, Niederlagen gegen schwache kosten mehr.' },
};
const metricCell = (r, mode) =>
  mode === 'quote' ? pct(r.quote) : mode === 'elo' ? r.elo : r.points;

function pageRanking() {
  const mode = rankMode || state.settings.rankingMode;
  const { ranked, unranked } = ranking(state, mode);
  const min = state.settings.minGames;
  const podium = ranked.slice(0, 3);
  const order = [1, 0, 2].filter(i => podium[i]);

  const row = (r) => `
    <a class="rank-row" href="#/spieler/${r.id}">
      <span class="rank">${r.rank}</span>
      ${avatar(r.id)}
      <span class="who">
        <b>${esc(r.name)}${r.id === me ? ' <em class="you">Du</em>' : ''}</b>
        <small>${r.games} Sp · ${r.wins}S ${r.losses}N · Tore ${r.goalsFor}:${r.goalsAgainst} (${signed(r.goalDiff)})</small>
      </span>
      <span class="form">${r.form.map(f => `<i class="${f === 'S' ? 'w' : 'l'}"></i>`).join('')}</span>
      <span class="metric">${metricCell(r, mode)}<small>${MODE_INFO[mode].label}</small></span>
    </a>`;

  return `
  <h1 class="page-title">Ranking</h1>
  <div class="segmented three pills">
    ${Object.entries(MODE_INFO).map(([k, v]) => `<button class="seg ${mode === k ? 'on' : ''}" data-rank-mode="${k}">${v.label}</button>`).join('')}
  </div>
  <p class="muted small mode-desc">${MODE_INFO[mode].desc}</p>

  ${podium.length ? `
  <section class="podium">
    ${order.map(i => {
      const r = podium[i];
      return `<a class="step-${i + 1}" href="#/spieler/${r.id}">
        <div class="crown">${i === 0 ? '👑' : ''}</div>
        ${avatar(r.id, 'lg')}
        <b>${esc(r.name)}</b>
        <span class="metric">${metricCell(r, mode)}</span>
        <div class="block"><span>${r.rank}</span></div>
      </a>`;
    }).join('')}
  </section>` : `<div class="empty card">Noch niemand hat ${min} Spiele erreicht. Erst dann wird gewertet.</div>`}

  ${ranked.length ? `<section class="card list">${ranked.map(row).join('')}</section>` : ''}

  ${state.settings.showUnranked && unranked.length ? `
    <h2 class="section-title">Noch nicht gewertet <small>(unter ${min} Spielen)</small></h2>
    <section class="card list">
      ${unranked.map(r => `
        <a class="rank-row unranked" href="#/spieler/${r.id}">
          <span class="rank">–</span>
          ${avatar(r.id)}
          <span class="who">
            <b>${esc(r.name)}${r.id === me ? ' <em class="you">Du</em>' : ''}</b>
            <span class="progress"><i style="width:${min ? Math.min(100, (r.games / min) * 100) : 100}%"></i></span>
            <small>${r.games} von ${min} Spielen · ${r.points} Pkt · TD ${signed(r.goalDiff)}</small>
          </span>
          <span class="metric dim">${metricCell(r, mode)}<small>${MODE_INFO[mode].label}</small></span>
        </a>`).join('')}
    </section>` : ''}`;
}

function pagePlayer(id) {
  const { rows, eloChange } = computeStats(state);
  const r = rows.find(x => x.id === id);
  if (!r) return `<div class="empty card">Spieler nicht gefunden.</div>`;
  const games = state.games
    .filter(g => g.status === 'done' && [...g.teamA, ...g.teamB].includes(id))
    .sort((a, b) => b.endedAt - a.endedAt);
  const min = state.settings.minGames;
  const { ranked } = ranking(state);
  const pos = ranked.find(x => x.id === id)?.rank;
  // Lieblingspartner / Angstgegner
  const partner = {}, rival = {};
  for (const g of games) {
    const inA = g.teamA.includes(id);
    const mine = inA ? g.teamA : g.teamB, opp = inA ? g.teamB : g.teamA;
    const won = inA ? g.scoreA > g.scoreB : g.scoreB > g.scoreA;
    for (const p of mine) if (p !== id) { partner[p] ??= { g: 0, w: 0 }; partner[p].g++; partner[p].w += won; }
    for (const p of opp) { rival[p] ??= { g: 0, w: 0 }; rival[p].g++; rival[p].w += won; }
  }
  const best = Object.entries(partner).sort((a, b) => (b[1].w / b[1].g - a[1].w / a[1].g) || b[1].g - a[1].g)[0];
  const nemesis = Object.entries(rival).sort((a, b) => (a[1].w / a[1].g - b[1].w / b[1].g) || b[1].g - a[1].g)[0];

  return `
  <section class="player-head card">
    ${avatar(id, 'xl')}
    <div>
      <h1>${esc(r.name)}</h1>
      <p class="muted">${r.games >= min ? `Platz ${pos ?? '–'} im Ranking` : `Noch ${min - r.games} Spiele bis zur Wertung`}</p>
      <div class="form big">${r.form.map(f => `<i class="${f === 'S' ? 'w' : 'l'}">${f}</i>`).join('')}</div>
    </div>
  </section>
  <section class="kpis">
    <div class="card"><b>${r.points}</b><span>Punkte</span></div>
    <div class="card"><b>${pct(r.quote)}</b><span>Quote</span></div>
    <div class="card"><b>${r.elo}</b><span>Elo</span></div>
    <div class="card"><b>${r.games}</b><span>Spiele (${r.singles}× 1:1, ${r.doubles}× 2:2)</span></div>
    <div class="card"><b>${r.wins}:${r.losses}</b><span>Siege : Niederlagen</span></div>
    <div class="card"><b>${signed(r.goalDiff)}</b><span>Tordiff. (${r.goalsFor}:${r.goalsAgainst})</span></div>
  </section>
  ${best || nemesis ? `<section class="kpis two">
    ${best ? `<div class="card"><b>${esc(nameOf(best[0]))}</b><span>Bester Partner (${best[1].w}/${best[1].g} Siege)</span></div>` : ''}
    ${nemesis ? `<div class="card"><b>${esc(nameOf(nemesis[0]))}</b><span>Angstgegner (${nemesis[1].w}/${nemesis[1].g} Siege)</span></div>` : ''}
  </section>` : ''}
  <h2 class="section-title">Spiele</h2>
  ${games.length ? `<section class="card list">${games.slice(0, 50).map(g => gameRow(g, eloChange, id)).join('')}</section>` : `<div class="empty card">Noch keine Spiele.</div>`}`;
}

function pageSettings() {
  const s = state.settings;
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const dataInfo = `<p class="muted small">Speicherort: <b>${store.mode === 'server' ? 'KickerStars-Server (alle Geräte teilen die Daten)' : 'nur auf diesem Gerät'}</b>.
      ${store.mode === 'lokal' ? 'Mach ab und zu eine Sicherung – beim Löschen der Browserdaten ist sonst alles weg.' : ''}</p>`;

  if (!isAdmin()) {
    return `
    <h1 class="page-title">Einstellungen</h1>
    <section class="card lock">
      <div class="lock-icon">🔒</div>
      <h3>Nur für den Spielleiter</h3>
      <p class="muted small">Spieler eintragen, Tische, Punkte und Wertung verwaltet der Spielleiter.</p>
      <form id="adminLoginForm" class="row" autocomplete="off">
        <input id="adminPin" class="input grow pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Spielleiter-PIN" required>
        <button class="btn primary">Entsperren</button>
      </form>
    </section>
    <section class="card">
      <h3>Wertung</h3>
      <p class="muted small">Gespielt wird auf <b>${s.winGoals} Tore</b>. Gewertet wird ab <b>${s.minGames} Spielen</b>. Sieg 1 gegen 1: <b>+${s.pointsSingle}</b>, Sieg 2 gegen 2: <b>+${s.pointsDoubleEach}</b> für jeden Sieger.</p>
    </section>
    <section class="card">
      <h3>Daten</h3>
      ${dataInfo}
      <button class="btn" id="exportBtn">Sicherung herunterladen</button>
    </section>
    <p class="muted small center">KickerStars v0.3</p>`;
  }

  return `
  <div class="row page-head">
    <h1 class="page-title grow">Spielleiter</h1>
    <button class="btn ghost" id="adminLogout">Spielleiter abmelden</button>
  </div>

  <section class="card">
    <h3>Spieler eintragen</h3>
    <form id="bulkAddForm" class="stack tight" autocomplete="off">
      <textarea id="bulkNames" class="input area" rows="3" placeholder="Namen eingeben – mehrere mit Komma oder je Zeile, z. B.&#10;Robert, Anna, Ben"></textarea>
      <button class="btn primary">Eintragen</button>
    </form>
    <h3 class="sub">${players.length} ${players.length === 1 ? 'Spieler' : 'Spieler'}</h3>
    <div class="stack tight">
      ${players.map(p => `<form class="row" data-rename="${p.id}">
        ${avatar(p.id, 'sm')}<input class="input grow" name="name" value="${esc(p.name)}" maxlength="30">
        <button class="btn ghost icon" aria-label="Namen speichern" title="Namen speichern">✓</button>
        <button type="button" class="btn ghost icon danger" data-confirm data-delete-player="${p.id}" aria-label="Spieler löschen">🗑</button>
      </form>`).join('') || '<p class="muted">Noch keine Spieler – oben eintragen.</p>'}
    </div>
  </section>

  <form id="settingsForm" class="stack">
    <section class="card">
      <h3>Wertung</h3>
      <label class="field inline"><span>Mindestanzahl Spiele für die Wertung</span>
        <input class="input num" type="number" min="0" max="999" name="minGames" value="${s.minGames}"></label>
      <label class="switch"><input type="checkbox" name="showUnranked" ${s.showUnranked ? 'checked' : ''}><span class="track"></span>
        <span>Spieler unter der Mindestanzahl trotzdem anzeigen</span></label>
      <label class="field inline"><span>Standard-Sortierung im Ranking</span>
        <select class="input" name="rankingMode">
          ${Object.entries(MODE_INFO).map(([k, v]) => `<option value="${k}" ${s.rankingMode === k ? 'selected' : ''}>${v.label}</option>`).join('')}
        </select></label>
    </section>
    <section class="card">
      <h3>Punkte</h3>
      <label class="field inline"><span>Sieg 1 gegen 1 (Punkte für den Sieger)</span>
        <input class="input num" type="number" min="0" max="99" name="pointsSingle" value="${s.pointsSingle}"></label>
      <label class="field inline"><span>Sieg 2 gegen 2 (Punkte für jeden Sieger)</span>
        <input class="input num" type="number" min="0" max="99" name="pointsDoubleEach" value="${s.pointsDoubleEach}"></label>
      <label class="field inline"><span>Tore zum Sieg (für die Schnell-Eingabe)</span>
        <input class="input num" type="number" min="1" max="99" name="winGoals" value="${s.winGoals}"></label>
      <label class="field inline"><span>Elo-Faktor K (wie stark ein Spiel zählt)</span>
        <input class="input num" type="number" min="1" max="100" name="eloK" value="${s.eloK}"></label>
    </section>
    <section class="card">
      <h3>Tische</h3>
      <div class="stack tight" id="tableList">
        ${s.tables.map((t, i) => `<div class="row"><input class="input grow" name="table" value="${esc(t)}" maxlength="30">
          ${s.tables.length > 1 ? `<button type="button" class="btn ghost icon" data-remove-table="${i}" aria-label="Tisch entfernen">✕</button>` : ''}</div>`).join('')}
      </div>
      <button type="button" class="btn ghost" id="addTable">+ Tisch hinzufügen</button>
    </section>
    <button class="btn primary block">Einstellungen speichern</button>
  </form>

  <section class="card">
    <h3>Spielleiter-PIN ändern</h3>
    <form id="pinForm" class="row wrap" autocomplete="off">
      <input id="newPin" class="input grow pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" placeholder="Neue PIN (4–8 Ziffern)" required>
      <button class="btn">PIN ändern</button>
    </form>
  </section>

  <section class="card">
    <h3>Daten</h3>
    ${dataInfo}
    <div class="row wrap">
      <button class="btn" id="exportBtn">Sicherung herunterladen</button>
      <label class="btn">Sicherung laden<input type="file" id="importFile" accept="application/json,.json" hidden></label>
      <button class="btn" data-confirm id="demoBtn">Demo-Daten laden</button>
      <button class="btn danger" data-confirm id="resetBtn">Alle Spiele & Spieler löschen</button>
    </div>
  </section>
  <p class="muted small center">KickerStars v0.3</p>`;
}

// ---------- Rendern ----------
function render() {
  const { parts, q } = route();
  const meExists = me && state.players.some(p => p.id === me);
  if (!meExists) { me = null; localStorage.removeItem(USER_KEY); }

  if (adminPin && !hasPin(state)) setAdmin(null);   // z. B. nach komplettem Zurücksetzen
  const inside = !!me || isAdmin();
  document.body.classList.toggle('logged-out', !inside);
  $user.innerHTML = inside
    ? `${isAdmin() ? '<span class="leiter-badge" title="Spielleiter">🔑 Leiter</span>' : ''}${me ? `${avatar(me, 'sm')}<span>${esc(nameOf(me))}</span>` : ''}<button class="link" id="logout">Abmelden</button>`
    : '';
  $conn.innerHTML = store.mode === 'server'
    ? `<span class="dot ${store.online ? 'on' : 'off'}"></span>${store.online ? 'Server' : 'Offline'}`
    : '';

  let html, tab = parts[0] || '';
  if (!inside) html = pageLogin();
  else if (tab === 'spiel') html = pageNewGame(q);
  else if (tab === 'ranking') html = pageRanking();
  else if (tab === 'spieler') { html = pagePlayer(parts[1]); tab = 'ranking'; }
  else if (tab === 'einstellungen') html = pageSettings();
  else { html = pageOverview(); tab = ''; }

  const scrollY = window.scrollY;
  $main.innerHTML = html;
  window.scrollTo(0, scrollY);
  $nav.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  tickTimers();
}

function tickTimers() {
  document.querySelectorAll('[data-since]').forEach(el => {
    const s = Math.max(0, Math.floor((Date.now() - Number(el.dataset.since)) / 1000));
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
}

// ---------- Ereignisse ----------
function armConfirm(btn) {
  if (btn.classList.contains('armed')) return true;
  btn.classList.add('armed');
  btn.dataset.label = btn.innerHTML;
  btn.innerHTML = 'Sicher? Nochmal tippen';
  setTimeout(() => { if (btn.isConnected) { btn.classList.remove('armed'); btn.innerHTML = btn.dataset.label; } }, 3000);
  return false;
}

/** Liefert {scoreA, scoreB} oder null (mit Hinweis), wenn noch etwas fehlt. */
function readScore(gameId) {
  const r = scoreDraft[gameId] || newResult();
  if (r.manual) return { scoreA: parseInt(r.a, 10), scoreB: parseInt(r.b, 10) };
  if (!r.winner) { toast('Bitte zuerst den Gewinner antippen.'); return null; }
  if (r.loser === null) { toast('Bitte die Tore des Verlierers antippen.'); return null; }
  const W = state.settings.winGoals;
  return r.winner === 'a' ? { scoreA: W, scoreB: r.loser } : { scoreA: r.loser, scoreB: W };
}

document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, [data-login], [data-rank-mode]');
  if (!t) return;
  if (t.hasAttribute('data-confirm') && !armConfirm(t)) { e.preventDefault(); return; }

  if (t.id === 'logout') { me = null; localStorage.removeItem(USER_KEY); setAdmin(null); location.hash = '#/'; render(); return; }
  if (t.id === 'adminLogout') { setAdmin(null); toast('Spielleiter abgemeldet', 'ok'); location.hash = '#/'; render(); return; }
  if (t.dataset.login) { me = t.dataset.login; localStorage.setItem(USER_KEY, me); render(); return; }

  if (t.dataset.table !== undefined) { draft.table = Number(t.dataset.table); render(); return; }
  if (t.dataset.mode) { draft.mode = t.dataset.mode; if (draft.mode === '1v1') { draft.a2 = ''; draft.b2 = ''; } render(); return; }
  if (t.dataset.rankMode) { rankMode = t.dataset.rankMode; render(); return; }

  if (t.dataset.step) {
    e.preventDefault();
    const gid = t.dataset.game, side = t.dataset.step, dir = Number(t.dataset.dir);
    const obj = scoreDraft[gid] ||= newResult();
    obj[side] = Math.max(0, Math.min(99, (parseInt(obj[side], 10) || 0) + dir));
    const input = document.querySelector(`[data-score-input="${side}"][data-game="${gid}"]`);
    if (input) input.value = obj[side];
    return;
  }
  if (t.dataset.winner) {
    const r = scoreDraft[t.dataset.game] ||= newResult();
    if (r.winner !== t.dataset.winner) { r.winner = t.dataset.winner; r.loser = null; }
    render(); return;
  }
  if (t.dataset.loser !== undefined) { scoreDraft[t.dataset.game].loser = Number(t.dataset.loser); render(); return; }
  if (t.dataset.quickToggle) {
    const r = scoreDraft[t.dataset.quickToggle] ||= newResult();
    r.manual = !r.manual;
    if (r.manual && r.winner && r.loser !== null) {  // Schnell-Eingabe in die +/- Felder übernehmen
      const W = state.settings.winGoals;
      r.a = r.winner === 'a' ? W : r.loser; r.b = r.winner === 'b' ? W : r.loser;
    }
    render(); return;
  }
  if (t.dataset.scoreOpen) { scoreDraft[t.dataset.scoreOpen] = newResult(); render(); return; }
  if (t.dataset.scoreCancel) { delete scoreDraft[t.dataset.scoreCancel]; render(); return; }
  if (t.dataset.scoreSave) {
    const id = t.dataset.scoreSave;
    const sc = readScore(id);
    if (!sc) return;
    if (await act('finishGame', { id, ...sc, at: Date.now(), by: me }, `Gespeichert: ${sc.scoreA} : ${sc.scoreB}`)) delete scoreDraft[id];
    render();
    return;
  }
  if (t.dataset.cancelGame) { await act('cancelGame', { id: t.dataset.cancelGame }, 'Spiel abgebrochen'); return; }
  if (t.dataset.deleteGame) { await act('deleteGame', { id: t.dataset.deleteGame }, 'Spiel gelöscht'); return; }
  if (t.dataset.deletePlayer) { await act('deletePlayer', { id: t.dataset.deletePlayer }, 'Spieler gelöscht'); return; }

  if (t.id === 'addTable') {
    const tables = [...document.querySelectorAll('[name="table"]')].map(i => i.value);
    tables.push(`Tisch ${tables.length + 1}`);
    await act('updateSettings', { tables }, 'Tisch hinzugefügt');
    return;
  }
  if (t.dataset.removeTable !== undefined) {
    const tables = state.settings.tables.filter((_, i) => i !== Number(t.dataset.removeTable));
    await act('updateSettings', { tables }, 'Tisch entfernt');
    return;
  }
  if (t.id === 'exportBtn') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kickerstars-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  if (t.id === 'demoBtn') {
    if (!(await act('importState', { state: demoState(state.settings) }))) return;
    let msg = 'Demo geladen – viel Spaß beim Testen!';
    if (!hasPin(state)) {  // Demo ohne eingerichteten Spielleiter: PIN 1234
      if (!(await act('setPin', { newPin: '1234' }))) return;
      setAdmin('1234');
      msg = 'Demo geladen – Spielleiter-PIN: 1234';
    }
    if (!me || !state.players.some(p => p.id === me)) { me = 'demo0'; localStorage.setItem(USER_KEY, me); }
    toast(msg, 'ok');
    location.hash = '#/'; render();
    return;
  }
  if (t.id === 'resetBtn') { await act('reset', {}, 'Alles gelöscht'); return; }
});

document.addEventListener('toggle', (e) => {
  if (e.target.classList?.contains('add-player')) addOpen = e.target.open;
}, true);

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.scoreInput) {
    const gid = t.dataset.game;
    const v = t.value.replace(/\D/g, '').slice(0, 2);
    t.value = v;
    if (scoreDraft[gid]) scoreDraft[gid][t.dataset.scoreInput] = v;
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.slot) { draft[t.dataset.slot] = t.value; render(); }
  if (t.id === 'direct') { draft.direct = t.checked; render(); }
  if (t.id === 'importFile' && t.files[0]) {
    try {
      const data = JSON.parse(await t.files[0].text());
      if (!Array.isArray(data.players) || !Array.isArray(data.games)) throw new Error();
      await act('importState', { state: data }, `Sicherung geladen: ${data.players.length} Spieler, ${data.games.length} Spiele`);
    } catch { toast('Das ist keine gültige KickerStars-Sicherung.'); }
  }
});

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'setupForm') {
    const p1 = f.querySelector('#pin1').value.trim(), p2 = f.querySelector('#pin2').value.trim();
    if (p1 !== p2) return toast('Die beiden PINs stimmen nicht überein.');
    if (await act('setPin', { newPin: p1 })) {
      setAdmin(p1);
      toast('Spielleiter eingerichtet – jetzt die Spieler eintragen.', 'ok');
      location.hash = '#/einstellungen'; render();
    }
  }
  if (f.id === 'adminLoginForm') {
    const pin = f.querySelector('#adminPin').value.trim();
    try {
      await store.dispatch({ type: 'verifyPin', pin });
      setAdmin(pin);
      toast('Angemeldet als Spielleiter', 'ok');
      if (!location.hash.startsWith('#/einstellungen')) location.hash = '#/einstellungen';
      render();
    } catch (err) { toast(err.message || 'Falsche PIN.'); f.querySelector('#adminPin').value = ''; }
  }
  if (f.id === 'pinForm') {
    const pin = f.querySelector('#newPin').value.trim();
    if (await act('setPin', { newPin: pin }, 'PIN geändert – gut merken!')) setAdmin(pin);
  }
  if (f.id === 'bulkAddForm') {
    const names = f.querySelector('#bulkNames').value.split(/[,;\n]+/).map(n => n.trim()).filter(Boolean);
    if (!names.length) return toast('Bitte mindestens einen Namen eingeben.');
    const added = [], skipped = [];
    for (const name of names) {
      if (findPlayerByName(state, name)) { skipped.push(name); continue; }
      try { await store.dispatch({ type: 'addPlayer', payload: { id: uid(), name, at: Date.now() }, pin: adminPin }); added.push(name); }
      catch (err) { toast(`${name}: ${err.message}`); return; }
    }
    toast(`${added.length} eingetragen${skipped.length ? ` · schon vorhanden: ${skipped.join(', ')}` : ''}`, added.length ? 'ok' : 'error');
    render();
  }
  if (f.id === 'addPlayerForm') {
    const name = f.querySelector('#newPlayer').value;
    if (findPlayerByName(state, name)) return toast('Diesen Spieler gibt es schon.');
    if (await act('addPlayer', { id: uid(), name, at: Date.now() }, 'Spieler hinzugefügt')) {
      document.getElementById('newPlayer')?.focus();
    }
  }
  if (f.id === 'gameForm') {
    const teamA = draft.mode === '2v2' ? [draft.a1, draft.a2] : [draft.a1];
    const teamB = draft.mode === '2v2' ? [draft.b1, draft.b2] : [draft.b1];
    const base = { id: uid(), table: draft.table, mode: draft.mode, teamA, teamB, at: Date.now(), by: me };
    let ok;
    if (draft.direct) {
      const sc = readScore('draft');
      if (!sc) return;
      ok = await act('recordGame', { ...base, ...sc }, `Gespeichert: ${sc.scoreA} : ${sc.scoreB}`);
    } else {
      ok = await act('startGame', base, 'Spiel gestartet – viel Erfolg!');
    }
    if (ok) {
      Object.assign(draft, { table: null, a1: '', a2: '', b1: '', b2: '', direct: false });
      delete scoreDraft.draft;
      location.hash = '#/';
    }
  }
  if (f.id === 'settingsForm') {
    const fd = new FormData(f);
    await act('updateSettings', {
      minGames: fd.get('minGames'),
      showUnranked: fd.get('showUnranked') === 'on',
      rankingMode: fd.get('rankingMode'),
      pointsSingle: fd.get('pointsSingle'),
      pointsDoubleEach: fd.get('pointsDoubleEach'),
      eloK: fd.get('eloK'),
      winGoals: fd.get('winGoals'),
      tables: fd.getAll('table'),
    }, 'Gespeichert');
    rankMode = null;
  }
  if (f.dataset.rename) {
    await act('renamePlayer', { id: f.dataset.rename, name: new FormData(f).get('name') }, 'Umbenannt');
  }
});

function logoSvg() {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9aa3ab"/></linearGradient></defs>
  <circle cx="32" cy="32" r="22" fill="none" stroke="url(#lg)" stroke-width="5"/>
  <path d="M32 18l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L32 39l-8.2 4.4 1.6-9.2-6.7-6.5 9.2-1.3z" fill="url(#lg)"/></svg>`;
}

// ---------- Start ----------
(async function init() {
  store = await createStore();
  state = store.state;
  store.subscribe((s) => { state = s; render(); });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/spiel')) draft.table = null; render(); window.scrollTo(0, 0); });
  setInterval(tickTimers, 1000);
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      // Neue Version installiert -> einmal neu laden, damit sie sofort aktiv ist
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'activated' && navigator.serviceWorker.controller) location.reload();
        });
      });
    }).catch(() => {});
  }
})();
