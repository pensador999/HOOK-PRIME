const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const networkSafety = require('./config/network-safety.js');

// Mapeamento de prefixo de código → pasta na rede
let networkPrefixes = {};
try {
  networkPrefixes = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'network-prefixes.json'), 'utf8'));
  console.log(`📂 ${Object.keys(networkPrefixes).length} prefixos de rede carregados`);
} catch (e) {
  console.warn('⚠️ network-prefixes.json não encontrado');
}

// ─── Configuração do servidor ────────────────────────────────────────────────
const app = express();
const PORT = 3000;

// Diretório base do projeto
const BASE_DIR = __dirname;

// ─── Middlewares globais ─────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Permitir: localhost, 127.0.0.1, e requests sem Origin (Tampermonkey, curl, etc.)
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado pelo CORS'));
    }
  }
}));
app.use(express.json({ limit: '50mb' }));

// Log de TODAS as requisições para debug
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`📨 ${req.method} ${req.path}`);
  }
  next();
});

// No-cache para JS/CSS (evita browser usar versão antiga)
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

app.use(express.static(path.join(BASE_DIR, 'public')));

// Garantir que o diretório de uploads exista
const uploadsDir = path.join(BASE_DIR, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Configuração do Multer para upload de arquivos ──────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Preserva o nome original temporariamente
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

// ─── Carregamento dos templates de configuração ──────────────────────────────
let templateBling = {}, productCategories = {}, sizePatterns = {};
try {
  templateBling = JSON.parse(
    fs.readFileSync(path.join(BASE_DIR, 'config', 'templates-bling.json'), 'utf-8')
  );

  productCategories = JSON.parse(
    fs.readFileSync(path.join(BASE_DIR, 'config', 'product-categories.json'), 'utf-8')
  );
  sizePatterns = JSON.parse(
    fs.readFileSync(path.join(BASE_DIR, 'config', 'size-patterns.json'), 'utf-8')
  );
} catch (err) {
  console.error('❌ Erro ao ler arquivos de configuração no startup:', err.message);
}

// ═══════ Network Image Scraper Helpers ═══════
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const GENDER_FOLDERS_MAP = { 'MASC': 'masc', 'MASCULINO': 'masc', 'FEM': 'fem', 'FEMININO': 'fem', 'INF': 'inf', 'INFANTIL': 'inf', 'KIDS': 'inf' };

function detectFolderPattern(folderPath) {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const subdirsUpper = subdirs.map(s => s.toUpperCase());
    const images = entries.filter(e => !e.isDirectory() && IMAGE_EXTENSIONS.test(e.name));
    
    if (subdirsUpper.includes('3D')) {
      const actual3d = subdirs.find(s => s.toUpperCase() === '3D');
      return { pattern: '3d_folder', sourceDir: actual3d || '3d' };
    }
    
    const genderDirs = subdirs.filter(s => Object.keys(GENDER_FOLDERS_MAP).includes(s.toUpperCase()));
    if (genderDirs.length > 0) return { pattern: 'gender_folders', genderDirs };
    
    if (subdirsUpper.includes('JPEG_IMAGENS')) {
      const jpegPath = path.join(folderPath, subdirs.find(s => s.toUpperCase() === 'JPEG_IMAGENS'));
      const jpegImages = fs.readdirSync(jpegPath).filter(f => IMAGE_EXTENSIONS.test(f));
      if (jpegImages.length > 0) return { pattern: 'jpeg_optimized', sourceDir: subdirs.find(s => s.toUpperCase() === 'JPEG_IMAGENS') };
    }
    
    if (images.length > 0) return { pattern: 'loose_images', imageCount: images.length };
    
    return { pattern: 'empty' };
  } catch (err) {
    return { pattern: 'error', error: err.message };
  }
}

function detectGenderFromFilename(filename) {
  const name = filename.toUpperCase().replace(/\.[^.]+$/, '');
  if (/MASC|MASCULIN/.test(name)) return 'masc';
  if (/FEM|FEMININ/.test(name)) return 'fem';
  if (/INF(?:ANT)?|KIDS?/.test(name)) return 'inf';
  return null;
}

function countImagesInDir(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath).filter(f => IMAGE_EXTENSIONS.test(f)).length;
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DA API
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/health ─────────────────────────────────────────────────────────
// Verificação de saúde do servidor
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// ─── AUTOPILOT AGENT (ClickUp Integration) ───────────────────────────────────
const TASKS_FILE = path.join(__dirname, 'config', 'tasks.json');

// Carregar tasks persistidos do disco
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

// SSE Endpoint para notificar o frontend sobre novas tarefas em tempo real
app.get('/api/autopilot/stream', (req, res) => {
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
    autopilotClients = autopilotClients.filter(client => client !== res);
  });
});

// Health check para o Tampermonkey saber se o Hub está online
app.get('/api/autopilot/ping', (req, res) => {
  res.json({ online: true, tasks: autopilotTasks.length, timestamp: new Date().toISOString() });
});

// Recebe as tarefas lidas pelo Tampermonkey
app.post('/api/autopilot/tasks', (req, res) => {
  try {
    const { title, description, url } = req.body;
    
    // Extrai os códigos da descrição usando Regex. Ex: FUSION181, CAX047, CANECA069
    // Procura por palavras que começam com letras maiúsculas seguidas de números
    const codeRegex = /\b[A-Z]+[0-9]+\b/g;
    const foundCodes = description ? description.match(codeRegex) || [] : [];
    
    // Agrupa os códigos pelos seus prefixos (ex: FUSION, CAX, BM)
    const groupedCodes = {};
    foundCodes.forEach(code => {
      const prefixMatch = code.match(/^[A-Z]+/);
      if (prefixMatch) {
        const prefix = prefixMatch[0];
        if (!groupedCodes[prefix]) groupedCodes[prefix] = [];
        if (!groupedCodes[prefix].includes(code)) {
          groupedCodes[prefix].push(code);
        }
      }
    });

    const fullText = (title + ' ' + (description || '')).toUpperCase();
    const rangeRegex = /([A-Za-z]+)(\d+)[ \t]*(?:a|até|→|-)[ \t]*(?:[A-Za-z]*)(\d+)/gi;
    let rangeMatch;
    while ((rangeMatch = rangeRegex.exec(fullText)) !== null) {
      const prefix = rangeMatch[1].toUpperCase();
      const start = parseInt(rangeMatch[2]);
      const end = parseInt(rangeMatch[3]);
      if (end > start && (end - start) <= 500) {
        if (!groupedCodes[prefix]) groupedCodes[prefix] = [];
        for (let i = start; i <= end; i++) {
          const code = `${prefix}${String(i).padStart(rangeMatch[2].length, '0')}`;
          if (!groupedCodes[prefix].includes(code)) groupedCodes[prefix].push(code);
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
    
    // Evitar duplicatas pela URL
    const isDuplicate = autopilotTasks.some(t => t.url === newTask.url);
    if (isDuplicate) {
      return res.json({ success: true, task: autopilotTasks.find(t => t.url === newTask.url), duplicate: true });
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
app.patch('/api/autopilot/tasks/:id/status', (req, res) => {
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
app.delete('/api/autopilot/tasks/:id', (req, res) => {
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

// ─── GET /api/ean-proxy ──────────────────────────────────────────────────────
// Proxy para buscar EANs do Google Sheets (resolve CORS)
app.get('/api/ean-proxy', async (req, res) => {
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

// ─── POST /api/folders/create ────────────────────────────────────────────────
// Cria pastas para cada código informado no caminho base
app.post('/api/folders/create', (req, res) => {
  try {
    const { codes, basePath } = req.body;

    // Validação dos parâmetros obrigatórios
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'O campo "codes" é obrigatório e deve ser um array com pelo menos um código.'
      });
    }

    if (!basePath || typeof basePath !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'O campo "basePath" é obrigatório e deve ser um caminho válido.'
      });
    }

    // Verifica se o diretório base existe
    if (!fs.existsSync(basePath)) {
      return res.status(400).json({
        success: false,
        error: `O caminho base não existe: ${basePath}`
      });
    }

    const created = [];
    const errors = [];

    // Cria uma pasta para cada código
    for (const code of codes) {
      const folderPath = path.join(basePath, code.trim());
      try {
        if (fs.existsSync(folderPath)) {
          errors.push({ code: code.trim(), reason: 'Pasta já existe' });
        } else {
          fs.mkdirSync(folderPath, { recursive: true });
          created.push(code.trim());
        }
      } catch (err) {
        errors.push({ code: code.trim(), reason: err.message });
      }
    }

    res.json({ success: true, created, errors });
  } catch (err) {
    console.error('[ERRO] /api/folders/create:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/images/rename ────────────────────────────────────────────────
// Recebe imagens via upload e renomeia seguindo o padrão (MASC, FEM, INF)
app.post('/api/images/rename', upload.array('images', 100), (req, res) => {
  try {
    const { pattern } = req.body;

    // Validação do padrão de nome
    const validPatterns = ['MASC', 'FEM', 'INF'];
    if (!pattern || !validPatterns.includes(pattern.toUpperCase())) {
      // Remove arquivos enviados caso o padrão seja inválido
      if (req.files) {
        req.files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch (e) { /* ignora */ }
        });
      }
      return res.status(400).json({
        success: false,
        error: `O campo "pattern" deve ser um dos valores: ${validPatterns.join(', ')}`
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada.'
      });
    }

    const upperPattern = pattern.toUpperCase();
    const renamed = [];

    // Cria subdiretório para as imagens renomeadas
    const renamedDir = path.join(uploadsDir, `renamed_${Date.now()}`);
    fs.mkdirSync(renamedDir, { recursive: true });

    // Renomeia cada arquivo seguindo o padrão sequencial
    req.files.forEach((file, index) => {
      const sequenceNumber = String(index + 1).padStart(2, '0');
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const newName = `${sequenceNumber}${upperPattern}${ext}`;
      const newPath = path.join(renamedDir, newName);

      // Move o arquivo para o novo caminho com o novo nome
      fs.renameSync(file.path, newPath);

      renamed.push({
        original: file.originalname,
        new: newName
      });
    });

    res.json({ success: true, renamed, outputDir: renamedDir });
  } catch (err) {
    console.error('[ERRO] /api/images/rename:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES PARA GERAÇÃO DE CSV
// ═══════════════════════════════════════════════════════════════════════════════



/**
 * Escapa valores para CSV - trata ponto-e-vírgula, aspas e quebras de linha
 * @param {string} value - Valor a ser escapado
 * @returns {string} Valor seguro para CSV
 */
function escaparCSV(value) {
  if (value.includes(';') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// ─── Rota de configuração (expõe dados de config para o frontend) ────────────
app.get('/api/config/categories', (req, res) => {
  res.json(productCategories);
});

app.get('/api/config/sizes', (req, res) => {
  res.json(sizePatterns);
});

app.get('/api/config/templates/:type', (req, res) => {
  const { type } = req.params;
  if (type === 'bling') {
    res.json(templateBling);
  } else {
    res.status(404).json({ error: `Template "${type}" não encontrado.` });
  }
});

// ─── Autopilot: Scan de pastas locais ────────────────────────────────────────

/**
 * POST /api/autopilot/scan-folder
 * Recebe um caminho local e retorna a estrutura de subpastas + arquivos
 */
app.post('/api/autopilot/scan-folder', (req, res) => {
  const { folderPath } = req.body;

  if (!folderPath) {
    return res.status(400).json({ error: 'Caminho da pasta é obrigatório.' });
  }

  try {
    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: `Pasta não encontrada: ${folderPath}` });
    }

    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'O caminho informado não é uma pasta.' });
    }

    const imgExt = /\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/i;
    function countImagesRecursive(dir) {
      let count = 0;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) count += countImagesRecursive(path.join(dir, e.name));
          else if (imgExt.test(e.name)) count++;
        }
      } catch {}
      return count;
    }

    const subfolders = fs.readdirSync(folderPath)
      .filter(name => {
        const fullPath = path.join(folderPath, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .map(name => {
        const subPath = path.join(folderPath, name);
        const totalCount = countImagesRecursive(subPath);

        return {
          name,
          path: subPath,
          images: [],
          imageCount: totalCount,
        };
      });

    res.json({
      basePath: folderPath,
      totalFolders: subfolders.length,
      totalImages: subfolders.reduce((sum, f) => sum + f.imageCount, 0),
      folders: subfolders,
    });
  } catch (err) {
    res.status(500).json({ error: `Erro ao ler pasta: ${err.message}` });
  }
});

/**
 * GET /api/preview-image
 * Serves a local image file as a thumbnail for the live preview panel.
 * Query: ?path=C:/path/to/image.jpg
 * Returns the image with correct content-type.
 */
app.get('/api/preview-image', (req, res) => {
  const imgPath = req.query.path;
  if (!imgPath) return res.status(400).json({ error: 'path is required' });

  // Security: only allow images from uploads/ directory
  const normalizedPath = path.resolve(imgPath);
  const uploadsDir = path.resolve('uploads');
  const desktopDir = path.resolve('C:/Users');
  
  if (!normalizedPath.startsWith(uploadsDir) && !normalizedPath.startsWith(desktopDir)) {
    return res.status(403).json({ error: 'Access denied - path must be in uploads/ or user directory' });
  }

  if (!fs.existsSync(normalizedPath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const ext = path.extname(normalizedPath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.bmp': 'image/bmp',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  fs.createReadStream(normalizedPath).pipe(res);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GERADOR DE PLANILHA APC (Bling CSV)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/autopilot/generate-apc-spreadsheet
 * Gera planilha CSV no padrão Bling para produtos APC.
 * Body: { codes: [{code, estampa}], taskTitle, taskId }
 * Cada código gera 3 blocos (PRETO, BRANCO/BL, BEGE/BG) × (PAI + 6 variações)
 */
app.post('/api/autopilot/generate-apc-spreadsheet', (req, res) => {
  const { codes, taskTitle, taskId, cdnUrls, colors, genders } = req.body;
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'Array de codes é obrigatório.' });
  }

  try {
    // Header Bling (59 campos)
    const HEADER = [
      'ID','Código','Descrição','Unidade','NCM','Origem','Preço','Valor IPI fixo',
      'Observações','Situação','Estoque','Preço de custo','Cód. no fornecedor',
      'Fornecedor','Localização','Estoque máximo','Estoque mínimo',
      'Peso líquido (Kg)','Peso bruto (Kg)','GTIN/EAN','GTIN/EAN da Embalagem',
      'Largura do produto','Altura do Produto','Profundidade do produto',
      'Data Validade','Descrição do Produto no Fornecedor','Descrição Complementar',
      'Itens p/ caixa','Produto Variação','Tipo Produção',
      'Classe de enquadramento do IPI','Código na Lista de Serviços',
      'Tipo do item','Grupo de Tags/Tags','Tributos','Código Pai',
      'Código Integração','Grupo de produtos','Marca','CEST','Volumes',
      'Descrição Curta','Cross-Docking','URL Imagens Externas','Link Externo',
      'Meses Garantia no Fornecedor','Clonar dados do pai','Condição do Produto',
      'Frete Grátis','Número FCI','Vídeo','Departamento','Unidade de Medida',
      'Preço de Compra','Valor base ICMS ST para retenção',
      'Valor ICMS ST para retenção','Valor ICMS próprio do substituto',
      'Categoria do produto','Informações Adicionais'
    ];

    const SIZES = ['P', 'M', 'G', 'GG', 'G1', 'G2'];
    
    const requestedColors = (colors && colors.length > 0) ? colors : ['Preto', 'Branco', 'Bege'];
    const COLORS_MAP = {
      'Preto': { codeColor: 'PRETO',  folderColor: 'PRETA' },
      'Branco': { codeColor: 'BRANCO', folderColor: 'BRANCA' },
      'Bege': { codeColor: 'BEGE',   folderColor: 'BEGE' },
    };
    
    const activeColors = requestedColors.map(c => ({
      name: c,
      codeColor: COLORS_MAP[c] ? COLORS_MAP[c].codeColor : c.toUpperCase(),
      folderColor: COLORS_MAP[c] ? COLORS_MAP[c].folderColor : c.toUpperCase()
    }));

    const requestedGenders = (genders && genders.length > 0) ? genders.map(g => g.toLowerCase()) : ['masc', 'fem'];
    const includeMasc = requestedGenders.includes('masc');
    const includeFem = requestedGenders.includes('fem');

    // Valores fixos do padrão APC
    const FIXED = {
      unidade: 'UN',
      ncm: '6205.20.00',
      origem: '0',
      preco: '99,9',
      ipi: '0',
      situacao: 'Ativo',
      estoque: '0',
      precoCusto: '22,83',
      pesoLiq: '0,25',
      pesoBruto: '0,25',
      largura: '22',
      altura: '4',
      profundidade: '30',
      itensCaixa: '1',
      variacao: 'Variação',
      producao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      tributos: '0',
      marca: 'Brk Agro',
      cest: '28.038.00',
      volumes: '1',
      descCurta: 'A',
      crossDocking: '0',
      garantia: '0',
      clonar: 'NÃO',
      condicao: 'NOVO',
      freteGratis: 'NÃO',
      unidadeMedida: 'Centímetro',
      precoCompra: '0',
      icmsST: '0',
      icmsRetencao: '0',
      icmsProprio: '0',
    };

    function buildDescription(estampa) {
      if (!estampa) return 'Camiseta Básica de Algodão Brk';
      const name = estampa.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      return `Camiseta Básica de Algodão Brk ${name}`;
    }

    function csvLine(fields) {
      return fields.map(f => {
        const val = f == null ? '' : String(f);
        if (val.includes(';') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      }).join(';');
    }

    const lines = [csvLine(HEADER)];
    const emptyLine = new Array(59).fill('').join(';');

    for (const rawItem of codes) {
      const item = typeof rawItem === 'string' ? { code: rawItem, estampa: '' } : rawItem;
      if (!item.code) continue;
      const baseCode = item.code.toUpperCase();
      const estampa = item.estampa || '';
      const description = buildDescription(estampa);

      let itemColors = activeColors;
      if (item.detectedColors && item.detectedColors.length > 0) {
        itemColors = activeColors.filter(c => item.detectedColors.includes(c.name));
      }
      if (itemColors.length === 0) continue;

      const urlMap = cdnUrls || {};
      const firstColor = itemColors[0];

      // BLOCK 1: MASCULINO
      if (includeMasc) {
        const parentCode = baseCode;
        const parentImageUrls = 
          urlMap[`${baseCode}_MASC_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.name}`] || 
          '';

        const parentFields = new Array(59).fill('');
        parentFields[1]  = parentCode;
        parentFields[2]  = description;
        parentFields[3]  = FIXED.unidade;
        parentFields[4]  = FIXED.ncm;
        parentFields[5]  = FIXED.origem;
        parentFields[6]  = FIXED.preco;
        parentFields[7]  = FIXED.ipi;
        parentFields[9]  = FIXED.situacao;
        parentFields[10] = FIXED.estoque;
        parentFields[11] = FIXED.precoCusto;
        parentFields[15] = '0';
        parentFields[16] = '0';
        parentFields[17] = FIXED.pesoLiq;
        parentFields[18] = FIXED.pesoBruto;
        parentFields[21] = FIXED.largura;
        parentFields[22] = FIXED.altura;
        parentFields[23] = FIXED.profundidade;
        parentFields[27] = FIXED.itensCaixa;
        parentFields[28] = FIXED.variacao;
        parentFields[29] = FIXED.producao;
        parentFields[32] = FIXED.tipoItem;
        parentFields[34] = FIXED.tributos;
        parentFields[35] = '';
        parentFields[36] = '0';
        parentFields[38] = FIXED.marca;
        parentFields[39] = FIXED.cest;
        parentFields[40] = FIXED.volumes;
        parentFields[41] = FIXED.descCurta;
        parentFields[42] = FIXED.crossDocking;
        parentFields[43] = parentImageUrls;
        parentFields[45] = FIXED.garantia;
        parentFields[46] = FIXED.clonar;
        parentFields[47] = FIXED.condicao;
        parentFields[48] = FIXED.freteGratis;
        parentFields[52] = FIXED.unidadeMedida;
        parentFields[53] = FIXED.precoCompra;
        parentFields[54] = FIXED.icmsST;
        parentFields[55] = FIXED.icmsRetencao;
        parentFields[56] = FIXED.icmsProprio;
        lines.push(csvLine(parentFields));

        for (const color of itemColors) {
          const imageUrls = 
            urlMap[`${baseCode}_MASC_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.name}`] ||
            '';

          for (const size of SIZES) {
            const varCode = `${parentCode}-PREMIUM-${color.codeColor}-${size}`;
            const varDesc = `Cor:${color.name};Tamanho:${size}`;
            
            const varFields = [...parentFields];
            varFields[1]  = varCode;
            varFields[2]  = varDesc;
            varFields[10] = FIXED.estoque;
            varFields[28] = FIXED.variacao;
            varFields[35] = parentCode;
            varFields[43] = imageUrls;
            lines.push(csvLine(varFields));
          }
        }
        lines.push(emptyLine);
      }

      // BLOCK 2: FEMININO
      if (includeFem) {
        const parentCode = `${baseCode}BL`;
        const parentImageUrls = 
          urlMap[`${baseCode}_FEM_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.folderColor}`] ||
          urlMap[`${baseCode}_${firstColor.name}`] || 
          '';

        const parentFields = new Array(59).fill('');
        parentFields[1]  = parentCode;
        parentFields[2]  = description;
        parentFields[3]  = FIXED.unidade;
        parentFields[4]  = FIXED.ncm;
        parentFields[5]  = FIXED.origem;
        parentFields[6]  = FIXED.preco;
        parentFields[7]  = FIXED.ipi;
        parentFields[9]  = FIXED.situacao;
        parentFields[10] = FIXED.estoque;
        parentFields[11] = FIXED.precoCusto;
        parentFields[15] = '0';
        parentFields[16] = '0';
        parentFields[17] = FIXED.pesoLiq;
        parentFields[18] = FIXED.pesoBruto;
        parentFields[21] = FIXED.largura;
        parentFields[22] = FIXED.altura;
        parentFields[23] = FIXED.profundidade;
        parentFields[27] = FIXED.itensCaixa;
        parentFields[28] = FIXED.variacao;
        parentFields[29] = FIXED.producao;
        parentFields[32] = FIXED.tipoItem;
        parentFields[34] = FIXED.tributos;
        parentFields[35] = '';
        parentFields[36] = '0';
        parentFields[38] = FIXED.marca;
        parentFields[39] = FIXED.cest;
        parentFields[40] = FIXED.volumes;
        parentFields[41] = FIXED.descCurta;
        parentFields[42] = FIXED.crossDocking;
        parentFields[43] = parentImageUrls;
        parentFields[45] = FIXED.garantia;
        parentFields[46] = FIXED.clonar;
        parentFields[47] = FIXED.condicao;
        parentFields[48] = FIXED.freteGratis;
        parentFields[52] = FIXED.unidadeMedida;
        parentFields[53] = FIXED.precoCompra;
        parentFields[54] = FIXED.icmsST;
        parentFields[55] = FIXED.icmsRetencao;
        parentFields[56] = FIXED.icmsProprio;
        lines.push(csvLine(parentFields));

        for (const color of itemColors) {
          const imageUrls = 
            urlMap[`${baseCode}_FEM_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.folderColor}`] ||
            urlMap[`${baseCode}_${color.name}`] ||
            '';

          for (const size of SIZES) {
            const varCode = `${parentCode}-PREMIUM-${color.codeColor}-${size}`;
            const varDesc = `Cor:${color.name};Tamanho:${size}`;
            
            const varFields = [...parentFields];
            varFields[1]  = varCode;
            varFields[2]  = varDesc;
            varFields[10] = FIXED.estoque;
            varFields[28] = FIXED.variacao;
            varFields[35] = parentCode;
            varFields[43] = imageUrls;
            lines.push(csvLine(varFields));
          }
        }
        lines.push(emptyLine);
      }
    }

    const fileName = taskTitle
      ? taskTitle.replace(/[<>:"\/\\|?*]/g, '').replace(/\s+/g, ' ').trim() + '.csv'
      : 'APC_PLANILHA.csv';
    
    const savePath = taskId
      ? path.join(uploadsDir, 'autopilot', taskId, fileName)
      : path.join(uploadsDir, 'autopilot', fileName);
    
    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, '\ufeff' + lines.join('\r\n'), 'utf-8');

    let totalProducts = 0;
    let totalVariations = 0;
    const allUsedColors = new Set();

    for (const rawItem of codes) {
      const item = typeof rawItem === 'string' ? { code: rawItem, estampa: '' } : rawItem;
      if (!item.code) continue;
      let itemColors = activeColors;
      if (item.detectedColors && item.detectedColors.length > 0) {
        itemColors = activeColors.filter(c => item.detectedColors.includes(c.name));
      }
      
      const multiplier = (includeMasc ? 1 : 0) + (includeFem ? 1 : 0);
      totalProducts += multiplier;
      totalVariations += itemColors.length * SIZES.length * multiplier;
      itemColors.forEach(c => allUsedColors.add(c.name));
    }

    const totalLines = lines.length;

    console.log(`📊 Planilha APC: ${codes.length} códigos, ${totalProducts} produtos (PAIs), ${totalVariations} variações`);

    res.json({
      success: true,
      fileName,
      filePath: savePath,
      downloadUrl: `/api/autopilot/download-spreadsheet?path=${encodeURIComponent(savePath)}`,
      summary: {
        totalCodes: codes.length,
        totalColors: allUsedColors.size,
        totalProducts,
        totalVariations,
        totalLines,
        colors: [...allUsedColors],
        sizes: SIZES,
      }
    });

  } catch (err) {
    console.error('❌ Erro ao gerar planilha APC:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/autopilot/download-spreadsheet
 * Download do arquivo CSV gerado
 */
app.get('/api/autopilot/download-spreadsheet', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'Parâmetro path é obrigatório' });
    }
    const resolved = path.resolve(filePath);
    // Security: only allow files within uploads dir (using resolved path)
    if (!resolved.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    res.download(resolved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/scan-upload-folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'folderPath é obrigatório' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }

    const blocks = [];
    const validExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'];
    const codes = new Set();
    let totalImages = 0;

    const codeDirs = fs.readdirSync(folderPath, { withFileTypes: true }).filter(d => d.isDirectory());

    for (const codeDir of codeDirs) {
      const code = codeDir.name;
      const codePath = path.join(folderPath, code);
      
      const genderDirs = fs.readdirSync(codePath, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const genderDir of genderDirs) {
        const gender = genderDir.name;
        const genderPath = path.join(codePath, gender);
        
        const colorDirs = fs.readdirSync(genderPath, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const colorDir of colorDirs) {
          const color = colorDir.name;
          const colorPath = path.join(genderPath, color);
          
          const files = fs.readdirSync(colorPath, { withFileTypes: true })
            .filter(f => f.isFile() && validExts.includes(path.extname(f.name).toLowerCase()));
            
          if (files.length > 0) {
            blocks.push({
              code,
              gender,
              color,
              images: files.length,
              path: `${code}/${gender}/${color}`
            });
            codes.add(code);
            totalImages += files.length;
          }
        }
      }
    }

    res.json({
      success: true,
      basePath: folderPath,
      blocks,
      summary: {
        totalBlocks: blocks.length,
        totalImages,
        codes: Array.from(codes)
      }
    });

  } catch (err) {
    console.error('❌ Erro no scan-upload-folder:', err);
    res.status(500).json({ error: err.message });
  }
});

function getSmartSortPriority(filename) {
  const name = filename.toUpperCase();
  if (name.includes('FRENTE') && !name.includes('PERSPECTIVA') && !name.includes('PERS')) return 10;
  if (name.includes('COSTAS') && !name.includes('PERSPECTIVA') && !name.includes('PERS')) return 20;
  if (name.includes('FRENTE') && (name.includes('PERSPECTIVA') || name.includes('PERS'))) return 30;
  if (name.includes('COSTAS') && (name.includes('PERSPECTIVA') || name.includes('PERS'))) {
    if (name.includes('2')) return 50;
    return 40;
  }
  if (name.includes('ZOOM')) return 60;
  if (name.includes('DETALHE')) return 65;
  if (name.includes('PESP')) return 70;
  return 100;
}

app.post('/api/autopilot/copy-network-images', (req, res) => {
  const { results, taskId } = req.body;
  if (!taskId || !results || !Array.isArray(results)) {
    return res.status(400).json({ error: 'taskId e array de results são obrigatórios.' });
  }

  const responseResults = [];
  let summaryTotalCodes = 0;
  let summaryTotalImages = 0;
  let summaryTotalSizeKB = 0;
  let summaryFiltered = 0;

  try {
    for (const item of results) {
      const { code, estampa, images } = item;
      if (!images || !Array.isArray(images)) continue;

      summaryTotalCodes++;

      // Filtrar imagens humanizadas (com modelo)
      const filteredImages = images.filter(img => {
        if (img.isHumanized) {
          summaryFiltered++;
          return false;
        }
        return true;
      });

      // Agrupar por gênero + variante (cor)
      // Estrutura: {MASC: {PRETA: [imgs], BRANCA: [imgs]}, FEM: {...}}
      const genderGroups = {};
      for (const img of filteredImages) {
        if (!img.fullPath || !img.name) continue;
        const gender = (img.gender || 'GERAL').toUpperCase();
        const variant = (img.variant || 'GERAL').toUpperCase();
        if (!genderGroups[gender]) genderGroups[gender] = {};
        if (!genderGroups[gender][variant]) genderGroups[gender][variant] = [];
        genderGroups[gender][variant].push(img);
      }

      const deduplicatedImages = [];

      for (const [gender, variants] of Object.entries(genderGroups)) {
        for (const [variant, imgs] of Object.entries(variants)) {
          // Criar subpasta: code/MASC/PRETA/
          const subDir = path.join(uploadsDir, 'autopilot', taskId, code, gender, variant);
          fs.mkdirSync(subDir, { recursive: true });

          // Deduplicar por nome base dentro de cada grupo gênero+cor
          const groups = {};
          for (const img of imgs) {
            const baseName = img.name.replace(/\.[^.]+$/, '').toUpperCase();
            if (!groups[baseName]) groups[baseName] = [];
            groups[baseName].push(img);
          }

          for (const baseName in groups) {
            const group = groups[baseName];
            let largestImg = group[0];
            if (group.length > 1) {
              let maxSize = -1;
              for (const img of group) {
                try {
                  const stat = networkSafety.safeStat(img.fullPath);
                  if (stat && stat.size > maxSize) {
                    maxSize = stat.size;
                    largestImg = img;
                  }
                } catch (err) {
                  console.warn(`⚠️ Erro ao obter tamanho de ${img.fullPath}:`, err.message);
                }
              }
            }

            const ext = path.extname(largestImg.name);
            const finalName = `${baseName}${ext}`;
            const localDestPath = path.join(subDir, finalName);

            try {
              networkSafety.safeCopyFromNetwork(largestImg.fullPath, localDestPath);
              const stat = fs.statSync(localDestPath);
              const sizeKB = Math.round(stat.size / 1024);

              summaryTotalImages++;
              summaryTotalSizeKB += sizeKB;

              deduplicatedImages.push({
                name: finalName,
                localPath: localDestPath,
                url: `/api/autopilot/images/${taskId}/${code}/${gender}/${variant}/${finalName}`,
                sizeKB,
                gender,
                variant
              });
            } catch (err) {
              console.error(`❌ Erro ao copiar imagem ${largestImg.fullPath}:`, err.message);
            }
          }

          // Sort images by priority
          const sortedInGroup = [...deduplicatedImages.filter(img => img.gender === gender && img.variant === variant)];
          sortedInGroup.sort((a, b) => {
            const prioA = getSmartSortPriority(a.name);
            const prioB = getSmartSortPriority(b.name);
            if (prioA !== prioB) return prioA - prioB;
            return a.name.localeCompare(b.name, undefined, { numeric: true });
          });

          // Rename to 1.jpg, 2.jpg, 3.jpg... (using extension from the original file to be safe if not jpg)
          sortedInGroup.forEach((img, idx) => {
            const newName = `${idx + 1}${path.extname(img.name)}`;
            const newPath = path.join(path.dirname(img.localPath), newName);
            // Only rename if different
            if (path.basename(img.localPath) !== newName) {
              fs.renameSync(img.localPath, newPath);
              img.localPath = newPath;
              img.name = newName;
              img.url = `/api/autopilot/images/${taskId}/${code}/${gender}/${variant}/${newName}`;
            }
          });
        }
      }

      console.log(`📋 Copy: [${code}] ${deduplicatedImages.length} copiadas, ${summaryFiltered} humanizadas filtradas`);

      responseResults.push({
        code,
        estampa,
        totalCopied: deduplicatedImages.length,
        totalFiltered: images.length - filteredImages.length,
        images: deduplicatedImages
      });
    }

    res.json({
      taskId,
      summary: {
        totalCodes: summaryTotalCodes,
        totalImages: summaryTotalImages,
        totalFiltered: summaryFiltered,
        totalSizeKB: summaryTotalSizeKB
      },
      results: responseResults
    });
  } catch (err) {
    console.error('❌ Erro no copy-network-images:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/autopilot/images/:taskId/:code', (req, res) => {
  const { taskId, code } = req.params;
  const dirPath = path.join(uploadsDir, 'autopilot', taskId, code);
  try {
    if (!fs.existsSync(dirPath)) {
      return res.json([]);
    }
    // Buscar recursivamente em todas as subpastas (MASC/PRETA/, FEM/BRANCA/, etc.)
    const imagesList = [];
    function walkDir(dir, relativePath) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walkDir(path.join(dir, entry.name), rel);
        } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
          imagesList.push({
            name: entry.name,
            url: `/api/autopilot/images/${taskId}/${code}/${rel}`,
            gender: relativePath ? relativePath.split('/')[0] : null,
            variant: relativePath ? relativePath.split('/')[1] || null : null,
          });
        }
      }
    }
    walkDir(dirPath, '');
    res.json(imagesList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Servir imagens de qualquer subpasta: /images/:taskId/:code/MASC/PRETA/file.png
app.get('/api/autopilot/images/:taskId/:code/*', (req, res) => {
  try {
    const { taskId, code } = req.params;
    const subPath = req.params[0]; // tudo depois de :code/
    const filePath = path.resolve(path.join(uploadsDir, 'autopilot', taskId, code, subPath));
    // Security: ensure resolved path is within uploads directory
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'Imagem não encontrada' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DO CRUZADOR DE IMAGENS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/crosser/parse-xls
 * Recebe um arquivo XLS/XLSX/CSV e retorna os dados parseados como JSON.
 */
app.post('/api/crosser/parse-xls', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
    }

    const XLSX = require('xlsx');
    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Limpar arquivo temporário
    fs.unlink(req.file.path, () => {});

    console.log(`📋 Crosser: planilha parseada — ${rows.length} linhas`);

    res.json({
      success: true,
      rows,
      totalRows: rows.length,
      sheetName: wb.SheetNames[0],
    });
  } catch (err) {
    console.error('❌ Erro ao parsear XLS:', err.message);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// ROTAS DE PROXY — Upload de imagens via BRK Link (Cloudflare R2)
// ═══════════════════════════════════════════════════════════════════════════════

const BRK_LINK_URL = 'https://brk-link-vz77.vercel.app';

// ─── GET /api/s3-proxy/health — Verifica se o BRK Link está online ───────────
app.get('/api/s3-proxy/health', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
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

/**
 * Faz upload de múltiplos arquivos para o BRK Link (Cloudflare R2).
 * O BRK Link renomeia como 1.jpg, 2.jpg, 3.jpg... na ordem enviada.
 * Cada upload usa um collectionId ÚNICO para não sobrescrever imagens de outros códigos.
 * @param {Array<{filePath: string, originalName: string}>} files
 * @param {string} collectionId - ID único da coleção (ex: 'C02858_MASC')
 * @returns {Promise<{urls: string[], count: number}>}
 */
async function uploadToBrkLink(files, collectionId) {
  const formData = new FormData();

  // Coleção ÚNICA para cada código+gênero
  if (collectionId) {
    formData.append('collectionId', collectionId);
    console.log(`📁 Coleção CDN: ${collectionId}`);
  }

  for (let i = 0; i < files.length; i++) {
    const { filePath, originalName } = files[i];
    let fileBuffer = fs.readFileSync(filePath);
    let sendName = originalName;

    // Comprimir se > 3MB (limite Vercel ~4.5MB)
    if (fileBuffer.length > 3 * 1024 * 1024) {
      try {
        fileBuffer = await sharp(fileBuffer)
          .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        sendName = sendName.replace(/\.[^.]+$/, '.jpg');
        console.log(`   🗜️ Comprimido: ${(files[i].filePath ? path.basename(files[i].filePath) : originalName)} ${(fs.readFileSync(filePath).length / 1024).toFixed(0)}KB → ${(fileBuffer.length / 1024).toFixed(0)}KB`);
      } catch (compErr) {
        console.log(`   ⚠️ Compressão falhou, enviando original: ${compErr.message}`);
      }
    }

    const blob = new Blob([fileBuffer]);
    formData.append('files', blob, sendName);
    formData.append('originalNames', sendName);
  }

  console.log(`📤 BRK Link: enviando ${files.length} imagem(ns)...`);

  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${BRK_LINK_URL}/api/save`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`BRK Link falhou (HTTP ${response.status}): ${text.substring(0, 300)}`);
      }

      const data = await response.json();

      if (!data.entries || data.entries.length === 0) {
        throw new Error('BRK Link retornou sem URLs');
      }

      const urls = data.entries.map(e => e.url);
      console.log(`✅ BRK Link OK: ${urls.length} imagem(ns) enviada(s)`);
      urls.forEach((url, i) => console.log(`   [${i + 1}] ${url}`));

      return { urls, count: data.count || urls.length };

    } catch (err) {
      lastErr = err;
      if (err.name === 'AbortError') {
        console.log(`⏱️ Timeout no upload BRK Link (tentativa ${attempt}/${MAX_RETRIES})`);
      } else {
        console.log(`⚠️ Erro BRK Link (tentativa ${attempt}/${MAX_RETRIES}): ${err.message}`);
      }

      if (attempt < MAX_RETRIES) {
        const waitMs = 3000 * attempt;
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  throw lastErr || new Error(`Falha após ${MAX_RETRIES} tentativas`);
}

/**
 * POST /api/s3-proxy/upload-from-folder-direct
 * Upload direto de uma pasta já resolvida (sem resolução de subpastas).
 * Ideal para APC onde a pasta final já é code/gender/color.
 * Body JSON: { folderPath: "C:\\...\\APC0573\\MASC\\PRETA", collectionId: "APC0573_MASC_PRETA" }
 * Response: { success: true, urls: [...], joined: "url1|url2|..." }
 */
app.post('/api/s3-proxy/upload-from-folder-direct', express.json(), async (req, res) => {
  try {
    const { folderPath, collectionId } = req.body;
    if (!folderPath || !collectionId) {
      return res.status(400).json({ error: 'folderPath e collectionId são obrigatórios.' });
    }

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: `Pasta não encontrada: ${folderPath}` });
    }

    const imageExts = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
    const imageFiles = [];

    // Scan direto (sem resolução de subpastas de gênero)
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && imageExts.test(entry.name)) {
        imageFiles.push(path.join(folderPath, entry.name));
      }
    }

    if (imageFiles.length === 0) {
      return res.status(400).json({ error: `Nenhuma imagem em: ${folderPath}` });
    }

    // Smart Sort
    function getImagePriority(fileName) {
      const name = fileName.toUpperCase().replace(/\.[^.]+$/, '');
      if (/^\d+$/.test(name.trim())) return parseInt(name.trim());
      const isFrente = /FRENTE/.test(name);
      const isCostas = /COSTA/.test(name);
      const isPerspec = /PERSPEC|PERSPECTIVA/.test(name);
      const isPerspec2 = /PERSPECTIVA\s*2|PERSPEC\s*2/.test(name);
      const isZoom = /ZOOM/.test(name);
      const isDetalhe = /DETALHE|DETAIL/.test(name);
      const isPesp = /PESP/.test(name);
      if (isFrente && !isPerspec)               return 10;
      if (isCostas && !isPerspec && !isPerspec2) return 20;
      if (isFrente && isPerspec)                 return 30;
      if (isCostas && isPerspec && !isPerspec2)  return 40;
      if (isCostas && isPerspec2)                return 50;
      if (isZoom)                                return 60;
      if (isDetalhe)                             return 65;
      if (isPesp)                                return 70;
      return 100;
    }

    imageFiles.sort((a, b) => {
      const prioA = getImagePriority(path.basename(a));
      const prioB = getImagePriority(path.basename(b));
      if (prioA !== prioB) return prioA - prioB;
      return path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true });
    });

    console.log(`📂 Upload direto: ${collectionId} → ${imageFiles.length} imagem(ns)`);

    // Renomear para padrão CDN: collectionId_1.jpg, collectionId_2.jpg
    const files = imageFiles.map((fp, idx) => ({
      filePath: fp,
      originalName: `${collectionId}_${idx + 1}${path.extname(fp)}`,
    }));

    files.forEach((f, i) => console.log(`   [${i + 1}] ${path.basename(imageFiles[i])} → ${f.originalName}`));

    // Comprimir com Sharp (JPEG 85%)
    const compressedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileBuffer = fs.readFileSync(file.filePath);
      let sendName = file.originalName;
      const originalSize = fileBuffer.length;

      if (originalSize > 500 * 1024) {
        try {
          fileBuffer = await sharp(fileBuffer)
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
          sendName = sendName.replace(/\.[^.]+$/, '.jpg');
          console.log(`   🗜️ [${i + 1}] ${(originalSize / 1024).toFixed(0)}KB → ${(fileBuffer.length / 1024).toFixed(0)}KB`);
        } catch (compErr) {
          console.log(`   ⚠️ [${i + 1}] Compressão falhou: ${compErr.message}`);
        }
      }

      compressedFiles.push({ buffer: fileBuffer, originalName: sendName });
    }

    // Calcular tamanho total
    const totalBatchSize = compressedFiles.reduce((sum, f) => sum + f.buffer.length, 0);
    console.log(`   📦 Batch: ${(totalBatchSize / 1024).toFixed(0)}KB (${compressedFiles.length} imgs)`);

    // Enviar em batches
    const MAX_BATCH_SIZE = 3.5 * 1024 * 1024;
    const allUrls = [];

    if (totalBatchSize <= MAX_BATCH_SIZE) {
      const tempFiles = compressedFiles.map((cf, idx) => {
        const tmpPath = path.join(uploadsDir, `tmp_${collectionId}_${idx}_${Date.now()}.jpg`);
        fs.writeFileSync(tmpPath, cf.buffer);
        return { filePath: tmpPath, originalName: cf.originalName };
      });
      try {
        const result = await uploadToBrkLink(tempFiles, collectionId);
        allUrls.push(...result.urls);
      } finally {
        tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
      }
    } else {
      let currentBatch = [];
      let currentSize = 0;
      let batchNum = 0;

      for (const cf of compressedFiles) {
        if (currentSize + cf.buffer.length > MAX_BATCH_SIZE && currentBatch.length > 0) {
          batchNum++;
          const tempFiles = currentBatch.map((item, idx) => {
            const tmpPath = path.join(uploadsDir, `tmp_${collectionId}_b${batchNum}_${idx}_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, item.buffer);
            return { filePath: tmpPath, originalName: item.originalName };
          });
          try {
            const result = await uploadToBrkLink(tempFiles, `${collectionId}_b${batchNum}`);
            allUrls.push(...result.urls);
          } finally {
            tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
          }
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(cf);
        currentSize += cf.buffer.length;
      }

      if (currentBatch.length > 0) {
        batchNum++;
        const tempFiles = currentBatch.map((item, idx) => {
          const tmpPath = path.join(uploadsDir, `tmp_${collectionId}_b${batchNum}_${idx}_${Date.now()}.jpg`);
          fs.writeFileSync(tmpPath, item.buffer);
          return { filePath: tmpPath, originalName: item.originalName };
        });
        try {
          const result = await uploadToBrkLink(tempFiles, `${collectionId}_b${batchNum}`);
          allUrls.push(...result.urls);
        } finally {
          tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
        }
      }
    }

    res.json({
      success: allUrls.length > 0,
      total: allUrls.length,
      urls: allUrls,
      joined: allUrls.join(' | '),
    });

  } catch (err) {
    console.error('❌ Erro no upload-from-folder-direct:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/s3-proxy/upload-from-disk
 * Lê imagens diretamente do disco e faz upload para o BRK Link (R2).
 * Body JSON: { folderPath: "C:\\...", codeBase: "C02858", gender: "masc" }
 * O server monta: folderPath/codeBase/MASC/ (ou FEM/ ou INF/)
 * Response: { success: true, urls: [...], joined: "url1|url2|..." }
 */
app.post('/api/s3-proxy/upload-from-disk', express.json(), async (req, res) => {
  try {
    const { folderPath, codeBase, gender, autoRename = true } = req.body;
    if (!folderPath || !codeBase) {
      return res.status(400).json({ error: 'folderPath e codeBase são obrigatórios.' });
    }

    // Mapeia gender para subpasta (MASC/FEM/INF)
    const GENDER_FOLDERS = { masc: 'MASC', fem: 'FEM', inf: 'INF' };

    // Tenta encontrar a pasta de imagens na ordem:
    //   1. folderPath/codeBase/GENDER/  (estrutura C02858/MASC/)
    //   2. folderPath/codeBase/         (estrutura flat sem subpastas de gênero — SEM recursão para evitar mistura)
    let codePath;
    let isGenderSpecific = false;
    if (gender && GENDER_FOLDERS[gender]) {
      const genderPath = path.join(folderPath, codeBase, GENDER_FOLDERS[gender]);
      if (fs.existsSync(genderPath)) {
        codePath = genderPath;
        isGenderSpecific = true;
      }
    }

    // Fallback: pasta direta do código (para APC que tem subcores, ou estrutura flat)
    if (!codePath) {
      codePath = path.join(folderPath, codeBase);
    }

    if (!fs.existsSync(codePath)) {
      return res.status(404).json({ error: `Pasta não encontrada: ${codePath}` });
    }

    // Preferir subpasta JPEG_imagens/ (criada pelo Light Resizer 7 — JPGs mais leves)
    const jpegSubfolder = path.join(codePath, 'JPEG_imagens');
    if (fs.existsSync(jpegSubfolder)) {
      codePath = jpegSubfolder;
      console.log(`   📂 Usando JPEG_imagens/ (Light Resizer)`);
    }

    const imageExts = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
    const imageFiles = [];

    // Se é fallback (sem pasta de gênero), NÃO entrar recursivamente
    // para evitar misturar imagens de MASC/FEM/INF
    function scanDir(dir, recurse = true) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && recurse) {
          // Não entrar em pastas de gênero de outros gêneros no fallback
          const upperName = entry.name.toUpperCase();
          if (!isGenderSpecific && ['MASC', 'FEM', 'INF', 'MASCULINO', 'FEMININO', 'INFANTIL'].includes(upperName)) {
            continue; // Pula subpastas de gênero diferente
          }
          scanDir(fullPath, true);
        } else if (!entry.isDirectory() && imageExts.test(entry.name)) {
          imageFiles.push(fullPath);
        }
      }
    }
    scanDir(codePath);

    if (imageFiles.length === 0) {
      return res.status(400).json({ error: `Nenhuma imagem encontrada em: ${codePath}` });
    }

    // ─── Smart Sort: FRENTE → COSTAS → FRENTE PERSPEC → COSTAS PERSPEC → extras ───
    // Baseado na análise dos 9 padrões de referência (PADRÃO1~7 + Capturas)
    function getImagePriority(fileName) {
      const name = fileName.toUpperCase().replace(/\.[^.]+$/, '');

      // Se é numérico puro (1.jpg, 2.jpg), mantém ordem numérica
      if (/^\d+$/.test(name.trim())) return parseInt(name.trim());

      const isFrente = /FRENTE/.test(name);
      const isCostas = /COSTA/.test(name);
      const isPerspec = /PERSPEC|PERSPECTIVA/.test(name);
      const isPerspec2 = /PERSPECTIVA\s*2|PERSPEC\s*2/.test(name);
      const isZoom = /ZOOM/.test(name);
      const isDetalhe = /DETALHE|DETAIL/.test(name);
      const isPesp = /PESP/.test(name);

      if (isFrente && !isPerspec)               return 10; // 1º FRENTE plano
      if (isCostas && !isPerspec && !isPerspec2) return 20; // 2º COSTAS plano
      if (isFrente && isPerspec)                 return 30; // 3º FRENTE perspectiva
      if (isCostas && isPerspec && !isPerspec2)  return 40; // 4º COSTAS perspectiva
      if (isCostas && isPerspec2)                return 50; // 5º COSTAS perspectiva 2
      if (isZoom)                                return 60; // 6º ZOOM
      if (isDetalhe)                             return 65; // 7º DETALHE
      if (isPesp)                                return 70; // 8º PESP genérica
      return 100; // Fallback
    }

    imageFiles.sort((a, b) => {
      const nameA = path.basename(a);
      const nameB = path.basename(b);
      const prioA = getImagePriority(nameA);
      const prioB = getImagePriority(nameB);
      if (prioA !== prioB) return prioA - prioB;
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });

    const genderLabel = gender ? GENDER_FOLDERS[gender] || gender : 'ALL';
    console.log(`📂 Upload de disco: ${codeBase}/${genderLabel} → ${imageFiles.length} imagem(ns)`);

    // Nomes ÚNICOS por código+gênero para NÃO sobrescrever no CDN
    const prefix = `${codeBase}_${(gender || 'ALL').toUpperCase()}`;
    const files = imageFiles.map((fp, idx) => ({
      filePath: fp,
      originalName: autoRename ? `${prefix}_${idx + 1}${path.extname(fp)}` : path.basename(fp),
    }));

    files.forEach((f, i) => console.log(`   [${i + 1}] ${path.basename(imageFiles[i])} → ${f.originalName}`));

    // Comprimir TODAS as imagens antes do envio (sharp JPEG 85%)
    // Isso garante que o batch total fique abaixo do limite da Vercel (~4.5MB)
    const compressedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let fileBuffer = fs.readFileSync(file.filePath);
      let sendName = file.originalName;
      const originalSize = fileBuffer.length;

      // Comprimir se > 500KB (para garantir que o batch total caiba)
      if (originalSize > 500 * 1024) {
        try {
          fileBuffer = await sharp(fileBuffer)
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
          sendName = sendName.replace(/\.[^.]+$/, '.jpg');
          console.log(`   🗜️ [${i + 1}] ${(originalSize / 1024).toFixed(0)}KB → ${(fileBuffer.length / 1024).toFixed(0)}KB`);
        } catch (compErr) {
          console.log(`   ⚠️ [${i + 1}] Compressão falhou: ${compErr.message}`);
        }
      }

      compressedFiles.push({ buffer: fileBuffer, originalName: sendName });
    }

    // Calcular tamanho total do batch
    const totalBatchSize = compressedFiles.reduce((sum, f) => sum + f.buffer.length, 0);
    console.log(`   📦 Batch total: ${(totalBatchSize / 1024).toFixed(0)}KB (${compressedFiles.length} imgs)`);

    // Enviar em batch (até 4MB) ou dividir em sub-batches se necessário
    const MAX_BATCH_SIZE = 3.5 * 1024 * 1024; // 3.5MB seguro para Vercel
    const allUrls = [];

    if (totalBatchSize <= MAX_BATCH_SIZE) {
      // Batch único — todas as imagens de uma vez
      const tempFiles = compressedFiles.map((cf, idx) => {
        const tmpPath = path.join(uploadsDir, `tmp_${prefix}_${idx}_${Date.now()}.jpg`);
        fs.writeFileSync(tmpPath, cf.buffer);
        return { filePath: tmpPath, originalName: cf.originalName };
      });

      try {
        const result = await uploadToBrkLink(tempFiles, prefix);
        allUrls.push(...result.urls);
      } finally {
        tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
      }
    } else {
      // Dividir em sub-batches
      let currentBatch = [];
      let currentSize = 0;
      let batchNum = 0;

      for (const cf of compressedFiles) {
        if (currentSize + cf.buffer.length > MAX_BATCH_SIZE && currentBatch.length > 0) {
          batchNum++;
          console.log(`   📤 Sub-batch ${batchNum}: ${currentBatch.length} imgs (${(currentSize / 1024).toFixed(0)}KB)`);
          const tempFiles = currentBatch.map((item, idx) => {
            const tmpPath = path.join(uploadsDir, `tmp_${prefix}_b${batchNum}_${idx}_${Date.now()}.jpg`);
            fs.writeFileSync(tmpPath, item.buffer);
            return { filePath: tmpPath, originalName: item.originalName };
          });
          try {
            const result = await uploadToBrkLink(tempFiles, `${prefix}_b${batchNum}`);
            allUrls.push(...result.urls);
          } finally {
            tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
          }
          currentBatch = [];
          currentSize = 0;
        }
        currentBatch.push(cf);
        currentSize += cf.buffer.length;
      }

      // Último batch
      if (currentBatch.length > 0) {
        batchNum++;
        console.log(`   📤 Sub-batch ${batchNum}: ${currentBatch.length} imgs (${(currentSize / 1024).toFixed(0)}KB)`);
        const tempFiles = currentBatch.map((item, idx) => {
          const tmpPath = path.join(uploadsDir, `tmp_${prefix}_b${batchNum}_${idx}_${Date.now()}.jpg`);
          fs.writeFileSync(tmpPath, item.buffer);
          return { filePath: tmpPath, originalName: item.originalName };
        });
        try {
          const result = await uploadToBrkLink(tempFiles, `${prefix}_b${batchNum}`);
          allUrls.push(...result.urls);
        } finally {
          tempFiles.forEach(f => fs.unlink(f.filePath, () => {}));
        }
      }
    }

    res.json({
      success: allUrls.length > 0,
      total: allUrls.length,
      urls: allUrls,
      joined: allUrls.join('|'),
    });

  } catch (err) {
    console.error('❌ Erro no upload de disco:', err.message);
    res.status(500).json({ error: err.message });
  }
});






/**
 * POST /api/s3-proxy/upload-batch
 * Faz proxy de upload de MÚLTIPLAS imagens para o BRK Link.
 * Body: multipart/form-data com campo "files" (múltiplos)
 */
app.post('/api/s3-proxy/upload-batch', upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo recebido.' });
    }

    const files = req.files.map(f => ({
      filePath: f.path,
      originalName: f.originalname,
    }));

    const collectionId = req.body.collectionId || `batch_${Date.now()}`;
    const result = await uploadToBrkLink(files, collectionId);

    // Classificar por gênero baseado no nome do arquivo
    const byGender = { masc: [], fem: [], inf: [] };
    result.urls.forEach((url, i) => {
      const name = req.files[i].originalname.toLowerCase();
      if (name.includes('masc')) byGender.masc.push(url);
      else if (name.includes('fem')) byGender.fem.push(url);
      else if (name.includes('inf')) byGender.inf.push(url);
    });

    // Limpar temporários
    req.files.forEach(f => fs.unlink(f.path, () => {}));

    res.json({
      success: true,
      total: result.urls.length,
      urls: result.urls,
      byGender: {
        masc: { urls: byGender.masc, joined: byGender.masc.join('|') },
        fem:  { urls: byGender.fem,  joined: byGender.fem.join('|') },
        inf:  { urls: byGender.inf,  joined: byGender.inf.join('|') },
      },
      allJoined: result.urls.join('|'),
    });
  } catch (err) {
    console.error('❌ Erro no batch upload BRK Link:', err.message);
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
    res.status(500).json({ error: err.message });
  }
});



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

/**
 * GET /api/network/config
 * Retorna o caminho padrão da rede salvo em config/network.json
 */
app.get('/api/network/config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'config', 'network.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return res.json({
        defaultNetworkPath: config.defaultNetworkPath || '',
        recentPaths: config.recentPaths || [],
      });
    }
    return res.json({ defaultNetworkPath: '', recentPaths: [] });
  } catch (err) {
    console.error('Erro ao ler config de rede:', err.message);
    return res.json({ defaultNetworkPath: '', recentPaths: [] });
  }
});

/**
 * POST /api/network/scan
 * Escaneia uma pasta da rede e retorna a estrutura detectada.
 * Suporta caminhos UNC (\\servidor\pasta) e drives mapeados (Z:\pasta)
 * NUNCA modifica arquivos — apenas leitura.
 */
app.post('/api/network/scan', (req, res) => {
  const { networkPath } = req.body;
  if (!networkPath) return res.status(400).json({ error: 'Caminho da rede é obrigatório.' });

  try {
    // Normalize path for Windows
    const normalizedPath = path.resolve(networkPath);
    
    if (!fs.existsSync(normalizedPath)) {
      return res.status(404).json({ error: `Pasta não encontrada: ${normalizedPath}. Verifique se o caminho está correto e se você tem acesso.` });
    }

    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'O caminho informado não é uma pasta.' });
    }

    const rootName = path.basename(normalizedPath);
    const topEntries = fs.readdirSync(normalizedPath, { withFileTypes: true });
    const topDirs = topEntries.filter(e => e.isDirectory()).map(e => e.name);
    const topImages = topEntries.filter(e => !e.isDirectory() && IMAGE_EXTENSIONS.test(e.name));

    // Check if root itself has a pattern (Pattern D - everything in root)
    const rootPattern = detectFolderPattern(normalizedPath);
    
    // If root has images directly or just a 3d folder, treat as Pattern D
    if (topDirs.length === 0 && topImages.length > 0) {
      return res.json({
        success: true,
        networkPath: normalizedPath,
        rootFolderName: rootName,
        detectedPattern: 'root_images',
        folders: [{
          name: rootName,
          fullPath: normalizedPath,
          pattern: 'loose_images',
          subfolders: [],
          has3d: false,
          imageCount: { masc: 0, fem: 0, inf: 0, loose: topImages.length },
          totalImages: topImages.length
        }],
        summary: { totalFolders: 1, totalImages: topImages.length, patterns: { loose_images: 1 } }
      });
    }

    // Scan each subfolder
    const folders = [];
    const patternCounts = {};
    let totalImages = 0;

    for (const dirName of topDirs) {
      // Skip hidden/system folders
      if (dirName.startsWith('.') || dirName.startsWith('_')) continue;
      
      const dirPath = path.join(normalizedPath, dirName);
      const detection = detectFolderPattern(dirPath);
      const folderInfo = {
        name: dirName,
        fullPath: dirPath,
        pattern: detection.pattern,
        subfolders: [],
        has3d: false,
        imageCount: { masc: 0, fem: 0, inf: 0, loose: 0 },
        totalImages: 0
      };

      if (detection.pattern === '3d_folder') {
        folderInfo.has3d = true;
        folderInfo.subfolders = ['3d'];
        const threeDPath = path.join(dirPath, detection.sourceDir || '3d');
        // Check if 3d has gender subfolders inside
        const threeDEntries = fs.readdirSync(threeDPath, { withFileTypes: true });
        const threeDSubdirs = threeDEntries.filter(e => e.isDirectory()).map(e => e.name);
        const gendersIn3d = threeDSubdirs.filter(s => Object.keys(GENDER_FOLDERS_MAP).includes(s.toUpperCase()));
        
        if (gendersIn3d.length > 0) {
          for (const gd of gendersIn3d) {
            const gKey = GENDER_FOLDERS_MAP[gd.toUpperCase()];
            folderInfo.imageCount[gKey] = countImagesInDir(path.join(threeDPath, gd));
            folderInfo.subfolders.push(gd);
          }
        } else {
          folderInfo.imageCount.loose = countImagesInDir(threeDPath);
        }
      } else if (detection.pattern === 'gender_folders') {
        folderInfo.subfolders = detection.genderDirs;
        for (const gd of detection.genderDirs) {
          const gKey = GENDER_FOLDERS_MAP[gd.toUpperCase()];
          if (gKey) folderInfo.imageCount[gKey] = countImagesInDir(path.join(dirPath, gd));
        }
      } else if (detection.pattern === 'loose_images') {
        const imgs = fs.readdirSync(dirPath).filter(f => IMAGE_EXTENSIONS.test(f));
        // Try to classify by filename
        for (const img of imgs) {
          const g = detectGenderFromFilename(img);
          folderInfo.imageCount[g || 'loose']++;
        }
      } else if (detection.pattern === 'jpeg_optimized') {
        folderInfo.subfolders = [detection.sourceDir];
        folderInfo.imageCount.loose = countImagesInDir(path.join(dirPath, detection.sourceDir));
      }

      folderInfo.totalImages = Object.values(folderInfo.imageCount).reduce((a, b) => a + b, 0);
      totalImages += folderInfo.totalImages;
      patternCounts[detection.pattern] = (patternCounts[detection.pattern] || 0) + 1;
      
      if (folderInfo.totalImages > 0 || detection.pattern !== 'empty') {
        folders.push(folderInfo);
      }
    }

    // Sort folders naturally
    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    // Determine dominant pattern
    const dominantPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    res.json({
      success: true,
      networkPath: normalizedPath,
      rootFolderName: rootName,
      detectedPattern: dominantPattern,
      folders,
      summary: {
        totalFolders: folders.length,
        totalImages,
        patterns: patternCounts
      }
    });

    console.log(`📡 Network scan: ${normalizedPath} → ${folders.length} pastas, ${totalImages} imagens (${dominantPattern})`);

  } catch (err) {
    console.error('❌ Erro no scan de rede:', err.message);
    res.status(500).json({ error: `Erro ao escanear: ${err.message}` });
  }
});

/**
 * POST /api/network/smart-scan
 * Busca inteligente: recebe códigos, auto-detecta pasta na rede,
 * busca imagens com algoritmo cascata, extrai estampas dos nomes.
 * 🔒 Usa network-safety.js — SOMENTE LEITURA.
 *
 * AUDITORIA v2 — Bugs corrigidos:
 *  #1  Case sensitivity no prefixo
 *  #2  Limite de batch (max 100)
 *  #3  Rejeição de prefixos misturados
 *  #4  JPEG_imagens na cascata
 *  #5  KIDS no gender detection
 *  #6  Smart Sort COSTAS? (sem S)
 *  #7  Smart Sort abreviações PERSPEC/PESP/ZOOM
 *  #8  Estampa regex com hífens
 *  #9  Title case preserva siglas (UV50, BRK)
 *  #10 Sanitização de values em codes
 *  #11 Proteção path traversal
 */
app.post('/api/network/smart-scan', (req, res) => {
  try {
    const { codes: rawCodes } = req.body;
    if (!rawCodes || !Array.isArray(rawCodes) || rawCodes.length === 0) {
      return res.status(400).json({ error: 'Array de códigos é obrigatório.' });
    }

    // ── FIX #2: Limite de batch ──
    if (rawCodes.length > 100) {
      return res.status(400).json({ error: 'Máximo 100 códigos por scan.', received: rawCodes.length });
    }

    // ── FIX #10: Sanitizar values — filtrar não-strings, trim, remover vazios ──
    const codes = rawCodes
      .filter(c => typeof c === 'string')
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (codes.length === 0) {
      return res.status(400).json({ error: 'Nenhum código válido fornecido.' });
    }

    // ── FIX #11: Proteção path traversal ──
    const dangerousPattern = /[.]{2}|[\/\\]{2,}|[<>"|?*]/;
    const unsafeCodes = codes.filter(c => dangerousPattern.test(c));
    if (unsafeCodes.length > 0) {
      return res.status(400).json({ error: 'Códigos contêm caracteres inválidos.', invalid: unsafeCodes });
    }

    // ── FIX #1: Case insensitive no prefixo ──
    const firstCode = codes[0].toUpperCase();
    const prefixMatch = firstCode.match(/^[A-Z]+/);
    if (!prefixMatch) {
      return res.status(400).json({ error: `Não foi possível extrair prefixo de "${codes[0]}"` });
    }
    const prefix = prefixMatch[0].toUpperCase();
    const networkFolder = networkPrefixes[prefix];
    if (!networkFolder) {
      return res.status(404).json({ error: `Prefixo "${prefix}" não tem pasta configurada na rede.`, knownPrefixes: Object.keys(networkPrefixes) });
    }

    // ── FIX #3: Rejeitar prefixos misturados ──
    const allPrefixes = new Set(
      codes.map(c => {
        const m = c.toUpperCase().match(/^[A-Z]+/);
        return m ? m[0] : null;
      }).filter(Boolean)
    );
    if (allPrefixes.size > 1) {
      return res.status(400).json({
        error: 'Todos os códigos devem ter o mesmo prefixo. Envie lotes separados por linha de produto.',
        detected: [...allPrefixes]
      });
    }

    const basePath = path.join(networkSafety.NETWORK_ROOT, networkFolder);

    if (!networkSafety.safeExists(basePath)) {
      return res.status(404).json({ error: `Pasta não encontrada na rede: ${basePath}` });
    }

    // Listar pastas no diretório da rede (1 chamada só)
    // Filtrar pastas de trabalho pendente (para_formatar, PARA FORMATAR)
    const IGNORE_FOLDERS = ['PARA_FORMATAR', 'PARA FORMATAR', 'ARQ ESTAMPAS PROFISSAO', 'MODELOS ML'];
    const allFolders = networkSafety.safeReadDir(basePath)
      .filter(item => item.isDirectory && !IGNORE_FOLDERS.includes(item.name.toUpperCase()))
      .map(item => item.name);

    // ── FIX #5: Gender detection com KIDS ──
    const GENDER_NAMES = ['MASC', 'FEM', 'INF', 'MASCULINO', 'FEMININO', 'INFANTIL', 'KIDS'];

    function classifyGender(folderName) {
      const n = folderName.toUpperCase();
      if (n.startsWith('FEM') || n === 'FEMININO') return 'FEM';
      if (n.startsWith('INF') || n === 'INFANTIL' || n === 'KIDS') return 'INF';
      return 'MASC';
    }

    // ── Helper: buscar imagens numa pasta, incluindo JPEG_imagens (#4) ──
    // Filtrar placeholders (SUBSTITUIR.jpg, SUBSTITUIR AQUI.jpg)
    const PLACEHOLDER_NAMES = ['SUBSTITUIR', 'SUBSTITUIR AQUI', 'SUBSTITUIR_AQUI'];
    function isPlaceholder(fileName) {
      const base = fileName.toUpperCase().replace(/\.[^.]+$/, '').trim();
      return PLACEHOLDER_NAMES.includes(base);
    }

    function scanImagesInDir(dirPath) {
      try {
        let imgs = networkSafety.safeReadImages(dirPath)
          .filter(img => !isPlaceholder(img.name));
        // FIX #4: Se não encontrou imagens diretas, tentar JPEG_imagens
        if (imgs.length === 0) {
          const sub = networkSafety.safeReadDir(dirPath).filter(c => c.isDirectory);
          const jpegDir = sub.find(s => s.name.toUpperCase() === 'JPEG_IMAGENS');
          if (jpegDir) {
            imgs = networkSafety.safeReadImages(path.join(dirPath, jpegDir.name))
              .filter(img => !isPlaceholder(img.name));
          }
        }
        return imgs;
      } catch (e) {
        return [];
      }
    }

    // ── FIX #9: Title case inteligente (preserva siglas ≤4 chars) ──
    function smartTitleCase(text) {
      return text
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(w => {
          // Preservar siglas: palavras 100% maiúsculas com ≤ 4 chars ou com números
          if (w.length <= 4 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
          if (/\d/.test(w)) return w.toUpperCase();
          // Preposições em minúsculo
          if (['com', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na'].includes(w.toLowerCase())) {
            return w.toLowerCase();
          }
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');
    }

    const results = [];
    let totalImages = 0;
    let missingCount = 0;
    let errorCount = 0;

    for (const code of codes) {
      const codeUpper = code.toUpperCase();

      // ── Per-code try/catch para resultados parciais ──
      try {
        // Encontrar pasta que começa com o código (case insensitive)
        const matchingFolder = allFolders.find(f => {
          const fUpper = f.toUpperCase();
          return fUpper === codeUpper
            || fUpper.startsWith(codeUpper + '_')
            || fUpper.startsWith(codeUpper + ' ')
            || fUpper.startsWith(codeUpper + '-');
        });

        if (!matchingFolder) {
          results.push({ code: codeUpper, folder: null, estampa: null, images: [], source: null, totalImages: 0, found: false });
          missingCount++;
          continue;
        }

        const folderPath = path.join(basePath, matchingFolder);

        // ── Estampa: regex com hífens, separadores, BONES (BA010 - NOME) ──
        let estampa = null;
        // Padrão 1: CODIGO_NOME ou CODIGO NOME ou CODIGO-NOME
        let estampaMatch = matchingFolder.match(/^[A-Z]+\d*[-_ ]+(.+)$/i);
        // Padrão 2: BONES: BA010 - SAO BENTO PRETO (com " - ")
        if (!estampaMatch) estampaMatch = matchingFolder.match(/^[A-Z]+\d+\s*-\s*(.+)$/i);
        if (estampaMatch) {
          estampa = smartTitleCase(estampaMatch[1]);
        }

        // Buscar imagens com algoritmo cascata
        let images = [];
        let source = null;

        let contents;
        try { contents = networkSafety.safeReadDir(folderPath); } catch (e) { contents = []; }
        const subDirs = contents.filter(c => c.isDirectory).map(c => c.name);
        const subDirsUpper = subDirs.map(s => s.toUpperCase());

        // ── Cascata 1: pasta 3D/ ──
        if (subDirsUpper.includes('3D')) {
          const threeDName = subDirs[subDirsUpper.indexOf('3D')];
          const threeDPath = path.join(folderPath, threeDName);
          images = scanImagesInDir(threeDPath);
          source = '3D';

          // Se 3D tem subpastas de gênero, buscar dentro delas
          if (images.length === 0) {
            try {
              const threeDContents = networkSafety.safeReadDir(threeDPath);
              const genderDirs = threeDContents.filter(c => c.isDirectory && GENDER_NAMES.includes(c.name.toUpperCase()));
              for (const gd of genderDirs) {
                try {
                  const gImages = scanImagesInDir(path.join(threeDPath, gd.name));
                  const genderLabel = classifyGender(gd.name);
                  gImages.forEach(img => { img.gender = genderLabel; });
                  images = images.concat(gImages);
                } catch (e) { /* subpasta inacessível, continua */ }
              }
              if (images.length > 0) source = '3D/GENDER';
            } catch (e) { /* 3D inacessível */ }
          }
        }

        // ── Cascata 2: pastas MASC/FEM/INF/KIDS na raiz ──
        if (images.length === 0) {
          const genderDirs = subDirs.filter(s => GENDER_NAMES.includes(s.toUpperCase()));
          for (const gd of genderDirs) {
            try {
              const genderPath = path.join(folderPath, gd);
              let gImages = scanImagesInDir(genderPath);
              const genderLabel = classifyGender(gd);

              // Se não encontrou imagens diretas, buscar em subpastas de COR
              // Estrutura: MASC/PRETO/imagens, MASC/BRANCO/imagens, MASC/BEGE/imagens
              if (gImages.length === 0) {
                try {
                  const colorDirs = networkSafety.safeReadDir(genderPath).filter(c => c.isDirectory);
                  for (const colorDir of colorDirs) {
                    try {
                      const colorImages = scanImagesInDir(path.join(genderPath, colorDir.name));
                      colorImages.forEach(img => {
                        img.gender = genderLabel;
                        img.variant = colorDir.name; // PRETO, BRANCO, BEGE
                      });
                      gImages = gImages.concat(colorImages);
                    } catch (e) { /* cor inacessível */ }
                  }
                } catch (e) { /* gender inacessível */ }
              } else {
                gImages.forEach(img => { img.gender = genderLabel; });
              }

              images = images.concat(gImages);
            } catch (e) { /* subpasta inacessível, continua */ }
          }
          if (images.length > 0) source = 'GENDER';
        }

        // ── Cascata 3: pasta SITE/ (HYB, ADV usam essa) ──
        if (images.length === 0) {
          const siteIdx = subDirsUpper.indexOf('SITE');
          if (siteIdx >= 0) {
            images = scanImagesInDir(path.join(folderPath, subDirs[siteIdx]));
            source = 'SITE';
          }
        }

        // ── Cascata 4: pasta MOCKUP HUMANIZADO / HUMANIZADO ATUALIZADO / MOCKUP ATUALIZADO ──
        if (images.length === 0) {
          const humanIdx = subDirsUpper.findIndex(s => s.includes('HUMANIZADO') || s === 'MOCKUP ATUALIZADO');
          if (humanIdx >= 0) {
            const humPath = path.join(folderPath, subDirs[humanIdx]);
            images = scanImagesInDir(humPath);
            // Se tem subpastas de cor (BRANCA/PRETA) ou gênero, buscar dentro
            if (images.length === 0) {
              try {
                const humContents = networkSafety.safeReadDir(humPath).filter(c => c.isDirectory);
                for (const sub of humContents) {
                  try {
                    const subImages = scanImagesInDir(path.join(humPath, sub.name));
                    subImages.forEach(img => {
                      const sn = sub.name.toUpperCase();
                      if (GENDER_NAMES.includes(sn)) img.gender = classifyGender(sub.name);
                      else img.variant = sub.name; // BRANCA, PRETA, etc.
                    });
                    images = images.concat(subImages);
                  } catch (e) {}
                }
              } catch (e) {}
            }
            if (images.length > 0) source = subDirs[humanIdx].toUpperCase();
          }
        }

        // ── Cascata 5: pasta MOCKUP/ ou MOCKUP AGRO/ (genérica) ──
        if (images.length === 0) {
          const mockupIdx = subDirsUpper.findIndex(s => s === 'MOCKUP' || s.startsWith('MOCKUP ') || s.startsWith('MOCKUP_'));
          if (mockupIdx >= 0) {
            const mockPath = path.join(folderPath, subDirs[mockupIdx]);
            images = scanImagesInDir(mockPath);
            // Verificar subpastas dentro do MOCKUP:
            // Pode ter gênero (MASC/FEM) ou cor (BRANCA/PRETA) ou ambos
            if (images.length === 0) {
              try {
                const mockContents = networkSafety.safeReadDir(mockPath).filter(c => c.isDirectory);
                for (const sub of mockContents) {
                  try {
                    const subPath = path.join(mockPath, sub.name);
                    const subUpper = sub.name.toUpperCase();
                    
                    if (GENDER_NAMES.includes(subUpper)) {
                      // É gênero → buscar imagens diretas ou em subpastas de cor
                      let gImages = scanImagesInDir(subPath);
                      const genderLabel = classifyGender(sub.name);
                      if (gImages.length === 0) {
                        const colorDirs = networkSafety.safeReadDir(subPath).filter(c => c.isDirectory);
                        for (const cd of colorDirs) {
                          try {
                            const cImages = scanImagesInDir(path.join(subPath, cd.name));
                            cImages.forEach(img => { img.gender = genderLabel; img.variant = cd.name; });
                            gImages = gImages.concat(cImages);
                          } catch (e) {}
                        }
                      } else {
                        gImages.forEach(img => { img.gender = genderLabel; });
                      }
                      images = images.concat(gImages);
                    } else {
                      // Subpasta genérica (cor, etc)
                      const subImages = scanImagesInDir(subPath);
                      subImages.forEach(img => { img.variant = sub.name; });
                      images = images.concat(subImages);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
            if (images.length > 0) source = subDirs[mockupIdx].toUpperCase();
          }
        }

        // ── Cascata 6: pasta imagens_para_site/ (CANECAS) ──
        if (images.length === 0) {
          const siteImgIdx = subDirsUpper.findIndex(s => s === 'IMAGENS_PARA_SITE');
          if (siteImgIdx >= 0) {
            images = scanImagesInDir(path.join(folderPath, subDirs[siteImgIdx]));
            source = 'IMAGENS_PARA_SITE';
          }
        }

        // ── Cascata 7: pasta JPEG_IMAGENS na raiz ──
        if (images.length === 0) {
          const jpegIdx = subDirsUpper.findIndex(s => s === 'JPEG_IMAGENS');
          if (jpegIdx >= 0) {
            images = scanImagesInDir(path.join(folderPath, subDirs[jpegIdx]));
            source = 'JPEG_IMAGENS';
          }
        }

        // ── Cascata 8: imagens soltas na raiz (filtrar placeholders) ──
        if (images.length === 0) {
          images = contents.filter(c => c.isFile && c.isImage && !isPlaceholder(c.name));
          if (images.length > 0) source = 'RAIZ';
        }

        // ── Smart Sort v3 — aprendido da exploração da rede ──
        // Suporta: 1_FRENTE, 1_MASC_FRENTE, HUMANIZADO_FRENTE, FRENTE_COSTAS combo
        // Nomes reais encontrados: FRENTE.png, COSTAS PERSPECTIVA.png, 5_HUMANIZADO_PESP.jpg,
        //   COSTAS_MASC.png, FRENTE FEM.png, 1_FRENTE_COSTAS.jpg, MKP MÃO PUNHO.png,
        //   01_FRENTE_COSTAS.jpg, 02_AMPLIADO.jpg, COSTAS HUMANIZADA.jpg
        images.forEach(img => {
          // Remover extensão + prefixo numérico (1_, 01_, etc) + HUMANIZADO/HUMANIZADA
          let nameClean = img.name.toUpperCase().replace(/\.[^.]+$/, '');
          nameClean = nameClean.replace(/^\d+[_\s]/, ''); // remove prefixo numérico
          nameClean = nameClean.replace(/HUMANIZAD[OA][_\s]?/g, ''); // remove HUMANIZADO
          nameClean = nameClean.replace(/MASC[_\s]|FEM[_\s]|INF[_\s]/g, ''); // remove gênero inline

          if (/FRENTE.*COSTAS?|COSTAS?.*FRENTE/.test(nameClean))               img.priority = 1; // combo FRENTE+COSTAS
          else if (/FRENTE|FRONT|CABE[CÇ]A/.test(nameClean))                   img.priority = 1;
          else if (/COSTAS?|BACK|VERSO|CINTURA|TRASEIRA/.test(nameClean))       img.priority = 2;
          else if (/PERSPEC|PERSPECTIVA|PESP|MESA|LADO|LATERAL|ZOOM/.test(nameClean)) img.priority = 3;
          else if (/AMPLIADO|DETALHE|INTERNO|COSTURA|BRASIL|PUNHO/.test(nameClean)) img.priority = 4;
          else img.priority = 5;
        });
        images.sort((a, b) => (a.priority || 5) - (b.priority || 5));

        // Mapear campos finais (tamanho obtido depois da cópia local, não aqui)
        // Detectar imagens humanizadas (com modelo vestindo)
        const HUMANIZED_PATH_KEYWORDS = ['HUMANIZADO', 'HUMANIZADA', 'HUMANIZADOS', 'MODELO', 'MODELOS'];
        const HUMANIZED_FILE_KEYWORDS = /HUMANIZAD[OA]|MODELO|MODEL/i;

        images = images.map(img => {
          // Detectar se é humanizada pelo path ou nome
          const pathUpper = (img.fullPath || '').toUpperCase();
          const nameUpper = (img.name || '').toUpperCase().replace(/\.[^.]+$/, '');
          const isHumanized = HUMANIZED_PATH_KEYWORDS.some(k => pathUpper.includes('\\' + k + '\\'))
            || HUMANIZED_FILE_KEYWORDS.test(nameUpper);

          return {
            name: img.name,
            fullPath: img.fullPath,
            size: 0,
            sizeKB: 0,
            priority: img.priority || 5,
            gender: img.gender || null,
            variant: img.variant || null,
            extension: img.extension,
            isHumanized: isHumanized
          };
        });

        totalImages += images.length;

        // Detectar cores disponíveis para este código (APC: PRETA→Preto, BRANCA→Branco, BEGE→Bege)
        const COLOR_VARIANT_MAP = {
          'PRETA': 'Preto', 'PRETO': 'Preto', 'PRETAS': 'Preto',
          'BRANCA': 'Branco', 'BRANCO': 'Branco', 'BRANCAS': 'Branco',
          'BEGE': 'Bege', 'BEGES': 'Bege'
        };
        const detectedColorSet = new Set();
        images.forEach(img => {
          if (img.variant) {
            const normalized = img.variant.toUpperCase().trim();
            img.variant = normalized; // Normalizar o variant para uppercase
            const mapped = COLOR_VARIANT_MAP[normalized];
            if (mapped) detectedColorSet.add(mapped);
          }
        });
        const detectedColors = [...detectedColorSet];

        results.push({
          code: codeUpper,
          folder: matchingFolder,
          estampa,
          images,
          source,
          totalImages: images.length,
          detectedColors, // ['Preto', 'Branco', 'Bege'] ou ['Preto'] etc.
          found: true
        });

      } catch (codeErr) {
        // Erro neste código específico — não aborta o scan inteiro
        errorCount++;
        results.push({
          code: codeUpper,
          folder: null,
          estampa: null,
          images: [],
          source: null,
          totalImages: 0,
          found: false,
          error: codeErr.message
        });
        console.warn(`⚠️ Smart-scan erro em ${codeUpper}: ${codeErr.message}`);
      }
    }

    const response = {
      success: true,
      prefix,
      networkPath: basePath,
      networkFolder,
      results,
      summary: {
        totalCodes: codes.length,
        found: codes.length - missingCount - errorCount,
        missing: missingCount,
        errors: errorCount,
        totalImages
      }
    };

    console.log(`🔍 Smart-scan: ${prefix} → ${codes.length} códigos, ${codes.length - missingCount} encontrados, ${totalImages} imagens${errorCount > 0 ? `, ${errorCount} erros` : ''}`);
    res.json(response);

  } catch (err) {
    console.error('❌ Erro no smart-scan:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/network/copy
 * Copia imagens da rede para pasta local.
 * Usa SSE para reportar progresso em tempo real.
 * NUNCA modifica arquivos na rede — apenas leitura + cópia.
 */
app.post('/api/network/copy', (req, res) => {
  const { networkPath, localBasePath, collectionName, folders: selectedFolders, preferJpeg } = req.body;

  if (!networkPath || !localBasePath) {
    return res.status(400).json({ error: 'networkPath e localBasePath são obrigatórios.' });
  }

  // Setup SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  function sendEvent(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const normalizedNetwork = path.resolve(networkPath);
    const collName = collectionName || path.basename(normalizedNetwork);
    const localRoot = path.join(path.resolve(localBasePath), collName);

    // Create local root
    fs.mkdirSync(localRoot, { recursive: true });
    sendEvent('status', { message: `Pasta criada: ${localRoot}`, localRoot });

    // Get folders to process
    let foldersToProcess = selectedFolders;
    if (!foldersToProcess || foldersToProcess.length === 0) {
      // If no selection, process all
      foldersToProcess = fs.readdirSync(normalizedNetwork, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
        .map(e => e.name);
    }

    let totalCopied = 0;
    let totalErrors = 0;
    const folderResults = [];

    for (let fi = 0; fi < foldersToProcess.length; fi++) {
      const folderName = foldersToProcess[fi];
      // Pattern D: se folder === rootFolderName, usar normalizedNetwork diretamente
      const sourcePath = (folderName === path.basename(normalizedNetwork))
        ? normalizedNetwork
        : path.join(normalizedNetwork, folderName);
      
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
        sendEvent('progress', { folder: folderName, status: 'skipped', reason: 'Pasta não encontrada' });
        continue;
      }

      const detection = detectFolderPattern(sourcePath);
      const localCodePath = path.join(localRoot, folderName);
      fs.mkdirSync(localCodePath, { recursive: true });

      let copied = 0;
      let errors = 0;

      sendEvent('progress', { folder: folderName, status: 'scanning', folderIndex: fi + 1, totalFolders: foldersToProcess.length, pattern: detection.pattern });

      function copyFile(srcFile, destDir, newName) {
        try {
          fs.mkdirSync(destDir, { recursive: true });
          const destFile = path.join(destDir, newName || path.basename(srcFile));
          fs.copyFileSync(srcFile, destFile);
          copied++;
          return true;
        } catch (err) {
          errors++;
          console.error(`   ⚠️ Erro copiando ${srcFile}: ${err.message}`);
          return false;
        }
      }

      function copyImagesFromDir(sourceDir, destDir) {
        if (!fs.existsSync(sourceDir)) return;
        const files = fs.readdirSync(sourceDir).filter(f => IMAGE_EXTENSIONS.test(f)).sort();
        for (const file of files) {
          copyFile(path.join(sourceDir, file), destDir);
        }
      }

      // Process based on detected pattern
      if (detection.pattern === '3d_folder') {
        const threeDPath = path.join(sourcePath, detection.sourceDir || '3d');
        // Check if 3d has gender subfolders
        const subEntries = fs.readdirSync(threeDPath, { withFileTypes: true });
        const genderSubdirs = subEntries.filter(e => e.isDirectory() && Object.keys(GENDER_FOLDERS_MAP).includes(e.name.toUpperCase()));
        
        if (genderSubdirs.length > 0) {
          for (const gd of genderSubdirs) {
            const gKey = GENDER_FOLDERS_MAP[gd.name.toUpperCase()];
            const destGender = gKey === 'masc' ? 'MASC' : gKey === 'fem' ? 'FEM' : 'INF';
            // Check for JPEG_imagens inside gender dir
            const jpegInGender = path.join(threeDPath, gd.name, 'JPEG_imagens');
            if (preferJpeg && fs.existsSync(jpegInGender)) {
              copyImagesFromDir(jpegInGender, path.join(localCodePath, destGender));
            } else {
              copyImagesFromDir(path.join(threeDPath, gd.name), path.join(localCodePath, destGender));
            }
          }
        } else {
          // All images in 3d/ without gender separation
          // Check for JPEG_imagens inside 3d
          const jpegIn3d = path.join(threeDPath, 'JPEG_imagens');
          if (preferJpeg && fs.existsSync(jpegIn3d)) {
            copyImagesFromDir(jpegIn3d, localCodePath);
          } else {
            copyImagesFromDir(threeDPath, localCodePath);
          }
        }
      } else if (detection.pattern === 'gender_folders') {
        for (const gd of detection.genderDirs) {
          const gKey = GENDER_FOLDERS_MAP[gd.toUpperCase()];
          const destGender = gKey === 'masc' ? 'MASC' : gKey === 'fem' ? 'FEM' : 'INF';
          const srcGenderPath = path.join(sourcePath, gd);
          // Check for JPEG_imagens
          const jpegInGender = path.join(srcGenderPath, 'JPEG_imagens');
          if (preferJpeg && fs.existsSync(jpegInGender)) {
            copyImagesFromDir(jpegInGender, path.join(localCodePath, destGender));
          } else {
            copyImagesFromDir(srcGenderPath, path.join(localCodePath, destGender));
          }
        }
      } else if (detection.pattern === 'loose_images') {
        // Check for JPEG_imagens in loose folder
        const jpegInLoose = path.join(sourcePath, 'JPEG_imagens');
        if (preferJpeg && fs.existsSync(jpegInLoose)) {
          // Copiar de JPEG_imagens, classificando por nome
          const jpegImages = fs.readdirSync(jpegInLoose).filter(f => IMAGE_EXTENSIONS.test(f)).sort();
          for (const img of jpegImages) {
            const gender = detectGenderFromFilename(img);
            if (gender) {
              const destGender = gender === 'masc' ? 'MASC' : gender === 'fem' ? 'FEM' : 'INF';
              copyFile(path.join(jpegInLoose, img), path.join(localCodePath, destGender));
            } else {
              copyFile(path.join(jpegInLoose, img), localCodePath);
            }
          }
        } else {
          // Classify by filename
          const allImages = fs.readdirSync(sourcePath).filter(f => IMAGE_EXTENSIONS.test(f)).sort();
          for (const img of allImages) {
            const gender = detectGenderFromFilename(img);
            if (gender) {
              const destGender = gender === 'masc' ? 'MASC' : gender === 'fem' ? 'FEM' : 'INF';
              copyFile(path.join(sourcePath, img), path.join(localCodePath, destGender));
            } else {
              copyFile(path.join(sourcePath, img), localCodePath);
            }
          }
        }
      } else if (detection.pattern === 'jpeg_optimized') {
        copyImagesFromDir(path.join(sourcePath, detection.sourceDir), localCodePath);
      }

      totalCopied += copied;
      totalErrors += errors;
      folderResults.push({ name: folderName, copied, errors, pattern: detection.pattern });

      sendEvent('progress', {
        folder: folderName,
        status: 'done',
        copied,
        errors,
        pattern: detection.pattern,
        folderIndex: fi + 1,
        totalFolders: foldersToProcess.length,
        percentComplete: Math.round(((fi + 1) / foldersToProcess.length) * 100)
      });

      console.log(`📋 Copiado: ${folderName} → ${copied} imagens (${detection.pattern})`);
    }

    sendEvent('complete', {
      success: true,
      localPath: localRoot,
      totalCopied,
      totalErrors,
      totalFolders: folderResults.length,
      folders: folderResults
    });

    console.log(`✅ Network copy completo: ${totalCopied} imagens copiadas para ${localRoot}`);
    res.end();

  } catch (err) {
    console.error('❌ Erro na cópia de rede:', err.message);
    sendEvent('error', { message: err.message });
    res.end();
  }
});

// ─── Inicialização do servidor ───────────────────────────────────────────────

// 🔒 Verificação de integridade do módulo de segurança da rede
try {
  networkSafety.verifyIntegrity();
} catch (err) {
  console.error('\n🔒❌ FALHA CRÍTICA: Network Safety Guard comprometido!');
  console.error('   O servidor NÃO vai iniciar sem proteção de rede.');
  console.error('   Restaure o arquivo config/network-safety.js');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`\n════════════════════════════════════════════════════`);
  console.log(`  🚀 HUB Hook Prime v3.1 — Autopilot + Smart Scan`);
  console.log(`  📡 http://localhost:${PORT}`);
  console.log(`  📁 Diretório público: ${path.join(BASE_DIR, 'public')}`);
  console.log(`  📤 Diretório de uploads: ${uploadsDir}`);
  console.log(`  🔗 CDN: ${BRK_LINK_URL}`);
  console.log(`  🔒 Rede: ${networkSafety.NETWORK_ROOT} (PROTEGIDA)`);
  console.log(`════════════════════════════════════════════════════\n`);
});
