/* ═══════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Lucas RTX — Fluxo de Trabalho Visual (Canvas)
   Nós editáveis, drag-and-drop, conexões e persistência
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ═══════════════════════════════════════════════════════════════
  // FASE 1 — RECEBIMENTO & ANÁLISE (Linha Y=80)
  // FASE 2 — COLETA & ORGANIZAÇÃO  (Linha Y=260)  
  // FASE 3 — PROCESSAMENTO         (Linha Y=440)
  // FASE 4 — EXPORTAÇÃO & ENTREGA  (Linha Y=620)
  // ═══════════════════════════════════════════════════════════════

  const DEFAULT_NODES = [
    // ═══ FASE 1 — RECEBIMENTO & ANÁLISE ═══
    {
      id: 'clickup-task',
      icon: '📋',
      title: 'Tarefa ClickUp',
      subtitle: 'Fase 1 · Recebimento',
      color: '#88CC00',
      x: 60,
      y: 80,
      page: 'dashboard',
      description: 'O processo inicia quando uma nova tarefa de cadastro de produto é criada no ClickUp pela equipe comercial ou de design. A tarefa contém título, códigos dos produtos e informações de gênero/marca.',
      externalUrl: 'https://app.clickup.com/12901270/v/b/f/901317259670'
    },
    {
      id: 'analisar-demanda',
      icon: '🔍',
      title: 'Analisar Demanda',
      subtitle: 'Fase 1 · Identificar códigos',
      color: '#CCFF44',
      x: 340,
      y: 80,
      page: 'dashboard',
      description: 'O operador analisa a tarefa para identificar os códigos de produto (ex: LEN002, FUS001), tipo de produto (camiseta, caneca, bone), gênero (MASC/FEM/INF) e marca (BRK). O parser automático do Hub extrai essas informações do título e descrição.',
      externalUrl: null
    },
    {
      id: 'iniciar-autopilot',
      icon: '🚀',
      title: 'Iniciar Autopilot',
      subtitle: 'Fase 1 · Automação',
      color: '#7c3aed',
      x: 620,
      y: 80,
      page: 'autopilot',
      description: 'Ao clicar em "Iniciar no Autopilot" no dashboard, o sistema automaticamente: 1) Extrai todos os códigos da tarefa, 2) Agrupa por prefixo de linha, 3) Dispara o Smart-Scan na rede. Este é o gatilho que inicia toda a automação.',
      externalUrl: null
    },

    // ═══ FASE 2 — COLETA & ORGANIZAÇÃO ═══
    {
      id: 'smart-scan',
      icon: '📡',
      title: 'Smart-Scan Rede',
      subtitle: 'Fase 2 · Busca inteligente',
      color: '#0ea5e9',
      x: 60,
      y: 260,
      page: 'autopilot',
      description: 'O Smart-Scan busca automaticamente as imagens na rede \\\\192.168.100.100 para cada código detectado. Usa uma cascata de 8 níveis: 3D/ → Gênero → SITE/ → MOCKUP/ → Raiz → Subpastas → Busca profunda. Extrai automaticamente o nome da estampa do nome da pasta (ex: LEN002_ARARA_AZUL → "Arara Azul").',
      externalUrl: null
    },
    {
      id: 'copiar-imagens',
      icon: '📂',
      title: 'Copiar Imagens',
      subtitle: 'Fase 2 · Rede → Local',
      color: '#06b6d4',
      x: 340,
      y: 260,
      page: null,
      description: 'As imagens encontradas são copiadas da rede para o disco local (uploads/autopilot/). Deduplicação automática: se existir COSTAS.png (500KB) e COSTAS.jpg (200KB), mantém apenas o maior. SEGURANÇA: apenas operação de LEITURA e CÓPIA, a rede nunca é modificada.',
      externalUrl: null
    },
    {
      id: 'preview-imagens',
      icon: '👁️',
      title: 'Preview Visual',
      subtitle: 'Fase 2 · Validação',
      color: '#14b8a6',
      x: 620,
      y: 260,
      page: 'autopilot',
      description: 'Modal com grid de thumbnails para o operador visualizar e validar as imagens copiadas. Mostra badges de prioridade (FRENTE, COSTAS, MESA, DETALHE) e gênero (MASC, FEM, INF). O operador pode confirmar ou ajustar antes de prosseguir.',
      externalUrl: null
    },
    {
      id: 'criar-pastas',
      icon: '📁',
      title: 'Criar Pastas',
      subtitle: 'Fase 2 · Estrutura local',
      color: '#3b82f6',
      x: 900,
      y: 260,
      page: 'folders',
      description: 'Cria automaticamente a estrutura de pastas no sistema local para organizar as imagens por código, gênero e tipo. Padrão: CODIGO/MASC/FRENTE.jpg, CODIGO/FEM/COSTAS.jpg, etc.',
      externalUrl: null
    },

    // ═══ FASE 3 — PROCESSAMENTO ═══
    {
      id: 'organizar-imagens',
      icon: '🖼️',
      title: 'Organizar Imagens',
      subtitle: 'Fase 3 · Renomear & Ordenar',
      color: '#88CC00',
      x: 60,
      y: 440,
      page: 'images',
      description: 'Renomeia as imagens seguindo o padrão Bling (ex: FRENTE_MASC.jpg, COSTAS_FEM.jpg). Ordena por prioridade: 1-FRENTE, 2-COSTAS, 3-PERSPECTIVA, 4-DETALHE. Remove duplicatas e valida formatos (JPG/PNG/WEBP).',
      externalUrl: null
    },
    {
      id: 'upload-cdn',
      icon: '☁️',
      title: 'Upload CDN',
      subtitle: 'Fase 3 · Publicar na nuvem',
      color: '#0284c7',
      x: 340,
      y: 440,
      page: null,
      description: 'Faz upload das imagens organizadas para o CDN (Cloudflare Workers + R2). Cada imagem recebe uma URL pública permanente que será usada na planilha Bling. O CDN garante carregamento rápido em qualquer dispositivo.',
      externalUrl: 'https://brk-bunker.allexadriel.workers.dev/images'
    },
    {
      id: 'gerar-links',
      icon: '🔗',
      title: 'Gerar Links',
      subtitle: 'Fase 3 · URLs públicas',
      color: '#0891b2',
      x: 620,
      y: 440,
      page: null,
      description: 'Gera as URLs públicas formatadas de cada imagem no CDN. Os links seguem o padrão: https://cdn.../CODIGO_GENERO_ANGULO.jpg. Estes links serão inseridos automaticamente na planilha CSV.',
      externalUrl: 'https://generate-link-images.vercel.app/'
    },
    {
      id: 'buscar-eans',
      icon: '📊',
      title: 'Buscar EANs',
      subtitle: 'Fase 3 · Códigos de barras',
      color: '#f59e0b',
      x: 900,
      y: 440,
      page: 'ean-viewer',
      description: 'Busca os códigos EAN/GTIN disponíveis na planilha central do Google Sheets. Cada variação de produto (ex: Camiseta P Preta, Camiseta M Branca) precisa de um EAN único para cadastro no Bling.',
      externalUrl: 'https://docs.google.com/spreadsheets/d/1YQx_542qirlutjeNT5SoRlxNgPpVk5Hq/edit?gid=1549727073'
    },

    // ═══ FASE 4 — EXPORTAÇÃO & ENTREGA ═══
    {
      id: 'gerar-planilha',
      icon: '📋',
      title: 'Gerar Planilha',
      subtitle: 'Fase 4 · Montar CSV',
      color: '#84cc16',
      x: 60,
      y: 620,
      page: 'spreadsheet',
      description: 'Gera a planilha CSV completa com todas as variações do produto. Inclui: código, título (estampa + tipo), descrição formatada, tamanhos (P/M/G/GG/XGG), gênero, marca (BRK), links de imagem do CDN, EANs e preços.',
      externalUrl: null
    },
    {
      id: 'revisar-titulos',
      icon: '✏️',
      title: 'Revisar Títulos',
      subtitle: 'Fase 4 · Qualidade',
      color: '#a3e635',
      x: 340,
      y: 620,
      page: 'spreadsheet',
      description: 'O operador revisa os títulos gerados automaticamente (ex: "Camiseta Arara Azul Masculina BRK") e faz ajustes se necessário. Verifica descrições, preços e informações antes da exportação final.',
      externalUrl: null
    },
    {
      id: 'exportar-csv',
      icon: '💾',
      title: 'Exportar CSV',
      subtitle: 'Fase 4 · Download',
      color: '#7C3AED',
      x: 620,
      y: 620,
      page: 'spreadsheet',
      description: 'Faz o download do arquivo CSV final no formato compatível com o Bling. O arquivo está pronto para importação direta no ERP, contendo todas as informações necessárias para o cadastro dos produtos.',
      externalUrl: null
    },
    {
      id: 'importar-bling',
      icon: '✅',
      title: 'Importar no Bling',
      subtitle: 'Fase 4 · Cadastro final',
      color: '#668800',
      x: 900,
      y: 620,
      page: null,
      description: 'Etapa final: o arquivo CSV é importado no ERP Bling para cadastro oficial dos produtos. Após a importação, os produtos ficam disponíveis para venda nos marketplaces e loja virtual.',
      externalUrl: 'https://www.bling.com.br'
    }
  ];

  const DEFAULT_CONNECTIONS = [
    // Fase 1: Recebimento & Análise
    { id: 'conn-01', from: 'clickup-task',       to: 'analisar-demanda' },
    { id: 'conn-02', from: 'analisar-demanda',   to: 'iniciar-autopilot' },

    // Fase 1 → Fase 2: Transição
    { id: 'conn-03', from: 'iniciar-autopilot',  to: 'smart-scan' },

    // Fase 2: Coleta & Organização
    { id: 'conn-04', from: 'smart-scan',         to: 'copiar-imagens' },
    { id: 'conn-05', from: 'copiar-imagens',     to: 'preview-imagens' },
    { id: 'conn-06', from: 'preview-imagens',    to: 'criar-pastas' },

    // Fase 2 → Fase 3: Transição
    { id: 'conn-07', from: 'criar-pastas',       to: 'organizar-imagens' },

    // Fase 3: Processamento (paralelo)
    { id: 'conn-08', from: 'organizar-imagens',  to: 'upload-cdn' },
    { id: 'conn-09', from: 'upload-cdn',         to: 'gerar-links' },
    { id: 'conn-10', from: 'organizar-imagens',  to: 'buscar-eans' },

    // Fase 3 → Fase 4: Links + EANs convergem
    { id: 'conn-11', from: 'gerar-links',        to: 'gerar-planilha' },
    { id: 'conn-12', from: 'buscar-eans',        to: 'gerar-planilha' },

    // Fase 4: Exportação
    { id: 'conn-13', from: 'gerar-planilha',     to: 'revisar-titulos' },
    { id: 'conn-14', from: 'revisar-titulos',    to: 'exportar-csv' },
    { id: 'conn-15', from: 'exportar-csv',       to: 'importar-bling' }
  ];

  let flowNodes = [];
  let flowConnections = [];

  function loadFlowState() {
    const savedNodes = localStorage.getItem('hub_flow_nodes');
    const savedConns = localStorage.getItem('hub_flow_connections');
    if (savedNodes && savedConns) {
      try {
        flowNodes = JSON.parse(savedNodes);
        flowConnections = JSON.parse(savedConns);
        
        // Assegura que conexões antigas possuam ID
        flowConnections = flowConnections.map(c => ({
          ...c,
          id: c.id || 'conn-' + Date.now() + Math.random().toString(36).substr(2, 5)
        }));
      } catch (e) {
        console.error('Error parsing flow state', e);
        flowNodes = JSON.parse(JSON.stringify(DEFAULT_NODES));
        flowConnections = JSON.parse(JSON.stringify(DEFAULT_CONNECTIONS));
      }
    } else {
      flowNodes = JSON.parse(JSON.stringify(DEFAULT_NODES));
      flowConnections = JSON.parse(JSON.stringify(DEFAULT_CONNECTIONS));
    }
  }

  function saveFlowState() {
    localStorage.setItem('hub_flow_nodes', JSON.stringify(flowNodes));
    localStorage.setItem('hub_flow_connections', JSON.stringify(flowConnections));
  }

  const canvasState = {
    zoom: 0.85,
    panX: 20,
    panY: 10,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    
    selectedNode: null,
    selectedConnection: null,
    
    draggingNode: null,
    dragOffset: { x: 0, y: 0 },
    
    isDrawingConnection: false,
    connectionSource: null,
    mouseX: 0,
    mouseY: 0,
    
    showPanel: false
  };

  const NODE_W = 200;
  const NODE_H = 60;

  // Gerenciamento de eventos globais para limpeza em re-render
  let globalHandlers = [];
  function addGlobalListener(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    globalHandlers.push({ target, event, handler, options });
  }
  function cleanupGlobalListeners() {
    for (const h of globalHandlers) {
      h.target.removeEventListener(h.event, h.handler, h.options);
    }
    globalHandlers = [];
  }

  function render() {
    cleanupGlobalListeners();
    
    // Forçar novo layout — limpar estado salvo antigo se não tem os novos nós
    const savedNodes = localStorage.getItem('hub_flow_nodes');
    if (savedNodes) {
      try {
        const parsed = JSON.parse(savedNodes);
        const hasNewNodes = parsed.some(n => n.id === 'clickup-task' || n.id === 'smart-scan');
        if (!hasNewNodes) {
          localStorage.removeItem('hub_flow_nodes');
          localStorage.removeItem('hub_flow_connections');
        }
      } catch (e) {
        localStorage.removeItem('hub_flow_nodes');
        localStorage.removeItem('hub_flow_connections');
      }
    }
    
    loadFlowState();

    const container = document.getElementById('app-content');

    container.innerHTML = `
      <div class="flow-canvas-wrapper" id="flow-wrapper">
        <div class="flow-toolbar">
          <button class="btn btn--primary btn--sm" id="flow-add-node">+ Novo Nó</button>
          <button class="btn btn--danger btn--sm" id="flow-delete-node" disabled>🗑️ Remover Nó</button>
          <button class="btn btn--secondary btn--sm" id="flow-reset">⟳ Resetar Fluxo</button>
          <div class="flow-toolbar__spacer"></div>
          <button class="btn btn--icon" id="zoom-in" title="Zoom In">+</button>
          <button class="btn btn--icon" id="zoom-reset" title="Reset">⟳</button>
          <button class="btn btn--icon" id="zoom-out" title="Zoom Out">−</button>
        </div>

        <div class="flow-canvas" id="flow-canvas" style="transform: translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom}); transform-origin: 0 0;">
          
          <!-- Phase Labels -->
          ${renderPhaseLabels()}

          <svg class="flow-connections" id="flow-svg" style="overflow: visible; position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></svg>
          
          <div id="flow-nodes-container">
            ${renderNodes()}
          </div>
        </div>

        <div id="node-panel-container"></div>
        <div id="modal-container"></div>
      </div>
    `;

    drawConnections();
    bind();
  }

  function renderPhaseLabels() {
    const phases = [
      { y: 30,  label: 'FASE 1', name: 'Recebimento & Análise', color: '#88CC00', icon: '📥' },
      { y: 210, label: 'FASE 2', name: 'Coleta & Organização',  color: '#0ea5e9', icon: '📡' },
      { y: 390, label: 'FASE 3', name: 'Processamento',          color: '#88CC00', icon: '⚙️' },
      { y: 570, label: 'FASE 4', name: 'Exportação & Entrega',   color: '#84cc16', icon: '📦' }
    ];
    return phases.map(p => `
      <div class="flow-phase-label" style="
        position: absolute;
        left: -5px;
        top: ${p.y}px;
        width: calc(100% + 10px);
        height: 160px;
        background: linear-gradient(135deg, ${p.color}08, ${p.color}04);
        border-left: 3px solid ${p.color}40;
        border-radius: 0 12px 12px 0;
        pointer-events: none;
        z-index: 0;
      ">
        <div style="
          position: absolute;
          left: 16px;
          top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: ${p.color}90;
        ">
          <span style="font-size: 14px;">${p.icon}</span>
          <span>${p.label}</span>
          <span style="font-weight: 400; letter-spacing: 0.5px; opacity: 0.7;">— ${p.name}</span>
        </div>
      </div>
    `).join('');
  }
  
  function renderNodes() {
    return flowNodes.map(node => `
      <div class="flow-node ${canvasState.selectedNode === node.id ? 'selected' : ''}"
           id="node-${node.id}"
           data-node-id="${node.id}"
           style="left:${node.x}px; top:${node.y}px;">
        <div class="flow-node__accent" style="background:${node.color};"></div>
        <div class="flow-port flow-port--in" data-node-id="${node.id}" style="border-color:${node.color};"></div>
        <div class="flow-node__header">
          <span class="flow-node__icon">${node.icon}</span>
          <span class="flow-node__title">${node.title}</span>
        </div>
        <div class="flow-node__subtitle">${node.subtitle}</div>
        <div class="flow-port flow-port--out" data-node-id="${node.id}" style="border-color:${node.color};"></div>
      </div>
    `).join('');
  }

  function drawConnections() {
    const svg = document.getElementById('flow-svg');
    if (!svg) return;

    // Remove old particles
    const oldParticles = document.querySelectorAll('.flow-particle');
    oldParticles.forEach(p => p.remove());

    let svgContent = '';
    const particleContainer = document.getElementById('flow-nodes-container');

    // Add SVG defs for glow filter
    svgContent += `<defs>
      <filter id="energy-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>`;

    flowConnections.forEach((conn, idx) => {
      const fromNode = flowNodes.find(n => n.id === conn.from);
      const toNode   = flowNodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return;

      const x1 = fromNode.x + NODE_W;
      const y1 = fromNode.y + NODE_H / 2;
      const x2 = toNode.x;
      const y2 = toNode.y + NODE_H / 2;

      const dx = Math.abs(x2 - x1) * 0.45;
      const cp1x = x1 + dx;
      const cp1y = y1;
      const cp2x = x2 - dx;
      const cp2y = y2;
      
      const d = `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
      const color = fromNode.color;
      const isSelected = canvasState.selectedConnection === conn.id;
      const groupClass = isSelected ? 'flow-connection--selected' : '';
      const delay = idx * 0.3;

      svgContent += `<g class="${groupClass}" data-conn-id="${conn.id}">
        <!-- Glow layer -->
        <path class="flow-conn-glow" d="${d}" stroke="${color}"
              style="animation-delay:${delay}s;" filter="url(#energy-glow)"/>
        <!-- Base dim line -->
        <path class="flow-conn-base" d="${d}" stroke="${color}"/>
        <!-- Animated trail -->
        <path class="flow-conn-trail" d="${d}" stroke="${color}"
              style="animation-delay:${delay}s;"/>
        <!-- Fast bright trail -->
        <path class="flow-conn-trail-fast" d="${d}" stroke="${color}"
              style="animation-delay:${delay + 0.6}s;"/>
        <!-- Hit area for clicks -->
        <path class="flow-conn-hit" d="${d}" id="${conn.id}"
              data-conn-id="${conn.id}"/>
      </g>`;

      // Create particle dots (HTML elements using offset-path)
      if (particleContainer) {
        for (let p = 0; p < 2; p++) {
          const particle = document.createElement('div');
          particle.className = 'flow-particle';
          particle.style.cssText = `
            background: ${color};
            offset-path: path('${d}');
            offset-rotate: 0deg;
            animation-delay: ${delay + p * 1.1}s;
            animation-duration: ${1.8 + p * 0.6}s;
          `;
          particleContainer.appendChild(particle);
        }
      }
    });
    
    // Draw temporary connection while dragging
    if (canvasState.isDrawingConnection && canvasState.connectionSource) {
      const fromNode = flowNodes.find(n => n.id === canvasState.connectionSource);
      if (fromNode) {
        const x1 = fromNode.x + NODE_W;
        const y1 = fromNode.y + NODE_H / 2;
        
        const canvas = document.getElementById('flow-canvas');
        const rect = canvas.getBoundingClientRect();
        const x2 = (canvasState.mouseX - rect.left) / canvasState.zoom;
        const y2 = (canvasState.mouseY - rect.top) / canvasState.zoom;
        
        const dx = Math.abs(x2 - x1) * 0.45;
        const cp1x = x1 + dx;
        const cp1y = y1;
        const cp2x = x2 - dx;
        const cp2y = y2;
        
        svgContent += `<path class="flow-conn-base" 
                    d="M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}"
                    stroke="${fromNode.color}" opacity="0.6" stroke-dasharray="6 6"/>`;
      }
    }

    svg.innerHTML = svgContent;
  }
  
  function openNodeModal(nodeId = null) {
      const isEdit = !!nodeId;
      const node = isEdit ? flowNodes.find(n => n.id === nodeId) : {
          icon: '📌', title: '', subtitle: '', color: '#6366f1', description: ''
      };
      
      const modalHtml = `
        <div class="modal-overlay" id="flow-modal" style="display: flex; justify-content: center; align-items: center; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;">
          <div class="modal" style="background: var(--bg-card); padding: 24px; border-radius: 8px; width: 400px; max-width: 90%; border: 1px solid var(--border-color);">
            <h3 style="margin-top: 0;">${isEdit ? 'Editar Nó' : 'Novo Nó'}</h3>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" style="display: block; margin-bottom: 4px;">Ícone (emoji)</label>
              <input type="text" class="form-input" id="node-icon" value="${node.icon}" maxlength="4" style="width: 100%; padding: 8px; background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 4px;">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" style="display: block; margin-bottom: 4px;">Título</label>
              <input type="text" class="form-input" id="node-title" value="${node.title}" placeholder="Nome do passo" style="width: 100%; padding: 8px; background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 4px;">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" style="display: block; margin-bottom: 4px;">Subtítulo</label>
              <input type="text" class="form-input" id="node-subtitle" value="${node.subtitle}" placeholder="Descrição curta" style="width: 100%; padding: 8px; background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 4px;">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" style="display: block; margin-bottom: 4px;">Cor</label>
              <input type="color" class="form-input" id="node-color" value="${node.color}" style="width: 100%; height: 40px; padding: 4px; background: var(--bg-body); border: 1px solid var(--border-color); border-radius: 4px;">
            </div>
            <div class="form-group" style="margin-bottom: 12px;">
              <label class="form-label" style="display: block; margin-bottom: 4px;">Descrição</label>
              <textarea class="form-input" id="node-desc" rows="3" placeholder="Descrição detalhada" style="width: 100%; padding: 8px; background: var(--bg-body); border: 1px solid var(--border-color); color: var(--text-color); border-radius: 4px;">${node.description}</textarea>
            </div>
            <div style="display:flex;gap:12px;margin-top:20px">
              <button class="btn btn--primary" id="modal-save" style="flex:1">Salvar</button>
              <button class="btn btn--secondary" id="modal-cancel" style="flex:1">Cancelar</button>
            </div>
          </div>
        </div>
      `;
      
      const container = document.getElementById('modal-container');
      container.innerHTML = modalHtml;
      
      document.getElementById('modal-save').addEventListener('click', () => {
          const icon = document.getElementById('node-icon').value || '📌';
          const title = document.getElementById('node-title').value || 'Sem título';
          const subtitle = document.getElementById('node-subtitle').value || '';
          const color = document.getElementById('node-color').value || '#6366f1';
          const description = document.getElementById('node-desc').value || '';
          
          if (isEdit) {
              const idx = flowNodes.findIndex(n => n.id === nodeId);
              if (idx >= 0) {
                  flowNodes[idx] = { ...flowNodes[idx], icon, title, subtitle, color, description };
              }
          } else {
              const wrapper = document.getElementById('flow-wrapper');
              const wrapperRect = wrapper.getBoundingClientRect();
              const x = (wrapperRect.width / 2 - canvasState.panX) / canvasState.zoom - NODE_W / 2;
              const y = (wrapperRect.height / 2 - canvasState.panY) / canvasState.zoom - NODE_H / 2;
              
              flowNodes.push({
                  id: 'node-' + Date.now(),
                  icon, title, subtitle, color, description,
                  x, y, page: null, externalUrl: null
              });
          }
          
          saveFlowState();
          container.innerHTML = '';
          updateCanvas();
          if (isEdit && canvasState.selectedNode === nodeId) {
              showNodePanel(nodeId);
          }
      });
      
      document.getElementById('modal-cancel').addEventListener('click', () => {
          container.innerHTML = '';
      });
  }
  
  function deleteSelectedNode() {
      if (!canvasState.selectedNode) return;
      
      if (confirm('Tem certeza que deseja remover este nó? Todas as conexões serão perdidas.')) {
          const nodeId = canvasState.selectedNode;
          flowNodes = flowNodes.filter(n => n.id !== nodeId);
          flowConnections = flowConnections.filter(c => c.from !== nodeId && c.to !== nodeId);
          
          canvasState.selectedNode = null;
          saveFlowState();
          hideNodePanel();
          updateCanvas();
      }
  }

  function showNodePanel(nodeId) {
    const node = flowNodes.find(n => n.id === nodeId);
    if (!node) return;

    canvasState.selectedNode = nodeId;
    canvasState.selectedConnection = null;
    canvasState.showPanel = true;
    
    document.getElementById('flow-delete-node').disabled = false;

    document.querySelectorAll('.flow-node').forEach(el => {
      el.classList.toggle('selected', el.dataset.nodeId === nodeId);
    });

    const panelContainer = document.getElementById('node-panel-container');

    let actionBtn = '';
    if (node.page) {
      actionBtn = `<button class="btn btn--primary btn--block" id="panel-open-module">Abrir Módulo</button>`;
    } else if (node.externalUrl) {
      actionBtn = `<a href="${node.externalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--block">Abrir Link Externo ↗</a>`;
    }

    panelContainer.innerHTML = `
      <div class="node-panel">
        <button class="node-panel__close" id="panel-close">✕</button>
        <div class="node-panel__icon">${node.icon}</div>
        <h3 class="node-panel__title">${node.title}</h3>
        <p class="node-panel__desc">${node.description}</p>
        <div class="node-panel__status">
          <span class="status-dot status-dot--online"></span>
          <span style="color:var(--success);">Ativo</span>
        </div>
        <div style="margin-top: 16px;">
            <button class="btn btn--secondary btn--block" id="panel-edit-node" style="margin-bottom: 8px;">✏️ Editar Nó</button>
            ${actionBtn}
        </div>
      </div>
    `;

    document.getElementById('panel-close')?.addEventListener('click', hideNodePanel);
    document.getElementById('panel-edit-node')?.addEventListener('click', () => {
        openNodeModal(nodeId);
    });

    if (node.page) {
      document.getElementById('panel-open-module')?.addEventListener('click', () => {
        if (window.HUB && window.HUB.navigate) window.HUB.navigate(node.page);
      });
    }
    
    drawConnections();
  }

  function hideNodePanel() {
    canvasState.selectedNode = null;
    canvasState.showPanel = false;
    const delBtn = document.getElementById('flow-delete-node');
    if(delBtn) delBtn.disabled = true;

    document.querySelectorAll('.flow-node').forEach(el => el.classList.remove('selected'));

    const panelContainer = document.getElementById('node-panel-container');
    if (panelContainer) panelContainer.innerHTML = '';
  }
  
  function updateCanvas() {
      const nodesContainer = document.getElementById('flow-nodes-container');
      if (nodesContainer) {
          nodesContainer.innerHTML = renderNodes();
      }
      
      const canvas = document.getElementById('flow-canvas');
      if (canvas) {
          canvas.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
      }
      
      drawConnections();
      bindNodes();
  }

  function bindNodes() {
      document.querySelectorAll('.flow-node').forEach(nodeEl => {
        const nodeId = nodeEl.dataset.nodeId;
        
        nodeEl.addEventListener('dblclick', (e) => {
            if (e.target.classList.contains('flow-port')) return;
            openNodeModal(nodeId);
        });

        nodeEl.addEventListener('mousedown', (e) => {
          if (e.target.classList.contains('flow-port')) return;
          if (canvasState.isPanning) return; 

          const node = flowNodes.find(n => n.id === nodeId);
          if (!node) return;

          canvasState.draggingNode = nodeId;
          
          const rect = document.getElementById('flow-canvas').getBoundingClientRect();
          canvasState.dragOffset.x = (e.clientX - rect.left) / canvasState.zoom - node.x;
          canvasState.dragOffset.y = (e.clientY - rect.top) / canvasState.zoom - node.y;
          
          nodeEl.classList.add('dragging');
          e.preventDefault();
        });

        nodeEl.addEventListener('click', (e) => {
          if (e.target.classList.contains('flow-port')) return;
          if (canvasState.isPanning) return;
          
          if (canvasState.selectedNode !== nodeId) {
            showNodePanel(nodeId);
          }
        });
      });
      
      document.querySelectorAll('.flow-port--out').forEach(port => {
          port.addEventListener('mousedown', (e) => {
              e.stopPropagation();
              const nodeId = port.dataset.nodeId;
              canvasState.isDrawingConnection = true;
              canvasState.connectionSource = nodeId;
              canvasState.mouseX = e.clientX;
              canvasState.mouseY = e.clientY;
          });
      });
      
      document.querySelectorAll('.flow-port--in').forEach(port => {
          port.addEventListener('mouseup', (e) => {
              if (canvasState.isDrawingConnection && canvasState.connectionSource) {
                  const toNode = port.dataset.nodeId;
                  const fromNode = canvasState.connectionSource;
                  
                  if (fromNode !== toNode) {
                      const exists = flowConnections.some(c => c.from === fromNode && c.to === toNode);
                      if (!exists) {
                          flowConnections.push({
                              id: 'conn-' + Date.now(),
                              from: fromNode,
                              to: toNode
                          });
                          saveFlowState();
                          updateCanvas();
                      }
                  }
              }
          });
      });
  }

  function bind() {
    const wrapper = document.getElementById('flow-wrapper');
    
    document.getElementById('flow-add-node')?.addEventListener('click', () => openNodeModal(null));
    
    document.getElementById('flow-delete-node')?.addEventListener('click', () => deleteSelectedNode());
    
    document.getElementById('flow-reset')?.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja restaurar o fluxo original? Todas as alterações serão perdidas.')) {
            localStorage.removeItem('hub_flow_nodes');
            localStorage.removeItem('hub_flow_connections');
            hideNodePanel();
            render();
        }
    });

    bindNodes();

    addGlobalListener(wrapper, 'mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            canvasState.isPanning = true;
            canvasState.panStart = { x: e.clientX - canvasState.panX, y: e.clientY - canvasState.panY };
            wrapper.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    addGlobalListener(document, 'mousemove', (e) => {
      if (canvasState.isPanning) {
          canvasState.panX = e.clientX - canvasState.panStart.x;
          canvasState.panY = e.clientY - canvasState.panStart.y;
          const canvas = document.getElementById('flow-canvas');
          if (canvas) canvas.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
          return;
      }
      
      if (canvasState.draggingNode) {
        const node = flowNodes.find(n => n.id === canvasState.draggingNode);
        if (!node) return;

        const canvas = document.getElementById('flow-canvas');
        const rect = canvas.getBoundingClientRect();
        
        node.x = (e.clientX - rect.left) / canvasState.zoom - canvasState.dragOffset.x;
        node.y = (e.clientY - rect.top) / canvasState.zoom - canvasState.dragOffset.y;

        const nodeEl = document.getElementById(`node-${canvasState.draggingNode}`);
        if (nodeEl) {
          nodeEl.style.left = `${node.x}px`;
          nodeEl.style.top  = `${node.y}px`;
        }

        drawConnections();
      }
      
      if (canvasState.isDrawingConnection) {
          canvasState.mouseX = e.clientX;
          canvasState.mouseY = e.clientY;
          drawConnections();
      }
    });

    addGlobalListener(document, 'mouseup', (e) => {
      if (canvasState.isPanning) {
          canvasState.isPanning = false;
          wrapper.style.cursor = '';
      }
        
      if (canvasState.draggingNode) {
        const nodeEl = document.getElementById(`node-${canvasState.draggingNode}`);
        if (nodeEl) nodeEl.classList.remove('dragging');
        canvasState.draggingNode = null;
        saveFlowState();
      }
      
      if (canvasState.isDrawingConnection) {
          canvasState.isDrawingConnection = false;
          canvasState.connectionSource = null;
          drawConnections();
      }
    });

    addGlobalListener(wrapper, 'click', (e) => {
        const connEl = e.target.closest('[data-conn-id]');
        if (connEl) {
            const connId = connEl.dataset.connId;
            canvasState.selectedConnection = connId;
            hideNodePanel();
            drawConnections();
        } else if (!e.target.closest('.flow-node')) {
            canvasState.selectedConnection = null;
            if (!canvasState.isPanning) {
                hideNodePanel();
            }
            drawConnections();
        }
    });

    addGlobalListener(document, 'keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (canvasState.selectedConnection) {
                flowConnections = flowConnections.filter(c => c.id !== canvasState.selectedConnection);
                canvasState.selectedConnection = null;
                saveFlowState();
                drawConnections();
            } else if (canvasState.selectedNode) {
                deleteSelectedNode();
            }
        }
    });

    addGlobalListener(wrapper, 'contextmenu', (e) => {
        const connEl = e.target.closest('[data-conn-id]');
        if (connEl) {
            e.preventDefault();
            const connId = connEl.dataset.connId;
            if (confirm('Deseja remover esta conexão?')) {
                flowConnections = flowConnections.filter(c => c.id !== connId);
                canvasState.selectedConnection = null;
                saveFlowState();
                drawConnections();
            }
        }
    });

    document.getElementById('zoom-in')?.addEventListener('click', () => {
      canvasState.zoom = Math.min(canvasState.zoom + 0.1, 1.5);
      updateCanvas();
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
      canvasState.zoom = Math.max(canvasState.zoom - 0.1, 0.4);
      updateCanvas();
    });

    document.getElementById('zoom-reset')?.addEventListener('click', () => {
      canvasState.zoom = 1;
      canvasState.panX = 0;
      canvasState.panY = 0;
      updateCanvas();
    });
  }

  window.HUB.renderFlow = function () {
    canvasState.selectedNode = null;
    canvasState.selectedConnection = null;
    canvasState.showPanel = false;
    canvasState.draggingNode = null;
    canvasState.isPanning = false;
    canvasState.isDrawingConnection = false;
    render();
  };
})();
