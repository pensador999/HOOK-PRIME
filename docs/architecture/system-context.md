# C1 — System Context

> **Nível C4:** Context | **Audiência:** Todos (técnicos e não-técnicos)

## O que é o HOOK PRIME?

Sistema de automação enterprise para gestão de produtos e-commerce da marca **BRK**.
Automatiza o fluxo: scan de rede → classificação de gênero → cópia local → upload CDN → geração de planilha ERP.

## Diagrama de Contexto

```mermaid
graph TB
    subgraph Usuários
        LUCAS["👤 Lucas (Operador)"]
        TM["🔌 Tampermonkey Script"]
    end

    subgraph HOOK_PRIME["🏛️ HOOK PRIME"]
        SPA["Frontend SPA"]
        SERVER["Node.js Server"]
    end

    subgraph Sistemas_Externos
        CLICKUP["📋 ClickUp<br>(Gestão de Tarefas)"]
        CDN["☁️ BRK Link CDN<br>(Cloudflare R2 / Vercel)"]
        REDE_NOVA["📁 Rede Nova<br>\\\\192.168.100.100\\Linha Brk 2024"]
        REDE_LEGADO["📁 Rede Legado<br>\\\\192.168.100.100\\Linha BRK\\LINHA BRK"]
        GSHEETS["📊 Google Sheets<br>(Tabela de EANs)"]
        BLING["🏪 Bling ERP<br>(Importação CSV)"]
    end

    LUCAS -->|Opera via browser| SPA
    TM -->|Envia tarefas via API| SERVER
    CLICKUP -->|Tarefas de produção| TM
    SPA -->|HTTP/SSE| SERVER
    SERVER -->|Leitura SOMENTE| REDE_NOVA
    SERVER -->|Leitura SOMENTE| REDE_LEGADO
    SERVER -->|Upload imagens| CDN
    SERVER -->|Proxy CSV| GSHEETS
    SERVER -->|Gera planilha| BLING

    style HOOK_PRIME fill:#0a0a0a,stroke:#0ae448,stroke-width:2px,color:#fff
    style REDE_NOVA fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#fff
    style REDE_LEGADO fill:#1a1a2e,stroke:#e94560,stroke-width:2px,color:#fff
    style CDN fill:#16213e,stroke:#0ae448,stroke-width:1px,color:#fff
```

## Atores

| Ator | Tipo | Interação |
|------|------|-----------|
| Lucas (Operador) | Humano | Opera o sistema via browser `localhost:3000` |
| Tampermonkey Script | Software | Injeta tarefas do ClickUp na API do servidor |
| ClickUp | SaaS externo | Fonte de tarefas de produção (códigos de produto) |
| BRK Link CDN | SaaS externo | Armazenamento de imagens (Cloudflare R2 via Vercel) |
| Rede Nova (192.168.100.100) | Infraestrutura interna | Pasta SMB com imagens de produtos atuais |
| Rede Legado (192.168.100.100) | Infraestrutura interna | Pasta SMB com imagens de produtos antigos |
| Google Sheets | SaaS externo | Tabela de EANs (códigos de barras) |
| Bling ERP | SaaS externo | Consome CSV gerado para cadastro de produtos |

## Fluxo Principal

```
ClickUp → Tampermonkey → API → Scan Rede → Cópia Local → Upload CDN → Planilha Bling
```
