// Erzeugt Beispieldaten zum Ausprobieren (8 Spieler, ~60 Spiele der letzten 2 Wochen, 1 Live-Spiel)
import { emptyState } from './core.js';

const NAMES = ['Robert', 'Anna', 'Ben', 'Carla', 'Dieter', 'Elif', 'Frank', 'Gabi'];

export function demoState(settings) {
  const s = emptyState();
  if (settings) s.settings = { ...s.settings, ...settings };
  let seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = Date.now();
  // Unterschiedliche Spielstärken, damit das Ranking interessant wird
  const skill = [0.75, 0.6, 0.55, 0.65, 0.4, 0.5, 0.35, 0.45];
  s.players = NAMES.map((name, i) => ({ id: 'demo' + i, name, createdAt: now - 15 * 864e5 }));

  const pick = (n) => {
    const pool = [...s.players.keys()];
    const out = [];
    while (out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return out;
  };
  for (let i = 0; i < 60; i++) {
    const mode = rnd() < 0.55 ? '2v2' : '1v1';
    const idx = pick(mode === '2v2' ? 4 : 2);
    const half = idx.length / 2;
    const a = idx.slice(0, half), b = idx.slice(half);
    const sa = a.reduce((x, k) => x + skill[k], 0) / half;
    const sb = b.reduce((x, k) => x + skill[k], 0) / half;
    const aWins = rnd() < 0.5 + (sa - sb) * 1.2;
    const loser = Math.floor(rnd() * 9);
    const at = now - (60 - i) * 5.5 * 36e5 - Math.floor(rnd() * 36e5);
    s.games.push({
      id: 'dg' + i, table: Math.floor(rnd() * 3), mode,
      teamA: a.map(k => 'demo' + k), teamB: b.map(k => 'demo' + k),
      status: 'done', scoreA: aWins ? 10 : loser, scoreB: aWins ? loser : 10,
      startedAt: at - 6e5, endedAt: at, by: null,
    });
  }
  s.games.push({
    id: 'dglive', table: 1, mode: '2v2', teamA: ['demo0', 'demo5'], teamB: ['demo2', 'demo7'],
    status: 'live', scoreA: null, scoreB: null, startedAt: now - 4 * 6e4, endedAt: null, by: null,
  });
  return s;
}
