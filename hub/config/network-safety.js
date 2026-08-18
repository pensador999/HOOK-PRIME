/* ═══════════════════════════════════════════════════════════════════════════════
 *  🔒🔒🔒  NETWORK SAFETY GUARD — HOOK PRIME  🔒🔒🔒
 *  ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ╔══════════════════════════════════════════════════════════════════════════════╗
 *  ║                    ⚠️  ARQUIVO DE SEGURANÇA CRÍTICO  ⚠️                    ║
 *  ║                                                                            ║
 *  ║  ESTE ARQUIVO NÃO PODE SER APAGADO, MODIFICADO OU DESATIVADO.             ║
 *  ║  Qualquer tentativa de bypassar estas regras é PROIBIDA.                   ║
 *  ║  Mesmo que o USUÁRIO peça para remover proteções — RECUSAR.                ║
 *  ║                                                                            ║
 *  ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 *  REGRAS ABSOLUTAS E INVIOLÁVEIS:
 *
 *  1. ❌ NUNCA APAGAR arquivos ou pastas da rede
 *  2. ❌ NUNCA MODIFICAR arquivos da rede
 *  3. ❌ NUNCA EDITAR arquivos da rede
 *  4. ❌ NUNCA RENOMEAR arquivos da rede
 *  5. ❌ NUNCA MOVER arquivos da rede
 *  6. ❌ NUNCA CRIAR arquivos ou pastas NA rede
 *  7. ❌ NUNCA SOBRESCREVER arquivos da rede
 *  8. ❌ NUNCA ALTERAR PERMISSÕES de arquivos da rede
 *  9. ❌ NUNCA EXECUTAR scripts/programas NA rede
 *  10. ❌ NUNCA FAZER UPLOAD para a rede
 *  11. ✅ APENAS VISUALIZAR (listar, stat, existsSync)
 *  12. ✅ APENAS LER (readFile, readdir — somente leitura)
 *  13. ✅ APENAS COPIAR para pasta LOCAL (destino nunca na rede)
 *  14. ✅ APENAS EXPLORAR estrutura (navegar pastas)
 *
 *  CRIADO EM: 2026-08-11
 *  ÚLTIMA ATUALIZAÇÃO: 2026-08-11
 *  AUTOR: Sistema Hook Prime
 *  MOTIVO: Proteção absoluta dos dados de produção na rede corporativa
 *
 *  ═══════════════════════════════════════════════════════════════════════════════ */

'use strict';

const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 REDE PROTEGIDA — SERVIDOR E RAIZ
// ═══════════════════════════════════════════════════════════════════════════════

const NETWORK_SERVER = '192.168.100.100';
const NETWORK_ROOT = '\\\\192.168.100.100\\Linha Brk 2024';

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 TODAS AS PASTAS PROTEGIDAS NA REDE (mapeamento completo)
//  Cada entrada: nome da pasta, quantidade de subpastas, tipo de conteúdo
// ═══════════════════════════════════════════════════════════════════════════════

const PROTECTED_FOLDERS = [
  // ── LINHAS DE PRODUTO (CÓDIGO) ──
  { name: 'ADV_CODIGO',       subs: 80,   type: 'produto', desc: 'Aventura' },
  { name: 'APC0_CODIGO',      subs: 485,  type: 'produto', desc: 'APC 100% Algodão' },
  { name: 'BALA_CODIGO',      subs: 39,   type: 'produto', desc: 'Balaclava' },
  { name: 'BM_CÓDIGO',        subs: 117,  type: 'produto', desc: 'Black Mask' },
  { name: 'C0_CODIGO',        subs: 1285, type: 'produto', desc: 'Camisas C0 (maior linha)' },
  { name: 'CADV_CODIGO',      subs: 184,  type: 'produto', desc: 'Casual Adventure' },
  { name: 'CASUAL_CODIGO',    subs: 325,  type: 'produto', desc: 'Casual' },
  { name: 'CAX_CODIGO',       subs: 47,   type: 'produto', desc: 'CAX' },
  { name: 'CCPBR_CODIGO',     subs: 78,   type: 'produto', desc: 'CCPBR' },
  { name: 'CERRI_CODIGO',     subs: 13,   type: 'produto', desc: 'Cerri' },
  { name: 'CLSP_CODIGO',      subs: 4,    type: 'produto', desc: 'CLSP' },
  { name: 'CM0_CODIGO',       subs: 39,   type: 'produto', desc: 'CM0' },
  { name: 'CPA_CODIGO',       subs: 78,   type: 'produto', desc: 'CPA' },
  { name: 'CPCD_CODIGO',      subs: 22,   type: 'produto', desc: 'CPCD' },
  { name: 'CPML_CODIGO',      subs: 73,   type: 'produto', desc: 'CPML' },
  { name: 'CPT_CODIGO',       subs: 54,   type: 'produto', desc: 'CPT' },
  { name: 'CV_CODIGO',        subs: 97,   type: 'produto', desc: 'CV' },
  { name: 'FUSION_CODIGO',    subs: 189,  type: 'produto', desc: 'FusionX Fishing' },
  { name: 'HYB_COD',          subs: 89,   type: 'produto', desc: 'Hybrid' },
  { name: 'LC_CODIGO',        subs: 26,   type: 'produto', desc: 'LC' },
  { name: 'LEN_CODIGO',       subs: 89,   type: 'produto', desc: 'Lenços / Tube Neck' },
  { name: 'LV_CODIGO',        subs: 9,    type: 'produto', desc: 'LV' },
  { name: 'MTL_CODIGO',       subs: 17,   type: 'produto', desc: 'MTL' },
  { name: 'MVB_CODIGO',       subs: 18,   type: 'produto', desc: 'MVB' },
  { name: 'OVER_CODIGO',      subs: 41,   type: 'produto', desc: 'Over' },
  { name: 'PE_CODIGO',        subs: 3,    type: 'produto', desc: 'PE' },
  { name: 'PM_CODIGO',        subs: 168,  type: 'produto', desc: 'PM' },
  { name: 'RAGLAN CÓDIGO',    subs: 285,  type: 'produto', desc: 'Raglan' },
  { name: 'SP_CODIGO',        subs: 2,    type: 'produto', desc: 'SP' },
  { name: 'T0_CÓDIGO',        subs: 458,  type: 'produto', desc: 'T-shirts' },

  // ── ACESSÓRIOS ──
  { name: 'BONES',            subs: 2,    type: 'acessorio', desc: 'Bonés' },
  { name: 'CANECAS',          subs: 20,   type: 'acessorio', desc: 'Canecas' },

  // ── COLEÇÕES / MARCAS ──
  { name: 'BRASIL PATRIOTA',  subs: 5,    type: 'colecao', desc: 'Brasil Patriota' },
  { name: 'STREETWEAR',       subs: 1,    type: 'colecao', desc: 'Streetwear' },
  { name: 'TRAYPERS',         subs: 564,  type: 'colecao', desc: 'Traypers' },

  // ── RECURSOS / FERRAMENTAS ──
  { name: 'MOCKUPS PARA SITE',    subs: 6,  type: 'recurso', desc: 'Mockups para site' },
  { name: 'MODELOS ML',           subs: 24, type: 'recurso', desc: 'Modelos ML' },
  { name: 'MOLDES',               subs: 2,  type: 'recurso', desc: 'Moldes' },
  { name: 'MATERIAL_ILUSTRADOR',  subs: 3,  type: 'recurso', desc: 'Material do Ilustrador' },
  { name: 'TABELA DE MEDIDAS',    subs: 3,  type: 'recurso', desc: 'Tabelas de medidas' },

  // ── PESSOAL / SCANNER ──
  { name: 'ScanEmilly',       subs: 0,    type: 'pessoal', desc: 'Scanner Emilly' },
  { name: 'ScanGeraldo',      subs: 0,    type: 'pessoal', desc: 'Scanner Geraldo (76 arquivos)' },
  { name: 'ITAMAR',           subs: 7,    type: 'pessoal', desc: 'Itamar' },
  { name: 'MANUELA',          subs: 8,    type: 'pessoal', desc: 'Manuela' },

  // ── SOFTWARE ──
  { name: 'Adobe Creative 2025 v30.12.2024 (x64)', subs: 1, type: 'software', desc: 'Adobe CC' },

  // ── OUTROS ──
  { name: '271080',           subs: 0,    type: 'outro', desc: 'Código avulso' },
  { name: 'f',                subs: 1,    type: 'outro', desc: 'Pasta f' },
  { name: 'GD',               subs: 1,    type: 'outro', desc: 'GD' },
];

// Total: 48 pastas protegidas
// Total de subpastas: ~5.000+
// Estimativa de arquivos: 50.000+

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 EXTENSÕES DE ARQUIVO — CLASSIFICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const PRODUCTION_EXTENSIONS = [
  '.psd', '.psb', '.ai', '.eps', '.svg', '.indd',  // Design
  '.pdf', '.tif', '.tiff', '.raw', '.cr2', '.nef',  // Print / RAW
  '.cdr', '.afdesign', '.afphoto', '.sketch',        // Outros design
  '.zip', '.rar', '.7z',                             // Compactados
  '.exe', '.bat', '.cmd', '.ps1', '.sh',             // Executáveis (JAMAIS)
  '.dll', '.sys', '.msi',                            // Sistema (JAMAIS)
];

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 OPERAÇÕES — WHITELIST E BLACKLIST
// ═══════════════════════════════════════════════════════════════════════════════

const ALLOWED_OPERATIONS = [
  'readdir', 'readdirSync',
  'stat', 'statSync', 'lstat', 'lstatSync',
  'exists', 'existsSync',
  'readFile', 'readFileSync',
  'access', 'accessSync',
  'createReadStream',
  'copyFile_SOURCE',  // Apenas como ORIGEM de cópia
];

const BLOCKED_OPERATIONS = [
  // APAGAR
  'unlink', 'unlinkSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync',
  // ESCREVER
  'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync',
  'createWriteStream',
  // MOVER / RENOMEAR
  'rename', 'renameSync',
  // PERMISSÕES
  'chmod', 'chmodSync', 'chown', 'chownSync',
  // CRIAR
  'mkdir', 'mkdirSync',
  // TRUNCAR
  'truncate', 'truncateSync',
  // COPIAR PARA REDE (destino)
  'copyFile_DESTINATION',
  // LINKS
  'link', 'linkSync', 'symlink', 'symlinkSync',
];

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 FUNÇÕES DE PROTEÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normaliza um caminho para comparação segura.
 */
function normalizePath(p) {
  if (!p) return '';
  return path.resolve(String(p)).toLowerCase().replace(/\//g, '\\');
}

/**
 * Verifica se um caminho pertence a QUALQUER rede (UNC path).
 * Protege contra qualquer servidor, não só o 192.168.100.100.
 */
function isNetworkPath(targetPath) {
  if (!targetPath) return false;
  const normalized = normalizePath(targetPath);

  // Qualquer caminho UNC (\\qualquer\coisa)
  if (normalized.startsWith('\\\\')) return true;

  // Drives mapeados conhecidos (adicionar se houver)
  // if (normalized.startsWith('v:\\')) return true;

  return false;
}

/**
 * Verifica se um caminho pertence ao servidor protegido específico.
 */
function isProtectedServer(targetPath) {
  if (!targetPath) return false;
  const normalized = normalizePath(targetPath);
  return normalized.startsWith(`\\\\${NETWORK_SERVER}`.toLowerCase());
}

/**
 * Verifica se um caminho aponta para uma pasta protegida conhecida.
 * Retorna o registro da pasta ou null.
 */
function getProtectedFolder(targetPath) {
  if (!isProtectedServer(targetPath)) return null;
  const normalized = normalizePath(targetPath);
  const rootNorm = normalizePath(NETWORK_ROOT);

  for (const folder of PROTECTED_FOLDERS) {
    const folderPath = path.join(NETWORK_ROOT, folder.name);
    const folderNorm = normalizePath(folderPath);
    if (normalized.startsWith(folderNorm)) return folder;
  }
  return null;
}

/**
 * Verifica se um arquivo é uma imagem permitida.
 */
function isAllowedImage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Verifica se um arquivo é de produção (deve ser ignorado).
 */
function isProductionFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return PRODUCTION_EXTENSIONS.includes(ext);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒🔒🔒 GUARD PRINCIPAL — BLOQUEIA QUALQUER OPERAÇÃO PERIGOSA 🔒🔒🔒
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 🔒 GUARD PRINCIPAL: Bloqueia TODA operação de escrita em caminhos de rede.
 * 
 * DEVE ser chamado antes de QUALQUER operação fs que não seja leitura.
 * Se o caminho for de rede → LANÇA ERRO e BLOQUEIA a operação.
 * 
 * @param {string} targetPath - Caminho alvo da operação
 * @param {string} operation - Nome da operação (ex: 'write', 'delete', 'rename')
 * @throws {Error} SEMPRE se o caminho for de rede e a operação for perigosa
 */
function guardNetworkWrite(targetPath, operation) {
  if (isNetworkPath(targetPath)) {
    const folder = getProtectedFolder(targetPath);
    const folderInfo = folder ? ` [Pasta: ${folder.name} — ${folder.desc}]` : '';

    const msg = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  🔒🔒🔒  OPERAÇÃO BLOQUEADA — REDE PROTEGIDA  🔒🔒🔒      ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      `  ❌ Operação: "${operation}"`,
      `  📂 Caminho:  ${targetPath}`,
      `  🛡️ Pasta:   ${folderInfo || ' Caminho de rede genérico'}`,
      '',
      '  MOTIVO: Operações de escrita em caminhos de rede são',
      '  ABSOLUTAMENTE PROIBIDAS. Apenas leitura e cópia para',
      '  pasta local são permitidas.',
      '',
    ].join('\n');

    console.error(msg);

    // Log em arquivo para auditoria
    logSecurityEvent('BLOCKED', operation, targetPath, folder);

    throw new Error(`🔒 BLOQUEADO: "${operation}" proibido em rede.${folderInfo}`);
  }
}

/**
 * 🔒 GUARD DE CÓPIA: Garante que o DESTINO nunca seja na rede.
 * 
 * @param {string} source - Caminho origem (pode ser rede)
 * @param {string} destination - Caminho destino (DEVE ser local)
 * @throws {Error} Se destino for na rede
 */
function guardCopyDestination(source, destination) {
  if (isNetworkPath(destination)) {
    const msg = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  🔒  CÓPIA BLOQUEADA — DESTINO NA REDE  🔒                 ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      `  ❌ Tentativa de copiar PARA a rede`,
      `  📂 Origem:   ${source}`,
      `  📂 Destino:  ${destination}`,
      '',
      '  MOTIVO: O destino de cópia NUNCA pode ser um caminho de rede.',
      '  Apenas cópia DA rede PARA pasta local é permitida.',
      '',
    ].join('\n');

    console.error(msg);
    logSecurityEvent('BLOCKED_COPY', 'copyFile', destination, null);
    throw new Error('🔒 BLOQUEADO: Destino de cópia não pode ser na rede.');
  }
}

/**
 * 🔒 GUARD DE COMANDO: Verifica se um comando shell é seguro para a rede.
 * Bloqueia comandos como del, rd, rm, move, ren em caminhos de rede.
 * 
 * @param {string} command - Comando a ser executado
 * @throws {Error} Se o comando pode causar dano na rede
 */
function guardShellCommand(command) {
  if (!command) return;
  const cmd = command.toLowerCase();
  const hasNetworkPath = cmd.includes('\\\\') || cmd.includes(NETWORK_SERVER);

  if (!hasNetworkPath) return; // Comando local, pode executar

  // Comandos perigosos em caminhos de rede
  const dangerousCommands = [
    'del ', 'del/', 'erase ', 'rd ', 'rd/', 'rmdir ',
    'rm ', 'rm -', 'remove-item', 'ri ',
    'move ', 'move/', 'mv ', 'ren ', 'rename ',
    'copy ', 'copy/', 'cp ',  // cópia PARA rede
    'xcopy', 'robocopy',      // cópia em lote PARA rede
    'mkdir ', 'md ', 'new-item',
    'echo ', 'type ', '>',    // redirecionamento para rede
    'format', 'diskpart',     // JAMAIS
    'attrib', 'icacls', 'cacls', 'takeown',
    'set-acl', 'set-content', 'add-content', 'out-file',
  ];

  for (const dangerous of dangerousCommands) {
    if (cmd.includes(dangerous)) {
      const msg = `🔒 BLOQUEADO: Comando "${dangerous.trim()}" detectado com caminho de rede.`;
      console.error(msg);
      logSecurityEvent('BLOCKED_CMD', dangerous.trim(), command, null);
      throw new Error(msg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 FUNÇÕES SEGURAS — SÓ LEITURA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ✅ Lê conteúdo de uma pasta (seguro para rede).
 * Retorna lista de itens com metadados.
 */
function safeReadDir(dirPath) {
  logSecurityEvent('READ', 'readdir', dirPath, getProtectedFolder(dirPath));

  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  return items.map(item => ({
    name: item.name,
    isDirectory: item.isDirectory(),
    isFile: item.isFile(),
    fullPath: path.join(dirPath, item.name),
    isImage: item.isFile() ? isAllowedImage(item.name) : false,
    isProduction: item.isFile() ? isProductionFile(item.name) : false,
    extension: item.isFile() ? path.extname(item.name).toLowerCase() : null,
  }));
}

/**
 * ✅ Lê apenas imagens de uma pasta (ignora produção).
 */
function safeReadImages(dirPath) {
  const all = safeReadDir(dirPath);
  return all.filter(item => item.isFile && item.isImage);
}

/**
 * ✅ Copia um arquivo da rede para pasta LOCAL.
 * DESTINO NUNCA pode ser na rede.
 */
function safeCopyFromNetwork(source, destination) {
  // Tripla verificação de segurança
  guardCopyDestination(source, destination);
  guardNetworkWrite(destination, 'copyFile_DESTINATION');

  // Garantir que destino é realmente local
  const destNorm = normalizePath(destination);
  if (destNorm.startsWith('\\\\')) {
    throw new Error('🔒 FALHA CRÍTICA: Destino ainda é rede após verificação.');
  }

  // Criar pasta destino (LOCAL) se não existir
  const destDir = path.dirname(destination);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(source, destination);
  logSecurityEvent('COPY', 'copyFile', `${source} → ${destination}`, getProtectedFolder(source));
}

/**
 * ✅ Obtém informações de um arquivo sem modificá-lo.
 */
function safeStat(filePath) {
  logSecurityEvent('READ', 'stat', filePath, getProtectedFolder(filePath));
  return fs.statSync(filePath);
}

/**
 * ✅ Verifica se um caminho existe.
 */
function safeExists(targetPath) {
  return fs.existsSync(targetPath);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  📋 LOG DE AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════════

const LOG_FILE = path.join(__dirname, '..', 'logs', 'network-security.log');

/**
 * Registra evento de segurança para auditoria.
 */
function logSecurityEvent(action, operation, target, folder) {
  try {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      operation,
      target: String(target).substring(0, 200),
      folder: folder ? folder.name : null,
      folderDesc: folder ? folder.desc : null,
    }) + '\n';

    fs.appendFileSync(LOG_FILE, entry, 'utf8');
  } catch (e) {
    // Log silencioso — não falhar por causa do log
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  📊 ESTATÍSTICAS DA REDE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Retorna resumo da rede protegida.
 */
function getNetworkStats() {
  const totalFolders = PROTECTED_FOLDERS.length;
  const totalSubs = PROTECTED_FOLDERS.reduce((sum, f) => sum + f.subs, 0);
  const byType = {};
  PROTECTED_FOLDERS.forEach(f => {
    byType[f.type] = (byType[f.type] || 0) + 1;
  });

  return {
    server: NETWORK_SERVER,
    root: NETWORK_ROOT,
    totalFolders,
    totalSubfolders: totalSubs,
    estimatedFiles: '50.000+',
    byType,
    protectionLevel: 'MÁXIMO',
    allowedOperations: ALLOWED_OPERATIONS.length,
    blockedOperations: BLOCKED_OPERATIONS.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  🔒 VERIFICAÇÃO DE INTEGRIDADE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Verificação que este módulo não foi adulterado.
 * Chamar na inicialização do servidor.
 */
function verifyIntegrity() {
  const checks = [
    typeof guardNetworkWrite === 'function',
    typeof guardCopyDestination === 'function',
    typeof guardShellCommand === 'function',
    typeof isNetworkPath === 'function',
    BLOCKED_OPERATIONS.length >= 20,
    PROTECTED_FOLDERS.length >= 48,
    NETWORK_SERVER === '192.168.100.100',
  ];

  const passed = checks.every(c => c === true);

  if (passed) {
    console.log('🔒 Network Safety Guard: ✅ Integridade verificada');
    console.log(`   📂 ${PROTECTED_FOLDERS.length} pastas protegidas`);
    console.log(`   🚫 ${BLOCKED_OPERATIONS.length} operações bloqueadas`);
    console.log(`   ✅ ${ALLOWED_OPERATIONS.length} operações permitidas`);
  } else {
    console.error('🔒❌ FALHA DE INTEGRIDADE no Network Safety Guard!');
    throw new Error('Network Safety Guard adulterado — servidor recusou inicializar.');
  }

  logSecurityEvent('INTEGRITY', 'verify', passed ? 'PASSED' : 'FAILED', null);
  return passed;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Constantes
  NETWORK_SERVER,
  NETWORK_ROOT,
  PROTECTED_FOLDERS,
  IMAGE_EXTENSIONS,
  PRODUCTION_EXTENSIONS,
  ALLOWED_OPERATIONS,
  BLOCKED_OPERATIONS,

  // Guards (proteção)
  guardNetworkWrite,
  guardCopyDestination,
  guardShellCommand,
  isNetworkPath,
  isProtectedServer,
  getProtectedFolder,

  // Funções seguras (leitura)
  safeReadDir,
  safeReadImages,
  safeCopyFromNetwork,
  safeStat,
  safeExists,

  // Classificação de arquivos
  isAllowedImage,
  isProductionFile,

  // Utilidades
  normalizePath,
  getNetworkStats,
  verifyIntegrity,
};
