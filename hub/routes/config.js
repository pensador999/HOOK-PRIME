/**
 * @module routes/config
 * @audit Extracted from server.js
 */
'use strict';
const router = require('express').Router();


module.exports = function(deps) {
  const { upload, productCategories, sizePatterns, fs, path, baseDir } = deps;

  // Proxy para buscar EANs do Google Sheets (resolve CORS)
  router.get('/api/ean-proxy', async (req, res) => {
    try {
      const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1TKBygIkhWIANBH337u-VQljz4MzLsB_W/export?format=csv&gid=1752445302';
      const response = await fetch(SHEET_URL);
      if (!response.ok) {
        return res.status(response.status).json({ error: `Google Sheets retornou ${response.status}` });
      }
      const csv = await response.text();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(csv);
    } catch (err) {
      console.error('❌ Erro no proxy EAN:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Rota de configuração (expõe dados de config para o frontend) ────────────
  router.get('/api/config/categories', (req, res) => {
    res.json(productCategories);
  });

  router.get('/api/config/sizes', (req, res) => {
    res.json(sizePatterns);
  });

  router.get('/api/config/templates/:type', (req, res) => {
    const { type } = req.params;
    if (type === 'bling') {
      try {
        const templateBling = JSON.parse(
          fs.readFileSync(path.join(baseDir, 'config', 'templates-bling.json'), 'utf-8')
        );
        res.json(templateBling);
      } catch (err) {
        console.error('Erro ao ler template bling:', err.message);
        res.status(500).json({ error: 'Erro ao carregar template.', details: err.message });
      }
    } else {
      res.status(404).json({ error: `Template "${type}" não encontrado.` });
    }
  });

  router.post('/api/crosser/parse-xls', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
      }

      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);

      const ws = workbook.worksheets[0];
      if (!ws) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'O arquivo Excel está vazio (sem planilhas).' });
      }
      const rows = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        rows.push(row.values.slice(1)); // row.values is 1-indexed, slice(1) to make 0-indexed
      });

      // Limpar arquivo temporário
      fs.unlink(req.file.path, () => {});

      console.log(`📋 Crosser: planilha parseada — ${rows.length} linhas`);

      res.json({
        success: true,
        rows,
        totalRows: rows.length,
        sheetName: ws.name,
      });
    } catch (err) {
      console.error('❌ Erro ao parsear XLS:', err.message);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
