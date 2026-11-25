// src/screens/business/JobScreen.js -- Manage Orders SOW §10.3-10.4: one job on the technician's phone. Acknowledge,
// start (with a scanned/typed site code or a one-time location fix when the company uses them), pause with a reason,
// resume, checklist, notes, photos, parts requests, flags and submit for inspection. The server decides everything:
// assignment, job state, branch, timestamps. A failed request keeps its key so a retry can't record twice.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Alert, Platform, AppState } from 'react-native';
import * as Application from 'expo-application';
import { colors, spacing } from '../../theme';
import { orgFetch, getStoredSessionToken, API_BASE } from '../../utils/orgApi';
import { takeJobPhoto, currentLocationOnce, scannerComponent, nativeCaps, withSystemUi } from '../../utils/jobNative';
import { styles, reqKey, human, when } from './MyJobsScreen';
import { enqueue, flushQueue, onQueueChange, dismiss, isOffline, LABEL } from '../../utils/jobQueue';

const PAUSE = [['break', 'Break'], ['parts', 'Waiting for parts'], ['tools', 'Tools'], ['customer_approval', 'Customer approval'], ['technical_review', 'Technical review'], ['safety', 'Safety'], ['end_of_shift', 'End of shift'], ['other', 'Other']];
const FLAGS = [['blocker', 'Blocker'], ['safety', 'Safety concern'], ['customer_approval', 'Needs customer approval'], ['parts', 'Parts problem']];
const device = () => ({ platform: Platform.OS, app: 'inaya-mobile', version: Application.nativeApplicationVersion || '' });

export default function JobScreen({ route }) {
  const { orgId, jobId } = route.params;
  const [d, setD] = useState(null); const [me, setMe] = useState(null); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false); const [pending, setPending] = useState(null);
  const [note, setNote] = useState(''); const [siteCode, setSiteCode] = useState(''); const [scan, setScan] = useState(false); const [pausing, setPausing] = useState(false); const [flagging, setFlagging] = useState(false);
  const [partQ, setPartQ] = useState(''); const [parts, setParts] = useState([]); const [partQty, setPartQty] = useState('1');
  const caps = nativeCaps(); const Cam = scan ? scannerComponent() : null;
  const [queue, setQueue] = useState([]);
  useEffect(() => onQueueChange((items) => setQueue(items.filter((x) => x.jobId === jobId))), [jobId]);
  const load = useCallback(async () => {
    try { const [j, m] = await Promise.all([orgFetch(`/api/orgs/ops/jobs/${jobId}?orgId=${orgId}`), orgFetch(`/api/orgs/ops/me?orgId=${orgId}`)]); setD(j); setMe(m); setErr(''); }
    catch (e) { setErr(e.message || 'Could not load the job.'); }
  }, [orgId, jobId]);
  useEffect(() => { load(); }, [load]);
  const sync = useCallback(async () => { const r = await flushQueue(); if (r.sent) load(); }, [load]);
  useEffect(() => { sync(); const t = setInterval(sync, 30000); const sub = AppState.addEventListener('change', (st) => { if (st === 'active') sync(); }); return () => { clearInterval(t); sub.remove(); }; }, [sync]);
  const queued = (kind, body, file, k) => enqueue({ orgId, jobId, kind, body, file, key: k || reqKey() }).then(() => { setErr(''); setOk('No signal: saved on this phone. It will be sent automatically when you are back online.'); });

  const send = async (body, keyToUse, okMsg) => {
    const k = keyToUse || reqKey(); setPending({ body, key: k }); setBusy(true); setErr(''); setOk('');
    try {
      await orgFetch(`/api/orgs/ops/jobs/${jobId}/activity`, { method: 'POST', body: { orgId, ...body, idempotencyKey: k, source: 'mobile', device: device() } });
      setPending(null); setOk(okMsg || 'Saved.'); await load();
    } catch (e) { setPending(null); if (isOffline(e)) await queued('activity', body, null, k); else setErr(e.message); }
    finally { setBusy(false); }
  };
  const post = async (path, body, okMsg) => {
    setBusy(true); setErr(''); setOk('');
    try { await orgFetch(`/api/orgs/ops/jobs/${jobId}/${path}`, { method: 'POST', body: { orgId, ...body } }); setOk(okMsg || 'Saved.'); await load(); }
    catch (e) { if (isOffline(e) && (path === 'checklist' || path === 'notes')) await queued(path === 'notes' ? 'note' : 'checklist', body); else setErr(e.status ? e.message : 'No connection. Nothing was saved; try again when you have signal.'); }
    finally { setBusy(false); }
  };
  const start = async (type) => {
    const extra = {};
    if (siteCode.trim()) extra.siteCode = siteCode.trim();
    else { const loc = await currentLocationOnce(); if (loc) extra.location = loc; }
    await send({ type, ...extra }, null, type === 'START' ? 'Job started.' : 'Resumed.');
  };
  const photo = async (fromLibrary, checklistItemId) => {
    setErr(''); setOk('');
    try {
      const f = await takeJobPhoto({ fromLibrary }); if (!f) return;
      if (f.size && f.size > 4 * 1024 * 1024) throw new Error('That file is larger than 4 MB.');
      setBusy(true);
      let blob; const token = await getStoredSessionToken();
      try { blob = await (await fetch(f.uri)).blob(); } catch { throw new Error('Could not read the photo.'); }
      const qs = new URLSearchParams({ orgId, filename: f.name.includes('.') ? f.name : `${f.name}.jpg`, ...(checklistItemId ? { checklistItemId } : {}) }).toString();
      let res; try { res = await fetch(`${API_BASE}/api/orgs/ops/jobs/${jobId}/evidence?${qs}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: blob }); }
      catch { await queued('photo', { checklistItemId: checklistItemId || null }, { uri: f.uri, name: f.name.includes('.') ? f.name : `${f.name}.jpg` }); return; }
      const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || `Upload failed (${res.status}).`);
      setOk('Photo attached.'); await load();
    } catch (e) { setErr(e.message || 'Could not attach the photo.'); }
    finally { setBusy(false); }
  };
  const findParts = async (q) => { setPartQ(q); try { const r = await orgFetch(`/api/orgs/ops/lookups?orgId=${orgId}&kind=products&q=${encodeURIComponent(q)}`); setParts(r.items || []); } catch { setParts([]); } };

  if (!d && !err) return <View style={styles.center}><ActivityIndicator color={colors.cyan} /></View>;
  if (!d) return <View style={styles.center}><Text style={styles.error}>{err}</Text></View>;
  const j = d.job; const w0 = (j.workers || []).find((x) => x.email === me?.email) || { state: 'NOT_STARTED', ack: false };
  // While actions wait on this phone, show the state they will produce (clearly marked as not sent yet).
  const waiting = queue.filter((x) => x.status === 'pending' && x.kind === 'activity');
  const w = waiting.reduce((acc, x) => ({ ...acc, ...(x.body.type === 'ACK' ? { ack: true } : {}), state: { START: 'ACTIVE', RESUME: 'ACTIVE', PAUSE: 'PAUSED', SUBMIT: 'SUBMITTED' }[x.body.type] || acc.state }), w0);
  const assigned = (j.assignments || []).some((a) => a.email === me?.email);
  const finished = ['COMPLETED', 'CLOSED', 'INVOICED', 'CANCELLED', 'READY_FOR_COLLECTION'].includes(j.status);
  const B = ({ label, onPress, primary, danger, disabled }) => <TouchableOpacity style={[styles.btn, primary && styles.primary, danger && styles.danger]} disabled={busy || disabled} onPress={onPress} accessibilityRole="button"><Text style={[styles.btnText, primary && styles.primaryText]}>{label}</Text></TouchableOpacity>;
  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      {!!err && <Text style={styles.error} accessibilityLiveRegion="polite">{err}</Text>}
      {!!ok && <Text style={[styles.warn, { color: colors.success, marginBottom: spacing.md }]}>{ok}</Text>}
      {!!queue.length && <View style={[styles.card, { borderColor: colors.warning }]}>
        <Text style={styles.h}>On this phone, not on the server yet</Text>
        {queue.map((x) => <Text key={x.key} style={x.status === 'failed' ? styles.error : styles.muted}>• {x.kind === 'activity' ? human(x.body.type) : human(x.kind)} · {new Date(x.doneAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {LABEL[x.status] || x.status}{x.error ? ` – ${x.error}` : ''}</Text>)}
        <View style={styles.row}><B label="Send now" onPress={sync} />{queue.some((x) => x.status !== 'pending') && <B label="Clear finished" onPress={() => dismiss(queue.filter((x) => x.status !== 'pending').map((x) => x.key))} />}</View>
      </View>}
      <View style={styles.card}>
        <Text style={styles.big}>{j.number}</Text><Text style={styles.jobTitle}>{j.title}</Text>
        <Text style={styles.muted}>{human(j.status)} · {j.priority} · {when(j.plannedStart)}</Text>
        {!!j.customerName && <Text style={styles.muted}>Customer: {j.customerName}{d.asset ? ` · ${d.asset.label}` : ''}</Text>}
        {!!j.site && <Text style={styles.muted}>Site: {j.site}</Text>}
        {!!j.description && <Text style={[styles.muted, { marginTop: spacing.sm }]}>{j.description}</Text>}
        {!!j.intake?.reportedIssue && <Text style={[styles.muted, { marginTop: spacing.sm }]}>Reported issue: {j.intake.reportedIssue}</Text>}
        {j.pendingChangeOrder && <Text style={styles.warn}>Waiting for the customer to approve extra work.</Text>}
      </View>

      {assigned && !finished && <View style={styles.card}>
        <Text style={styles.h}>My work · {human(w.state)}{w.minutes ? ` · ${w.minutes} min` : ''}</Text>
        {!w.ack && <B label="Acknowledge job" onPress={() => send({ type: 'ACK' }, null, 'Acknowledged.')} />}
        {w.state === 'NOT_STARTED' && <>
          <Text style={styles.tiny}>If this site has a code, scan or type it before you start.</Text>
          <View style={styles.row}><TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} placeholder="Site code (optional)" placeholderTextColor={colors.textMuted} autoCapitalize="characters" value={siteCode} onChangeText={setSiteCode} />{caps.scanner && <B label="Scan" onPress={() => setScan(true)} />}</View>
          <View style={styles.row}><B label="Start job" primary onPress={() => start('START')} /></View>
        </>}
        {w.state === 'ACTIVE' && <View style={styles.row}><B label="Pause" onPress={() => setPausing(true)} /><B label="Submit for completion" primary onPress={() => Alert.alert('Submit this job?', 'Your manager will check it. Make sure the checklist and photos are done.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => send({ type: 'SUBMIT', note }, null, 'Submitted for inspection.') }])} /></View>}
        {w.state === 'PAUSED' && <View style={styles.row}><B label="Resume" primary onPress={() => start('RESUME')} /><B label="Submit for completion" onPress={() => send({ type: 'SUBMIT', note }, null, 'Submitted for inspection.')} /></View>}
        {w.state === 'SUBMITTED' && <Text style={styles.muted}>Submitted. Waiting for your manager.</Text>}
        {pending && !busy && <View style={styles.row}><Text style={styles.warn}>Not confirmed.</Text><B label="Try again" onPress={() => send(pending.body, pending.key)} /></View>}
        <View style={styles.row}><B label="Flag to manager" danger onPress={() => setFlagging(true)} /></View>
      </View>}

      {!!j.checklist?.length && <View style={styles.card}><Text style={styles.h}>Checklist</Text>{j.checklist.map((x) => (
        <View key={x.id} style={[styles.job, { alignItems: 'flex-start' }]}>
          <TouchableOpacity style={[styles.btn, { minWidth: 52, marginRight: spacing.md }, x.done && styles.primary]} disabled={busy || !assigned || finished} onPress={() => post('checklist', { itemId: x.id, done: !x.done })} accessibilityRole="checkbox" accessibilityState={{ checked: !!x.done }} accessibilityLabel={x.text}><Text style={[styles.btnText, x.done && styles.primaryText]}>{x.done ? '✓' : ' '}</Text></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.jobTitle}>{x.text}</Text>{x.required && <Text style={styles.tiny}>Required</Text>}{x.evidence && <View style={styles.row}><Text style={styles.warn}>Photo needed</Text>{assigned && !finished && <B label="Add photo" onPress={() => photo(false, x.id)} />}</View>}</View>
        </View>))}</View>}

      <View style={styles.card}><Text style={styles.h}>Photos and documents ({j.evidence?.length || 0})</Text>
        {(j.evidence || []).map((e) => <Text key={e.id} style={styles.muted}>• {e.name} · {when(e.at)}</Text>)}
        {assigned && !finished && <View style={styles.row}>{caps.camera && <B label="Take photo" onPress={() => photo(false)} />}<B label={caps.camera ? 'From gallery' : 'Attach photo / PDF'} onPress={() => photo(true)} /></View>}
      </View>

      <View style={styles.card}><Text style={styles.h}>Parts</Text>
        {(j.parts || []).map((p) => <Text key={p.id} style={styles.muted}>• {p.name} × {p.qty}{p.requested && !p.approved ? ' (requested)' : ''} · used {p.consumed}</Text>)}
        {assigned && !finished && <>
          <TextInput style={styles.input} placeholder="Search a part to request" placeholderTextColor={colors.textMuted} value={partQ} onChangeText={findParts} />
          {parts.slice(0, 6).map((p) => <TouchableOpacity key={p.id} style={styles.job} onPress={() => Alert.alert('Request part', `${partQty} × ${p.name}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Request', onPress: () => { setParts([]); setPartQ(''); post('parts', { productId: p.id, quantity: Number(partQty) || 1, request: true }, 'Parts request sent to your manager.'); } }])}><Text style={styles.jobTitle}>{p.name}{p.sku ? ` (${p.sku})` : ''}</Text></TouchableOpacity>)}
          <TextInput style={[styles.input, { maxWidth: 120 }]} keyboardType="numeric" value={partQty} onChangeText={setPartQty} accessibilityLabel="Quantity" />
          {(j.parts || []).filter((p) => p.approved && p.qty - p.consumed > 0).map((p) => <View key={`u${p.id}`} style={styles.row}><Text style={[styles.muted, { flex: 1 }]}>Used {p.name}?</Text><B label="Record used" onPress={() => { const k = reqKey(); setBusy(true); orgFetch(`/api/orgs/ops/jobs/${jobId}/parts/${p.id}`, { method: 'POST', body: { orgId, action: 'consume', quantity: p.qty - p.consumed, idempotencyKey: k } }).then(() => { setOk('Recorded.'); load(); }).catch((e) => setErr(e.message)).finally(() => setBusy(false)); }} /></View>)}
        </>}
      </View>

      <View style={styles.card}><Text style={styles.h}>Notes</Text>
        {(j.notes || []).map((n) => <View key={n.id} style={{ marginBottom: spacing.sm }}><Text style={styles.tiny}>{n.by} · {when(n.at)}</Text><Text style={styles.muted}>{n.text}</Text></View>)}
        <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline placeholder="Work notes or findings" placeholderTextColor={colors.textMuted} value={note} onChangeText={setNote} />
        <View style={styles.row}><B label="Add note" disabled={!note.trim()} onPress={() => post('notes', { text: note }, 'Note added.').then(() => setNote(''))} /></View>
      </View>

      <Modal visible={pausing} transparent animationType="slide" onRequestClose={() => setPausing(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}><View style={[styles.card, { margin: 0 }]}>
          <Text style={styles.h}>Why are you pausing?</Text>
          {PAUSE.map(([k, l]) => <TouchableOpacity key={k} style={styles.job} onPress={() => { setPausing(false); if (k === 'other' && note.trim().length < 3) { setErr('Type a short note first, then pause with "Other".'); return; } send({ type: 'PAUSE', reason: k, note }, null, 'Paused.'); }}><Text style={styles.jobTitle}>{l}</Text></TouchableOpacity>)}
          <B label="Cancel" onPress={() => setPausing(false)} />
        </View></View>
      </Modal>
      <Modal visible={flagging} transparent animationType="slide" onRequestClose={() => setFlagging(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}><View style={[styles.card, { margin: 0 }]}>
          <Text style={styles.h}>What do you want to flag? (add details in the note box first)</Text>
          {FLAGS.map(([k, l]) => <TouchableOpacity key={k} style={styles.job} onPress={() => { setFlagging(false); send({ type: 'FLAG', reason: k, note }, null, 'Your manager has been told.'); }}><Text style={styles.jobTitle}>{l}</Text></TouchableOpacity>)}
          <B label="Cancel" onPress={() => setFlagging(false)} />
        </View></View>
      </Modal>
      <Modal visible={!!Cam} animationType="slide" onRequestClose={() => setScan(false)}>
        {Cam && <ScannerView Cam={Cam} onCode={(v) => { setSiteCode(String(v).toUpperCase().slice(0, 40)); setScan(false); }} onClose={() => setScan(false)} />}
      </Modal>
    </ScrollView>
  );
}

function ScannerView({ Cam, onCode, onClose }) {
  const [perm, requestPerm] = Cam.useCameraPermissions(); const [done, setDone] = useState(false);
  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) withSystemUi(() => requestPerm()); }, [perm, requestPerm]);
  if (!perm) return <View style={styles.center}><ActivityIndicator color={colors.cyan} /></View>;
  if (!perm.granted) return <View style={styles.center}><Text style={styles.error}>Camera access was not allowed. Type the site code instead.</Text><TouchableOpacity style={styles.btn} onPress={onClose}><Text style={styles.btnText}>Close</Text></TouchableOpacity></View>;
  return <View style={{ flex: 1, backgroundColor: '#000' }}>
    <Cam.CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }} onBarcodeScanned={done ? undefined : (r) => { setDone(true); onCode(r.data); }} />
    <TouchableOpacity style={[styles.btn, { margin: spacing.lg }]} onPress={onClose}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
  </View>;
}
