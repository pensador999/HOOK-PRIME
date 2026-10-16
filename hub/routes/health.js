/**
 * @module routes/health
 * @audit Extracted from server.js
 */
'use strict';
const router = require('express').Router();

module.exports = function({ autopilotTasks, BRK_LINK_URL }) {
  // Verificação de saúde do servidor
  router.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
  });

  // Health check para o Tampermonkey saber se o Hub está online
  router.get('/api/autopilot/ping', (req, res) => {
    res.json({ online: true, tasks: autopilotTasks.length, timestamp: new Date().toISOString() });
  });

  // ─── GET /api/s3-proxy/health — Verifica se o BRK Link está online ───────────
  router.get('/api/s3-proxy/health', async (req, res) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(BRK_LINK_URL, {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      res.json({ online: response.ok, status: response.status });
    } catch (err) {
      res.json({ online: false, error: err.message });
    }
  });

  return router;
};
