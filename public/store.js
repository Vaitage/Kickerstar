// Datenhaltung: entweder lokal im Browser (Handy) oder über den KickerStars-Server (Laptop/Tailscale).
// Beim Start wird geprüft, ob /api/ping antwortet – dann Server-Modus, sonst Lokal-Modus.
import { emptyState, normalizeState, reduce } from './core.js';

const LS_KEY = 'kickerstars.state.v1';

class LocalStore {
  constructor() {
    this.mode = 'lokal';
    this.listeners = new Set();
    this.state = this.#load();
    // Änderungen aus einem anderen Tab übernehmen
    window.addEventListener('storage', (e) => {
      if (e.key === LS_KEY) { this.state = this.#load(); this.#emit(); }
    });
  }
  #load() {
    try { return normalizeState(JSON.parse(localStorage.getItem(LS_KEY))); }
    catch { return emptyState(); }
  }
  async dispatch(action) {
    const next = reduce(this.state, action); // wirft ActionError bei Fehleingaben
    if (next === this.state) return this.state;
    this.state = next;
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    this.#emit();
    return next;
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  #emit() { for (const fn of this.listeners) fn(this.state); }
}

class ServerStore {
  constructor(initial) {
    this.mode = 'server';
    this.listeners = new Set();
    this.state = normalizeState(initial);
    this.online = true;
    this.#poll();
  }
  async dispatch(action) {
    const res = await fetch('api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Server-Fehler');
    this.state = normalizeState(data.state);
    this.#emit();
    return this.state;
  }
  async #poll() {
    for (;;) {
      await new Promise(r => setTimeout(r, document.hidden ? 10000 : 2500));
      try {
        const res = await fetch('api/state?rev=' + this.state.rev, { cache: 'no-store' });
        const wasOffline = !this.online;
        this.online = true;
        if (res.status === 200) { this.state = normalizeState(await res.json()); this.#emit(); }
        else if (wasOffline) this.#emit();
      } catch {
        if (this.online) { this.online = false; this.#emit(); }
      }
    }
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  #emit() { for (const fn of this.listeners) fn(this.state); }
}

export async function createStore() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('api/state', { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      return new ServerStore(await res.json());
    }
  } catch { /* kein Server -> lokal */ }
  return new LocalStore();
}
