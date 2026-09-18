---
name: brk-estampa-intelligence
description: Reconhecimento inteligente de estampas BRK via Gemini AI. Use quando o agente precisa gerar, validar, ou corrigir nomes de estampas para produtos BRK (Fishing, Agro, Motors).
---

# BRK Estampa Intelligence

## Quando usar
- Gerando nomes de estampas para produtos BRK
- Analisando imagens de camisas/acessórios para identificar a estampa
- Validando se um nome de estampa está correto segundo as regras BRK
- Debugando problemas no fluxo Autopilot Step 4 (Revisão de Estampas)
- Criando novos tipos de produto que precisam de nomenclatura de estampa

## Arquitetura do Sistema de Estampas

### 3 Camadas (ordem de prioridade)

1. **Gemini Vision** (IA) — Reconhecimento automático de estampas por imagem
   - Backend: `hub/routes/gemini-vision.js`
   - Prompts dinâmicos por categoria (fishing, agro, motors)
   - Banco de conhecimento: `hub/config/estampa-patterns.json`
   - Validação pós-processamento (remove palavras proibidas, limita a 4 palavras)

2. **Extração por Pasta** (Regex) — Lê o nome da pasta na rede
   - Backend: `hub/routes/network.js` (smart-scan, L400-445)
   - Regex para extrair estampa de títulos completos ou nomes simples
   - Exemplo: `C02576 - Camisa de Pesca Brk Tucunaré com Proteção UV50+` → "Tucunaré"

3. **Banco Estático** (Fallback) — Nomes pré-definidos por categoria
   - Frontend: `hub/public/js/autopilot/estampas.js`
   - ~50 nomes por categoria, baseados no catálogo real da BRK
   - Botão 🎲 na Step 4 sorteia um nome não usado

### Fluxo Completo

```
Rede (pasta) → Regex extrai estampa → preenche state.estampaSuggestions
     ↓
Step 4 abre → auto-trigger Gemini se todas vazias
     ↓
Gemini analisa imagens → preenche state.estampas
     ↓
Usuário revisa/edita → validateEstampa() limpa
     ↓
Step 5 (planilha) → buildProductTitle(type, brand, estampa, gender)
```

## Regras de Nomenclatura BRK

### Padrão de Título Final
```
{Tipo de Produto} {Marca} {ESTAMPA} {Gênero} {Recurso Técnico}
```

Exemplos reais:
- `Camisa de Pesca Brk Tucunaré Azul com Proteção UV50+`
- `Camisa ArmorX Camuflado Digital com Luva e Proteção UV50+`
- `Bandana Tubeneck Brk Degradê Vinho com Proteção UV50+`
- `Camisa BRK Agro Nelore Country com Proteção UV50+`
- `Camisa BRK Motors Big Trail Adventure com Proteção UV50+`

### Regras da Estampa (somente o nome)
1. **1-4 palavras** máximo
2. **Descritivo e comercial** — deve dar ideia do visual
3. **Palavras PROIBIDAS:** camisa, camiseta, pesca, brk, fishing, proteção, uv50, masculina, feminina, infantil, agro, motors, bandana, tubeneck, lenço, boné, manga, longa, curta
4. **Title Case** — primeira letra maiúscula, exceto preposições (de, do, da, e, com)
5. **Pode usar inglês** quando é termo consagrado: "Black Edition", "Off Road", "Combat Fish"
6. **Preferir português** para espécies e temas brasileiros

### Taxonomia por Categoria

#### Fishing (Pesca)
- **Espécies:** Tucunaré, Dourado, Robalo, Pintado, Traíra, Tambaqui, Pirarara, Cachara, Pirarucu, Surubim, Marlin, Atum, Black Bass, Tarpon
- **Sufixos estilísticos:** Clean, Underwater, Waves, 2.0, Raptor, Combat Fish, River Monster, Amazon
- **Combinação:** Espécie + Cor/Estilo ("Tucunaré Azul", "Robalo Flecha", "Pirarucu Amazon 2.0")

#### Agro (Agropecuária)  
- **Raças:** Nelore, Angus, Brahman, Charolês, Tabapuã, Mangalarga
- **Temas:** Comitiva, Rodeio, Vaquejada, Boiadeiro, Team Roping, São Bento
- **Combinação:** Raça + Estilo ("Nelore Country", "Angus Preto")

#### Motors (Motociclismo)
- **Modalidades:** Motocross, Enduro, Big Trail, Rally, Superbike, Café Racer
- **Temas:** Skull Rider, Carbon Tech, Racing, Nitro, Chrome
- **Combinação:** Modalidade + Cor ("Enduro Verde", "Rally Laranja")

## Endpoints da API

### `POST /api/gemini/describe-estampa`
```json
{
  "imagePath": "uploads/autopilot/task123/C0001/1.jpg",
  "productType": "Raglan",
  "category": "fishing"
}
```
Retorna: `{ "success": true, "estampa": "Tucunaré Azul" }`

### `POST /api/gemini/batch-describe`
```json
{
  "images": [
    { "code": "C0001", "imagePath": "uploads/autopilot/task123/C0001/1.jpg", "productType": "Raglan" },
    { "code": "C0002", "imagePath": "uploads/autopilot/task123/C0002/1.jpg", "productType": "ArmorX" }
  ],
  "category": "fishing"
}
```
Retorna: `{ "success": true, "results": [{ "code": "C0001", "estampa": "Tucunaré Azul" }, ...] }`

### `GET /api/gemini/status`
Verifica se a API key está configurada e o SDK instalado.

## Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `hub/routes/gemini-vision.js` | Backend — endpoints + prompts dinâmicos |
| `hub/config/estampa-patterns.json` | Banco de conhecimento (taxonomia, regras) |
| `hub/public/js/autopilot/estampas.js` | Frontend — banco estático + validação |
| `hub/public/js/autopilot/steps/step4-estampas.js` | Frontend — UI da Step 4 + Gemini handler |
| `hub/public/js/autopilot/registry.js` | Frontend — buildProductTitle() |

## Troubleshooting

### "Gemini não disponível"
1. Verificar `GEMINI_API_KEY` no `.env`
2. Verificar `npm install @google/generative-ai`
3. Verificar `GET /api/gemini/status`

### Estampa retorna nome genérico/errado
1. Verificar se a imagem existe no caminho enviado
2. Verificar se `category` está sendo enviada corretamente (fishing/agro/motors)
3. Verificar `estampa-patterns.json` — pode precisar de mais exemplos

### Auto-trigger não funciona
- Só dispara quando TODAS as estampas estão vazias
- Se alguma já tem valor (ex: veio da pasta), o auto-trigger não roda
- Botão manual 🤖 IA Gemini sempre está disponível
