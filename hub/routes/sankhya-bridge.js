'use strict';

/**
 * Step 7 — Converter para Sankhya (Padrão Ouro 45 colunas)
 * Conecta ao HUNTER HS API Bridge (porta 5000) para conversão.
 */

module.exports = function(deps) {
  const { express, fs, path, uploadsDir } = deps;
  const router = express.Router();
  const HUNTER_API = 'http://127.0.0.1:5000';

  // ═══ Health check do HUNTER HS ═══
  router.get('/api/sankhya/health', async (req, res) => {
    try {
      const resp = await fetch(`${HUNTER_API}/api/health`);
      const data = await resp.json();
      res.json({ connected: true, ...data });
    } catch (err) {
      res.json({
        connected: false,
        error: 'HUNTER HS API não está rodando. Execute iniciar_suite.bat.',
        details: err.message,
      });
    }
  });

  // ═══ Converter CSV do Bling para Sankhya 45 colunas ═══
  router.post('/api/sankhya/formatar', async (req, res) => {
    try {
      const { taskId, modo = 'auto' } = req.body;

      // Encontrar o CSV exportado no Step 6
      const taskDir = path.join(uploadsDir, 'autopilot', taskId || '');
      let csvPath = '';

      if (taskId && fs.existsSync(taskDir)) {
        // Procurar CSV gerado no Step 6
        const files = fs.readdirSync(taskDir).filter(f => f.endsWith('.csv'));
        if (files.length > 0) {
          csvPath = path.join(taskDir, files[files.length - 1]);
        }
      }

      // Se não achou por taskId, tentar pelo body
      if (!csvPath && req.body.csvPath) {
        csvPath = req.body.csvPath;
      }

      if (!csvPath || !fs.existsSync(csvPath)) {
        return res.status(404).json({
          error: 'CSV do Bling não encontrado.',
          hint: 'Complete o Step 6 primeiro ou forneça csvPath.',
        });
      }

      // Enviar para o HUNTER HS API
      const csvBuffer = fs.readFileSync(csvPath);
      const formData = new FormData();
      formData.append('arquivo', new Blob([csvBuffer], { type: 'text/csv' }), 'bling_export.csv');
      formData.append('modo', modo);
      formData.append('formato', 'json');
      formData.append('dedup', 'true');

      const resp = await fetch(`${HUNTER_API}/api/formatar-sankhya`, {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json();
        return res.status(resp.status).json(err);
      }

      const result = await resp.json();

      // Salvar o resultado como CSV e XLSX localmente
      if (result.success && result.data) {
        const outDir = path.join(taskDir, 'sankhya');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // Baixar CSV formatado
        const csvResp = await fetch(`${HUNTER_API}/api/formatar-sankhya`, {
          method: 'POST',
          body: (() => {
            const fd = new FormData();
            fd.append('arquivo', new Blob([csvBuffer], { type: 'text/csv' }), 'bling_export.csv');
            fd.append('modo', modo);
            fd.append('formato', 'csv');
            fd.append('dedup', 'true');
            return fd;
          })(),
        });
        const csvOut = Buffer.from(await csvResp.arrayBuffer());
        fs.writeFileSync(path.join(outDir, 'sankhya_ouro.csv'), csvOut);

        // Baixar XLSX formatado
        const xlsResp = await fetch(`${HUNTER_API}/api/formatar-sankhya`, {
          method: 'POST',
          body: (() => {
            const fd = new FormData();
            fd.append('arquivo', new Blob([csvBuffer], { type: 'text/csv' }), 'bling_export.csv');
            fd.append('modo', modo);
            fd.append('formato', 'xlsx');
            fd.append('dedup', 'true');
            return fd;
          })(),
        });
        const xlsOut = Buffer.from(await xlsResp.arrayBuffer());
        fs.writeFileSync(path.join(outDir, 'sankhya_ouro.xlsx'), xlsOut);

        result.files = {
          csv: path.join(outDir, 'sankhya_ouro.csv'),
          xlsx: path.join(outDir, 'sankhya_ouro.xlsx'),
        };
      }

      res.json(result);

    } catch (err) {
      console.error('[Sankhya] Erro na conversão:', err.message);
      res.status(500).json({
        error: 'Erro ao conectar com HUNTER HS API.',
        details: err.message,
        hint: 'Verifique se o iniciar_suite.bat está rodando.',
      });
    }
  });

  // ═══ Download de arquivo Sankhya ═══
  router.get('/api/sankhya/download/:taskId/:format', (req, res) => {
    try {
      const { taskId, format } = req.params;
      // Sanitize taskId — block path traversal
      if (/[\\\/\.\:]/.test(taskId) || taskId.includes('..')) {
        return res.status(400).json({ error: 'taskId inválido.' });
      }
      const ext = format === 'xlsx' ? 'sankhya_ouro.xlsx' : 'sankhya_ouro.csv';
      const filePath = path.resolve(uploadsDir, 'autopilot', taskId, 'sankhya', ext);
      const safeBase = path.resolve(uploadsDir);

      // Verify resolved path is within uploadsDir
      if (!filePath.startsWith(safeBase + path.sep)) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado. Execute a conversão primeiro.' });
      }

      res.download(filePath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: 'Erro ao enviar arquivo.' });
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Erro interno.', details: err.message });
    }
  });

  return router;
};
