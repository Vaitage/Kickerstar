// KickerStars – Statistik über alle (oder gefilterte) Spiele. Reine Rechenfunktionen, ohne Oberfläche.

const DAY = 864e5;

export function rangeStart(range, now = Date.now()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  if (range === 'heute') return d.getTime();
  if (range === '7') return d.getTime() - 6 * DAY;
  if (range === '30') return d.getTime() - 29 * DAY;
  return 0;
}

const key = (ids) => [...ids].sort().join('|');

export function gameStats(state, range = 'alle', now = Date.now()) {
  const from = rangeStart(range, now);
  const W = state.settings.winGoals || 10;
  const games = state.games
    .filter(g => g.status === 'done' && g.endedAt >= from)
    .sort((a, b) => a.endedAt - b.endedAt);
  const n = games.length;

  // ---- Kennzahlen
  const goals = games.reduce((s, g) => s + g.scoreA + g.scoreB, 0);
  const singles = games.filter(g => g.mode === '1v1').length;
  const timed = games.map(g => g.endedAt - g.startedAt).filter(ms => ms > 30e3 && ms < 2 * 36e5);
  const avgDuration = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : null;

  // ---- Uhrzeit (wann wird gespielt)
  const hours = new Array(24).fill(0);
  for (const g of games) hours[new Date(g.endedAt).getHours()]++;
  const usedH = hours.map((c, h) => [h, c]).filter(([, c]) => c);
  const hLo = usedH.length ? usedH[0][0] : 17, hHi = usedH.length ? usedH.at(-1)[0] : 22;
  const byHour = hours.slice(hLo, hHi + 1).map((c, i) => ({ label: `${hLo + i}`, full: `${hLo + i}:00–${hLo + i + 1}:00 Uhr`, value: c }));

  // ---- Tische
  const byTable = state.settings.tables.map((name, i) => ({ label: name, value: games.filter(g => g.table === i).length }));

  // ---- Ergebnisse: Tore des Verlierers bei regulären Siegen
  const loser = new Array(W).fill(0);
  let other = 0;
  for (const g of games) {
    const hi = Math.max(g.scoreA, g.scoreB), lo = Math.min(g.scoreA, g.scoreB);
    if (hi === W && lo < W) loser[lo]++; else other++;
  }
  const results = loser.map((c, i) => ({ label: `${W}:${i}`, full: `${W}:${i}`, value: c }));

  // ---- Blau (Team A) gegen Rot (Team B)
  const blau = games.filter(g => g.scoreA > g.scoreB).length;

  // ---- Rekorde
  let biggest = null, longest = null;
  for (const g of games) {
    const diff = Math.abs(g.scoreA - g.scoreB);
    if (!biggest || diff >= Math.abs(biggest.scoreA - biggest.scoreB)) biggest = g;
    const dur = g.endedAt - g.startedAt;
    if (dur > 30e3 && dur < 2 * 36e5 && (!longest || dur > longest.endedAt - longest.startedAt)) longest = g;
  }
  const zuNull = games.filter(g => Math.min(g.scoreA, g.scoreB) === 0).length;
  const knapp = games.filter(g => Math.abs(g.scoreA - g.scoreB) === 1).length;
  const perDay = {};
  for (const g of games) { const k = new Date(g.endedAt).toDateString(); perDay[k] = (perDay[k] || 0) + 1; }
  const bestDay = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0] || null;

  // ---- Spieler-Bestenlisten
  const pl = {};
  const P = (id) => (pl[id] ??= { id, games: 0, wins: 0, goals: 0, streak: 0, bestStreak: 0 });
  const duos = {}, rivals = {};
  for (const g of games) {
    const aWon = g.scoreA > g.scoreB;
    for (const [teamIds, gf, won] of [[g.teamA, g.scoreA, aWon], [g.teamB, g.scoreB, !aWon]]) {
      for (const id of teamIds) {
        const p = P(id);
        p.games++; p.goals += gf;
        if (won) { p.wins++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak); } else p.streak = 0;
      }
      if (g.mode === '2v2') {
        const k = key(teamIds);
        const d = (duos[k] ??= { ids: [...teamIds].sort(), games: 0, wins: 0 });
        d.games++; d.wins += won ? 1 : 0;
      }
    }
    if (g.mode === '1v1') {
      const k = key([g.teamA[0], g.teamB[0]]);
      const r = (rivals[k] ??= { ids: [g.teamA[0], g.teamB[0]].sort(), games: 0, wins: {} });
      r.games++;
      const w = aWon ? g.teamA[0] : g.teamB[0];
      r.wins[w] = (r.wins[w] || 0) + 1;
    }
  }
  const players = Object.values(pl);
  const top = (arr, f, n = 3) => [...arr].sort(f).slice(0, n);
  const minDuo = 3;

  return {
    n, goals, avgGoals: n ? goals / n : 0, singles, doubles: n - singles, avgDuration,
    byHour, byTable, results, otherResults: other, winGoals: W,
    sides: { blau, rot: n - blau },
    records: { biggest, longest, zuNull, knapp, bestDay },
    leaders: {
      streak: top(players.filter(p => p.bestStreak > 1), (a, b) => b.bestStreak - a.bestStreak || b.wins - a.wins),
      currentStreak: top(players.filter(p => p.streak > 1), (a, b) => b.streak - a.streak),
      games: top(players, (a, b) => b.games - a.games),
      goals: top(players, (a, b) => b.goals - a.goals),
      duos: top(Object.values(duos).filter(d => d.games >= minDuo), (a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games),
      rivals: top(Object.values(rivals), (a, b) => b.games - a.games),
    },
    minDuo,
  };
}
