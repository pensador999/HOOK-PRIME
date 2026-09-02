'use strict';

/**
 * server.js — HUB Hook Prime v3.3
 * 
 * Orquestrador principal: configura Express, middlewares e monta rotas modulares.
 * Cada domínio de rotas está em hub/routes/*.js
 * 
 * @version 3.3.0
 * @audit Phase 3 — Backend Modularization
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  DEPENDÊNCIAS
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const networkSafety = require('./config/network-safety.js');
const imageUtils = require('./config/image-utils.js');

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURAÇÃO DE REDE
// ═══════════════════════════════════════════════════════════════════════════════

// Mapeamento de prefixo de código → pasta na rede (suporta multi-rede)
let networkPrefixes = {};
try {
  networkPrefixes = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'network-prefixes.json'), 'utf8'));
  const realKeys = Object.keys(networkPrefixes).filter(k => !k.startsWith('_'));
  console.log(`📂 ${realKeys.length} prefixos de rede carregados`);
} catch (e) {
  console.warn('⚠️ network-prefixes.json não encontrado');
}

// Resolve um prefixo para { folder, root }
function resolvePrefixConfig(prefix) {
  const val = networkPrefixes[prefix];
  if (!val) return null;
  if (typeof val === 'string') return { folder: val, root: networkSafety.NETWORK_ROOT };
  if (typeof val === 'object' && val.folder) return { folder: val.folder, root: val.root || networkSafety.NETWORK_ROOT };
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SERVIDOR EXPRESS
// ═══════════════════════════════════════════════════════════════════════════════

const app = express();
const PORT = 3000;
const BASE_DIR = __dirname;

// ─── Middlewares globais ─────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  }
}));
app.use(express.json({ limit: '50mb' }));

// Log de requisições API
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`📨 ${req.method} ${req.path}`);
  }
  next();
});

// No-cache para JS/CSS
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

app.use(express.static(path.join(BASE_DIR, 'public')));

// ═══════════════════════════════════════════════════════════════════════════════
//  UPLOADS
// ═══════════════════════════════════════════════════════════════════════════════

const uploadsDir = path.join(BASE_DIR, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// ═══════════════════════════════════════════════════════════════════════════════
//  TEMPLATES E CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

let templateBling = {}, productCategories = {}, sizePatterns = {};
try {
  templateBling = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'config', 'templates-bling.json'), 'utf-8'));
  productCategories = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'config', 'product-categories.json'), 'utf-8'));
  sizePatterns = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'config', 'size-patterns.json'), 'utf-8'));
} catch (err) {
  console.error('❌ Erro ao ler arquivos de configuração no startup:', err.message);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTOPILOT STATE (shared mutable state)
// ═══════════════════════════════════════════════════════════════════════════════

const TASKS_FILE = path.join(__dirname, 'config', 'tasks.json');

let autopilotTasks = [];
try {
  if (fs.existsSync(TASKS_FILE)) {
    autopilotTasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    console.log(`📋 ${autopilotTasks.length} tarefa(s) carregada(s) do disco`);
  }
} catch (e) {
  console.warn('⚠️ Erro ao ler tasks.json:', e.message);
  autopilotTasks = [];
}

function saveTasksToDisk() {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(autopilotTasks, null, 2));
  } catch (e) {
    console.warn('⚠️ Erro ao salvar tasks.json:', e.message);
  }
}

let autopilotClients = [];

// ═══════════════════════════════════════════════════════════════════════════════
//  MONTAGEM DAS ROTAS MODULARES
// ═══════════════════════════════════════════════════════════════════════════════

// Dependências compartilhadas entre os módulos de rotas
const sharedDeps = {
  upload, uploadsDir, fs, path, sharp,
  networkSafety, imageUtils,
  networkPrefixes, resolvePrefixConfig,
  autopilotTasks, autopilotClients, saveTasksToDisk,
  productCategories, sizePatterns, templateBling,
  baseDir: BASE_DIR,
};

// S3 Proxy (precisa ser montado primeiro para exportar BRK_LINK_URL)
const s3ProxyRouter = require('./routes/s3-proxy.js')(sharedDeps);
app.use(s3ProxyRouter);

// Exportar BRK_LINK_URL e uploadToBrkLink do s3-proxy para outros módulos
const BRK_LINK_URL = s3ProxyRouter.BRK_LINK_URL;
sharedDeps.BRK_LINK_URL = BRK_LINK_URL;
sharedDeps.uploadToBrkLink = s3ProxyRouter.uploadToBrkLink;

// Health & Status
app.use(require('./routes/health.js')(sharedDeps));

// Configuração & Proxies
app.use(require('./routes/config.js')(sharedDeps));

// Autopilot — Tarefas (CRUD + SSE)
app.use(require('./routes/autopilot-tasks.js')(sharedDeps));

// Autopilot — Imagens (scan, copy, preview, spreadsheet)
app.use(require('./routes/autopilot-images.js')(sharedDeps));

// Pastas & Operações com Arquivos Locais
app.use(require('./routes/folders.js')(sharedDeps));

// Scanner de Rede UNC & Multi-Rede
app.use(require('./routes/network.js')(sharedDeps));

// Sankhya Bridge — Ponte para HUNTER HS API (Python/Flask :5000)
app.use(require('./routes/sankhya-bridge.js')({ express, fs, path, uploadsDir }));

// Gemini Vision — Reconhecimento de Estampas por IA
app.use(require('./routes/gemini-vision.js')({ fs, path }));

// ═══════════════════════════════════════════════════════════════════════════════
//  STATIC & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/uploads', express.static(uploadsDir));

app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

process.on('uncaughtException', (err) => {
  console.error('💥 Exceção não capturada:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Promise rejeitada:', reason);
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

// 🔒 Verificação de integridade do módulo de segurança da rede
// Na Vercel, não temos acesso à rede local — pular verificação
if (!process.env.VERCEL) {
  try {
    networkSafety.verifyIntegrity();
  } catch (err) {
    console.error('\n🔒❌ FALHA CRÍTICA: Network Safety Guard comprometido!');
    console.error('   O servidor NÃO vai iniciar sem proteção de rede.');
    console.error('   Restaure o arquivo config/network-safety.js');
    process.exit(1);
  }
} else {
  console.log('☁️ Vercel: Network Safety check ignorado (sem rede local)');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INICIALIZAÇÃO (local) + EXPORT (Vercel)
// ═══════════════════════════════════════════════════════════════════════════════

// Na Vercel, o app é importado como serverless function (não usa listen)
// Localmente, continua rodando como servidor Express normal
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const prefixCount = Object.keys(networkPrefixes).filter(k => !k.startsWith('_')).length;
    console.log(`\n════════════════════════════════════════════════════`);
    console.log(`  🚀 HUB Hook Prime v3.3 — Modular Architecture`);
    console.log(`  📡 http://localhost:${PORT}`);
    console.log(`  📁 Diretório público: ${path.join(BASE_DIR, 'public')}`);
    console.log(`  📤 Diretório de uploads: ${uploadsDir}`);
    console.log(`  🔗 CDN: ${BRK_LINK_URL}`);
    console.log(`  🔒 Rede nova: ${networkSafety.NETWORK_ROOT} (PROTEGIDA)`);
    console.log(`  🔒 Rede legado: ${networkSafety.NETWORK_ROOT_LEGACY} (PROTEGIDA)`);
    console.log(`  📂 ${prefixCount} prefixos mapeados`);
    console.log(`  📦 7 módulos de rotas carregados`);
    console.log(`════════════════════════════════════════════════════\n`);
  });
}

// Export para Vercel serverless
module.exports = app;
