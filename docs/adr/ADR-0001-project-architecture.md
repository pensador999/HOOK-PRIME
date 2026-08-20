# ADR-0001: Arquitetura Inicial do HOOK PRIME

## Status
**Aceita** — 2026-08-20

## Contexto

O HOOK PRIME é um sistema de automação para gestão de produtos e-commerce da marca BRK.
O projeto nasceu como uma ferramenta interna e cresceu organicamente sem uma arquitetura 
formalmente definida. Com o aumento da complexidade (autopilot, rede dual, CDN, intro 3D, 
27+ skills de agente), é necessário estabelecer uma fundação arquitetural clara.

## Decisão

Adotar uma **arquitetura monolítica modular** com as seguintes características:

### Frontend
- **Vanilla JS SPA** (sem framework) com módulos IIFE
- Navegação via hash routing (`app.js`)
- Estado gerenciado por módulos independentes (`sessionStorage` + closures)
- GSAP para animações, Three.js para intro cinematográfica
- CSS com design system baseado em tokens (variáveis CSS)

### Backend
- **Node.js + Express** (server.js) — monolito com camadas internas
- Endpoints REST + SSE para operações longas
- Configuração via JSON (`network-prefixes.json`, `network-safety.js`)
- Sem banco de dados (estado em memória + disco)
- CDN upload via proxy para Cloudflare R2

### Rede
- **Dual-network** com Network Safety Guard
  - Rede nova: `\\192.168.100.100\Linha Brk 2024` (produtos atuais)
  - Rede legado: `\\192.168.100.100\Linha BRK\LINHA BRK` (produtos antigos)
  - Ambas PROTEGIDAS — apenas leitura e cópia para local

### Agentes
- 32+ skills organizadas em 5 camadas hierárquicas
- Skill de governança (`hook-prime-enterprise-architecture`) como autoridade máxima

## Alternativas Consideradas

| Opção | Prós | Contras |
|-------|------|---------|
| Next.js/React | Componentes, SSR, ecossistema | Complexidade, build step, overhead |
| Vanilla JS SPA | Zero build, simplicidade, controle total | Escala manual, sem hot reload |
| Microserviços | Isolamento, escalabilidade | Complexidade operacional excessiva |
| Monolito modular | Simplicidade + organização interna | Risco de acoplamento |

## Consequências

### Positivas
- Zero toolchain — sem build, sem bundler, sem transpiler
- Deploy simples: `node server.js`
- Controle total sobre o comportamento
- Compatível com a infraestrutura existente (rede Windows)

### Negativas
- server.js monolítico (2700+ linhas) — precisa modularizar
- autopilot.js monolítico (3680+ linhas) — precisa modularizar
- Sem testes automatizados
- Sem CI/CD

### Riscos
- Crescimento do server.js pode tornar manutenção difícil
- Sem TypeScript, erros de tipo são silenciosos em runtime
- Sem banco de dados, estado é volátil

## Arquivos Afetados
- `hub/server.js` — Backend monolítico principal
- `hub/public/js/*.js` — Módulos frontend
- `hub/config/*.json` — Configuração declarativa
- `.agents/skills/` — Skills do agente
- `docs/` — Documentação arquitetural

## Validação
1. O sistema deve inicializar com `node server.js` sem erros
2. Network Safety Guard deve passar verificação de integridade
3. Ambas as redes devem ser acessíveis e protegidas
4. Todos os 42 prefixos devem resolver corretamente
5. Fluxo Autopilot (Live e Manual) deve completar todas as fases
