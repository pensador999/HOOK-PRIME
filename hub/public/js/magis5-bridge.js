/* ═══════════════════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Magis5 Bridge (Central Unificada: Shopify ➔ Sankhya ➔ Magis5)
   Fluxo limpo e organizado em 3 Passos Diretos:
   1. Capturar Anúncios da Shopify (1-Click nas 3 Lojas ou Colar IDs)
   2. Cruzar SKUs com Sankhya em 40ms (CODPROD Exato 1:1 + Classificação)
   3. Executar (Gerar Lista p/ Tampermonkey OU Enviar via API Magis5)
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  window.HUB = window.HUB || {};

  const ACCENT = '#AAFF00';
  const CHANNELS = {
    'BRK FISHING': {
      channelId: 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
      storeKey: 'fishing',
      domain: 'brkfishing.com.br',
    },
    'BRK AGRO': {
      channelId: 'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
      storeKey: 'agro',
      domain: 'brkagro.com.br',
    },
    'BRK MOTORS': {
      channelId: 'shopify-7495282216c04726834a39582e5369dd',
      storeKey: 'motors',
      domain: 'brkmotors.com.br',
    },
  };

  let state = {
    sankhyaConnected: false,
    sankhyaLastCaptured: null,
    magisMode: 'BRIDGE_HYBRID',
    magisConfigured: false,
    discoveredProducts: [], // { id, title, handle, skus: [], classification: 'producao'|'revenda_full'|'kit' }
    skuMap: new Map(),      // SKU_SHOPIFY -> CODPROD_SANKHYA
    showSettings: false,
  };

  async function loadStatus() {
    try {
      const [revRes, magisRes] = await Promise.all([
        fetch('/api/reverse-map/status').then(r => r.json()).catch(() => null),
        fetch('/api/magis5/status').then(r => r.json()).catch(() => null),
      ]);

      if (revRes && revRes.sankhyaSession) {
        state.sankhyaConnected = Boolean(revRes.sankhyaSession.connected);
        state.sankhyaLastCaptured = revRes.sankhyaSession.lastCapturedAt;
      }
      if (magisRes) {
        state.magisMode = magisRes.mode || 'BRIDGE_HYBRID';
        state.magisConfigured = Boolean(magisRes.configured);
      }
      updateStatusHeader();
    } catch (e) {
      console.warn('[Magis5 Bridge] Falha ao carregar status:', e);
    }
  }

  function updateStatusHeader() {
    const skBadge = document.getElementById('m5-badge-sankhya');
    const mgBadge = document.getElementById('m5-badge-magis');

    if (skBadge) {
      if (state.sankhyaConnected) {
        skBadge.style.background = 'rgba(16,185,129,0.12)';
        skBadge.style.borderColor = 'rgba(16,185,129,0.35)';
        skBadge.style.color = '#10b981';
        skBadge.innerHTML = '🟢 Sankhya API Direta: Conectada (40ms)';
      } else {
        skBadge.style.background = 'rgba(245,158,11,0.12)';
        skBadge.style.borderColor = 'rgba(245,158,11,0.35)';
        skBadge.style.color = '#f59e0b';
        skBadge.innerHTML = '🟡 Sankhya API: Aguardando Sessão (Clique em ⚙️)';
      }
    }

    if (mgBadge) {
      if (state.magisConfigured) {
        mgBadge.style.background = 'rgba(16,185,129,0.12)';
        mgBadge.style.borderColor = 'rgba(16,185,129,0.35)';
        mgBadge.style.color = '#10b981';
        mgBadge.innerHTML = '🟢 Magis5 API Oficial: Ativa';
      } else {
        mgBadge.style.background = 'rgba(56,189,248,0.12)';
        mgBadge.style.borderColor = 'rgba(56,189,248,0.35)';
        mgBadge.style.color = '#38bdf8';
        mgBadge.innerHTML = '⚡ Modo Híbrido (Tampermonkey + Fila Pronta)';
      }
    }
  }

  function render() {
    const container = document.getElementById('app-content');
    if (!container) return;

    const channelOpts = Object.keys(CHANNELS).map(name =>
      `<option value="${name}">${name} (${CHANNELS[name].domain})</option>`
    ).join('');

    container.innerHTML = `
      <div style="max-width:1080px;margin:0 auto;padding:18px 0 36px;display:flex;flex-direction:column;gap:18px">

        <!-- BARRA SUPERIOR DE STATUS E CONFIGURAÇÃO -->
        <div class="card card--glow" style="padding:20px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <h2 style="margin:0;color:${ACCENT};font-size:20px">📦 Central Shopify ➔ Sankhya ➔ Magis5</h2>
              <span style="font-size:11px;padding:3px 8px;border-radius:999px;background:rgba(170,255,0,0.12);color:${ACCENT};font-weight:700">FLUXO EM 3 PASSOS</span>
            </div>
            <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">
              Capture anúncios da Shopify, busque o <code>CODPROD</code> no Sankhya em 40ms e envie para a Magis5 sem bagunça.
            </p>
          </div>

          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span id="m5-badge-sankhya" style="font-size:12px;padding:6px 12px;border-radius:999px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.12);color:#f59e0b;font-weight:600">
              ⏳ Verificando Sankhya...
            </span>
            <span id="m5-badge-magis" style="font-size:12px;padding:6px 12px;border-radius:999px;border:1px solid rgba(56,189,248,0.35);background:rgba(56,189,248,0.12);color:#38bdf8;font-weight:600">
              ⚡ Modo Híbrido
            </span>
            <button id="m5-btn-toggle-settings" class="btn btn--secondary btn--sm" style="padding:6px 12px">
              ⚙️ Conexões & Tokens
            </button>
          </div>
        </div>

        <!-- GAVETA DE CONFIGURAÇÃO (OCULTA POR PADRÃO PARA NÃO POLUIR) -->
        <div id="m5-settings-drawer" class="card" style="display:none;padding:20px 24px;border:1px solid rgba(170,255,0,0.3);background:#0c1322">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="margin:0;color:${ACCENT};font-size:15px">⚙️ Configurar Conexão Direta Sankhya (40ms) & API Magis5</h3>
            <div style="display:flex;gap:8px">
              <a href="/userscripts" target="_blank" class="btn btn--secondary btn--sm" style="font-size:11px">🕵️ Instalar Sniffer Automático</a>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <!-- Coluna Sankhya -->
            <div style="background:#111827;padding:14px;border-radius:10px;border:1px solid #1e293b">
              <div style="font-weight:700;font-size:13px;color:#e2e8f0;margin-bottom:6px">1. Sessão Sankhya (Cookie <code>sktk</code> + <code>mgeSession</code>)</div>
              <p style="font-size:11px;color:#94a3b8;margin:0 0 10px">
                Com o Sniffer Tampermonkey instalado, isso é capturado sozinho ao abrir o Sankhya. Ou cole abaixo manualmente:
              </p>
              <div style="display:flex;flex-direction:column;gap:8px">
                <input id="m5-cfg-sktk" type="text" placeholder="Cookie sktk (ou string completa de cookies)" style="padding:8px 10px;border-radius:6px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-size:12px">
                <input id="m5-cfg-mge" type="text" placeholder="mgeSession (JSESSIONID da URL do Sankhya)" style="padding:8px 10px;border-radius:6px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-size:12px">
                <button id="m5-btn-save-sankhya" class="btn btn--primary btn--sm">💾 Salvar Sessão Sankhya</button>
              </div>
            </div>

            <!-- Coluna Magis5 -->
            <div style="background:#111827;padding:14px;border-radius:10px;border:1px solid #1e293b">
              <div style="font-weight:700;font-size:13px;color:#e2e8f0;margin-bottom:6px">2. Chave de API Magis5 (Para quando o suporte liberar)</div>
              <p style="font-size:11px;color:#94a3b8;margin:0 0 10px">
                Quando tiver o Token da API Oficial da Magis5, cole aqui para importar direto sem Tampermonkey:
              </p>
              <div style="display:flex;flex-direction:column;gap:8px">
                <input id="m5-cfg-magis-token" type="password" placeholder="X-Magis5-Api-Key / Bearer Token" style="padding:8px 10px;border-radius:6px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-size:12px">
                <input id="m5-cfg-magis-url" type="text" value="https://app.magis5.com.br" placeholder="URL Base Magis5" style="padding:8px 10px;border-radius:6px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-size:12px">
                <button id="m5-btn-save-magis" class="btn btn--secondary btn--sm">🔑 Salvar Token Magis5</button>
              </div>
            </div>
          </div>
        </div>

        <!-- GRADE PRINCIPAL DOS 3 PASSOS -->
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;align-items:start">

          <!-- ═══════════════════════════════════════════════════════════ -->
          <!-- PASSO 1: LOJA & IDs SHOPIFY                                 -->
          <!-- ═══════════════════════════════════════════════════════════ -->
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;border-top:3px solid ${ACCENT}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;font-weight:800;color:${ACCENT};letter-spacing:0.6px">PASSO 1 DE 3</span>
              <span id="magis-count" style="font-size:11px;padding:2px 8px;border-radius:999px;background:#1e293b;color:#cbd5e1">0 ID(s)</span>
            </div>
            <div>
              <h3 style="margin:0 0 4px;color:#f8fafc;font-size:16px">1. Anúncios da Shopify</h3>
              <p style="margin:0;color:#94a3b8;font-size:12px">Escolha a loja e busque os produtos novos em 1 clique ou cole os IDs.</p>
            </div>

            <div>
              <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Loja / Canal de Venda</label>
              <select id="magis-channel" style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:13px;font-weight:600">
                ${channelOpts}
              </select>
            </div>

            <div style="display:flex;gap:8px">
              <button id="m5-btn-discover" class="btn btn--secondary btn--sm" style="flex:1;justify-content:center;font-size:12px">
                🔍 Buscar Últimos da Loja
              </button>
              <button id="m5-btn-clear-ids" class="btn btn--ghost btn--sm" style="font-size:12px" title="Limpar">
                🗑️
              </button>
            </div>

            <div>
              <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">IDs dos Anúncios Shopify (1 por linha)</label>
              <textarea id="magis-ids" rows="8" placeholder="Ex:&#10;6358879166530&#10;7520209109058&#10;8364053397570" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical"></textarea>
            </div>

            <!-- Lista de produtos descobertos (se houver) -->
            <div id="m5-discovered-box" style="display:none;max-height:175px;overflow-y:auto;background:#0b1220;border:1px solid #1e293b;border-radius:8px;padding:8px;font-size:11px"></div>
          </div>

          <!-- ═══════════════════════════════════════════════════════════ -->
          <!-- PASSO 2: SANKHYA 40ms (DE-PARA SKU -> CODPROD)              -->
          <!-- ═══════════════════════════════════════════════════════════ -->
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;border-top:3px solid #38bdf8">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;font-weight:800;color:#38bdf8;letter-spacing:0.6px">PASSO 2 DE 3</span>
              <span id="m5-sku-count" style="font-size:11px;padding:2px 8px;border-radius:999px;background:#1e293b;color:#cbd5e1">0 SKUs mapeados</span>
            </div>
            <div>
              <h3 style="margin:0 0 4px;color:#f8fafc;font-size:16px">2. Cruzar SKUs no Sankhya</h3>
              <p style="margin:0;color:#94a3b8;font-size:12px">Troca o SKU da Shopify pelo <code>CODPROD</code> numérico do Sankhya.</p>
            </div>

            <div style="display:flex;gap:6px">
              <input id="m5-quick-sku-input" type="text" placeholder="Ex: CASUAL081, C01077P..." style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-size:12px;font-family:'JetBrains Mono',monospace">
              <button id="m5-btn-lookup-sankhya" class="btn btn--secondary btn--sm" style="font-size:12px;white-space:nowrap">
                ⚡ Buscar 40ms
              </button>
            </div>

            <div>
              <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">
                Pares <code>SKU_SHOPIFY [TAB] CODPROD_SANKHYA</code>
              </label>
              <textarea id="magis-skus" rows="8" placeholder="RAGLAN321BLPP&#9;75739&#10;RAGLAN321BLP&#9;75740&#10;RAGLAN321BLPM&#9;75741" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical"></textarea>
            </div>

            <div style="background:#111827;padding:10px 12px;border-radius:8px;border:1px solid #1e293b;display:flex;flex-direction:column;gap:6px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:#e2e8f0">
                <input type="checkbox" id="magis-producao" checked style="accent-color:${ACCENT};width:15px;height:15px">
                <span>Produto de <strong style="color:${ACCENT}">Produção</strong> (Estoque = 1000 | Diverso = Sim)</span>
              </label>
              <div style="font-size:11px;color:#64748b;padding-left:23px">
                Produtos <code>_FULL</code> vão para depósito <code>1010000</code> e Kits são ignorados automaticamente.
              </div>
            </div>
          </div>

          <!-- ═══════════════════════════════════════════════════════════ -->
          <!-- PASSO 3: EXECUTAR (TAMPERMONKEY OU API DIRETA)              -->
          <!-- ═══════════════════════════════════════════════════════════ -->
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;border-top:3px solid #10b981">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;font-weight:800;color:#10b981;letter-spacing:0.6px">PASSO 3 DE 3</span>
              <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(16,185,129,0.15);color:#10b981">Pronto p/ Envio</span>
            </div>
            <div>
              <h3 style="margin:0 0 4px;color:#f8fafc;font-size:16px">3. Gerar & Importar</h3>
              <p style="margin:0;color:#94a3b8;font-size:12px">Use o script Tampermonkey hoje ou dispare pela Fila de API da Magis5.</p>
            </div>

            <div style="display:flex;gap:8px">
              <button id="magis-generate" class="btn btn--primary" style="flex:1;justify-content:center;font-size:13px">
                ⚡ 1. Gerar Lista
              </button>
              <button id="magis-copy" class="btn btn--secondary" style="flex:1;justify-content:center;font-size:13px">
                📋 2. Copiar Lista
              </button>
            </div>

            <div>
              <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:4px">Saída Formatada (Pronta para Magis5)</label>
              <textarea id="magis-output" rows="8" readonly style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#10b981;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical" placeholder="Clique em '⚡ 1. Gerar Lista' para montar os lotes..."></textarea>
            </div>

            <div style="border-top:1px solid #1e293b;padding-top:12px;display:flex;flex-direction:column;gap:8px">
              <button id="m5-btn-send-api" class="btn btn--secondary btn--sm" style="width:100%;justify-content:center;font-size:12px;border-color:rgba(16,185,129,0.4);color:#10b981">
                🚀 Enviar Lote Direto p/ Fila Magis5 API
              </button>
              <div style="display:flex;gap:8px">
                <a href="https://app.magis5.com.br/v2/admin/product/import/consult.php" target="_blank" rel="noopener" class="btn btn--ghost btn--sm" style="flex:1;justify-content:center;font-size:11px">
                  📦 Abrir Magis5
                </a>
                <a href="https://brk.sankhyacloud.com.br" target="_blank" rel="noopener" class="btn btn--ghost btn--sm" style="flex:1;justify-content:center;font-size:11px">
                  🎣 Abrir Sankhya
                </a>
              </div>
            </div>
          </div>

        </div>

      </div>
    `;

    bind();
    loadStatus();
  }

  function updateCounts() {
    const idsEl = document.getElementById('magis-ids');
    const skusEl = document.getElementById('magis-skus');
    const countEl = document.getElementById('magis-count');
    const skuCountEl = document.getElementById('m5-sku-count');

    if (idsEl && countEl) {
      const count = idsEl.value.split('\n').map(l => l.trim()).filter(Boolean).length;
      countEl.textContent = `${count} ID(s)`;
    }
    if (skusEl && skuCountEl) {
      const sCount = skusEl.value.split('\n').map(l => l.trim()).filter(Boolean).length;
      skuCountEl.textContent = `${sCount} SKU(s) mapeados`;
    }
  }

  function bind() {
    const idsEl = document.getElementById('magis-ids');
    const skusEl = document.getElementById('magis-skus');
    const outputEl = document.getElementById('magis-output');
    const channelEl = document.getElementById('magis-channel');
    const drawerEl = document.getElementById('m5-settings-drawer');

    idsEl?.addEventListener('input', updateCounts);
    skusEl?.addEventListener('input', updateCounts);

    // Toggle Settings Drawer
    document.getElementById('m5-btn-toggle-settings')?.addEventListener('click', () => {
      state.showSettings = !state.showSettings;
      if (drawerEl) drawerEl.style.display = state.showSettings ? 'block' : 'none';
    });

    // Save Sankhya Session
    document.getElementById('m5-btn-save-sankhya')?.addEventListener('click', async () => {
      const sktk = document.getElementById('m5-cfg-sktk')?.value?.trim() || '';
      const mgeSession = document.getElementById('m5-cfg-mge')?.value?.trim() || '';
      if (!sktk && !mgeSession) {
        window.HUB?.showToast?.('⚠️ Informe o cookie sktk ou mgeSession!', 'warning');
        return;
      }
      try {
        const res = await fetch('/api/reverse-map/sankhya-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sktk, mgeSession, cookieHeader: sktk }),
        });
        const data = await res.json();
        if (data.success || data.ok) {
          window.HUB?.showToast?.('✅ Sessão Sankhya salva com sucesso!', 'success');
          loadStatus();
        } else {
          window.HUB?.showToast?.(`❌ ${data.error || 'Erro ao salvar sessão Sankhya'}`, 'error');
        }
      } catch (err) {
        window.HUB?.showToast?.(`❌ Falha: ${err.message}`, 'error');
      }
    });

    // Save Magis5 API Token
    document.getElementById('m5-btn-save-magis')?.addEventListener('click', async () => {
      const apiKey = document.getElementById('m5-cfg-magis-token')?.value?.trim() || '';
      const baseUrl = document.getElementById('m5-cfg-magis-url')?.value?.trim() || 'https://app.magis5.com.br';
      try {
        const res = await fetch('/api/magis5/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, baseUrl }),
        });
        const data = await res.json();
        if (data.success || data.ok) {
          window.HUB?.showToast?.('✅ Configuração Magis5 atualizada!', 'success');
          loadStatus();
        }
      } catch (err) {
        window.HUB?.showToast?.(`❌ Erro: ${err.message}`, 'error');
      }
    });

    // Clear IDs
    document.getElementById('m5-btn-clear-ids')?.addEventListener('click', () => {
      if (idsEl) idsEl.value = '';
      const box = document.getElementById('m5-discovered-box');
      if (box) {
        box.style.display = 'none';
        box.innerHTML = '';
      }
      updateCounts();
    });

    // Passo 1: Buscar últimos produtos da loja Shopify selecionada
    document.getElementById('m5-btn-discover')?.addEventListener('click', async () => {
      const channelName = channelEl?.value || 'BRK FISHING';
      const channelCfg = CHANNELS[channelName] || CHANNELS['BRK FISHING'];
      const btn = document.getElementById('m5-btn-discover');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Buscando na Shopify...';
      }

      try {
        const res = await fetch('/api/magis5/shopify/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stores: [channelCfg.storeKey], limit: 25 }),
        });
        const data = await res.json();
        const products = data?.ads || data?.products || [];

        if (!products.length) {
          window.HUB?.showToast?.('⚠️ Nenhum produto retornado desta loja.', 'warning');
          return;
        }

        state.discoveredProducts = products;
        const validProducts = products.filter(p => p.classification !== 'kit' && p.classification !== 'all_kit');
        const currentIds = (idsEl?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
        const mergedIds = Array.from(new Set([...currentIds, ...validProducts.map(p => String(p.shopifyProductId || p.id))]));
        if (idsEl) idsEl.value = mergedIds.join('\n');

        // Extrair SKUs das variantes para o campo de busca rápida
        const allSkus = [];
        validProducts.forEach(p => {
          if (Array.isArray(p.skus)) {
            p.skus.forEach(s => { if (s) allSkus.push(String(s).trim()); });
          } else {
            (p.variants || []).forEach(v => {
              if (v.sku) allSkus.push(String(v.sku).trim());
            });
          }
        });
        const quickSkuEl = document.getElementById('m5-quick-sku-input');
        if (quickSkuEl && allSkus.length > 0 && !quickSkuEl.value) {
          quickSkuEl.value = Array.from(new Set(allSkus)).slice(0, 30).join(', ');
        }

        // Mostrar resumo compacto dos produtos encontrados
        const box = document.getElementById('m5-discovered-box');
        if (box) {
          box.style.display = 'block';
          box.innerHTML = products.slice(0, 15).map(p => {
            const pId = p.shopifyProductId || p.id;
            const isKit = p.classification === 'kit' || p.classification === 'all_kit';
            const isFull = p.classification === 'revenda_full';
            const badgeColor = isKit ? '#ef4444' : isFull ? '#38bdf8' : ACCENT;
            const badgeLabel = isKit ? 'KIT (Pular)' : isFull ? 'FULL' : 'PRODUÇÃO';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #1e293b">
              <span style="color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px" title="${p.title}">${pId} — ${p.title}</span>
              <span style="color:${badgeColor};font-weight:700;font-size:10px">${badgeLabel}</span>
            </div>`;
          }).join('');
        }

        updateCounts();
        window.HUB?.showToast?.(`✅ ${validProducts.length} anúncio(s) carregados da ${channelName}!`, 'success');
      } catch (err) {
        window.HUB?.showToast?.(`❌ Erro ao buscar na Shopify: ${err.message}`, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔍 Buscar Últimos da Loja';
        }
      }
    });

    // Passo 2: Buscar SKUs no Sankhya em 40ms
    document.getElementById('m5-btn-lookup-sankhya')?.addEventListener('click', async () => {
      const quickInput = document.getElementById('m5-quick-sku-input')?.value || '';
      const rawSkus = quickInput
        .split(/[\n,;|\t ]+/)
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      if (rawSkus.length === 0) {
        window.HUB?.showToast?.('⚠️ Digite pelo menos um SKU (ex: CASUAL081PP) para buscar no Sankhya!', 'warning');
        return;
      }

      const btn = document.getElementById('m5-btn-lookup-sankhya');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 40ms...';
      }

      try {
        const res = await fetch('/api/reverse-map/sankhya/lookup-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skus: rawSkus }),
        });
        const data = await res.json();

        if (!res.ok || data.error) {
          window.HUB?.showToast?.(`⚠️ ${data.error || 'Sessão Sankhya não conectada. Abra ⚙️ Conexões & Tokens.'}`, 'warning');
          state.showSettings = true;
          if (drawerEl) drawerEl.style.display = 'block';
          return;
        }

        const results = data.results || [];
        const existingLines = (skusEl?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
        let foundCount = 0;

        results.forEach(item => {
          if (item.found && item.codProd) {
            foundCount++;
            existingLines.push(`${item.sku}\t${item.codProd}`);
          }
        });

        if (skusEl) {
          skusEl.value = Array.from(new Set(existingLines)).join('\n');
        }
        updateCounts();
        window.HUB?.showToast?.(`⚡ ${foundCount}/${rawSkus.length} SKU(s) encontrados no Sankhya!`, foundCount > 0 ? 'success' : 'warning');
      } catch (err) {
        window.HUB?.showToast?.(`❌ Erro na busca Sankhya: ${err.message}`, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '⚡ Buscar 40ms';
        }
      }
    });

    // Passo 3A: Gerar Lista para Tampermonkey
    document.getElementById('magis-generate')?.addEventListener('click', () => {
      const ids = (idsEl?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (ids.length === 0) {
        window.HUB?.showToast?.('⚠️ Cole ou busque pelo menos um ID da Shopify no Passo 1!', 'warning');
        return;
      }

      const skuPairs = new Map();
      if (skusEl?.value) {
        skusEl.value.split('\n').forEach(line => {
          const parts = line.trim().split(/[\t;]+/);
          if (parts.length >= 2) {
            skuPairs.set(parts[0].trim(), parts[1].trim());
          }
        });
      }

      const lines = ids.map(id => {
        if (skuPairs.size > 0) {
          const pairs = [...skuPairs.entries()].map(([old, new_]) => `${old}\t${new_}`).join('\t');
          return `${id}\t${pairs}`;
        }
        return id;
      });

      if (outputEl) outputEl.value = lines.join('\n');
      window.HUB?.showToast?.(`✅ ${ids.length} anúncio(s) preparados para importação!`, 'success');
    });

    // Passo 3B: Copiar Lista
    document.getElementById('magis-copy')?.addEventListener('click', async () => {
      const text = outputEl?.value || '';
      if (!text) {
        window.HUB?.showToast?.('⚠️ Clique em "⚡ 1. Gerar Lista" primeiro!', 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        window.HUB?.showToast?.('📋 Lista copiada! Cole no painel Magis5 Import.', 'success');
      } catch {
        outputEl.select();
        document.execCommand('copy');
        window.HUB?.showToast?.('📋 Copiado!', 'success');
      }
    });

    // Passo 3C: Enviar para Fila Magis5 API
    document.getElementById('m5-btn-send-api')?.addEventListener('click', async () => {
      const ids = (idsEl?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (ids.length === 0) {
        window.HUB?.showToast?.('⚠️ Adicione pelo menos um ID no Passo 1!', 'warning');
        return;
      }

      const channelName = channelEl?.value || 'BRK FISHING';
      const channelCfg = CHANNELS[channelName] || CHANNELS['BRK FISHING'];
      const isProducao = Boolean(document.getElementById('magis-producao')?.checked);

      const skuList = [];
      if (skusEl?.value) {
        skusEl.value.split('\n').forEach(line => {
          const parts = line.trim().split(/[\t;]+/);
          if (parts.length >= 2) {
            skuList.push(parts[1].trim());
          }
        });
      }

      try {
        const items = ids.map(shopifyProductId => ({
          shopifyProductId,
          store: channelCfg.storeKey,
          stockFixed: isProducao ? 1000 : undefined,
          skus: skuList,
          source: 'hub-magis5-bridge',
        }));

        const res = await fetch('/api/magis5/queue/enqueue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (data.success || data.ok) {
          window.HUB?.showToast?.(`🚀 ${ids.length} anúncio(s) enfileirados na Magis5 Bridge!`, 'success');
        } else {
          window.HUB?.showToast?.(`⚠️ ${data.error || 'Erro ao enfileirar'}`, 'warning');
        }
      } catch (err) {
        window.HUB?.showToast?.(`❌ Falha ao enviar lote: ${err.message}`, 'error');
      }
    });
  }

  // ═══ Register Page ═══
  window.HUB.renderMagis5 = render;
})();
