#!/usr/bin/env node
/**
 * Reorganiza imagens JÁ COPIADAS (uploads/autopilot/<pasta>) para o PADRÃO OFICIAL:
 *   1 = FRENTE · 2 = COSTAS · 3 = FRENTE PERSP · 4 = COSTAS PERSP
 *
 * Como funciona (sem adivinhar):
 *   1. Para cada CODIGO/GENERO local, localiza a pasta original na rede
 *      (SOMENTE LEITURA via networkSafety) e lista os nomes reais dos arquivos.
 *   2. Casa cada arquivo local (1.png, 2.png…) com o original da rede pelo
 *      TAMANHO EM BYTES (a cópia é idêntica). Se não casar com certeza → PULA.
 *   3. Calcula a ordem correta com o MESMO getImagePriority do sistema.
 *   4. Renomeia localmente em 2 fases (sem sobrescrever) — PNG e a pasta
 *      JPEG_imagens juntos, mantendo o par PNG↔JPG.
 *
 * Uso:
 *   node tools/reorganize-autopilot-images.js "<pasta>"            (simulação)
 *   node tools/reorganize-autopilot-images.js "<pasta>" --apply    (aplica)
 *   opções: --only=FUSION199,FUSION200   (limita a certos códigos)
 *
 * Gera log de rollback em hub/logs/reorganize-images-<data>.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const networkSafety = require('../config/network-safety.js');
const imageUtils = require('../config/image-utils.js');

const { getImagePriority, GENDER_NAMES, classifyGender, shouldExcludeImage } = imageUtils;
const IMG_EXT = /\.(png|jpe?g|webp)$/i;
const STANDARD_4 = [10, 20, 30, 40];

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const folderArg = args.find(a => !a.startsWith('--'));
const onlyArg = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '');
const ONLY = onlyArg ? new Set(onlyArg.toUpperCase().split(',').map(s => s.trim()).filter(Boolean)) : null;

if (!folderArg) {
  console.error('Uso: node tools/reorganize-autopilot-images.js "<pasta>" [--apply] [--only=COD1,COD2]');
  process.exit(1);
}
const TASK_DIR = path.resolve(folderArg);
if (networkSafety.isNetworkPath(TASK_DIR)) {
  console.error('🔒 A pasta alvo precisa ser LOCAL — a rede nunca é modificada.');
  process.exit(1);
}
if (!fs.existsSync(TASK_DIR)) {
  console.error(`Pasta não encontrada: ${TASK_DIR}`);
  process.exit(1);
}

// ── Prefixos de rede (mesma regra do server.js) ──────────────────────────────
const prefixes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'network-prefixes.json'), 'utf8'));
function resolvePrefix(prefix) {
  const val = prefixes[prefix];
  if (!val) return null;
  if (typeof val === 'string') return { folder: val, root: networkSafety.NETWORK_ROOT };
  if (val.folder) return { folder: val.folder, root: val.root || networkSafety.NETWORK_ROOT };
  return null;
}

const _dirCache = new Map();
function listNet(dir) {
  if (!_dirCache.has(dir)) _dirCache.set(dir, networkSafety.safeReadDir(dir));
  return _dirCache.get(dir);
}

/** Pasta do código na rede: nome começa com o código e o próximo char NÃO é dígito. */
function findNetworkCodeFolder(code) {
  const m = code.match(/^([A-Z]+)/);
  if (!m) return null;
  const cfg = resolvePrefix(m[1]);
  if (!cfg) return null;
  const parent = path.join(cfg.root, cfg.folder);
  const codeUp = code.toUpperCase();
  const hit = listNet(parent).find(e => {
    if (!e.isDirectory) return false;
    const n = e.name.toUpperCase();
    return n === codeUp || (n.startsWith(codeUp) && !/\d/.test(n[codeUp.length] || ''));
  });
  return hit ? hit.fullPath : null;
}

/** Imagens originais de um gênero na rede (3D/<GEN> primeiro, depois <GEN> na raiz). */
function findNetworkGenderImages(codeFolder, gender) {
  const candidates = [];
  const top = listNet(codeFolder).filter(e => e.isDirectory);
  const upperTop = top.map(d => d.name.toUpperCase());
  const threeD = top[upperTop.indexOf('3D')];
  if (threeD) {
    listNet(threeD.fullPath).filter(e => e.isDirectory && GENDER_NAMES.includes(e.name.toUpperCase()) && classifyGender(e.name) === gender)
      .forEach(d => candidates.push(d.fullPath));
  }
  top.filter(d => GENDER_NAMES.includes(d.name.toUpperCase()) && classifyGender(d.name) === gender)
    .forEach(d => candidates.push(d.fullPath));

  for (const dir of candidates) {
    const files = listNet(dir)
      .filter(e => e.isFile && IMG_EXT.test(e.name) && !shouldExcludeImage(e.name))
      .map(e => ({ name: e.name, size: networkSafety.safeStat(e.fullPath).size }));
    if (files.length) return { dir, files };
  }
  return null;
}

// ── Execução ─────────────────────────────────────────────────────────────────
const report = [];
const stats = { dirs: 0, ok: 0, reorder: 0, skipped: 0, warnings: 0 };

const codeDirs = fs.readdirSync(TASK_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && (!ONLY || ONLY.has(d.name.toUpperCase())))
  .map(d => d.name).sort();

console.log(`\n${APPLY ? '🛠️  APLICANDO' : '🔎 SIMULAÇÃO'} — ${TASK_DIR}`);
console.log(`   ${codeDirs.length} código(s)\n`);

for (const code of codeDirs) {
  const codeDir = path.join(TASK_DIR, code);
  const genderDirs = fs.readdirSync(codeDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && GENDER_NAMES.includes(d.name.toUpperCase()));
  if (!genderDirs.length) continue;

  let netFolder = null;
  try { netFolder = findNetworkCodeFolder(code); }
  catch (e) { /* tratado abaixo */ }

  for (const gd of genderDirs) {
    stats.dirs++;
    const gender = classifyGender(gd.name);
    const localDir = path.join(codeDir, gd.name);
    const label = `${code}/${gd.name}`;
    const entry = { dir: label, status: '', map: [], warnings: [] };
    report.push(entry);

    try {
      if (!netFolder) throw new Error('pasta do código não encontrada na rede');
      const net = findNetworkGenderImages(netFolder, gender);
      if (!net) throw new Error(`sem imagens ${gender} na rede`);

      const local = fs.readdirSync(localDir, { withFileTypes: true })
        .filter(f => f.isFile() && IMG_EXT.test(f.name) && /^\d+$/.test(path.parse(f.name).name))
        .map(f => ({ file: f.name, idx: parseInt(path.parse(f.name).name, 10), ext: path.extname(f.name), size: fs.statSync(path.join(localDir, f.name)).size }))
        .sort((a, b) => a.idx - b.idx);
      if (!local.length) throw new Error('nenhuma imagem numerada (1,2,3…) localmente');

      // Casamento por tamanho (único e exclusivo)
      const used = new Set();
      for (const lf of local) {
        const cands = net.files.filter(n => n.size === lf.size);
        if (cands.length !== 1) throw new Error(`${lf.file}: ${cands.length} candidatos de mesmo tamanho na rede — não dá para garantir`);
        if (used.has(cands[0].name)) throw new Error(`${lf.file}: original duplicado (${cands[0].name})`);
        used.add(cands[0].name);
        lf.netName = cands[0].name;
      }

      // Ordem correta (mesmo critério do sistema)
      const ordered = [...local].sort((a, b) => {
        const pa = getImagePriority(a.netName), pb = getImagePriority(b.netName);
        if (pa !== pb) return pa - pb;
        return a.netName.localeCompare(b.netName, undefined, { numeric: true });
      });
      ordered.forEach((lf, i) => { lf.newIdx = i + 1; lf.prio = getImagePriority(lf.netName); });

      const prios = ordered.map(o => o.prio);
      if (new Set(prios).size !== prios.length) entry.warnings.push(`empate de prioridade: ${ordered.map(o => o.netName).join(' / ')}`);
      if (local.length === 4 && JSON.stringify(prios) !== JSON.stringify(STANDARD_4)) {
        entry.warnings.push(`fora do padrão 10/20/30/40 → ${ordered.map(o => `${o.netName}(${o.prio})`).join(', ')}`);
      }

      entry.map = ordered.map(o => ({ from: o.idx, to: o.newIdx, ext: o.ext, original: o.netName }));
      const changes = ordered.filter(o => o.idx !== o.newIdx);
      if (!changes.length) {
        entry.status = 'OK';
        stats.ok++;
      } else {
        entry.status = APPLY ? 'REORDENADO' : 'REORDENAR';
        stats.reorder++;
      }

      if (changes.length && APPLY) {
        const jpegDir = path.join(localDir, 'JPEG_imagens');
        const jpgs = fs.existsSync(jpegDir)
          ? fs.readdirSync(jpegDir, { withFileTypes: true }).filter(f => f.isFile() && IMG_EXT.test(f.name))
              .map(f => ({ file: f.name, idx: parseInt(path.parse(f.name).name, 10), ext: path.extname(f.name) }))
              .filter(f => Number.isInteger(f.idx))
          : [];
        const moves = [];
        for (const o of ordered) {
          moves.push({ dir: localDir, from: `${o.idx}${o.ext}`, to: `${o.newIdx}${o.ext}` });
          const jp = jpgs.find(j => j.idx === o.idx);
          if (jp) moves.push({ dir: jpegDir, from: jp.file, to: `${o.newIdx}${jp.ext}` });
        }
        const real = moves.filter(m => m.from !== m.to);
        real.forEach((m, i) => fs.renameSync(path.join(m.dir, m.from), path.join(m.dir, `__reorder_${i}.tmp`)));
        real.forEach((m, i) => fs.renameSync(path.join(m.dir, `__reorder_${i}.tmp`), path.join(m.dir, m.to)));
        if (jpgs.length && jpgs.length !== local.length) entry.warnings.push(`JPEG_imagens tem ${jpgs.length} arquivo(s) para ${local.length} PNG(s)`);
      }

      const line = ordered.map(o => `${o.newIdx}=${o.netName.replace(/\.[^.]+$/, '')}`).join(' | ');
      const flag = entry.status === 'OK' ? '✅' : (APPLY ? '🛠️ ' : '🔀');
      console.log(`${flag} ${label.padEnd(22)} ${entry.status.padEnd(10)} ${line}`);
      entry.warnings.forEach(w => { stats.warnings++; console.log(`     ⚠️  ${w}`); });
    } catch (e) {
      entry.status = 'PULADO';
      entry.warnings.push(e.message);
      stats.skipped++;
      console.log(`⏭️  ${label.padEnd(22)} PULADO     ${e.message}`);
    }
  }
}

// ── Resumo + log de rollback ────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────────');
console.log(`Pastas de gênero analisadas : ${stats.dirs}`);
console.log(`Já corretas                 : ${stats.ok}`);
console.log(`${APPLY ? 'Reordenadas' : 'A reordenar'}                 : ${stats.reorder}`);
console.log(`Puladas (sem certeza)       : ${stats.skipped}`);
console.log(`Avisos                      : ${stats.warnings}`);

if (APPLY) {
  const logsDir = path.join(__dirname, '..', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const logFile = path.join(logsDir, `reorganize-images-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(logFile, JSON.stringify({ taskDir: TASK_DIR, when: new Date().toISOString(), stats, report }, null, 2), 'utf8');
  console.log(`\n📝 Log de rollback: ${logFile}`);
} else {
  console.log('\n(simulação — nada foi alterado. Rode com --apply para aplicar.)');
}
process.exit(stats.skipped > 0 ? 2 : 0);
