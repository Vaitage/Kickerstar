// Tests für die Kern-Logik:  node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, reduce, computeStats, ranking, ActionError } from '../public/core.js';

function setup(names = ['Robert', 'Anna', 'Ben', 'Carla']) {
  let s = emptyState();
  for (const n of names) s = reduce(s, { type: 'addPlayer', payload: { name: n } });
  const id = Object.fromEntries(s.players.map(p => [p.name, p.id]));
  return { s, id };
}

test('Spieler anlegen ist doppelt-sicher (Groß/Klein egal)', () => {
  let { s } = setup(['Robert']);
  s = reduce(s, { type: 'addPlayer', payload: { name: 'robert ' } });
  assert.equal(s.players.length, 1);
});

test('1:1 Sieg gibt 2 Punkte, 2:2 Sieg gibt jedem 1 Punkt', () => {
  let { s, id } = setup();
  s = reduce(s, { type: 'recordGame', payload: { table: 0, mode: '1v1', teamA: [id.Robert], teamB: [id.Anna], scoreA: 10, scoreB: 6, at: 1 } });
  s = reduce(s, { type: 'recordGame', payload: { table: 1, mode: '2v2', teamA: [id.Robert, id.Ben], teamB: [id.Anna, id.Carla], scoreA: 4, scoreB: 10, at: 2 } });
  const r = Object.fromEntries(computeStats(s).rows.map(x => [x.name, x]));
  assert.equal(r.Robert.points, 2);
  assert.equal(r.Anna.points, 1);
  assert.equal(r.Carla.points, 1);
  assert.equal(r.Ben.points, 0);
  assert.equal(r.Robert.goalDiff, 4 - 6);       // +4 und -6
  assert.equal(r.Anna.goalDiff, -4 + 6);
  assert.equal(r.Robert.maxPoints, 3);
  assert.ok(Math.abs(r.Robert.quote - 2 / 3) < 1e-9);
});

test('Live-Spiel: Tisch und Spieler sind belegt, Ergebnis beendet es', () => {
  let { s, id } = setup();
  s = reduce(s, { type: 'startGame', payload: { id: 'g1', table: 0, mode: '1v1', teamA: [id.Robert], teamB: [id.Anna] } });
  assert.throws(() => reduce(s, { type: 'startGame', payload: { table: 0, mode: '1v1', teamA: [id.Ben], teamB: [id.Carla] } }), ActionError);
  assert.throws(() => reduce(s, { type: 'startGame', payload: { table: 1, mode: '1v1', teamA: [id.Robert], teamB: [id.Carla] } }), ActionError);
  assert.throws(() => reduce(s, { type: 'finishGame', payload: { id: 'g1', scoreA: 5, scoreB: 5 } }), ActionError);
  s = reduce(s, { type: 'finishGame', payload: { id: 'g1', scoreA: 3, scoreB: 10 } });
  assert.equal(s.games[0].status, 'done');
});

test('Mindestspielzahl trennt gewertet / ungewertet', () => {
  let { s, id } = setup(['Aa', 'Bb', 'Cc']);
  s = reduce(s, { type: 'updateSettings', payload: { minGames: 2 } });
  for (let i = 0; i < 2; i++) {
    s = reduce(s, { type: 'recordGame', payload: { table: 0, mode: '1v1', teamA: [id.Aa], teamB: [id.Bb], scoreA: 10, scoreB: i, at: i + 1 } });
  }
  s = reduce(s, { type: 'recordGame', payload: { table: 0, mode: '1v1', teamA: [id.Cc], teamB: [id.Aa], scoreA: 10, scoreB: 2, at: 9 } });
  const r = ranking(s, 'punkte');
  assert.deepEqual(r.ranked.map(x => x.name), ['Aa', 'Bb']);
  assert.deepEqual(r.unranked.map(x => x.name), ['Cc']);
});

test('Elo bleibt in Summe gleich (Nullsummenspiel)', () => {
  let { s, id } = setup();
  s = reduce(s, { type: 'recordGame', payload: { table: 0, mode: '2v2', teamA: [id.Robert, id.Ben], teamB: [id.Anna, id.Carla], scoreA: 10, scoreB: 8, at: 1 } });
  s = reduce(s, { type: 'recordGame', payload: { table: 0, mode: '1v1', teamA: [id.Robert], teamB: [id.Carla], scoreA: 2, scoreB: 10, at: 2 } });
  const { rows } = computeStats(s);
  const total = rows.reduce((a, r) => a + r.elo, 0);
  assert.ok(Math.abs(total - 4000) <= 2);
});

test('Spielleiter-PIN: nur mit PIN Spieler eintragen, Spieler dürfen spielen', () => {
  let { s, id } = setup(['Robert', 'Anna']);
  s = reduce(s, { type: 'setPin', payload: { newPin: '4711' } });
  assert.throws(() => reduce(s, { type: 'addPlayer', payload: { name: 'Ben' } }), /Spielleiter/);
  assert.throws(() => reduce(s, { type: 'verifyPin', pin: '0000' }), /Falsche PIN/);
  assert.equal(reduce(s, { type: 'verifyPin', pin: '4711' }), s);
  s = reduce(s, { type: 'addPlayer', pin: '4711', payload: { name: 'Ben' } });
  assert.equal(s.players.length, 3);
  // Spiele starten/eintragen geht ohne PIN
  s = reduce(s, { type: 'recordGame', payload: { table: 0, mode: '1v1', teamA: [id.Robert], teamB: [id.Anna], scoreA: 10, scoreB: 3 } });
  assert.throws(() => reduce(s, { type: 'deleteGame', payload: { id: s.games[0].id } }), /Spielleiter/);
  // PIN lässt sich weder per Einstellungen noch per Import aushebeln
  s = reduce(s, { type: 'updateSettings', pin: '4711', payload: { adminPin: '', minGames: 5 } });
  assert.equal(s.settings.adminPin, '4711');
  s = reduce(s, { type: 'importState', pin: '4711', payload: { state: { players: [], games: [], settings: { adminPin: '1' } } } });
  assert.equal(s.settings.adminPin, '4711');
  assert.throws(() => reduce(s, { type: 'setPin', pin: '4711', payload: { newPin: '12' } }), /4 bis 8/);
});

test('Statistik: Kennzahlen, Ergebnisse, Seiten, Serien', async () => {
  const { gameStats } = await import('../public/stats.js');
  let { s, id } = setup();
  const day = Date.now();
  const rec = (a, b, sa, sb, mode = '1v1', at) => {
    s = reduce(s, { type: 'recordGame', payload: { table: 0, mode, teamA: a, teamB: b, scoreA: sa, scoreB: sb, at } });
  };
  rec([id.Robert], [id.Anna], 10, 0, '1v1', day - 3000);
  rec([id.Robert], [id.Anna], 10, 9, '1v1', day - 2000);
  rec([id.Ben, id.Carla], [id.Robert, id.Anna], 4, 10, '2v2', day - 1000);
  const st = gameStats(s, 'alle', day);
  assert.equal(st.n, 3);
  assert.equal(st.goals, 43);
  assert.equal(st.singles, 2);
  assert.equal(st.results[0].value, 1);   // 10:0
  assert.equal(st.results[9].value, 1);   // 10:9
  assert.equal(st.results[4].value, 1);   // 10:4
  assert.deepEqual(st.sides, { blau: 2, rot: 1 });
  assert.equal(st.records.zuNull, 1);
  assert.equal(st.records.knapp, 1);
  assert.equal(st.leaders.streak[0].id, id.Robert);
  assert.equal(st.leaders.streak[0].bestStreak, 3);
  assert.equal(st.leaders.rivals[0].games, 2);
});
