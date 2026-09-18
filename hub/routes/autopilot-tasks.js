/**
 * @module routes/autopilot-tasks
 * @audit Extracted from server.js
 */
'use strict';
const router = require('express').Router();

module.exports = function({ autopilotTasks, autopilotClients, saveTasksToDisk, networkPrefixes, resolvePrefixConfig }) {

router.get('/api/autopilot/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Envia as tarefas atuais ao conectar
  res.write(`event: init\ndata: ${JSON.stringify({ tasks: autopilotTasks })}\n\n`);
  
  // Heartbeat a cada 30s para manter conexão viva (proxies/browsers cortam idle)
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);
  
  autopilotClients.push(res);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    const idx = autopilotClients.indexOf(res);
    if (idx !== -1) autopilotClients.splice(idx, 1);
  });
});

// Recebe as tarefas lidas pelo Tampermonkey
router.post('/api/autopilot/tasks', (req, res) => {
  try {
    const { title, description, url } = req.body;
    
    // Extrai os códigos da descrição usando Regex. Ex: FUSION181, CAX047, CANECA069
    // Procura por palavras que começam com letras maiúsculas seguidas de números
    const codeRegex = /\b[A-Z]+[0-9]+\b/g;
    const foundCodes = description ? description.match(codeRegex) || [] : [];
    
    // Agrupa os códigos pelos seus prefixos (ex: FUSION, CAX, BM, C0)
    // Usa longest-match contra prefixos conhecidos
    const groupedCodes = {};
    foundCodes.forEach(code => {
      const upper = code.toUpperCase();
      const knownKeys = Object.keys(networkPrefixes).filter(k => !k.startsWith('_')).sort((a, b) => b.length - a.length);
      let prefix = null;
      for (const key of knownKeys) {
        if (upper.startsWith(key)) { prefix = key; break; }
      }
      // Fallback: extrair só letras se prefixo desconhecido
      if (!prefix) {
        const m = code.match(/^[A-Z]+/);
        prefix = m ? m[0] : code;
      }
      if (!groupedCodes[prefix]) groupedCodes[prefix] = [];
      if (!groupedCodes[prefix].includes(code)) {
        groupedCodes[prefix].push(code);
      }
    });

    const fullText = ((title || '') + ' ' + (description || '')).toUpperCase();
    const rangeRegex = /([A-Za-z]+)(\d+)[ \t]*(?:a|até|→|-)[ \t]*(?:[A-Za-z]*)(\d+)/gi;
    let rangeMatch;
    while ((rangeMatch = rangeRegex.exec(fullText)) !== null) {
      const rawPrefix = rangeMatch[1].toUpperCase();
      const start = parseInt(rangeMatch[2]);
      const end = parseInt(rangeMatch[3]);
      if (end > start && (end - start) <= 500) {
        for (let i = start; i <= end; i++) {
          const code = `${rawPrefix}${String(i).padStart(rangeMatch[2].length, '0')}`;
          // Use smart prefix matching
          const upper = code.toUpperCase();
          const knownKeys = Object.keys(networkPrefixes).filter(k => !k.startsWith('_')).sort((a, b) => b.length - a.length);
          let smartPrefix = rawPrefix;
          for (const key of knownKeys) {
            if (upper.startsWith(key)) { smartPrefix = key; break; }
          }
          if (!groupedCodes[smartPrefix]) groupedCodes[smartPrefix] = [];
          if (!groupedCodes[smartPrefix].includes(code)) groupedCodes[smartPrefix].push(code);
        }
      }
    }

    let totalCodesCount = 0;
    Object.values(groupedCodes).forEach(arr => totalCodesCount += arr.length);

    const newTask = {
      id: Date.now().toString(),
      title: title || 'Tarefa Desconhecida',
      description: description || '',
      url: url || '#',
      groups: groupedCodes,
      totalCodes: totalCodesCount,
      timestamp: new Date().toISOString(),
      checklist: {
        codigos_definidos: true, // Já que extraímos
        fotos_tiradas: false,
        planilha_exportada: false
      },
      status: 'pending',
      custoTotal: 0
    };
    
    // Evitar duplicatas: por URL real (ignorar '#') OU por título exato
    const isDuplicate = autopilotTasks.some(t => {
      if (newTask.url !== '#' && t.url !== '#' && t.url === newTask.url) return true;
      if (t.title === newTask.title && t.title !== 'Tarefa Desconhecida') return true;
      return false;
    });
    if (isDuplicate) {
      const existing = autopilotTasks.find(t => 
        (newTask.url !== '#' && t.url !== '#' && t.url === newTask.url) ||
        (t.title === newTask.title && t.title !== 'Tarefa Desconhecida')
      );
      return res.json({ success: true, task: existing, duplicate: true });
    }

    autopilotTasks.push(newTask);
    saveTasksToDisk();
    
    // Notifica todos os clientes conectados (Frontend)
    autopilotClients.forEach(client => {
      client.write(`event: new_task\ndata: ${JSON.stringify(newTask)}\n\n`);
    });
    
    console.log('🤖 Autopilot: Nova tarefa processada ->', title);
    res.json({ success: true, task: newTask });
  } catch (err) {
    console.error('❌ Erro no Autopilot:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/autopilot/tasks/:id/status ─────────────────────────────────
// Atualiza o status de uma task (pending, in_progress, done)
router.patch('/api/autopilot/tasks/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(', ')}` });
    }
    const task = autopilotTasks.find(t => t.id === id);
    if (!task) return res.status(404).json({ error: 'Task não encontrada.' });
    task.status = status;
    saveTasksToDisk();
    // Notifica todos os clientes SSE
    autopilotClients.forEach(client => {
      client.write(`event: task_updated\ndata: ${JSON.stringify(task)}\n\n`);
    });
    console.log(`🔄 Task ${id} → ${status}`);
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/autopilot/tasks/:id ────────────────────────────────────────
// Remove uma task do sistema
router.delete('/api/autopilot/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const idx = autopilotTasks.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Task não encontrada.' });
    const removed = autopilotTasks.splice(idx, 1)[0];
    saveTasksToDisk();
    // Notifica todos os clientes SSE
    autopilotClients.forEach(client => {
      client.write(`event: task_deleted\ndata: ${JSON.stringify({ id: removed.id })}\n\n`);
    });
    console.log(`🗑️ Task removida: ${removed.title}`);
    res.json({ success: true, removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  return router;
};
