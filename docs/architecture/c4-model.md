# Documentação de Arquitetura C4 - HOOK PRIME

Este documento descreve a arquitetura do **HOOK PRIME** utilizando o [Modelo C4](https://c4model.com/). Ele está dividido em quatro níveis, proporcionando uma visão técnica do sistema, desde o contexto de alto nível até os detalhes de fluxo de código.

---

## Nível 1: Contexto de Sistema (System Context)

O diagrama de contexto foca na visão geral do sistema, identificando os atores (usuários) e os sistemas externos com os quais o HOOK PRIME interage.

```mermaid
C4Context
    title Nível 1: Contexto de Sistema - HOOK PRIME

    Person(operador, "Operador BRK", "Equipe de Cadastro. Usa o navegador localhost:3000")
    Person(admin, "Admin", "Gerente de Produto. Configura os processos")

    System(hookprime, "HOOK PRIME", "Sistema em Node.js Express")

    System_Ext(smb, "Servidor de Rede", "\\192.168.100.100 (SMB, Read-Only enforced)")
    System_Ext(cdn, "BRK Link CDN", "Cloudflare R2 via Vercel (brk-link-vz77.vercel.app)")
    System_Ext(bling, "Bling ERP", "Sistema ERP (Importação de CSV com 59 colunas)")
    System_Ext(clickup, "ClickUp", "Gestão de projetos (via integração Tampermonkey Script)")
    System_Ext(github, "GitHub", "Repositório pensador999/HOOK-PRIME")

    Rel(operador, hookprime, "Usa", "Navegador Web")
    Rel(admin, hookprime, "Configura", "Navegador Web")
    Rel(hookprime, smb, "Lê arquivos/imagens da rede em modo", "SMB")
    Rel(hookprime, cdn, "Faz upload de imagens para", "HTTPS/API")
    Rel(operador, bling, "Importa o CSV gerado pelo sistema para o", "CSV")
    Rel(operador, clickup, "Agiliza fluxo com scripts de integração com", "Web")
    Rel(hookprime, github, "Versionamento e Hospedagem de código", "Git")
```

**Descrição:**
- **Operador BRK (Equipe de Cadastro):** É o usuário final principal que utiliza o portal rodando localmente (localhost:3000) para processar os produtos.
- **Admin (Gerente de Produto):** Configura regras de negócio e fluxos processuais.
- **HOOK PRIME:** O sistema core construído em Node.js e Express, que fornece a interface (SPA) e a API (HUB Server).
- Sistemas externos incluem o Servidor local para consumo de imagens de produtos, o Cloudflare R2 (BRK Link CDN) para armazenamento na nuvem e o Bling ERP para onde o CSV final será importado.

---

## Nível 2: Diagrama de Container

O diagrama de container divide o sistema HOOK PRIME em suas principais peças de execução, demonstrando como elas comunicam entre si.

```mermaid
C4Container
    title Nível 2: Diagrama de Container - HOOK PRIME

    Person(operador, "Operador BRK", "Equipe de Cadastro")

    System_Boundary(hookprime, "HOOK PRIME") {
        Container(browser, "Browser SPA", "Vanilla JS + GSAP 3.12.5", "Sem build step. Interface interativa do Autopilot.")
        Container(hub, "HUB Server", "Node.js >=18, Express 4.21", "Orquestrador backend que provê APIs REST e SSE.")
        Container(networkGuard, "Network Safety Guard", "Node.js Module", "516 linhas de código. Assegura a integridade limitando o acesso a 57 pastas protegidas e em modo Read-Only.")
        ContainerDb(configStore, "Config Store", "Arquivos JSON", "Armazenamento em hub/config/")
        ContainerDb(uploadStore, "Upload Store", "File System", "Diretório de cache em hub/uploads/")
    }

    System_Ext(cdn, "BRK Link CDN", "Cloudflare R2 via Vercel")
    System_Ext(smb, "Servidor de Rede", "\\192.168.100.100")

    Rel(operador, browser, "Usa a interface via", "HTTPS")
    Rel(browser, hub, "Requisita dados via", "REST / SSE")
    Rel(hub, configStore, "Lê e Escreve", "File System")
    Rel(hub, uploadStore, "Salva arquivos temporários", "File System")
    Rel(hub, networkGuard, "Acessa rede protegida via", "Internal")
    Rel(networkGuard, smb, "Busca imagens em modo Read-Only", "SMB")
    Rel(hub, cdn, "Faz o upload seguro de arquivos", "HTTPS/API")
```

**Descrição:**
O SPA em **Vanilla JS** roda diretamente no navegador, eliminando tempos de build e conectando-se ao **HUB Server**. O servidor delega as tarefas críticas de busca em rede para o **Network Safety Guard**, que aplica as restrições e segurança em 57 pastas designadas. Os metadados de configuração e uploads temporários ficam armazenados em pastas locais do backend.

---

## Nível 3: Diagrama de Componentes

### Backend (HUB Server)

Mostra a estrutura interna de componentes, injetados a partir do `server.js`.

```mermaid
C4Component
    title Nível 3: Component Diagram - Backend

    Container_Boundary(hub, "HUB Server") {
        Component(server, "server.js", "Node.js", "Orquestrador principal com Dependency Injection (sharedDeps).")
        
        Component(health, "health.js", "Express Router", "3 endpoints")
        Component(config, "config.js", "Express Router", "5 endpoints")
        Component(autopilotTasks, "autopilot-tasks.js", "Express Router", "4 endpoints, suporta Server-Sent Events (SSE)")
        Component(autopilotImages, "autopilot-images.js", "Express Router", "7 endpoints")
        Component(folders, "folders.js", "Express Router", "3 endpoints")
        Component(network, "network.js", "Express Router", "4 endpoints")
        Component(s3proxy, "s3-proxy.js", "Express Router", "3 endpoints")
        
        Component(networkSafety, "network-safety.js", "Module", "Módulo de segurança da rede, gerencia as regras das pastas protegidas.")
        Component(imageUtils, "image-utils.js", "Module", "Manipulação de imagem (usando Sharp).")
        
        Rel(server, health, "Injeta", "DI / sharedDeps")
        Rel(server, config, "Injeta", "DI / sharedDeps")
        Rel(server, autopilotTasks, "Injeta", "DI / sharedDeps")
        Rel(server, autopilotImages, "Injeta", "DI / sharedDeps")
        Rel(server, folders, "Injeta", "DI / sharedDeps")
        Rel(server, network, "Injeta", "DI / sharedDeps")
        Rel(server, s3proxy, "Injeta", "DI / sharedDeps")

        Rel(autopilotTasks, networkSafety, "Valida caminhos", "Function Call")
        Rel(network, networkSafety, "Busca com segurança", "Function Call")
        Rel(folders, networkSafety, "Lista diretórios", "Function Call")
        
        Rel(autopilotImages, imageUtils, "Processa thumbnails", "Function Call")
        Rel(s3proxy, imageUtils, "Otimiza e comprime uploads", "Function Call")
    }
```

**Descrição:**
A arquitetura do Express usa um padrão de **Injeção de Dependência** (`sharedDeps`) gerenciado pelo orquestrador `server.js`. Roteadores lidam com as responsabilidades específicas do sistema, e delegam complexidades para módulos de serviço internos como `network-safety.js` e `image-utils.js`.

### Frontend Autopilot (SPA)

Mostra a estrutura de componentes e gestão de estado no frontend.

```mermaid
C4Component
    title Nível 3: Component Diagram - Frontend Autopilot

    Container_Boundary(spa, "Browser SPA") {
        Component(autopilot, "autopilot.js", "Vanilla JS", "Orquestrador e inicializador principal.")
        
        Boundary(core, "Core (Lógica Base)") {
            Component(state, "state.js", "JS Object", "Armazena o estado global da sessão.")
            Component(helpers, "helpers.js", "Functions", "Utilitários DOM.")
            Component(codegen, "code-gen.js", "Functions", "Gera códigos e constrói o CSV.")
        }
        
        Component(uploader, "uploader.js", "Module", "Gerenciamento de fila de upload.")
        Component(steps, "steps (1 a 6)", "Modules", "Lógica de UI e validação de cada passo.")
        
        Boundary(products, "Products") {
            Component(apc, "apc.js", "Config", "Regras para produto APC.")
            Component(unique, "unique.js", "Config", "Regras para produto Unique.")
            Component(variation, "variation.js", "Config", "Regras para produto Variation.")
        }
        
        Boundary(data, "Data Layer") {
            Component(registry, "registry.js", "Store", "Registro persistente do produto.")
            Component(estampas, "estampas.js", "Store", "Catálogo de estampas mapeadas.")
        }

        Rel(autopilot, state, "Inicializa estado global", "Function")
        Rel(autopilot, steps, "Aciona carregamento", "Function")
        Rel(autopilot, uploader, "Registra callbacks", "Function")
        Rel(steps, products, "Lê regras de variação", "Function")
        Rel(steps, core, "Modifica estado / Usa Helpers", "Function")
        Rel(products, data, "Lê registros e estampas", "Function")
    }
```

**Descrição:**
O front-end não possui ferramentas complexas de build. O arquivo principal `autopilot.js` orquestra diferentes camadas lógicas, desde utilitários comuns no Core, fluxos fracionados nos Steps, até as regras específicas para cada tipo de produto na sub-camada Products.

---

## Nível 4: Code Diagram (Fluxos Específicos)

### Máquina de Estados: Autopilot Wizard

Representação da transição entre os passos do assistente de cadastro (Steps 1 a 6). A navegação regressiva é suportada ao se clicar em um passo já completado.

```mermaid
stateDiagram-v2
    direction LR
    
    [*] --> Step1: Iniciar

    Step1 --> Step2: Validate & Next
    Step2 --> Step3: Validate & Next
    Step3 --> Step4: Validate & Next
    Step4 --> Step5: Validate & Next
    Step5 --> Step6: Validate & Next
    Step6 --> [*]: Exportar CSV
    
    Step2 --> Step1: Click Completed Step
    Step3 --> Step1: Click
    Step3 --> Step2: Click
    Step4 --> Step1: Click
    Step4 --> Step2: Click
    Step4 --> Step3: Click
    Step5 --> Step1: Click
    Step5 --> Step2: Click
    Step5 --> Step3: Click
    Step5 --> Step4: Click
    Step6 --> Step5: Click
```

**Descrição:** 
Cada passo exige a validação de seus campos antes de prosseguir. O usuário pode retroceder a um passo prévio sem perder os dados armazenados em `state`.

### Pipeline de Upload

Diagrama do fluxo de dados para as imagens que vão até a CDN.

```mermaid
flowchart LR
    A[S3Uploader\nFrontend] -->|Envio de Imagem\nMultipart| B(S3Proxy\nBackend Express)
    B -->|Processamento de Imagem| C{Sharp Compress}
    C -->|Chunk Batches| D[Vercel API\nBRK Link CDN]
    D -->|Persistência| E[(Cloudflare R2)]
```

**Descrição:** 
O pipeline de upload fragmenta e delega o processamento da imagem em etapas. O S3Proxy no backend comprime o arquivo na hora usando Sharp, envia os chunks de dados em lotes (batches) para a API servida na Vercel, que por sua vez salva no bucket R2 da Cloudflare.

### Network Smart Scan

Lógica de cascata em 8 níveis realizada pelo `network-safety.js` para localizar dinamicamente a pasta certa da imagem, caso não esteja na raiz padrão.

```mermaid
flowchart TD
    Start([Busca Iniciada para SKU]) --> L1{1. 3D/}
    
    L1 -->|Não encontrado| L2{2. Subpastas root\nMASC / FEM / INF}
    L2 -->|Não encontrado| L3{3. SITE/}
    L3 -->|Não encontrado| L4{4. MOCKUP HUMANIZADO}
    L4 -->|Não encontrado| L5{5. MOCKUP/}
    L5 -->|Não encontrado| L6{6. IMAGENS_PARA_SITE/}
    L6 -->|Não encontrado| L7{7. JPEG_IMAGENS/}
    L7 -->|Não encontrado| L8{8. Imagens soltas na Raiz}
    L8 -->|Não encontrado| F([Falha / Fallback Padrão])
    
    L1 -->|Match| Match([Match: Arquivos Listados])
    L2 -->|Match| Match
    L3 -->|Match| Match
    L4 -->|Match| Match
    L5 -->|Match| Match
    L6 -->|Match| Match
    L7 -->|Match| Match
    L8 -->|Match| Match
```

**Descrição:**
Para evitar quebras quando as imagens do produto não seguem estritamente a padronização, a funcionalidade de *Smart Scan* vasculha a pasta da rede descendo uma árvore de regras de fallback com 8 níveis até achar os arquivos ou informar o erro ao sistema.
