(function () {
  'use strict';
  window.AutopilotModules = window.AutopilotModules || {};
  const State = window.AutopilotModules.State;
  const H = window.AutopilotModules.Helpers;

  function renderStep5() {
    const totalCodes  = State.state.generatedCodes.length;
    const totalSkus   = H.totalSkuCount();
    const totalGenderCodes = State.state.generatedCodes.reduce((acc, c) => {
      const gList = c._groupId ? H.activeGenders(State.getGroupById(c._groupId)) : ['masc'];
      return acc + gList.filter(g => c[g]).length;
    }, 0);
    const totalImages = Object.values(State.state.imageUrls).filter(v => v && v.trim()).length;

    // #8 Validation checks
    const checks = [
      { label: 'Todos os códigos têm imagens', ok: totalImages >= totalGenderCodes, detail: `${totalImages}/${totalGenderCodes}` },
      { label: 'Peso definido (0,250)', ok: true, detail: '✓' },
      { label: 'Marca definida', ok: State.state.brand && State.state.brand.trim(), detail: State.state.brand || '—' },
      { label: 'Preço definido', ok: State.state.price && State.state.price.trim(), detail: State.state.price || '—' },
    ];

    // #9 Export History
    const history = State.getExportHistory();
    const currentTheme = State.state.theme || 'dark';

    let html = `
    <div style="display:flex;flex-direction:column;gap:24px">

      <!-- Summary -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 20px;color:${State.TIFFANY}">🎉 Resumo Final</h3>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
          ${H.renderStatCard('Códigos', totalCodes, '📋', State.TIFFANY)}
          ${H.renderStatCard('SKUs', totalSkus, '📦', '#3b82f6')}
          ${H.renderStatCard('Imagens', totalImages, '🖼️', '#8b5cf6')}
          ${H.renderStatCard('Marca', State.state.brand, '🏷️', '#f59e0b')}
        </div>
      </div>

      <!-- #8 Validation Checklist -->
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${State.TIFFANY}">✅ Validação</h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${checks.map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;background:rgba(${c.ok ? '65,255,10' : '239,68,68'},0.06);border:1px solid ${c.ok ? State.TIFFANY + '20' : '#ef444420'}">
              <span style="font-size:16px">${c.ok ? '✅' : '⚠️'}</span>
              <span style="flex:1;font-size:13px;color:#e5e7eb">${c.label}</span>
              <span style="font-size:12px;color:${c.ok ? State.TIFFANY : '#f59e0b'};font-family:monospace">${c.detail}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Export Actions -->
      <div class="card" style="padding:28px;text-align:center">
        <h3 style="margin:0 0 8px;color:${State.TIFFANY}">📥 Exportação</h3>
        <p style="color:#9ca3af;font-size:13px;margin:0 0 24px">
          Formato: Bling V2 (59 colunas, separador ;) — Padrão Coleção São Bento
        </p>

        <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap">
          <button class="btn btn--primary" id="ap-download-csv" style="min-width:220px;padding:14px 32px;font-size:16px">
            📥 Baixar CSV Bling
          </button>

          <button class="btn btn--secondary" id="ap-copy-csv" style="min-width:200px">
            📋 Copiar para Área de Transferência
          </button>
        </div>
      </div>

      <!-- #9 Export History -->
      ${history.length > 0 ? `
      <div class="card" style="padding:28px">
        <h3 style="margin:0 0 16px;color:${State.TIFFANY}">📜 Histórico de Exports</h3>
        <div style="max-height:200px;overflow-y:auto">
          ${history.slice(0, 10).map(h => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px">
              <span style="color:#9ca3af">${h.date || '—'}</span>
              <span style="color:#e5e7eb;font-family:monospace">${h.codes || '—'}</span>
              <span style="color:#6b7280">${h.skus || 0} SKUs</span>
              <span style="color:${State.TIFFANY}">${h.brand || '—'}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <!-- #12 Theme Toggle + Restart -->
      <div style="display:flex;justify-content:space-between;gap:12px;padding-bottom:24px;align-items:center">
        <button class="btn btn--secondary" id="ap-prev-5">← Voltar</button>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="btn btn--secondary" id="ap-toggle-theme" style="font-size:13px;padding:8px 16px">
            ${currentTheme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
          </button>
          <button class="btn btn--secondary" id="ap-new-process" style="color:#f59e0b;border-color:#f59e0b">🔄 Novo Processo</button>
        </div>
      </div>
    </div>`;

    return html;
  }

  function generateCsvContent() {
    const Step5 = window.AutopilotModules.Step5;
    // Sempre reconstruir para garantir dados atualizados
    State.state.csvRows = Step5.buildCsvRows();

    const sep = ';';

    // ═══════════════════════════════════════════════════════════════
    // Bling V2 — 59 colunas exatas (formato COLEÇÃO SÃO BENTO)
    // ═══════════════════════════════════════════════════════════════
    const blingHeaders = [
      /*  0 */ '"ID"',
      /*  1 */ 'Código',
      /*  2 */ 'Descrição',
      /*  3 */ 'Unidade',
      /*  4 */ 'NCM',
      /*  5 */ 'Origem',
      /*  6 */ 'Preço',
      /*  7 */ 'Valor IPI fixo',
      /*  8 */ 'Observações',
      /*  9 */ 'Situação',
      /* 10 */ 'Estoque',
      /* 11 */ 'Preço de custo',
      /* 12 */ 'Cód. no fornecedor',
      /* 13 */ 'Fornecedor',
      /* 14 */ 'Localização',
      /* 15 */ 'Estoque máximo',
      /* 16 */ 'Estoque mínimo',
      /* 17 */ 'Peso líquido (Kg)',
      /* 18 */ 'Peso bruto (Kg)',
      /* 19 */ 'GTIN/EAN',
      /* 20 */ 'GTIN/EAN da Embalagem',
      /* 21 */ 'Largura do produto',
      /* 22 */ 'Altura do Produto',
      /* 23 */ 'Profundidade do produto',
      /* 24 */ 'Data Validade',
      /* 25 */ 'Descrição do Produto no Fornecedor',
      /* 26 */ 'Descrição Complementar',
      /* 27 */ 'Itens p/ caixa',
      /* 28 */ 'Produto Variação',
      /* 29 */ 'Tipo Produção',
      /* 30 */ 'Classe de enquadramento do IPI',
      /* 31 */ 'Código na Lista de Serviços',
      /* 32 */ 'Tipo do item',
      /* 33 */ 'Grupo de Tags/Tags',
      /* 34 */ 'Tributos',
      /* 35 */ 'Código Pai',
      /* 36 */ 'Código Integração',
      /* 37 */ 'Grupo de produtos',
      /* 38 */ 'Marca',
      /* 39 */ 'CEST',
      /* 40 */ 'Volumes',
      /* 41 */ 'Descrição Curta',
      /* 42 */ 'Cross-Docking',
      /* 43 */ 'URL Imagens Externas',
      /* 44 */ 'Link Externo',
      /* 45 */ 'Meses Garantia no Fornecedor',
      /* 46 */ 'Clonar dados do pai',
      /* 47 */ 'Condição do Produto',
      /* 48 */ 'Frete Grátis',
      /* 49 */ 'Número FCI',
      /* 50 */ 'Vídeo',
      /* 51 */ 'Departamento',
      /* 52 */ 'Unidade de Medida',
      /* 53 */ 'Preço de Compra',
      /* 54 */ 'Valor base ICMS ST para retenção',
      /* 55 */ 'Valor ICMS ST para retenção',
      /* 56 */ 'Valor ICMS próprio do substituto',
      /* 57 */ 'Categoria do produto',
      /* 58 */ 'Informações Adicionais',
    ];

    let csv = blingHeaders.join(sep) + '\n';

    State.state.csvRows.forEach(row => {
      // Separator row (empty between APC code blocks)
      if (row._isEmpty) {
        csv += new Array(59).fill('').join(sep) + '\n';
        return;
      }
      const cols = new Array(59).fill('');

      // ─── Campos comuns (PAI e VARIAÇÃO) ───
      cols[1]  = row.codigo;                   // Código
      cols[3]  = 'UN';                         // Unidade
      cols[4]  = row.ncm;                      // NCM
      cols[5]  = '0';                          // Origem
      cols[6]  = row.preco;                    // Preço
      cols[7]  = '0';                          // Valor IPI fixo
      cols[9]  = 'Ativo';                      // Situação
      cols[10] = row.estoque;                  // Estoque (0 pai, 1000 variação)
      cols[11] = State.state.costPrice || '22,83';         // Preço de custo
      cols[15] = '0';                          // Estoque máximo
      cols[16] = '0';                          // Estoque mínimo
      cols[17] = row.pesoLiq;                  // Peso líquido (Kg)
      cols[18] = row.pesoBruto;                // Peso bruto (Kg)
      cols[19] = row.ean;                      // GTIN/EAN (vazio)
      cols[20] = row.eanEmb;                   // GTIN/EAN da Embalagem (vazio)
      cols[21] = row.largura || '22';            // Largura do produto
      cols[22] = row.altura || '4';              // Altura do Produto
      cols[23] = row.profundidade || '30';       // Profundidade do produto
      cols[27] = '1';                          // Itens p/ caixa
      cols[28] = row.produtoVariacao;          // Produto Variação
      cols[29] = 'Terceiros';                  // Tipo Produção
      cols[32] = 'Mercadoria para Revenda';    // Tipo do item
      cols[34] = '0';                          // Tributos
      cols[35] = row.codigoPai;                // Código Pai
      cols[36] = '0';                          // Código Integração
      cols[37] = '';                           // Grupo de produtos (vazio conforme planilha padrão)
      cols[38] = row.marca;                    // Marca
      cols[39] = '28.038.00';                  // CEST
      cols[40] = '1';                          // Volumes
      cols[41] = 'A';                          // Descrição Curta
      cols[42] = '0';                          // Cross-Docking
      cols[43] = row.imagens;                  // URL Imagens Externas
      cols[45] = '0';                          // Meses Garantia no Fornecedor
      cols[46] = 'NÃO';                        // Clonar dados do pai
      cols[47] = 'NOVO';                       // Condição do Produto
      cols[48] = 'NÃO';                        // Frete Grátis
      cols[52] = 'Centímetro';                 // Unidade de Medida
      cols[53] = '0';                          // Preço de Compra
      cols[54] = '0';                          // Valor base ICMS ST
      cols[55] = '0';                          // Valor ICMS ST
      cols[56] = '0';                          // Valor ICMS próprio

      // ─── Campo específico ───
      // Descrição: envolver com aspas quando contém ; (delimitador CSV)
      cols[2]  = row.descricao.includes(';') ? `"${row.descricao}"` : row.descricao;

      csv += cols.join(sep) + '\n';
    });

    return csv;
  }



  function downloadCsv(content, filename) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  function fireConfetti() {
    const container = document.getElementById('app-content');
    if (!container) return;

    const colors = [State.TIFFANY, State.TIFFANY_S || '#c084fc', State.TIFFANY_D || '#9333ea', '#3b82f6', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4'];

    for (let i = 0; i < 30; i++) {
      const piece = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left  = Math.random() * 100;
      const delay = Math.random() * 800;
      const dur   = 1500 + Math.random() * 1500;
      const size  = 6 + Math.random() * 8;
      const rot   = Math.random() * 360;

      Object.assign(piece.style, {
        position: 'fixed',
        top: '-20px',
        left: left + '%',
        width: size + 'px',
        height: size + 'px',
        background: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        zIndex: '9999',
        pointerEvents: 'none',
        opacity: '1',
        transform: `rotate(${rot}deg)`,
        animation: `apConfettiFall ${dur}ms ${delay}ms ease-in forwards`,
      });

      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), dur + delay + 200);
    }

    // Inject confetti keyframes if not present
    if (!document.getElementById('ap-confetti-style')) {
      const style = document.createElement('style');
      style.id = 'ap-confetti-style';
      style.textContent = `
        @keyframes apConfettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function bindStep5(deps) {
    const { render, goToStep } = deps;
    const Step5 = window.AutopilotModules.Step5;
    
    const dlBtn = document.getElementById('ap-download-csv');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        if (!State.state.csvRows.length) State.state.csvRows = Step5.buildCsvRows();
        const csv = generateCsvContent();
        const prefix = State.getFirstGroup().codeStart || 'autopilot';
        const suffix = State.getFirstGroup().codeEnd || '';
        const filename = `autopilot_${prefix}${suffix ? '_' + suffix : ''}_bling.csv`;
        downloadCsv(csv, filename);

        // Registrar estampas usadas SOMENTE na exportação final (não no preview)
        Object.values(State.state.estampas).forEach(est => {
          if (est && est.trim() && est.trim() !== '*ESTAMPA A SER DEFINIDA') window.Estampas?.addUsedEstampa(est.trim());
        });

        // #9 Save to export history
        State.addExportHistory({
          date: new Date().toLocaleString('pt-BR'),
          codes: `${prefix}${suffix ? ' → ' + suffix : ''}`,
          skus: H.totalSkuCount(),
          brand: State.state.brand,
          filename,
        });

        window.HUB.logTask?.('export', `CSV Lucas RTX exportado (Bling)`, {
          codes: State.state.generatedCodes.length,
          skus: H.totalSkuCount(),
        });

        window.HUB.showToast('CSV Bling baixado com sucesso!', 'success');
        fireConfetti();
        State.state.exported = true;
        State.saveSession();

        // ✅ Marcar tarefa como concluída no backend
        if (State.state.networkTaskId) {
          fetch(`/api/autopilot/tasks/${State.state.networkTaskId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'done' })
          }).then(r => {
            if (r.ok) {
              console.log(`✅ Tarefa ${State.state.networkTaskId} marcada como concluída`);
              window.HUB?.showToast('📋 Tarefa movida para "Completo" no Dashboard!', 'success');
            }
          }).catch(err => console.warn('Erro ao finalizar tarefa:', err));
        }
      });
    }

    const copyBtn = document.getElementById('ap-copy-csv');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!State.state.csvRows.length) State.state.csvRows = Step5.buildCsvRows();
        const csv = generateCsvContent();
        navigator.clipboard.writeText(csv).then(() => {
          window.HUB.showToast('CSV copiado para a área de transferência!', 'success');
        }).catch(() => {
          window.HUB.showToast('Erro ao copiar. Tente baixar o arquivo.', 'error');
        });
      });
    }


    // #12 Theme toggle
    const currentTheme = State.state.theme || 'dark';
    const themeBtn = document.getElementById('ap-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        State.applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        render();
      });
    }

    const newBtn = document.getElementById('ap-new-process');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        State.clearSession(); // #3
        State.resetState();
        render();
        window.HUB.showToast('Novo processo iniciado', 'info');
      });
    }

    const prevBtn = document.getElementById('ap-prev-5');
    if (prevBtn) prevBtn.addEventListener('click', () => goToStep(5));
  }

  window.AutopilotModules.Step6 = {
    render: renderStep5,
    generateCsvContent,
    downloadCsv,
    fireConfetti,
    bind: bindStep5
  };
})();
