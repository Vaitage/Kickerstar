// KickerStars-Server (ohne Abhängigkeiten, Node >= 18)
// Liefert die App aus und speichert die Daten zentral in data/state.json,
// damit mehrere Handys (z. B. über Tailscale) dieselbe Liga sehen.
//
//   node server.js              -> http://0.0.0.0:8080
//   PORT=3000 node server.js
import http from 'node:http';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emptyState, normalizeState, reduce, ActionError } from './public/core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png',
};

let state = emptyState();
let writing = Promise.resolve();

async function load() {
  await mkdir(DATA_DIR, { recursive: true });
  if (existsSync(DATA_FILE)) {
    state = normalizeState(JSON.parse(await readFile(DATA_FILE, 'utf8')));
  }
}

function save() {
  // Schreibvorgänge nacheinander, atomar über Temp-Datei + rename
  const snapshot = JSON.stringify(state, null, 2);
  writing = writing.then(async () => {
    const tmp = DATA_FILE + '.tmp';
    await writeFile(tmp, snapshot);
    await rename(tmp, DATA_FILE);
  }).catch(err => console.error('Speichern fehlgeschlagen:', err));
  return writing;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 5 * 1024 * 1024) throw new Error('Zu groß');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/api/state' && req.method === 'GET') {
      const rev = url.searchParams.get('rev');
      if (rev !== null && Number(rev) === state.rev) { res.writeHead(204); return res.end(); }
      return send(res, 200, state);
    }
    if (url.pathname === '/api/action' && req.method === 'POST') {
      const action = await readBody(req);
      try {
        const next = reduce(state, action);
        if (next !== state) { state = next; await save(); }
        return send(res, 200, { state });
      } catch (e) {
        if (e instanceof ActionError) return send(res, 400, { error: e.message });
        throw e;
      }
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Nicht gefunden' });

    // Statische Dateien
    let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'Verboten', 'text/plain');
    if (existsSync(file) && (await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) file = path.join(PUBLIC, 'index.html');
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'Server-Fehler' });
  }
});

await load();
server.listen(PORT, HOST, () => {
  console.log(`KickerStars läuft auf http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Daten: ${DATA_FILE}  (${state.players.length} Spieler, ${state.games.length} Spiele)`);
});
