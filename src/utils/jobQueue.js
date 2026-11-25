// src/utils/jobQueue.js -- offline queue for technician job actions (Manage Orders SOW §10.6).
//
// When there is no connection, a job action (start, pause, resume, submit, acknowledge, flag), a checklist tick, a note
// or a photo is saved on the phone with its request key and the time it was done, and sent in order when the
// connection is back. The key makes every retry idempotent on the server, so nothing is ever recorded twice. The
// server decides whether the phone's time is plausible; if not (or if it arrives late) the action is flagged for a
// manager ("Needs review"). Clock in/out is NOT queued: attendance stays online-only with its own correction process.
// States shown to the technician: Pending (on this phone), Synced, Failed (refused by the server, with the reason),
// Needs review.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { orgFetch, getStoredSessionToken, API_BASE } from './orgApi';

const KEY = 'inaya.jobQueue.v1';
const listeners = new Set();
let flushing = null;

export const isOffline = (e) => !e?.status; // orgFetch errors from the server carry an HTTP status; network failures don't
async function read() { try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]'); } catch { return []; } }
async function write(items) { await AsyncStorage.setItem(KEY, JSON.stringify(items)); listeners.forEach((fn) => { try { fn(items); } catch { /* ignore */ } }); }
export function onQueueChange(fn) { listeners.add(fn); read().then(fn); return () => listeners.delete(fn); }
export const queueItems = read;

/** kind: activity | checklist | note | photo. For a photo, `file` = { uri, name } and the file is copied into app storage. */
export async function enqueue({ orgId, jobId, kind, body = {}, file = null, key }) {
  const items = await read();
  if (items.some((x) => x.key === key)) return; // already queued (double tap)
  let saved = null;
  if (file) {
    const dir = `${FileSystem.documentDirectory}jobqueue/`; await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const to = `${dir}${key}-${String(file.name).replace(/[^A-Za-z0-9._-]/g, '_')}`; await FileSystem.copyAsync({ from: file.uri, to }); saved = { uri: to, name: file.name };
  }
  items.push({ key, orgId, jobId, kind, body, file: saved, doneAt: new Date().toISOString(), status: 'pending', error: null, tries: 0 });
  await write(items);
}

async function sendOne(it) {
  if (it.kind === 'activity') return orgFetch(`/api/orgs/ops/jobs/${it.jobId}/activity`, { method: 'POST', body: { orgId: it.orgId, ...it.body, idempotencyKey: it.key, queued: true, clientAt: it.doneAt, source: 'mobile' } });
  if (it.kind === 'checklist') return orgFetch(`/api/orgs/ops/jobs/${it.jobId}/checklist`, { method: 'POST', body: { orgId: it.orgId, ...it.body, note: [it.body.note, `(done offline ${it.doneAt})`].filter(Boolean).join(' ') } });
  if (it.kind === 'note') return orgFetch(`/api/orgs/ops/jobs/${it.jobId}/notes`, { method: 'POST', body: { orgId: it.orgId, text: `${it.body.text}\n(written offline ${new Date(it.doneAt).toLocaleString()})` } });
  if (it.kind === 'photo') {
    const blob = await (await fetch(it.file.uri)).blob(); const token = await getStoredSessionToken();
    const qs = new URLSearchParams({ orgId: it.orgId, filename: it.file.name, caption: `Taken offline ${new Date(it.doneAt).toLocaleString()}`, ...(it.body.checklistItemId ? { checklistItemId: it.body.checklistItemId } : {}) }).toString();
    let res; try { res = await fetch(`${API_BASE}/api/orgs/ops/jobs/${it.jobId}/evidence?${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: blob }); } catch { throw new Error('offline'); }
    const d = await res.json().catch(() => ({})); if (!res.ok) throw Object.assign(new Error(d.error || `Upload failed (${res.status}).`), { status: res.status });
    return d;
  }
  throw Object.assign(new Error('Unknown queued item.'), { status: 400 });
}

/** Sends pending items oldest first. Stops at the first network failure (still offline); server refusals become Failed. */
export function flushQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    let items = await read(); let sent = 0;
    for (const it of items.filter((x) => x.status === 'pending')) {
      try {
        const r = await sendOne(it); sent++;
        items = await read(); const i = items.findIndex((x) => x.key === it.key);
        if (i >= 0) { if (r?.needsReview) items[i] = { ...items[i], status: 'review', error: null }; else items.splice(i, 1); await write(items); }
        if (it.file?.uri) FileSystem.deleteAsync(it.file.uri, { idempotent: true }).catch(() => {});
      } catch (e) {
        if (isOffline(e)) break;
        items = await read(); const i = items.findIndex((x) => x.key === it.key);
        if (i >= 0) { items[i] = { ...items[i], status: 'failed', error: e.message, tries: (items[i].tries || 0) + 1 }; await write(items); }
      }
    }
    return { sent };
  })().finally(() => { flushing = null; });
  return flushing;
}
/** Remove Failed / Needs-review items the technician has seen. */
export async function dismiss(keys) { await write((await read()).filter((x) => !keys.includes(x.key))); }
export const LABEL = { pending: 'Pending (on this phone)', failed: 'Failed', review: 'Sent, needs manager review' };
