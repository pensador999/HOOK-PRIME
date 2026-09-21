/* ═══════════════════════════════════════════════════════════════
   Pipeline Dashboard — Memória dos Códigos
   Integrado na SPA do Hub, acessível via sidebar #pipeline
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const STEP_LABELS = {
    hookPrime: '② HOOK PRIME',
    ean: '③ EAN',
    sankhya: '④ Sankhya',
    bling: '⑤ Bling',
    shopify: '⑦ Shopify IDs',
    magis5Import: '⑨ Magis5 Import',
    magis5Estoque: '⑪ Estoque 1000',
  };

  const STEP_COLORS = {
    hookPrime: '#10b981',
    ean: '#f59e0b',
    sankhya: '#f59e0b',
    bling: '#f59e0b',
    shopify: '#a855f7',
    magis5Import: '#a855f7',
    magis5Estoque: '#10b981',
  };

  let _refreshInterval = null;

  function statusIcon(s) {
    if (s === 'done') return '<span style="color:#10b981">✅</span>';
    if (s === 'error') return '<span style="color:#ef4444">🔴</span>';
    return '<span style="color:#475569">⏳</span>';
  }

  function esc(s) {
    return window.HUB?.esc?.(s) ?? String(s || '');
  }

  // ── Render principal ──
  async function renderPipeline() {
    const container = document.getElementById('app-content');
    if (!container) return;

    container.innerHTML = `
      <div class="page-section" style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div>
            <h2 style="color:var(--accent-primary,#AAFF00);margin:0;font-size:20px;font-weight:800">📋 Pipeline — Memória dos Códigos</h2>
            <p style="color:var(--text-muted,#64748b);font-size:13px;margin:4px 0 0">Acompanhe todos os códigos sendo trabalhados em tempo real</p>
          </div>
          <button onclick="window.HUB._pipelineRefresh?.()" class="btn btn--outline" style="font-size:12px">🔄 Atualizar</button>
        </div>
        <div id="pipeline-container">
          <div style="text-align:center;padding:40px;color:var(--text-muted,#475569)">⏳ Carregando...</div>
        </div>
      </div>`;

    window.HUB._pipelineRefresh = loadAndRender;
    await loadAndRender();

    // Auto-refresh a cada 10s enquanto a página estiver ativa
    clearInterval(_refreshInterval);
    _refreshInterval = setInterval(() => {
      if (window.HUB?.state?.currentPage === 'pipeline') loadAndRender();
      else clearInterval(_refreshInterval);
    }, 10000);
  }

  async function loadAndRender() {
    const target = document.getElementById('pipeline-container');
    if (!target) return;

    try {
      const res = await fetch('/api/pipeline/sessions');
      const data = await res.json();

      if (!data.success || !data.sessions || data.sessions.length === 0) {
        target.innerHTML = `
          <div style="text-align:center;padding:60px 20px;color:var(--text-muted,#475569)">
            <div style="font-size:48px;margin-bottom:16px">📋</div>
            <div style="font-size:18px;font-weight:700;color:var(--text-secondary,#64748b);margin-bottom:8px">Nenhuma session encontrada</div>
            <div style="font-size:14px">Exporte um CSV no <strong>Lucas RTX</strong> para criar a primeira pipeline session.</div>
          </div>`;
        return;
      }

      // Busca detalhes da session mais recente
      const activeId = data.sessions[0].id;
      const detailRes = await fetch(`/api/pipeline/sessions/${activeId}`);
      const detailData = await detailRes.json();

      if (!detailData.success || !detailData.session) {
        target.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444">Erro ao carregar detalhes</div>';
        return;
      }

      renderSession(target, detailData.session, data.sessions);
    } catch (err) {
      target.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444">Erro: ${esc(err.message)}</div>`;
    }
  }

  function renderSession(target, active, allSessions) {
    // Calcula progresso por etapa
    const steps = {};
    Object.keys(STEP_LABELS).forEach(key => {
      const done = active.codes.filter(c => c.pipeline[key]?.status === 'done').length;
      const total = key === 'magis5Estoque'
        ? active.codes.filter(c => c.tipo === 'producao').length
        : active.codes.length;
      steps[key] = { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
    });

    const statusLabel = active.status === 'in_progress' ? '🔄 Em Progresso' : '✅ Completo';
    const statusClass = active.status === 'in_progress' ? 'color:#10b981;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3)' : 'color:#3b82f6;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3)';

    let html = `
      <!-- Session Card -->
      <div style="background:var(--bg-card,#1e293b);border-radius:16px;border:1px solid var(--border,#334155);overflow:hidden;margin-bottom:24px">

        <!-- Header -->
        <div style="padding:16px 20px;background:linear-gradient(135deg,#1e1b4b,#0f172a);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border,#334155)">
          <div>
            <span style="font-weight:800;color:#AAFF00;font-size:15px">${esc(active.brand || 'BRK')}</span>
            <span style="color:var(--text-muted,#64748b);margin-left:12px;font-size:12px">${active.codes.length} códigos · ${esc(active.store || '')}</span>
            <span style="color:var(--text-muted,#64748b);margin-left:12px;font-size:12px">Criado: ${new Date(active.createdAt).toLocaleString('pt-BR')}</span>
          </div>
          <span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;${statusClass}">${statusLabel}</span>
        </div>

        <!-- Progress bars -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:16px 20px">
          ${Object.entries(STEP_LABELS).map(([key, label]) => {
            const s = steps[key];
            const color = STEP_COLORS[key];
            return `
              <div style="background:var(--bg-primary,#0f172a);border-radius:10px;padding:12px;border:1px solid var(--border-subtle,#1e293b)">
                <div style="font-size:11px;color:var(--text-muted,#64748b);font-weight:600;text-transform:uppercase;margin-bottom:6px">${label}</div>
                <div style="height:6px;background:var(--border-subtle,#1e293b);border-radius:3px;overflow:hidden;margin-bottom:6px">
                  <div style="height:100%;width:${s.pct}%;background:${color};border-radius:3px;transition:width .5s"></div>
                </div>
                <div style="font-size:13px;font-weight:700;color:var(--text-primary,#e2e8f0)">${s.done}/${s.total} ${s.pct === 100 ? '✅' : s.done > 0 ? '🔄' : '⏳'}</div>
              </div>`;
          }).join('')}
        </div>

        <!-- Botões de ação para etapas manuais -->
        <div style="padding:12px 20px;background:var(--bg-primary,#0f172a);display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border,#334155)">
          <button onclick="window.HUB._pipelineMarkStep?.('ean')" class="btn btn--outline" style="font-size:11px;padding:6px 14px">✅ Marcar EAN Concluído</button>
          <button onclick="window.HUB._pipelineMarkStep?.('sankhya')" class="btn btn--outline" style="font-size:11px;padding:6px 14px">✅ Marcar Sankhya Concluído</button>
          <button onclick="window.HUB._pipelineMarkStep?.('bling')" class="btn btn--outline" style="font-size:11px;padding:6px 14px">✅ Marcar Bling Concluído</button>
        </div>

        <!-- Tabela de códigos -->
        <div style="max-height:50vh;overflow:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg-primary,#0f172a);position:sticky;top:0;z-index:1">
                <th style="text-align:left;padding:10px 12px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Código</th>
                <th style="text-align:left;padding:10px 12px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Estampa</th>
                <th style="text-align:left;padding:10px 12px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Tipo</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">HOOK</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">EAN</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">SKY</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">BLING</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">SHOP</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">M5</th>
                <th style="text-align:center;padding:10px 8px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">EST</th>
              </tr>
            </thead>
            <tbody>
              ${active.codes.map(c => `
                <tr style="border-bottom:1px solid var(--border-subtle,#1e293b)">
                  <td style="padding:10px 12px;font-family:monospace;font-weight:700;color:#AAFF00;font-size:13px">${esc(c.base)}</td>
                  <td style="padding:10px 12px;color:#a78bfa;font-size:13px">${esc(c.estampa || '—')}</td>
                  <td style="padding:10px 12px;font-size:12px;font-weight:600;color:${c.tipo === 'producao' ? '#10b981' : '#f59e0b'}">${c.tipo === 'producao' ? '🏭 PROD' : '📦 REV'}</td>
                  <td style="text-align:center;padding:10px 8px">${statusIcon(c.pipeline.hookPrime?.status)}</td>
                  <td style="text-align:center;padding:10px 8px">${statusIcon(c.pipeline.ean?.status)}</td>
                  <td style="text-align:center;padding:10px 8px">${statusIcon(c.pipeline.sankhya?.status)}</td>
                  <td style="text-align:center;padding:10px 8px">${statusIcon(c.pipeline.bling?.status)}</td>
                  <td style="text-align:center;padding:10px 8px">${statusIcon(c.pipeline.shopify?.status)}</td>
                  <td style="text-align:center;padding:10px 8px">${statusIcon(c.pipeline.magis5Import?.status)}</td>
                  <td style="text-align:center;padding:10px 8px">${c.tipo === 'producao' ? statusIcon(c.pipeline.magis5Estoque?.status) : '<span style="color:#6b7280">—</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${allSessions.length > 1 ? `
        <h3 style="color:var(--text-muted,#64748b);font-size:14px;margin:24px 0 12px">Sessões Anteriores</h3>
        ${allSessions.slice(1, 10).map(s => `
          <div style="background:var(--bg-card,#1e293b);border-radius:10px;padding:12px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;border:1px solid var(--border,#334155)">
            <div>
              <span style="font-weight:700;color:var(--text-secondary,#94a3b8)">${esc(s.brand || 'BRK')}</span>
              <span style="color:var(--text-muted,#475569);margin-left:8px;font-size:12px">${s.totalCodes} códigos</span>
            </div>
            <span style="color:var(--text-muted,#475569);font-size:12px">${new Date(s.createdAt).toLocaleString('pt-BR')}</span>
          </div>
        `).join('')}
      ` : ''}
    `;

    target.innerHTML = html;
  }

  // ── Marcar etapa manual como concluída ──
  window.HUB._pipelineMarkStep = async function (step) {
    if (!confirm(`Marcar "${step.toUpperCase()}" como concluído para TODOS os códigos?`)) return;
    try {
      const res = await fetch('/api/pipeline/mark-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      const data = await res.json();
      if (data.success) {
        window.HUB.showToast?.(`✅ ${step.toUpperCase()} concluído para ${data.codesUpdated} códigos`, 'success');
        loadAndRender();
      }
    } catch (err) {
      window.HUB.showToast?.('Erro: ' + err.message, 'error');
    }
  };

  // ── Expõe render para a SPA ──
  window.HUB = window.HUB || {};
  window.HUB.renderPipeline = renderPipeline;
})();
