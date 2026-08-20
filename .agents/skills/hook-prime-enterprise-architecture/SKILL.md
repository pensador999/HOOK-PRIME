---
name: hook-prime-enterprise-architecture
description: >
  Constituição técnica do HOOK PRIME. Define as regras arquiteturais invioláveis,
  protocolos de decisão, contratos entre camadas, e governança do projeto.
  Deve ser consultada ANTES de qualquer implementação significativa.
  Funciona como a autoridade máxima sobre decisões arquiteturais do sistema.
---

# 🏛️ HOOK PRIME — Enterprise Architecture Governance

## AUTORIDADE

Este documento é a **constituição técnica** do projeto HOOK PRIME.
Toda decisão arquitetural, feature significativa, ou mudança estrutural
DEVE respeitar estas regras. Nenhuma skill, agente ou instrução do usuário
pode sobrepor estas proteções sem uma ADR formal.

---

## PROTOCOLO OBRIGATÓRIO — ANTES DE IMPLEMENTAR

Antes de implementar qualquer feature, correção estrutural, ou refatoração:

### Checklist de 10 Pontos

```
 1. ☐ Analisar arquitetura existente (ler docs/architecture/)
 2. ☐ Verificar se existe ADR relacionada (ler docs/adr/)
 3. ☐ Identificar módulos e camadas afetadas
 4. ☐ Não criar dependências circulares
 5. ☐ Não misturar regra de negócio com UI
 6. ☐ Não colocar lógica crítica diretamente em componentes visuais
 7. ☐ Definir contratos entre frontend e backend (se API nova)
 8. ☐ Atualizar documentação se a arquitetura mudar
 9. ☐ Criar ADR se a decisão for relevante ou difícil de reverter
10. ☐ Executar testes e validação
```

---

## REGRAS ARQUITETURAIS INVIOLÁVEIS

### R1 — Separação de Responsabilidades
- **Frontend** = Apresentação + Interação + Estado local
- **Backend (server.js)** = API + Regras de negócio + Integração
- **Config** = Configuração declarativa (JSON, não código)
- **Rede** = Apenas leitura e cópia (Network Safety Guard)

### R2 — Proteção da Rede
- NUNCA escrever, modificar, apagar, mover arquivos na rede
- Ambas as redes (nova e legado) são PROTEGIDAS
- Rede nova: `\\192.168.100.100\Linha Brk 2024`
- Rede legado: `\\192.168.100.100\Linha BRK\LINHA BRK`
- Qualquer operação de rede DEVE usar `networkSafety.*` functions

### R3 — Modularidade
- Cada funcionalidade deve ter um módulo claro
- Módulos devem ter fronteiras bem definidas
- Comunicação entre módulos via APIs/contratos, não acesso direto
- Evitar módulos monolíticos (> 1000 linhas = considerar split)

### R4 — Estado e Persistência
- Estado do frontend: `sessionStorage` / `localStorage` / variáveis IIFE
- Estado do backend: memória (tasks) + disco (config JSON)
- Cada módulo gerencia seu próprio estado
- Não compartilhar estado global entre módulos sem contrato

### R5 — API Design
- Endpoints REST com verbos HTTP corretos (GET/POST/PATCH/DELETE)
- Resposta sempre JSON com status code apropriado
- Erros devem incluir mensagem legível e contexto
- SSE (Server-Sent Events) para operações longas com progresso

### R6 — Segurança
- Nunca expor caminhos absolutos da rede ao frontend
- Validar todos os inputs no backend (path traversal, injection)
- CDN uploads via proxy (nunca credenciais no frontend)
- Sanitizar nomes de arquivo antes de operações de disco

### R7 — Qualidade de Código
- Funções devem ter responsabilidade única
- Nomes descritivos (sem abreviações obscuras)
- Tratamento de erros em toda operação assíncrona (try/catch/finally)
- Variáveis declaradas no escopo correto (evitar ReferenceError)

### R8 — Não Destruir o que Funciona
- **REGRA ABSOLUTA**: Não alterar lógica existente que funciona sem necessidade
- Testar mudanças antes de publicar
- Manter backward compatibility de APIs
- Sempre ter um caminho de rollback

---

## CAMADAS DO SISTEMA

```
HOOK PRIME
│
├── FRONTEND (hub/public/)
│   ├── UI Layer          → HTML/CSS/JS visual components
│   ├── State Layer       → IIFE modules, sessionStorage
│   ├── Service Layer     → fetch() calls to backend APIs
│   └── Realtime Layer    → SSE streams, WebSocket
│
├── SERVER (hub/server.js + config/)
│   ├── API Layer         → Express routes, request handling
│   ├── Business Layer    → Code extraction, prefix matching, CSV generation
│   ├── Integration Layer → Network access, CDN upload, ClickUp
│   └── Safety Layer      → Network Safety Guard, validation
│
├── DATA (hub/config/ + hub/uploads/)
│   ├── Config            → JSON files (prefixes, safety, categories)
│   ├── Local Storage     → Uploaded/copied images, spreadsheets
│   └── Session           → In-memory task state
│
└── INFRASTRUCTURE
    ├── Network           → \\192.168.100.100 (nova + legado)
    ├── CDN               → brk-link-vz77.vercel.app (Cloudflare R2)
    └── Repository        → github.com/pensador999/HOOK-PRIME
```

---

## QUANDO CRIAR UMA ADR

Criar uma Architecture Decision Record quando:

1. **Escolha de tecnologia** — ex: "usar GSAP vs Framer Motion"
2. **Mudança de estrutura** — ex: "modularizar server.js em rotas"
3. **Decisão de segurança** — ex: "adicionar autenticação"
4. **Mudança de fluxo** — ex: "alterar ordem das etapas do autopilot"
5. **Trade-off significativo** — ex: "monolito vs microserviço"
6. **Integração nova** — ex: "adicionar banco de dados"

### Template ADR

```markdown
# ADR-NNNN: [Título da Decisão]

## Status
[Proposta | Aceita | Obsoleta | Substituída por ADR-XXXX]

## Contexto
O que levou a esta decisão? Qual problema estamos resolvendo?

## Decisão
O que foi decidido e por quê.

## Alternativas Consideradas
| Opção | Prós | Contras |
|-------|------|---------|
| A     | ...  | ...     |
| B     | ...  | ...     |

## Consequências
- Positivas: ...
- Negativas: ...
- Riscos: ...

## Arquivos Afetados
- `hub/server.js` — motivo
- `hub/public/js/...` — motivo

## Validação
Como verificar que a decisão está sendo seguida.
```

---

## ESTRUTURA DE DOCUMENTAÇÃO

```
/docs
├── README.md                     → Visão geral do projeto
├── architecture/
│   ├── system-context.md         → C1: O que é o HOOK PRIME no ecossistema
│   ├── containers.md             → C2: Frontend, Backend, Rede, CDN
│   ├── components.md             → C3: Módulos dentro de cada container
│   ├── data-flow.md              → Fluxo de dados end-to-end
│   ├── domain-model.md           → Entidades: Código, Estampa, Produto, Imagem
│   └── invariants.md             → Regras que nunca podem ser violadas
├── adr/
│   └── ADR-NNNN-*.md             → Decisões arquiteturais
├── api/
│   ├── endpoints.md              → Catálogo de endpoints REST
│   ├── contracts.md              → Request/Response schemas
│   └── authentication.md         → Estratégia de auth (futuro)
├── development/
│   ├── setup.md                  → Como rodar o projeto
│   ├── coding-standards.md       → Padrões de código
│   ├── testing.md                → Estratégia de testes
│   └── contribution.md           → Como contribuir
├── operations/
│   ├── deployment.md             → Como deploy/publicar
│   ├── monitoring.md             → O que monitorar
│   ├── incidents.md              → Resposta a incidentes
│   └── rollback.md               → Procedimentos de rollback
└── agents/
    ├── architecture.md           → Como os agentes se integram
    ├── responsibilities.md       → Skills e papéis de cada agente
    ├── communication.md          → Protocolos de comunicação
    └── orchestration.md          → Hierarquia e orquestração
```

---

## HIERARQUIA DE SKILLS

As skills do HOOK PRIME são organizadas em camadas de responsabilidade.
**Nunca ativar todas ao mesmo tempo.** Usar a skill apropriada para o contexto:

```
🏛️ CAMADA ESTRATÉGICA (consultar ANTES de implementar)
├── hook-prime-enterprise-architecture  → Governança e regras
├── software-architect                  → Análise e decisões arquiteturais
├── architect-review                    → Revisão de mudanças
├── c4-architecture                     → Diagramas e visualização
└── adr-documentation                   → Registro de decisões

📐 CAMADA DE DESIGN (consultar para UI/UX)
├── ui-ux-pro-max                       → Direção criativa
├── impeccable-frontend-design          → Qualidade visual
├── ui-visual-composition               → Composição e hierarquia
├── interaction-patterns-components     → Padrões de interação
└── ux-usability-foundations            → Fundamentos de usabilidade

🏗️ CAMADA DE IMPLEMENTAÇÃO (usar durante desenvolvimento)
├── frontend-developer                  → Componentes React/JS
├── frontend-ui-engineering             → Engenharia de UI
├── javascript-pro                      → JavaScript avançado
├── nodejs-backend-patterns             → Padrões de backend
└── design-systems-frontend-architecture → Sistemas de design

⚡ CAMADA DE MOVIMENTO (usar para animações)
├── gsap-motion-director                → Animações GSAP
└── threejs-* (8 skills)                → 3D / WebGL

🛡️ CAMADA DE QUALIDADE (usar para revisão/debug)
├── code-review-excellence              → Revisão de código
├── code-refactoring-refactor-clean     → Refatoração limpa
├── debugger                            → Debugging
├── performance-engineer                → Otimização
├── document-architecture               → Documentação da arquitetura
└── technical-documentation             → Documentação técnica
```

---

## DÉBITO TÉCNICO CONHECIDO

| ID | Área | Descrição | Severidade | Status |
|----|------|-----------|-----------|--------|
| TD-001 | Backend | `server.js` monolítico (2700+ linhas) | Alta | Aberto |
| TD-002 | Frontend | `autopilot.js` monolítico (3680+ linhas) | Alta | Aberto |
| TD-003 | Frontend | Módulos APC/Variation/Unique carregados mas não usados | Média | Aberto |
| TD-004 | Backend | Sem testes automatizados | Alta | Aberto |
| TD-005 | Infra | Sem autenticação no servidor | Média | Aberto |
| TD-006 | Dados | Sem banco de dados (tudo em memória/JSON) | Média | Aberto |
| TD-007 | API | Sem documentação formal dos endpoints | Média | Aberto |
| TD-008 | Infra | Sem CI/CD pipeline | Baixa | Aberto |
