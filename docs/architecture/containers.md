# C2 — Containers

> **Nível C4:** Container | **Audiência:** Desenvolvedores, operações, arquitetos

## Diagrama de Containers

```mermaid
graph TB
    subgraph BROWSER["🖥️ Browser (localhost:3000)"]
        SPA["SPA Frontend<br>22 arquivos JS · 13.098 linhas<br>Vanilla JS + GSAP 3.12 + Three.js"]
        INTRO["Intro Cinematográfico<br>Video MP4 + GSAP"]
    end

    subgraph SERVER["⚙️ Node.js Server (Express)"]
        API["API Layer<br>29 endpoints REST + SSE"]
        BIZ["Business Layer<br>Smart Scan · CSV Gen · Prefixes"]
        SAFETY["Safety Layer<br>Network Safety Guard<br>57 pastas protegidas"]
    end

    subgraph CONFIG["📁 Config (JSON + JS)"]
        PREFIXES["network-prefixes.json<br>42 prefixos"]
        NETSAFE["network-safety.js<br>591 linhas"]
        CATS["product-categories.json"]
        SIZES["size-patterns.json"]
        BLING["templates-bling.json<br>59 colunas"]
        TASKS["tasks.json<br>Flat-file DB"]
    end

    subgraph EXTERNAL["🌐 Serviços Externos"]
        CDN["☁️ BRK Link CDN<br>brk-link-vz77.vercel.app<br>Cloudflare R2"]
        CLICKUP["📋 ClickUp<br>via Tampermonkey"]
        GSHEETS["📊 Google Sheets<br>EAN proxy"]
    end

    subgraph NETWORK["🔒 Rede SMB (192.168.100.100)"]
        REDE_NOVA["📂 Linha Brk 2024<br>48 pastas · 50.000+ arquivos"]
        REDE_LEGACY["📂 Linha BRK (Legado)<br>9 pastas"]
    end

    subgraph LOCAL["💾 Disco Local"]
        UPLOADS["uploads/<br>Imagens copiadas · CSVs"]
        LOGS["logs/<br>network-security.log"]
    end

    SPA -->|HTTP/SSE| API
    INTRO -->|Autoplay| SPA
    API --> BIZ
    BIZ --> SAFETY
    SAFETY -->|READ ONLY| REDE_NOVA
    SAFETY -->|READ ONLY| REDE_LEGACY
    BIZ --> CDN
    BIZ --> LOCAL
    API --> CONFIG
    CLICKUP -->|POST /api/autopilot/tasks| API
    API -->|GET proxy| GSHEETS

    style SERVER fill:#0a0a0a,stroke:#0ae448,stroke-width:2px,color:#fff
    style NETWORK fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#fff
```

## Inventário de Containers

| Container | Tecnologia | Linhas | Responsabilidade |
|-----------|-----------|--------|-----------------|
| **Frontend SPA** | Vanilla JS, GSAP, HTML/CSS | 13.098 JS + 2.285 CSS | UI, navegação, estado local, uploads |
| **Node.js Server** | Express 4.21 | 2.767 | API REST, SSE, integração rede/CDN |
| **Config Layer** | JSON + CommonJS | ~1.050 | Configuração declarativa |
| **Network SMB** | Windows SMB | — | Fonte de imagens de produto |
| **BRK Link CDN** | Vercel + Cloudflare R2 | — | Storage público de imagens |
| **Disco Local** | Filesystem | — | Staging de imagens e CSVs |

## Protocolos de Comunicação

| De → Para | Protocolo | Formato |
|-----------|-----------|---------|
| Browser → Server | HTTP REST | JSON |
| Server → Browser | SSE (Server-Sent Events) | `text/event-stream` |
| Server → Rede SMB | UNC Path (`\\\\`) | `fs.*` via Safety Guard |
| Server → CDN | HTTPS POST multipart | FormData → JSON URLs |
| ClickUp → Server | HTTP POST (Tampermonkey) | JSON |
| Server → Google Sheets | HTTPS GET (proxy) | CSV |
