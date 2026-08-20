# 📚 HOOK PRIME — Documentação Técnica

## O que é o HOOK PRIME?

Sistema de automação enterprise para gestão de produtos e-commerce da marca **BRK**.
Automatiza o fluxo completo: scan de rede → cópia de imagens → upload CDN → geração de planilhas Bling.

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    HOOK PRIME                        │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Frontend │  │  Server  │  │  Network Safety   │  │
│  │  (SPA)   │──│ (Express)│──│     Guard         │  │
│  └─────────┘  └──────────┘  └───────────────────┘  │
│       │            │              │        │        │
│       ▼            ▼              ▼        ▼        │
│  ┌─────────┐  ┌──────────┐  ┌────────┐ ┌───────┐  │
│  │ Browser  │  │   CDN    │  │ Rede   │ │ Rede  │  │
│  │          │  │  (R2)    │  │ Nova   │ │Legado │  │
│  └─────────┘  └──────────┘  └────────┘ └───────┘  │
└─────────────────────────────────────────────────────┘
```

## Documentação

| Seção | Descrição |
|-------|-----------|
| [architecture/](architecture/) | Visão arquitetural C4, fluxo de dados, modelo de domínio |
| [adr/](adr/) | Architecture Decision Records — decisões formais |
| [api/](api/) | Endpoints, contratos, schemas |
| [development/](development/) | Setup, padrões de código, testes |
| [operations/](operations/) | Deploy, monitoramento, rollback |
| [agents/](agents/) | Arquitetura dos agentes AI, skills, orquestração |

## Quick Start

```bash
cd hub
npm install
node server.js
# → http://localhost:3000
```

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Vanilla JS, GSAP 3.12, Three.js 0.155 |
| Backend | Node.js, Express |
| CDN | Cloudflare R2 via brk-link-vz77.vercel.app |
| Rede | SMB (Windows) — 192.168.100.100 |
| Repositório | github.com/pensador999/HOOK-PRIME |
