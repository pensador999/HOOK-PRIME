/**
 * @module config/clickup-sync
 * Regras da sincronização HUB → quadro de cadastro do ClickUp (Fase 1 "ClickUp vivo").
 *
 * O HUB guarda, em cada task, até onde o card do ClickUp já foi movido (`synced`) e até onde
 * ele deveria estar (`want`). O script do Tampermonkey pede a próxima movimentação e devolve
 * o resultado. Regras de segurança:
 *   - só tasks com link real de task do ClickUp (app.clickup.com/t/...);
 *   - só avança (A Fazer → Em Execução → Completo), um passo por vez, nunca volta.
 */
'use strict';

const ORDER = ['pending', 'in_progress', 'done'];
const CLICKUP_NAMES = { pending: '1. A Fazer', in_progress: '2. Em Execução', done: '3. Completo' };
const MAX_ATTEMPTS = 3;

const idx = (s) => ORDER.indexOf(s);
const isClickupTaskUrl = (url) => /^https:\/\/app\.clickup\.com\/t\/[^/?#\s]+/i.test(String(url || ''));

/** Chamado sempre que o status de uma task muda no HUB. Nunca agenda volta. */
function onStatusChange(task, newStatus) {
  if (!task || idx(newStatus) < 0) return task;
  const sync = task.clickupSync || { synced: 'pending', want: 'pending', attempts: 0, lastError: null };
  if (idx(newStatus) > idx(sync.want)) {
    sync.want = newStatus;
    sync.attempts = 0;
    sync.lastError = null;
    sync.updatedAt = new Date().toISOString();
  }
  task.clickupSync = sync;
  return task;
}

/** Próximo passo de uma task (ou null). Um passo por vez — nunca pula. */
function nextStep(task) {
  const s = task && task.clickupSync;
  if (!s || !isClickupTaskUrl(task.url)) return null;
  if (idx(s.want) <= idx(s.synced)) return null;
  if ((s.attempts || 0) >= MAX_ATTEMPTS) return null;
  const to = ORDER[idx(s.synced) + 1];
  return { id: task.id, title: task.title, url: task.url, from: s.synced, to, fromName: CLICKUP_NAMES[s.synced], toName: CLICKUP_NAMES[to], attempts: s.attempts || 0 };
}

const pendingSteps = (tasks) => (tasks || []).map(nextStep).filter(Boolean);

/**
 * Aplica o resultado enviado pelo script.
 * @param {{ok:boolean, dryRun?:boolean, observed?:string, error?:string, to:string}} r
 *   observed = status que o script LEU no card (pending|in_progress|done), se conseguiu ler.
 */
function applyResult(task, r) {
  const s = task.clickupSync;
  if (!s) return { changed: false, reason: 'task sem sincronização' };
  const now = new Date().toISOString();
  if (r.dryRun) { s.lastTest = { at: now, ok: !!r.ok, error: r.error || null, observed: r.observed || null }; return { changed: false, reason: 'teste' }; }
  // Se o card já está no destino (ou além), apenas registra — nunca volta.
  if (r.observed && idx(r.observed) > idx(s.synced)) {
    s.synced = ORDER[Math.min(idx(r.observed), idx(s.want))];
  }
  if (r.ok && idx(r.to) === idx(s.synced) + 1) s.synced = r.to;
  if (r.ok || (r.observed && idx(r.observed) >= idx(r.to))) {
    s.attempts = 0; s.lastError = null; s.lastSyncAt = now;
    return { changed: true };
  }
  s.attempts = (s.attempts || 0) + 1;
  s.lastError = r.error || 'falha desconhecida';
  s.lastErrorAt = now;
  return { changed: false, reason: s.lastError };
}

module.exports = { ORDER, CLICKUP_NAMES, MAX_ATTEMPTS, isClickupTaskUrl, onStatusChange, nextStep, pendingSteps, applyResult };
