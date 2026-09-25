/* ═══════════════════════════════════════════════════════════════
   Pipeline Dashboard v2.0 — Máquina Autônoma de Cadastro
   Integrado na SPA do Hub, acessível via sidebar #pipeline

   Melhorias v2.0:
   - Sessões históricas clicáveis (Fix B9)
   - Filtros por status (Todos, Pendentes, Erros, Prod, Rev)
   - Busca por código/estampa
   - Barra de progresso global
   - Tooltip com detalhes no hover
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
  let _activeSessionId = null;
  let _allSessions = [];
  let _currentFilter = 'all';
  let _searchQuery = '';

  function statusIcon(s, details) {
    if (s === 'done') return '<span style="color:#10b981;cursor:default" title="Concluído">✅</span>';
    if (s === 'error') {
      const tooltip = details ? `Erro: ${esc(details)}` : 'Erro — clique para detalhes';
      return `<span style="color:#ef4444;cursor:help" title="${esc(tooltip)}">🔴</span>`;
    }
    return '<span style="color:#475569;cursor:default" title="Pendente">⏳</span>';
  }

  function esc(s) {
    return window.HUB?.esc?.(s) ?? String(s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(d) {
    try { return new Date(d).toLocaleString('pt-BR'); } catch (_) { return d || '—'; }
  }

  // ── Render principal ──
  async function renderPipeline() {
    const container = document.getElementById('app-content');
    if (!container) return;

    container.innerHTML = `
      <div class="page-section" style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
          <div>
            <h2 style="color:var(--accent-primary,#AAFF00);margin:0;font-size:20px;font-weight:800">📋 Pipeline RTX — Máquina de Cadastro</h2>
            <p style="color:var(--text-muted,#64748b);font-size:13px;margin:4px 0 0">Acompanhe todos os códigos em tempo real · Auto-refresh 10s</p>
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

      _allSessions = data.sessions;

      // Se não há session selecionada, usar a primeira (mais recente)
      if (!_activeSessionId || !_allSessions.find(s => s.id === _activeSessionId)) {
        _activeSessionId = data.sessions[0].id;
      }

      // Busca detalhes da session selecionada
      const detailRes = await fetch(`/api/pipeline/sessions/${_activeSessionId}`);
      const detailData = await detailRes.json();

      if (!detailData.success || !detailData.session) {
        target.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444">Erro ao carregar detalhes</div>';
        return;
      }

      renderSession(target, detailData.session, _allSessions);
    } catch (err) {
      target.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444">Erro: ${esc(err.message)}</div>`;
    }
  }

  function renderSession(target, active, allSessions) {
    // Calcula progresso por etapa
    const steps = {};
    let totalStepsDone = 0;
    let totalStepsTotal = 0;
    Object.keys(STEP_LABELS).forEach(key => {
      const done = active.codes.filter(c => c.pipeline[key]?.status === 'done').length;
      const total = key === 'magis5Estoque'
        ? active.codes.filter(c => c.tipo === 'producao').length
        : active.codes.length;
      steps[key] = { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
      totalStepsDone += done;
      totalStepsTotal += total;
    });

    const globalPct = totalStepsTotal > 0 ? Math.round((totalStepsDone / totalStepsTotal) * 100) : 0;
    const statusLabel = active.status === 'completed' ? '✅ Completo' : active.status === 'cancelled' ? '❌ Cancelado' : '🔄 Em Progresso';
    const statusBg = active.status === 'completed' ? 'rgba(59,130,246,0.1)' : active.status === 'cancelled' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
    const statusBorder = active.status === 'completed' ? 'rgba(59,130,246,0.3)' : active.status === 'cancelled' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)';
    const statusColor = active.status === 'completed' ? '#3b82f6' : active.status === 'cancelled' ? '#ef4444' : '#10b981';

    // Filtrar códigos
    let filteredCodes = active.codes;
    if (_searchQuery) {
      const q = _searchQuery.toLowerCase();
      filteredCodes = filteredCodes.filter(c =>
        (c.base || '').toLowerCase().includes(q) ||
        (c.estampa || '').toLowerCase().includes(q) ||
        (c.titleMasc || '').toLowerCase().includes(q)
      );
    }
    if (_currentFilter === 'pending') {
      filteredCodes = filteredCodes.filter(c =>
        Object.values(c.pipeline).some(p => p?.status === 'pending')
      );
    } else if (_currentFilter === 'error') {
      filteredCodes = filteredCodes.filter(c =>
        Object.values(c.pipeline).some(p => p?.status === 'error')
      );
    } else if (_currentFilter === 'prod') {
      filteredCodes = filteredCodes.filter(c => c.tipo === 'producao');
    } else if (_currentFilter === 'rev') {
      filteredCodes = filteredCodes.filter(c => c.tipo === 'revenda');
    }

    const errorCount = active.codes.filter(c => Object.values(c.pipeline).some(p => p?.status === 'error')).length;
    const pendingCount = active.codes.filter(c => Object.values(c.pipeline).some(p => p?.status === 'pending')).length;
    const prodCount = active.codes.filter(c => c.tipo === 'producao').length;
    const revCount = active.codes.filter(c => c.tipo === 'revenda').length;

    let html = `
      <!-- Session selector (se há mais de 1) -->
      ${allSessions.length > 1 ? `
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12px;color:var(--text-muted,#64748b);font-weight:700">SESSÕES:</span>
          ${allSessions.slice(0, 10).map(s => `
            <button onclick="window.HUB._pipelineSelectSession?.('${s.id}')"
              style="padding:4px 12px;border-radius:16px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid ${s.id === active.id ? '#AAFF00' : 'var(--border,#334155)'};
              background:${s.id === active.id ? 'rgba(170,255,0,0.1)' : 'var(--bg-card,#1e293b)'};
              color:${s.id === active.id ? '#AAFF00' : 'var(--text-muted,#64748b)'}">
              ${esc(s.brand || 'BRK')} · ${s.totalCodes || '?'}c · ${s.status === 'completed' ? '✅' : s.status === 'cancelled' ? '❌' : '🔄'}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <!-- Session Card -->
      <div style="background:var(--bg-card,#1e293b);border-radius:16px;border:1px solid var(--border,#334155);overflow:hidden;margin-bottom:24px">

        <!-- Header -->
        <div style="padding:16px 20px;background:linear-gradient(135deg,#1e1b4b,#0f172a);display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border,#334155)">
          <div>
            <span style="font-weight:800;color:#AAFF00;font-size:15px">${esc(active.brand || 'BRK')}</span>
            <span style="color:var(--text-muted,#64748b);margin-left:12px;font-size:12px">${active.codes.length} códigos · ${esc(active.store || '')}</span>
            <span style="color:var(--text-muted,#64748b);margin-left:12px;font-size:12px">Criado: ${formatDate(active.createdAt)}</span>
          </div>
          <span style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;color:${statusColor};background:${statusBg};border:1px solid ${statusBorder}">${statusLabel}</span>
        </div>

        <!-- Global progress bar -->
        <div style="padding:12px 20px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--border,#334155)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;color:var(--text-muted,#64748b);font-weight:700">PROGRESSO GLOBAL</span>
            <span style="font-size:14px;font-weight:800;color:${globalPct === 100 ? '#10b981' : '#AAFF00'}">${globalPct}%</span>
          </div>
          <div style="height:8px;background:var(--border-subtle,#1e293b);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${globalPct}%;background:linear-gradient(90deg,#AAFF00,#10b981);border-radius:4px;transition:width .5s"></div>
          </div>
        </div>

        <!-- Progress bars per step -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;padding:14px 20px">
          ${Object.entries(STEP_LABELS).map(([key, label]) => {
            const s = steps[key];
            const color = STEP_COLORS[key];
            return `
              <div style="background:var(--bg-primary,#0f172a);border-radius:10px;padding:10px;border:1px solid var(--border-subtle,#1e293b)">
                <div style="font-size:10px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;margin-bottom:4px">${label}</div>
                <div style="height:5px;background:var(--border-subtle,#1e293b);border-radius:3px;overflow:hidden;margin-bottom:4px">
                  <div style="height:100%;width:${s.pct}%;background:${color};border-radius:3px;transition:width .5s"></div>
                </div>
                <div style="font-size:12px;font-weight:700;color:var(--text-primary,#e2e8f0)">${s.done}/${s.total} ${s.pct === 100 ? '✅' : s.done > 0 ? '🔄' : '⏳'}</div>
              </div>`;
          }).join('')}
        </div>

        <!-- Action buttons -->
        <div style="padding:12px 20px;background:var(--bg-primary,#0f172a);display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border,#334155)">
          <button onclick="window.HUB._pipelineMarkStep?.('ean')" class="btn btn--outline" style="font-size:11px;padding:6px 14px">✅ Marcar EAN</button>
          <button onclick="window.HUB._pipelineMarkStep?.('sankhya')" class="btn btn--outline" style="font-size:11px;padding:6px 14px">✅ Marcar Sankhya</button>
          <button onclick="window.HUB._pipelineMarkStep?.('bling')" class="btn btn--outline" style="font-size:11px;padding:6px 14px">✅ Marcar Bling</button>
        </div>

        <!-- Search + Filters -->
        <div style="padding:12px 20px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border,#334155)">
          <div style="position:relative;flex:1;min-width:200px">
            <input type="text" id="pipeline-search" placeholder="🔍 Buscar código ou estampa..."
              oninput="window.HUB._pipelineSearch?.(this.value)"
              value="${esc(_searchQuery)}"
              style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border,#334155);
              background:var(--bg-primary,#0f172a);color:var(--text-primary,#e2e8f0);font-size:12px;outline:none">
          </div>
          <div style="display:flex;gap:4px">
            ${[
              { key: 'all', label: 'Todos', count: active.codes.length },
              { key: 'pending', label: '⏳ Pendentes', count: pendingCount },
              { key: 'error', label: '🔴 Erros', count: errorCount },
              { key: 'prod', label: '🏭 Prod', count: prodCount },
              { key: 'rev', label: '📦 Rev', count: revCount },
            ].map(f => `
              <button onclick="window.HUB._pipelineFilter?.('${f.key}')"
                style="padding:4px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;
                border:1px solid ${_currentFilter === f.key ? '#AAFF00' : 'var(--border,#334155)'};
                background:${_currentFilter === f.key ? 'rgba(170,255,0,0.1)' : 'transparent'};
                color:${_currentFilter === f.key ? '#AAFF00' : 'var(--text-muted,#64748b)'}">
                ${f.label} (${f.count})
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Codes table -->
        <div style="max-height:50vh;overflow:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:var(--bg-primary,#0f172a);position:sticky;top:0;z-index:1">
                <th style="text-align:left;padding:10px 12px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Código</th>
                <th style="text-align:left;padding:10px 12px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Estampa</th>
                <th style="text-align:left;padding:10px 8px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Gêneros</th>
                <th style="text-align:left;padding:10px 8px;font-size:11px;color:var(--text-muted,#64748b);font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border,#334155)">Tipo</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">HOOK</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">EAN</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">SKY</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">BLING</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">SHOP</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">M5</th>
                <th style="text-align:center;padding:10px 6px;font-size:10px;color:var(--text-muted,#64748b);font-weight:700;border-bottom:1px solid var(--border,#334155)">EST</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCodes.length === 0
                ? `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--text-muted,#475569);font-size:13px">Nenhum código encontrado com o filtro atual</td></tr>`
                : filteredCodes.map(c => {
                  const hasError = Object.values(c.pipeline).some(p => p?.status === 'error');
                  const rowBg = hasError ? 'rgba(239,68,68,0.05)' : 'transparent';
                  const genderBadges = (c.genders || []).map(g => {
                    const colors = { masc: '#3b82f6', fem: '#ec4899', inf: '#f59e0b' };
                    return `<span style="padding:1px 6px;border-radius:4px;font-size:9px;font-weight:700;background:${colors[g] || '#6b7280'}20;color:${colors[g] || '#6b7280'};text-transform:uppercase">${g}</span>`;
                  }).join(' ');
                  return `
                <tr style="border-bottom:1px solid var(--border-subtle,#1e293b);background:${rowBg}">
                  <td style="padding:10px 12px;font-family:monospace;font-weight:700;color:#AAFF00;font-size:13px">${esc(c.base)}</td>
                  <td style="padding:10px 12px;color:#a78bfa;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(c.estampa || '')}">${esc(c.estampa || '—')}</td>
                  <td style="padding:10px 8px">${genderBadges || '—'}</td>
                  <td style="padding:10px 8px;font-size:11px;font-weight:600;color:${c.tipo === 'producao' ? '#10b981' : '#f59e0b'}">${c.tipo === 'producao' ? '🏭 PROD' : '📦 REV'}</td>
                  <td style="text-align:center;padding:10px 6px">${statusIcon(c.pipeline.hookPrime?.status)}</td>
                  <td style="text-align:center;padding:10px 6px">${statusIcon(c.pipeline.ean?.status)}</td>
                  <td style="text-align:center;padding:10px 6px">${statusIcon(c.pipeline.sankhya?.status)}</td>
                  <td style="text-align:center;padding:10px 6px">${statusIcon(c.pipeline.bling?.status)}</td>
                  <td style="text-align:center;padding:10px 6px">${statusIcon(c.pipeline.shopify?.status)}</td>
                  <td style="text-align:center;padding:10px 6px">${statusIcon(c.pipeline.magis5Import?.status, c.pipeline.magis5Import?.error)}</td>
                  <td style="text-align:center;padding:10px 6px">${c.tipo === 'producao' ? statusIcon(c.pipeline.magis5Estoque?.status, c.pipeline.magis5Estoque?.error) : '<span style="color:#6b7280">—</span>'}</td>
                </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Summary footer -->
        <div style="padding:10px 20px;background:var(--bg-primary,#0f172a);border-top:1px solid var(--border,#334155);display:flex;gap:20px;font-size:11px;color:var(--text-muted,#64748b);flex-wrap:wrap">
          <span>📊 ${active.codes.length} códigos</span>
          <span>📋 ${active.summary?.totalVariations || '?'} variações</span>
          <span>🆔 ${active.summary?.shopifyExtracted || 0} IDs Shopify</span>
          <span>📥 ${active.summary?.imported || 0} importados</span>
          <span>📦 ${active.summary?.estoqueOk || 0} estoque ok</span>
          ${active.updatedAt ? `<span>🕐 Última atualização: ${formatDate(active.updatedAt)}</span>` : ''}
        </div>
      </div>
    `;

    target.innerHTML = html;
  }

  // ── Selecionar session (Fix B9) ──
  window.HUB._pipelineSelectSession = function (sessionId) {
    _activeSessionId = sessionId;
    loadAndRender();
  };

  // ── Filtrar ──
  window.HUB._pipelineFilter = function (filter) {
    _currentFilter = filter;
    loadAndRender();
  };

  // ── Buscar ──
  window.HUB._pipelineSearch = function (query) {
    _searchQuery = query;
    loadAndRender();
  };

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
