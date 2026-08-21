# 🟣 HOOK PRIME

> **Enterprise Automation System** para cadastro de produtos e-commerce

[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-339933?logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com)
[![GSAP](https://img.shields.io/badge/GSAP-3.12.5-88CE02?logo=greensock)](https://gsap.com)
[![License](https://img.shields.io/badge/License-Private-red)]()

## O que é?

O HOOK PRIME automatiza o cadastro de centenas de SKUs (camisas de pesca, agro, motociclismo) no ERP Bling, transformando um processo manual de dias em minutos.

**Fluxo de 6 Etapas:**

```
⚙️ Configuração → 📁 Pastas & Imagens → 🔗 Links CDN → 🎨 Estampas → 📊 Planilha → 📤 Exportar
```

## Principais Features

- 🚀 **Lucas RTX Autopilot** — Wizard inteligente de 6 etapas
- 🔍 **Smart Scan** — 8 cascatas de busca em 50.000+ arquivos de rede
- ☁️ **Upload CDN** — Batch upload com compressão Sharp para Cloudflare R2
- 📊 **Planilha Bling** — CSV de 59 colunas com pesos, NCM e títulos SEO
- 🔒 **Network Safety** — 57 pastas protegidas com audit log
- 🎨 **Estampas SEO** — Banco de 140+ termos com anti-duplicação
- 📋 **ClickUp Radar** — Integração SSE live com Kanban
- 🎬 **Cinematic UI** — GSAP animations + violet design system

## Quick Start

```bash
cd hub
npm install
npm start
# → http://localhost:3000
```

## Estatísticas

| Métrica | Valor |
|---------|:-----:|
| Arquivos de código | 48 |
| Linhas totais | 18.376 |
| Endpoints REST | 29 |
| Módulos Autopilot | 16 |
| Pastas protegidas | 57 |
| Dependências npm | 5 |

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [📖 Documentação Completa](docs/HOOK-PRIME-Documentation.md) | Tudo sobre o projeto |
| [🏗️ C4 Architecture](docs/architecture/c4-model.md) | Diagramas C4 (4 níveis) |
| [🔌 API Reference](docs/api/api-reference.md) | 29 endpoints documentados |

## Stack

- **Backend**: Node.js + Express 4.21 + Sharp + Multer + xlsx
- **Frontend**: Vanilla JS (ES6) + GSAP 3.12.5 + CSS Custom (2003 linhas)
- **CDN**: Cloudflare R2 via Vercel
- **ERP**: Bling V2 (CSV 59 colunas)
- **Rede**: SMB/CIFS (\\\\192.168.100.100)

## Arquitetura

```
hub/
├── server.js                    # Orchestrator (193 lines)
├── config/
│   ├── network-safety.js        # Security Guard (516 lines)
│   ├── image-utils.js           # Smart Sort + Gender (158 lines)
│   └── *.json                   # Config files
├── routes/                      # 7 route modules (29 endpoints)
├── public/
│   ├── index.html               # SPA shell
│   ├── css/styles.css           # Design System (2003 lines)
│   └── js/
│       ├── app.js               # SPA Router
│       ├── core/                # Canvas BG + GSAP + Intro
│       ├── autopilot.js         # Wizard Orchestrator (262 lines)
│       └── autopilot/           # 16 modular files
│           ├── core/            # state, helpers, code-gen
│           ├── uploader/        # s3-uploader, upload-manager
│           ├── steps/           # step1 through step6
│           └── products/        # apc, unique, variation
└── docs/                        # Full documentation
```

---

*HOOK PRIME v3.3 — Modular Architecture*
