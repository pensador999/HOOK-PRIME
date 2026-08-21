# Referência da API - HOOK PRIME

Esta documentação descreve todos os 29 endpoints da API do HOOK PRIME, organizados por módulo de rota. Cada endpoint inclui detalhes sobre parâmetros, formatos de resposta, códigos de erro e medidas de segurança.

---

## 1. Health & Status — `routes/health.js`

### 1.1 `GET /api/health`
**Descrição:** Verifica o estado de saúde da aplicação principal e a versão da API.
**Parâmetros:** Nenhum
**Resposta (Sucesso - 200 OK):**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```
**Erros:**
- `500 Internal Server Error`: Falha ao verificar o status.
**Segurança:** Endpoint público (sem autenticação).
**Notas:** Usado para monitoramento de uptime e balanceamento de carga.

### 1.2 `GET /api/autopilot/ping`
**Descrição:** Endpoint de liveness utilizado pela extensão Tampermonkey para checar a conectividade contínua com a API do Autopilot.
**Parâmetros:** Nenhum
**Resposta (Sucesso - 200 OK):**
```json
{
  "online": true,
  "tasks": 12,
  "timestamp": "2026-08-21T16:50:11.000Z"
}
```
**Erros:**
- `500 Internal Server Error`: Erro interno no servidor.
**Segurança:** Acesso restrito via CORS apenas para origens permitidas da extensão.
**Notas:** O número de tarefas (`tasks`) refere-se ao número de tarefas ativas/pendentes na fila do Autopilot.

### 1.3 `GET /api/s3-proxy/health`
**Descrição:** Verifica a disponibilidade e saúde do proxy CDN/S3 remoto (`brk-link-vz77.vercel.app`) usando uma requisição HTTP HEAD.
**Parâmetros:** Nenhum
**Resposta (Sucesso - 200 OK):**
```json
{
  "online": true,
  "status": 200
}
```
**Resposta (Erro - 503 Service Unavailable):**
```json
{
  "online": false,
  "error": "Timeout or connection refused"
}
```
**Erros:**
- `503 Service Unavailable`: Quando o endpoint remoto falha, demora mais que 5 segundos (timeout via `AbortController`), ou retorna um erro de conexão.
**Segurança:** Endpoint público (sem autenticação).
**Notas:** Timeout configurado restritamente para 5s (5000ms) para evitar bloqueio do event loop.

---

## 2. Configuration — `routes/config.js`

### 2.1 `GET /api/ean-proxy`
**Descrição:** Proxy de requisição que resolve problemas de CORS e busca os dados no formato CSV da planilha do Google Sheets contendo informações de EAN.
**Parâmetros da Query:**
- `gid` (opcional, string): ID da folha (padrão: 1752445302).
**Resposta (Sucesso - 200 OK):**
- Stream de dados: `text/csv`
**Erros:**
- `502 Bad Gateway`: Falha ao comunicar com o Google Sheets.
**Segurança:** Ignora restrições de CORS configurando headers abertos (`Access-Control-Allow-Origin: *`).
**Notas:** Transfere os dados nativamente no formato stream.

### 2.2 `GET /api/config/categories`
**Descrição:** Retorna o mapeamento de categorias de produto do sistema, incluindo os códigos de imposto utilizados no Sankhya e no Bling.
**Parâmetros:** Nenhum
**Resposta (Sucesso - 200 OK):**
```json
{
  "categories": [
    {
      "name": "Camisetas",
      "sankhyaCode": "101",
      "blingCode": "1001",
      "taxRate": 12.5
    }
  ]
}
```
**Erros:**
- `404 Not Found`: Arquivo `product-categories.json` não encontrado.
- `500 Internal Server Error`: Erro de leitura do arquivo.
**Segurança:** Acesso local autenticado.
**Notas:** Retorna o conteúdo de `product-categories.json`.

### 2.3 `GET /api/config/sizes`
**Descrição:** Retorna os padrões de tamanho cadastrados, totalizando cerca de 275 linhas contendo sequências, pesos (produto × tamanho) e dimensões.
**Parâmetros:** Nenhum
**Resposta (Sucesso - 200 OK):**
```json
{
  "sizePatterns": [
    {
      "pattern": "P-M-G-GG",
      "weights": {"P": 150, "M": 160, "G": 180, "GG": 200},
      "dimensions": {"width": 20, "height": 30, "length": 5}
    }
  ]
}
```
**Erros:**
- `500 Internal Server Error`: Erro de leitura de `size-patterns.json`.
**Segurança:** Requer sessão de usuário válida.
**Notas:** A leitura é carregada em memória na inicialização e fornecida no endpoint.

### 2.4 `GET /api/config/templates/:type`
**Descrição:** Busca um template de configuração em formato JSON. Por exemplo, utilizado para o mapeamento de 59 colunas do Bling.
**Parâmetros de Rota:**
- `type` (obrigatório, string): O tipo de template desejado (ex: `bling`).
**Resposta (Sucesso - 200 OK):**
```json
{
  "headers": ["ID", "Código", "Descrição", "..."],
  "defaults": {
    "origem": "0",
    "situacao": "Ativo"
  }
}
```
**Erros:**
- `404 Not Found`: Se `type` for desconhecido ou arquivo `templates-[type].json` não for encontrado.
**Segurança:** Somente origens permitidas (CORS restrito).
**Notas:** Suporta até 59 colunas fixas para a integração padrão do Bling.

### 2.5 `POST /api/crosser/parse-xls`
**Descrição:** Faz o upload de um arquivo XLS/XLSX, executa o parsing, extrai os dados, e retorna na resposta JSON, deletando o arquivo temporário imediatamente após.
**Headers:** `Content-Type: multipart/form-data`
**Body Parameters:**
- `file` (obrigatório, arquivo binário): Arquivo formato Excel (.xls, .xlsx).
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "rows": [
    ["Coluna 1", "Coluna 2"],
    ["Dado 1", "Dado 2"]
  ],
  "totalRows": 2,
  "sheetName": "Planilha1"
}
```
**Erros:**
- `400 Bad Request`: Arquivo ausente ou formato não suportado.
- `500 Internal Server Error`: Falha no parsing da planilha.
**Segurança:** Arquivo salvo na pasta `/temp` gerenciado pelo middleware `multer` e excluído com `fs.unlink()` independente de erro ou sucesso.
**Notas:** Utiliza a biblioteca `xlsx` do nodejs. Limite de tamanho de upload gerenciado pelo multer.

---

## 3. Autopilot Tasks — `routes/autopilot-tasks.js`

### 3.1 `GET /api/autopilot/stream`
**Descrição:** Estabelece uma conexão Server-Sent Events (SSE) para receber atualizações em tempo real das tarefas do Autopilot.
**Headers Recomendados:** Nenhum no request especial, mas a resposta trará:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`
**Resposta (Sucesso - 200 OK):** Fluxo SSE.
**Eventos Recebidos:**
- `init`: Enviado na conexão inicial com o estado atual.
- `new_task`: Quando uma nova tarefa é recebida.
- `task_updated`: Alteração no status de uma tarefa.
- `task_deleted`: Quando a tarefa é removida.
- Heartbeat: Mensagem vazia `: ping\n\n` a cada 30 segundos.
**Erros:** Desconexão silenciosa.
**Segurança:** Acesso CORS configurado para a extensão e painel.
**Notas:** O servidor gerencia listeners `req.on('close', ...)` para limpeza de clientes inativos, evitando vazamento de memória.

### 3.2 `POST /api/autopilot/tasks`
**Descrição:** Cria uma nova tarefa na fila do Autopilot e faz o parsing inteligente da descrição para buscar padrões e códigos.
**Body Parameters (JSON):**
- `title` (obrigatório, string): Título da tarefa.
- `description` (obrigatório, string): Descrição rica contendo os códigos (ex: "Criar APC MASC01").
- `url` (obrigatório, string): URL de origem da tarefa.
**Resposta (Sucesso - 201 Created):**
```json
{
  "id": "12345",
  "title": "APC MASC",
  "status": "pending",
  "codes": ["MASC01", "MASC02"],
  "url": "http://origem..."
}
```
**Erros:**
- `400 Bad Request`: Dados obrigatórios faltando.
- `409 Conflict`: Deduplicação por `url` (tarefa já existe para esta url).
**Segurança:** Validação contra injection no parsing.
**Notas:** A rota usa Regex `\b[A-Z]+[0-9]+\b` e processa ranges. A API realiza matching de "longest-prefix" contra 38 prefixos da rede (networkPrefixes). Após sucesso, emite o evento SSE `new_task`.

### 3.3 `PATCH /api/autopilot/tasks/:id/status`
**Descrição:** Atualiza o estado (`status`) de uma tarefa do Autopilot existente.
**Parâmetros de Rota:**
- `id` (obrigatório, string/uuid): ID da tarefa.
**Body Parameters (JSON):**
- `status` (obrigatório, string): Enum válido `['pending', 'in_progress', 'done']`.
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "id": "12345",
  "status": "in_progress"
}
```
**Erros:**
- `400 Bad Request`: Status inválido fora do Enum.
- `404 Not Found`: Tarefa com o ID não existe.
**Segurança:** Acesso controlado via API Key/Sessão.
**Notas:** Dispara o evento SSE `task_updated` para todos os clientes conectados.

### 3.4 `DELETE /api/autopilot/tasks/:id`
**Descrição:** Remove uma tarefa da fila do Autopilot.
**Parâmetros de Rota:**
- `id` (obrigatório, string/uuid): ID da tarefa.
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "deletedId": "12345"
}
```
**Erros:**
- `404 Not Found`: Tarefa com o ID não existe.
**Segurança:** Apenas usuários autorizados podem deletar.
**Notas:** Dispara o evento SSE `task_deleted` para os clientes SSE.

---

## 4. Autopilot Images — `routes/autopilot-images.js`

### 4.1 `POST /api/autopilot/scan-folder`
**Descrição:** Faz uma varredura (scan) recursiva e conta as imagens em um diretório.
**Body Parameters (JSON):**
- `folderPath` (obrigatório, string): Caminho absoluto no disco local.
**Resposta (Sucesso - 200 OK):**
```json
{
  "basePath": "C:\\Imagens\\Uploads",
  "totalFolders": 12,
  "totalImages": 150,
  "folders": [
    {
      "name": "MASC",
      "imageCount": 50,
      "path": "C:\\Imagens\\Uploads\\MASC"
    }
  ]
}
```
**Erros:**
- `400 Bad Request`: `folderPath` vazio ou inválido.
- `404 Not Found`: Caminho não encontrado no sistema operacional.
**Segurança:** Bloqueio de caminhos de sistema protegidos.

### 4.2 `GET /api/preview-image`
**Descrição:** Retorna a imagem do sistema de arquivos de forma segura, utilizada para pré-visualização.
**Parâmetros da Query:**
- `path` (obrigatório, string): Caminho absoluto para a imagem.
**Resposta (Sucesso - 200 OK):**
- Arquivo Binário da Imagem (image/jpeg, image/png).
**Headers da Resposta:** `Cache-Control: public, max-age=3600`
**Erros:**
- `400 Bad Request`: Caminho não fornecido.
- `403 Forbidden`: `networkSafety.isNetworkPath` falhou ou caminho não começa com `uploadsDir`.
- `404 Not Found`: Arquivo não existe.
**Segurança:** Rigorosa proteção contra Path Traversal. Valida utilizando método de segurança `networkSafety` e força restrição à pasta de uploads (`startsWith`).

### 4.3 `POST /api/autopilot/generate-apc-spreadsheet`
**Descrição:** Gera uma planilha no padrão Bling (CSV com 59 colunas) para produtos gerados no fluxo do Autopilot.
**Body Parameters (JSON):**
- `codes` (obrigatório, array de strings): Códigos gerados.
- `taskTitle` (obrigatório, string): Título da tarefa.
- `taskId` (obrigatório, string): ID da tarefa.
- `cdnUrls` (obrigatório, array de strings): URLs das imagens vinculadas no CDN.
- `colors` (opcional, array): Variações de cor.
- `genders` (opcional, array): Gêneros da peça.
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "filePath": "uploads/autopilot/12345/Titulo_Tarefa.csv",
  "rowsGenerated": 25
}
```
**Erros:**
- `400 Bad Request`: Faltando propriedades no payload.
- `500 Internal Server Error`: Falha ao gravar arquivo no disco.
**Segurança:** Cria as pastas da tarefa e escreve o arquivo temporário apenas dentro de diretórios permitidos.
**Notas:** O CSV é gravado de forma persistente e a estrutura respeita 100% o array `templates-bling.json`.

### 4.4 `GET /api/autopilot/download-spreadsheet`
**Descrição:** Realiza o download forçado (`Content-Disposition: attachment`) da planilha gerada no endpoint de planilha do APC.
**Parâmetros da Query:**
- `path` (obrigatório, string): Caminho do arquivo csv gerado.
**Resposta (Sucesso - 200 OK):**
- Arquivo em formato texto `.csv`.
**Erros:**
- `403 Forbidden`: Path traversal detectado.
- `404 Not Found`: Arquivo não encontrado.
**Segurança:** Validação via `path.resolve` e `startsWith` do `uploadsDir` para forçar download seguro e não expor pastas do sistema raiz.
**Notas:** Utiliza método `res.download(resolved)`.

### 4.5 `POST /api/autopilot/copy-network-images`
**Descrição:** Copia os arquivos de imagem das pastas mapeadas na rede, otimizando, deduplicando por tamanho de byte e renomeando as fotos de forma sequencial, voltada ao usuário.
**Body Parameters (JSON):**
- `results` (obrigatório, array de objetos): Os dados descobertos para cada referência (origem de rede).
- `taskId` (obrigatório, string): A qual tarefa pertence.
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "copiedImages": 12,
  "skipped": 2,
  "destinationFolder": "C:\\Uploads\\Autopilot\\12345"
}
```
**Erros:**
- `500 Internal Server Error`: Falha nas cópias (timeout ou erro de I/O na rede).
**Segurança:** A cópia usa a classe de isolamento `safeCopyFromNetwork` e filtra paths "humanizados".
**Notas:** Inclui Smart Sort, onde fotos nomeadas ex: 'frente', 'costas' e 'detalhe' ganham nomes padronizados `1.jpg`, `2.jpg` etc.

### 4.6 `GET /api/autopilot/images/:taskId/:code`
**Descrição:** Retorna a listagem em JSON de todas as imagens que foram copiadas da rede ou tratadas para um `code` específico de uma tarefa específica.
**Parâmetros de Rota:**
- `taskId` (obrigatório, string): Id da task.
- `code` (obrigatório, string): Código do produto (ex: MASC01).
**Resposta (Sucesso - 200 OK):**
```json
{
  "taskId": "12345",
  "code": "MASC01",
  "images": [
    "1.jpg",
    "2.jpg"
  ]
}
```
**Erros:**
- `404 Not Found`: Diretório não existe.
**Segurança:** Leitura apenas no caminho padrão `uploads/autopilot/:taskId/:code`.

### 4.7 `GET /api/autopilot/images/:taskId/:code/*`
**Descrição:** Serve estaticamente o arquivo real de imagem do diretório do Autopilot. O `*` funciona como um catch-all para o nome do arquivo.
**Parâmetros de Rota:**
- `taskId` (obrigatório, string)
- `code` (obrigatório, string)
- `*` (obrigatório, string): Nome da imagem (ex: `1.jpg`).
**Resposta (Sucesso - 200 OK):**
- Arquivo Binário da Imagem.
**Erros:**
- `403 Forbidden`: `startsWith` uploadsDir falhou.
- `404 Not Found`: Arquivo ausente.
**Segurança:** Path validation rigoroso, sem expor metadados internos de caminhos absolutos do backend.

---

## 5. Folders — `routes/folders.js`

### 5.1 `POST /api/folders/create`
**Descrição:** Cria estruturas de diretórios vazias e pré-organizadas baseadas em uma lista de códigos para preparo manual ou sistemático das fotos.
**Body Parameters (JSON):**
- `codes` (obrigatório, array de strings): Códigos que terão pastas.
- `basePath` (obrigatório, string): Caminho base de criação.
**Resposta (Sucesso - 200 OK):**
```json
{
  "created": ["MASC01", "MASC02"],
  "errors": []
}
```
**Erros:**
- `403 Forbidden`: O sistema bloqueia especificamente criar pastas em mapeamentos de rede lentos/indesejados para segurança.
- `500 Internal Server Error`: Erro de permissão do SO.
**Segurança:** A API rejeita (403) a criação se `basePath` for detectado como Network Path via regex padrão (ex: `\\rede` ou `Z:\`).

### 5.2 `POST /api/images/rename`
**Descrição:** Aplica um padrão semântico de renomeação num array de arquivos enviados (Multipart) com base na sigla.
**Headers:** `Content-Type: multipart/form-data`
**Body/Form Parameters:**
- `pattern` (obrigatório, string): Pode ser 'MASC', 'FEM', 'INF'.
- `images` (obrigatório, files): Arquivos binários para renomear, upload (limite de 100 imagens no Multer).
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "renamedFiles": [
    "01MASC.jpg",
    "02FEM.jpg"
  ]
}
```
**Erros:**
- `400 Bad Request`: `pattern` inválido ou arquivos não enviados.
**Segurança:** Apenas extensões de imagens aceitas no upload, e o multipart é rigidamente limitado.

### 5.3 `POST /api/scan-upload-folder`
**Descrição:** Varre uma pasta de upload especificada localmente num formato "3-tier hierarchy" (Coleção > Gênero > Referência) e extrai um resumo agrupado.
**Body Parameters (JSON):**
- `folderPath` (obrigatório, string): Caminho local absoluto para varrer.
**Resposta (Sucesso - 200 OK):**
```json
{
  "blocks": [
    {
      "collection": "Verao2027",
      "gender": "MASC",
      "reference": "01",
      "images": 3
    }
  ],
  "summary": {
    "totalImages": 300,
    "totalReferences": 100
  }
}
```
**Erros:**
- `404 Not Found`: Caminho inexistente.
- `500 Internal Server Error`: Loop de leitura muito longo.
**Segurança:** O usuário necessita estar autenticado e a pasta deve ser de escopo local para evitar tráfego alto.

---

## 6. Network — `routes/network.js`

### 6.1 `GET /api/network/config`
**Descrição:** Retorna os defaults de configuração armazenados estaticamente para facilitar mapeamentos de drive de rede na interface.
**Parâmetros:** Nenhum
**Resposta (Sucesso - 200 OK):**
```json
{
  "defaultNetworkPath": "Z:\\Rede_Geral\\Fotos",
  "recentPaths": [
    "Z:\\Rede_Geral\\Fotos\\Colecao1",
    "Y:\\Fotos_Arquivadas"
  ]
}
```
**Erros:**
- `500 Internal Server Error`: `network.json` corrompido ou ausente.
**Segurança:** Endpoint interno. Acesso via interface administrativa.

### 6.2 `POST /api/network/scan`
**Descrição:** Faz uma varredura seletiva para diagnosticar um caminho de rede, classificando seu conteúdo.
**Body Parameters (JSON):**
- `networkPath` (obrigatório, string): Caminho base de rede (ex: `Z:\`).
**Resposta (Sucesso - 200 OK):**
```json
{
  "status": "success",
  "detections": {
    "3d_folder": true,
    "gender_folders": false,
    "loose_images": true,
    "jpeg_optimized": false,
    "empty": false
  }
}
```
**Erros:**
- `500 Internal Server Error`: Erro ao contatar mapeamento de rede.
**Segurança:** Utiliza wrappers assíncronos customizados `safeStat` e `safeReadDir` para contornar travamentos devido à latência SMB do Windows, implementando timeouts forçados.

### 6.3 `POST /api/network/smart-scan`
**Descrição:** Varre a rede em até 8 níveis de subpastas buscando códigos de produtos exatos em cascata, ideal para a inteligência de catalogação do autômato.
**Body Parameters (JSON):**
- `codes` (obrigatório, array de strings): Os códigos buscados (limite de 100).
**Resposta (Sucesso - 200 OK):**
```json
{
  "results": [
    {
      "code": "MASC01",
      "found": true,
      "path": "Z:\\Fotos\\MASC\\MASC01",
      "estampa": "Liso",
      "colorVariants": ["Azul", "Preto"],
      "images": ["1.jpg", "2.jpg"]
    }
  ]
}
```
**Erros:**
- `400 Bad Request`: Máximo de limites ultrapassado.
- `403 Forbidden`: Proteção contra Path Traversal bloqueia o envio caso detecte `/[\.]{2}|[\/\\]{2,}|[<>"|?*]/`.
**Segurança:** Traversal validation rigoroso, escapamento de arrays para leitura de diretório (8-level cascade limit hardcoded).

### 6.4 `POST /api/network/copy`
**Descrição:** Executa a cópia massiva da rede via Stream.
**Body Parameters (JSON):**
- `networkPath` (obrigatório, string): Origem (Rede).
- `localBasePath` (obrigatório, string): Destino (Local).
- `collectionName` (opcional, string)
- `folders` (opcional, array de strings)
- `preferJpeg` (opcional, boolean): Preferência para imagens Jpeg se TIFF estiver presente.
**Resposta (Sucesso - 200 OK):** Dispara processamento assíncrono conectado por SSE para resposta.
**Eventos SSE Emitidos:**
- `status`: "Iniciando cópia..."
- `progress`: `{ copied: 10, total: 100 }`
- `complete`: `{ success: true, message: 'Fim' }`
- `error`: Mensagens sobre I/O exception.
**Erros HTTP:**
- `403 Forbidden`: Bloqueia agressivamente caso `localBasePath` não seja um caminho local (não podemos copiar rede para rede por motivos de lentidão do servidor).
**Segurança:** Exclusivo de painel de controle restrito. Wrappers `safeCopyFromNetwork` usados para lidar com travamentos I/O de SMB.

---

## 7. S3 Proxy CDN — `routes/s3-proxy.js`

### 7.1 `POST /api/s3-proxy/upload-from-folder-direct`
**Descrição:** Rota pesada que pega todos os itens de uma pasta e faz o stream e compressão com `sharp` diretamente para o proxy/CDN na Vercel (brk-link-vz77).
**Body Parameters (JSON):**
- `folderPath` (obrigatório, string): Caminho base das fotos tratadas.
- `collectionId` (obrigatório, string): Nome da coleção no balde S3/CDN.
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "total": 5,
  "urls": [
    "https://cdn.brk-link.com/collection/1.jpg"
  ],
  "joined": "https://cdn.brk-link... 1.jpg, https://cdn..."
}
```
**Erros:**
- `500 Internal Server Error`: Falha no proxy Vercel ou compressão falhou.
**Segurança e Otimização:** 
- O Sharp é configurado para comprimir em JPEG a 85% e redimensionar proporções acima de `1600x1600`.
- Arquivos abaixo de 500KB "bypassam" o sharp.
- Enviado ao proxy/CDN em pedaços (Chunks) limitados a 3.5MB por request do Axios para respeitar os limites severos de Request Body Size na Vercel.

### 7.2 `POST /api/s3-proxy/upload-from-disk`
**Descrição:** Transfere diretórios do disco local para o S3, auto-gerenciando renomeio e compactação.
**Body Parameters (JSON):**
- `folderPath` (obrigatório, string)
- `codeBase` (obrigatório, string): Nome primário base, Ex: `MASC`
- `gender` (obrigatório, string)
- `autoRename` (opcional, boolean)
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "cdnLinks": ["https://cdn.url/1.jpg"]
}
```
**Erros:**
- `502 Bad Gateway`: Caso os retries falhem.
**Segurança e Otimização:** Possui mecanismo interno de Retry: Caso ocorra timeout, o loop retenta a cada arquivo específico 3x aplicando um método "Exponential Backoff". Realiza compressão Sharp e Smart Sort nativamente antes do envio.

### 7.3 `POST /api/s3-proxy/upload-batch`
**Descrição:** Upload via Multipart para envio "on the fly" de imagens esparsas (fora do fluxo do disco).
**Headers:** `Content-Type: multipart/form-data`
**Body/Form Parameters:**
- `files` (obrigatório, limit: 50 arquivos binários).
- `collectionId` (opcional, string).
**Resposta (Sucesso - 200 OK):**
```json
{
  "success": true,
  "uploadedCount": 10,
  "urls": ["https://..."]
}
```
**Erros:**
- `413 Payload Too Large`: Total do request ultrapassa limites configurados no Node/Multer.
**Segurança:** Checagem rigorosa de MIME types no Multer (`image/jpeg`, `image/png`, `image/webp`).
**Notas:** Classifica e aplica a tag "Gênero" dinamicamente baseado nos próprios nomes dos arquivos das fotos durante o trânsito da rota para estruturação no CDN remoto.
