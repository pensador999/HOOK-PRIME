/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Magis5 Bridge
   Ponte entre Lucas RTX e o Tampermonkey da Magis5.
   Gera a lista formatada de IDs Shopify para importação.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';
  window.HUB = window.HUB || {};

  const ACCENT = '#AAFF00';
  const CHANNELS = {
    'BRK FISHING': 'shopify-8e9dc508c9e24e76a6cc29dc92ce3b9f',
    'BRK AGRO': 'shopify-21b47dd8ee4b4a44b8b8d891bb3e2265',
    'BRK MOTORS': 'shopify-7495282216c04726834a39582e5369dd',
  };

  function render() {
    const container = document.getElementById('app-content');
    if (!container) return;

    const channelOpts = Object.keys(CHANNELS).map(name =>
      `<option value="${name}">${name}</option>`
    ).join('');

    container.innerHTML = `
      <div style="max-width:900px;margin:0 auto;padding:24px 0;display:flex;flex-direction:column;gap:24px">

        <!-- Header -->
        <div class="card card--glow" style="padding:28px;text-align:center">
          <h2 style="margin:0 0 8px;color:${ACCENT}">🚀 Magis5 Bridge</h2>
          <p style="color:#9ca3af;margin:0;font-size:14px">Ponte entre o Lucas RTX e o Tampermonkey da Magis5</p>
        </div>

        <!-- Fluxo Visual -->
        <div class="card" style="padding:24px">
          <h3 style="margin:0 0 16px;color:${ACCENT};font-size:15px">📋 Fluxo de Trabalho</h3>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;text-align:center">
            <div style="background:rgba(170, 255, 0,0.1);border-radius:10px;padding:12px 8px;border:1px solid ${ACCENT}20">
              <div style="font-size:22px">📋</div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:4px">Lucas RTX<br/>Planilha OK</div>
            </div>
            <div style="background:rgba(170, 255, 0,0.07);border-radius:10px;padding:12px 8px;border:1px solid ${ACCENT}15">
              <div style="font-size:22px">🛒</div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:4px">Upload<br/>Shopify CSV</div>
            </div>
            <div style="background:rgba(170, 255, 0,0.07);border-radius:10px;padding:12px 8px;border:1px solid ${ACCENT}15">
              <div style="font-size:22px">🔗</div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:4px">Ativar +<br/>Copiar IDs</div>
            </div>
            <div style="background:rgba(170, 255, 0,0.1);border-radius:10px;padding:12px 8px;border:1px solid ${ACCENT}30">
              <div style="font-size:22px;color:${ACCENT}">📦</div>
              <div style="font-size:11px;color:${ACCENT};margin-top:4px;font-weight:600">Magis5<br/>Bridge</div>
            </div>
            <div style="background:rgba(170, 255, 0,0.07);border-radius:10px;padding:12px 8px;border:1px solid ${ACCENT}15">
              <div style="font-size:22px">✅</div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:4px">Importado<br/>na Magis5</div>
            </div>
          </div>
        </div>

        <!-- Canal de Venda -->
        <div class="card" style="padding:24px">
          <h3 style="margin:0 0 12px;color:${ACCENT};font-size:15px">🏪 Canal de Venda</h3>
          <select id="magis-channel" style="width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#1e293b;color:#e2e8f0;font-size:14px">
            ${channelOpts}
          </select>
        </div>

        <!-- IDs Shopify -->
        <div class="card" style="padding:24px">
          <h3 style="margin:0 0 4px;color:${ACCENT};font-size:15px">🔑 IDs dos Anúncios Shopify</h3>
          <p style="color:#6b7280;font-size:12px;margin:0 0 12px">Cole os IDs da URL dos produtos (um por linha). Ex: 6358879166530</p>
          <textarea id="magis-ids" rows="8" placeholder="Cole aqui os IDs da Shopify...&#10;&#10;6358879166530&#10;7520209109058&#10;8364053397570" style="width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:13px;resize:vertical"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span id="magis-count" style="font-size:12px;color:#6b7280">0 IDs</span>
          </div>
        </div>

        <!-- SKU Mapping (Opcional) -->
        <div class="card" style="padding:24px">
          <h3 style="margin:0 0 4px;color:${ACCENT};font-size:15px">🔄 Mapeamento de SKUs (Opcional)</h3>
          <p style="color:#6b7280;font-size:12px;margin:0 0 12px">Se quiser já trocar os SKUs automaticamente, cole os pares: <code>SKU_SHOPIFY [TAB] SKU_SANKHYA</code></p>
          <textarea id="magis-skus" rows="6" placeholder="SKU_SHOPIFY&#9;SKU_SANKHYA&#10;RAGLAN321BLPP&#9;75739&#10;RAGLAN321BLP&#9;75740&#10;RAGLAN321BLPM&#9;75741" style="width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical"></textarea>
          <div style="margin-top:8px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#cbd5e1">
              <input type="checkbox" id="magis-producao" checked style="accent-color:${ACCENT};width:16px;height:16px">
              <span>Produto de <strong style="color:${ACCENT}">produção</strong> (Vendido de forma diversa = Sim)</span>
            </label>
          </div>
        </div>

        <!-- Output -->
        <div class="card" style="padding:24px">
          <h3 style="margin:0 0 12px;color:${ACCENT};font-size:15px">📤 Saída para Tampermonkey</h3>
          <textarea id="magis-output" rows="6" readonly style="width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0b1220;color:#10b981;font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical" placeholder="Clique 'Gerar Lista' para criar a saída..."></textarea>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button id="magis-generate" class="btn btn--primary" style="flex:1">⚡ Gerar Lista</button>
            <button id="magis-copy" class="btn btn--secondary" style="flex:1">📋 Copiar para Clipboard</button>
          </div>
        </div>

        <!-- Instruções -->
        <div class="card" style="padding:24px">
          <h3 style="margin:0 0 12px;color:${ACCENT};font-size:15px">📖 Como Usar</h3>
          <ol style="color:#9ca3af;font-size:13px;line-height:1.8;margin:0;padding-left:20px">
            <li>Na <strong>Shopify</strong>: Abra cada produto em rascunho, mude para <strong>Ativo</strong>, copie o ID da URL</li>
            <li>Cole todos os IDs aqui (um por linha)</li>
            <li>Se tiver os SKUs do Sankhya, cole o mapeamento</li>
            <li>Clique <strong>"Gerar Lista"</strong> e depois <strong>"Copiar"</strong></li>
            <li>Na <strong>Magis5</strong>, abra o painel do Tampermonkey <strong>"🚀 Magis5 Import"</strong></li>
            <li>Cole a lista e clique <strong>"▶ Iniciar Importação"</strong></li>
          </ol>
        </div>

        <!-- Links -->
        <div style="display:flex;gap:8px;justify-content:center;padding-bottom:24px">
          <a href="https://app.magis5.com.br/v2/admin/product/import/consult.php" target="_blank" rel="noopener" class="btn btn--primary" style="font-size:13px">📦 Abrir Magis5</a>
          <a href="https://brk.sankhyacloud.com.br" target="_blank" rel="noopener" class="btn btn--primary" style="font-size:13px">🎣 Abrir Sankhya</a>
        </div>
      </div>
    `;

    bind();
  }

  function bind() {
    const idsEl = document.getElementById('magis-ids');
    const skusEl = document.getElementById('magis-skus');
    const outputEl = document.getElementById('magis-output');
    const countEl = document.getElementById('magis-count');

    // Count IDs on input
    if (idsEl) {
      idsEl.addEventListener('input', () => {
        const count = idsEl.value.split('\n').map(l => l.trim()).filter(Boolean).length;
        if (countEl) countEl.textContent = `${count} ID(s)`;
      });
    }

    // Generate
    document.getElementById('magis-generate')?.addEventListener('click', () => {
      const ids = (idsEl?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
      if (ids.length === 0) {
        window.HUB?.showToast?.('⚠️ Cole pelo menos um ID!', 'warning');
        return;
      }

      // Parse SKU pairs
      const skuPairs = new Map();
      if (skusEl?.value) {
        skusEl.value.split('\n').forEach(line => {
          const parts = line.trim().split(/\t+/);
          if (parts.length >= 2) {
            skuPairs.set(parts[0].trim(), parts[1].trim());
          }
        });
      }

      // Build output — one line per ID, with optional SKU pairs
      const lines = ids.map(id => {
        if (skuPairs.size > 0) {
          const pairs = [...skuPairs.entries()].map(([old, new_]) => `${old}\t${new_}`).join('\t');
          return `${id}\t${pairs}`;
        }
        return id;
      });

      if (outputEl) outputEl.value = lines.join('\n');
      window.HUB?.showToast?.(`✅ ${ids.length} anúncio(s) preparados!`, 'success');
    });

    // Copy
    document.getElementById('magis-copy')?.addEventListener('click', async () => {
      const text = outputEl?.value || '';
      if (!text) {
        window.HUB?.showToast?.('⚠️ Gere a lista primeiro!', 'warning');
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        window.HUB?.showToast?.('📋 Copiado para o clipboard!', 'success');
      } catch {
        // Fallback
        outputEl.select();
        document.execCommand('copy');
        window.HUB?.showToast?.('📋 Copiado!', 'success');
      }
    });
  }

  // ═══ Register Page ═══
  window.HUB.renderMagis5 = render;
})();
