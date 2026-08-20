# C3 — Components

> **Nível C4:** Component | **Audiência:** Desenvolvedores e mantenedores

## Backend — server.js (2.767 linhas / 8 domínios implícitos)

```mermaid
graph TB
    subgraph SERVER["server.js — Monolito Express"]
        MIDDLEWARE["Middleware Layer<br>CORS · JSON 50MB · Static · Multer"]
        
        subgraph AUTOPILOT["📋 Autopilot Domain (L163-584)"]
            TASKS_API["Tasks API<br>CRUD + SSE Stream"]
            CODE_EXTRACT["Code Extractor<br>Regex + Prefix Grouping"]
        end
        
        subgraph SPREADSHEET["📊 Spreadsheet Domain (L487-977)"]
            BLING_GEN["Bling CSV Generator<br>59 colunas · Pai+Variações"]
            CONFIG_API["Config API<br>Categories · Sizes · Templates"]
        end
        
        subgraph IMAGES["🖼️ Image Domain (L374-620, L1061-1262)"]
            FOLDER_CREATE["Folder Creator<br>Batch mkdir"]
            IMG_RENAME["Image Renamer<br>Sequencial + Sharp"]
            NET_COPY["Network Copier<br>Dedup + Gender Sort"]
            PREVIEW["Preview Server<br>Thumbnail + Lightbox"]
        end
        
        subgraph CDN_PROXY["☁️ CDN Proxy Domain (L1304-1869)"]
            HEALTH_CHECK["BRK Link Health"]
            UPLOAD_DIRECT["Upload Direct<br>Folder → R2"]
            UPLOAD_DISK["Upload from Disk<br>Sharp + Batch 3.5MB"]
            UPLOAD_BATCH["Upload Batch<br>Multipart → R2"]
        end
        
        subgraph NETWORK["🌐 Network Domain (L105-152, L1886-2740)"]
            PREFIX_RESOLVER["Prefix Resolver<br>42 prefixos · Dual-root"]
            LEGACY_SCAN["Legacy Scan<br>fs.readdirSync direto"]
            SMART_SCAN["Smart Scan v3<br>8-level cascade · Safety Guard"]
            NET_COPY_LEGACY["Legacy Copy<br>fs.copyFileSync direto"]
        end
        
        subgraph EXTERNAL["🔗 External Domain (L356-372)"]
            EAN_PROXY["EAN Proxy<br>Google Sheets CSV"]
        end
        
        XLS["XLS Parser<br>L1266-1302"]
    end

    style NETWORK fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#fff
    style CDN_PROXY fill:#16213e,stroke:#0ae448,stroke-width:1px,color:#fff
```

## Frontend — 22 Módulos JS (13.098 linhas)

```mermaid
graph TB
    subgraph CORE["🎯 Core (3 módulos)"]
        INTRO["intro-cinematic.js<br>204 linhas · Video intro"]
        CANVAS["canvas-bg.js<br>164 linhas · Particle BG"]
        GSAP["gsap-init.js<br>497 linhas · Animations"]
    end

    subgraph ROUTER["🧭 Router"]
        APP["app.js<br>135 linhas · SPA Hash Router<br>window.HUB.state · navigate · showToast"]
    end

    subgraph PAGES["📄 Pages (9 módulos)"]
        DASH["dashboard-clickup.js<br>585 linhas · SSE Radar"]
        AUTOPILOT["autopilot.js<br>3.686 linhas · 6-Step Wizard"]
        SPREAD["spreadsheet-gen.js<br>737 linhas · CSV Builder"]
        FOLDERS["folder-manager.js<br>228 linhas · Batch mkdir"]
        FLOW["flow-editor.js<br>925 linhas · Visual Canvas"]
        IMGMGR["image-manager.js<br>1.306 linhas · Rename+Upload"]
        CROSSER["image-crosser.js<br>1.035 linhas · XLS Matcher"]
        HISTORY["task-history.js<br>791 linhas · Operation Log"]
        EAN["ean-viewer.js<br>453 linhas · EAN Lookup"]
    end

    subgraph AGENTS["🤖 Agent Layer (2 módulos)"]
        AGENT["autopilot-agent.js<br>512 linhas · Task Parser"]
        LIVE["autopilot-live.js<br>964 linhas · Live RTX Panel"]
    end

    subgraph MODULES["📦 Sub-Modules (5 módulos)"]
        REG["registry.js · 163 linhas"]
        EST["estampas.js · 91 linhas"]
        APC["apc.js · 370 linhas"]
        VAR["variation.js · 187 linhas"]
        UNI["unique.js · 150 linhas"]
    end

    APP --> PAGES
    APP --> CORE
    DASH --> AGENT
    DASH --> LIVE
    AUTOPILOT --> MODULES
```

## Inventário Completo — Backend Endpoints (29)

| # | Método | Caminho | Domínio |
|---|--------|---------|---------|
| 1 | GET | `/api/health` | Core |
| 2 | GET | `/api/autopilot/stream` | Autopilot (SSE) |
| 3 | GET | `/api/autopilot/ping` | Autopilot |
| 4 | POST | `/api/autopilot/tasks` | Autopilot |
| 5 | PATCH | `/api/autopilot/tasks/:id/status` | Autopilot |
| 6 | DELETE | `/api/autopilot/tasks/:id` | Autopilot |
| 7 | GET | `/api/ean-proxy` | External |
| 8 | POST | `/api/folders/create` | Images |
| 9 | POST | `/api/images/rename` | Images |
| 10 | GET | `/api/config/categories` | Config |
| 11 | GET | `/api/config/sizes` | Config |
| 12 | GET | `/api/config/templates/:type` | Config |
| 13 | POST | `/api/autopilot/scan-folder` | Images |
| 14 | GET | `/api/preview-image` | Images |
| 15 | POST | `/api/autopilot/generate-apc-spreadsheet` | Spreadsheet |
| 16 | GET | `/api/autopilot/download-spreadsheet` | Spreadsheet |
| 17 | POST | `/api/scan-upload-folder` | Images |
| 18 | POST | `/api/autopilot/copy-network-images` | Network |
| 19 | GET | `/api/autopilot/images/:taskId/:code` | Images |
| 20 | GET | `/api/autopilot/images/:taskId/:code/*` | Images |
| 21 | POST | `/api/crosser/parse-xls` | Parser |
| 22 | GET | `/api/s3-proxy/health` | CDN |
| 23 | POST | `/api/s3-proxy/upload-from-folder-direct` | CDN |
| 24 | POST | `/api/s3-proxy/upload-from-disk` | CDN |
| 25 | POST | `/api/s3-proxy/upload-batch` | CDN |
| 26 | GET | `/api/network/config` | Network |
| 27 | POST | `/api/network/scan` | Network |
| 28 | POST | `/api/network/smart-scan` | Network |
| 29 | POST | `/api/network/copy` | Network |
