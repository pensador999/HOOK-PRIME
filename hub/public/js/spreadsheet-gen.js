/* ═══════════════════════════════════════════════════════════════════════════
   HUB HOOK PRIME — Gerador de Planilhas Oficial (Molde 100% Fiel PLANILHAS EXEMPLOS)
   - Bling V2: 59 Colunas Exatas (CASUAL081, HALOWEN, ANA, CBT, COPOS, FACAS, LENÇO, TUBENECK)
   - Sankhya Padrão Ouro: 45 Colunas Exatas + Conversor Direto Bling -> Sankhya
   - Pesos e Medidas oficiais da PLANILHA ALTURA E PESO.xlsx
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  window.HUB = window.HUB || {};

  // ═══════════════════════════════════════════════════════════════════════════
  //  1. CABEÇALHOS OFICIAIS (59 COLUNAS BLING / 45 COLUNAS SANKHYA)
  // ═══════════════════════════════════════════════════════════════════════════

  const BLING_HEADERS_59 = [
    'ID', 'Código', 'Descrição', 'Unidade', 'NCM', 'Origem', 'Preço',
    'Valor IPI fixo', 'Observações', 'Situação', 'Estoque', 'Preço de custo',
    'Cód. no fornecedor', 'Fornecedor', 'Localização', 'Estoque máximo',
    'Estoque mínimo', 'Peso líquido (Kg)', 'Peso bruto (Kg)', 'GTIN/EAN',
    'GTIN/EAN da Embalagem', 'Largura do produto', 'Altura do Produto',
    'Profundidade do produto', 'Data Validade',
    'Descrição do Produto no Fornecedor', 'Descrição Complementar',
    'Itens p/ caixa', 'Produto Variação', 'Tipo Produção',
    'Classe de enquadramento do IPI', 'Código na Lista de Serviços',
    'Tipo do item', 'Grupo de Tags/Tags', 'Tributos', 'Código Pai',
    'Código Integração', 'Grupo de produtos', 'Marca', 'CEST', 'Volumes',
    'Descrição Curta', 'Cross-Docking', 'URL Imagens Externas',
    'Link Externo', 'Meses Garantia no Fornecedor', 'Clonar dados do pai',
    'Condição do Produto', 'Frete Grátis', 'Número FCI', 'Vídeo',
    'Departamento', 'Unidade de Medida', 'Preço de Compra',
    'Valor base ICMS ST para retenção', 'Valor ICMS ST para retenção',
    'Valor ICMS próprio do substituto', 'Categoria do produto',
    'Informações Adicionais',
  ];

  const SANKHYA_HEADERS_45 = [
    'AD_IDEXTERNO', 'CODGRUPOPROD', 'CODVOL', 'DESCRPROD', 'TEMIPICOMPRA',
    'TEMIPIVENDA', 'UNIDADE', 'USACODBARRASQTD', 'USOPROD', 'MARCA', 'NCM',
    'REFERENCIA', 'REFFORN', 'CODPROD', 'PESOBRUTO', 'PESOLIQ', 'TEMICMS',
    'AD_IDEXTERNO2', 'ALTURA', 'AD_TAMTECIDO', 'CODVOLCOMPRA', 'CSTIPIENT',
    'CSTIPISAI', 'LARGURA', 'ORIGPROD', 'DECVLR', 'DECQTD', 'AD_CATEGORIAPRO',
    'AD_TAMANHO', 'CODMARCA', 'ESPESSURA', 'ATIVO', 'DESCMAX', 'GRUPOPIS',
    'GRUPOCOFINS', 'GRUPOCSSL', 'TIPGTINNFE', 'CALCDIFAL', 'TEMCOMISSAO',
    'DIMENSOES', 'TIPLANCNOTA', 'LOCAL', 'USALOCAL', 'CODLOCALPADRAO',
    'ENDIMAGEM',
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  //  2. CATÁLOGO DE PRODUTOS E REGRAS DOS MOLDES (PLANILHAS EXEMPLOS)
  // ═══════════════════════════════════════════════════════════════════════════

  const SHIRT_SIZES_FULL = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2'];
  const CBT_SIZES = ['P', 'M', 'G', 'GG', 'G1'];
  const APC_SIZES = ['P', 'M', 'G', 'GG', 'G1', 'G2'];
  const ALL_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2', 'G3'];

  const PRODUCT_SPECS = {
    'Camisa UV': {
      label: '👕 Camisa UV / Pesca / Agro (C0, BP, CLML)',
      isUnique: false,
      defaultSizes: SHIRT_SIZES_FULL,
      defaultPrice: '159,9',
      defaultCost: '55',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '12',
      sankhyaGrupo: { Masculino: '20101', Feminino: '20501', Infantil: '20601' },
      weightTable: 'master',
    },
    'FusionX': {
      label: '🔥 Camisa FusionX (FUSION)',
      isUnique: false,
      defaultSizes: SHIRT_SIZES_FULL,
      defaultPrice: '199,9',
      defaultCost: '0',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '0',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'fusion_halowen',
    },
    'Capuz': {
      label: '🧥 Camisa com Capuz (CCP / CCPBR)',
      isUnique: false,
      defaultSizes: ['P', 'M', 'G', 'GG', 'G1', 'G2'],
      defaultPrice: '169,9',
      defaultCost: '55',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: '',
      garantia: '12',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'capuz',
    },
    'Casual': {
      label: '👕 Camiseta Casual (CASUAL / CADV)',
      isUnique: false,
      defaultSizes: SHIRT_SIZES_FULL,
      defaultPrice: '99,9',
      defaultCost: '55',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '0',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'casual',
    },
    'Motociclismo': {
      label: '🏍️ Camisa Motociclismo (ADV)',
      isUnique: false,
      defaultSizes: SHIRT_SIZES_FULL,
      defaultPrice: '159,9',
      defaultCost: '55',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: '',
      garantia: '12',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'master',
    },
    'Camisa de Botão': {
      label: '👔 Camisa de Botão Texas (CBT)',
      isUnique: false,
      defaultSizes: CBT_SIZES,
      defaultPrice: '289,9',
      defaultCost: '55',
      largura: '10', altura: '11', profundidade: '16',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: 'CAMISA DE BOTÃO',
      descrCurta: '',
      garantia: '0',
      isCBT: true,
      sankhyaGrupo: { Masculino: '13307', Feminino: '13307', Infantil: '13307' },
      weightTable: 'fixed_025',
    },
    'ArmorX': {
      label: '🧤 Camisa ArmorX com Luva (CAX)',
      isUnique: false,
      defaultSizes: SHIRT_SIZES_FULL,
      defaultPrice: '179,9',
      defaultCost: '55',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '0',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'fusion',
    },
    'Hybrid': {
      label: '🧥 Camisa Hybrid (HYB)',
      isUnique: false,
      defaultSizes: ['P', 'M', 'G', 'GG', 'G1', 'G2'],
      defaultPrice: '189,9',
      defaultCost: '55',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '0',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'hybrid',
    },
    'Raglan': {
      label: '👕 Camisa Raglan (RAGLAN)',
      isUnique: false,
      defaultSizes: SHIRT_SIZES_FULL,
      defaultPrice: '119,9',
      defaultCost: '35',
      largura: '22', altura: '4', profundidade: '30',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '0',
      sankhyaGrupo: { Masculino: '20113', Feminino: '20513', Infantil: '20613' },
      weightTable: 'master',
    },
    'Corta-Vento': {
      label: '🌬️ Corta-Vento (CV)',
      isUnique: false,
      defaultSizes: ['P', 'M', 'G', 'GG', 'G1', 'G2'],
      defaultPrice: '249,9',
      defaultCost: '65',
      largura: '26', altura: '3', profundidade: '36',
      ncmMasc: '6101.30.00', ncmFem: '6102.30.00', ncmInf: '6101.30.00',
      cest: '28.038.00',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      garantia: '0',
      sankhyaGrupo: { Masculino: '20409', Feminino: '20409', Infantil: '20409' },
      weightTable: 'fixed_025',
    },
    // ─── PRODUTOS DE TAMANHO ÚNICO (1 LINHA POR CÓDIGO, SEM PAI/FILHO) ───
    'Tubeneck': {
      label: '🧣 Bandana Tubeneck (T566) — Tamanho Único',
      isUnique: true,
      defaultSizes: ['ÚNICO'],
      defaultPrice: '34,9',
      defaultCost: '35',
      estoqueUnico: '1.000,00',
      pesoLiq: '0,2', pesoBruto: '0,2',
      largura: '8', altura: '1', profundidade: '13',
      ncmMasc: '6214.30.00',
      cest: '28.038.00',
      produtoVariacaoUnico: 'Produto',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: '',
      itensCaixa: '1',
      sankhyaGrupo: { Masculino: '20204' },
    },
    'Lenço': {
      label: '🧶 Lenço com Proteção UV50 (LEN) — Tamanho Único',
      isUnique: true,
      defaultSizes: ['ÚNICO'],
      defaultPrice: '34,9',
      defaultCost: '55',
      estoqueUnico: '1000',
      pesoLiq: '0,25', pesoBruto: '0,25',
      largura: '8', altura: '1', profundidade: '13',
      ncmMasc: '6214.30.00',
      cest: '28.038.00',
      produtoVariacaoUnico: 'Variação',
      tipoProducao: 'Própria',
      tipoItem: 'Produto Acabado',
      grupoProdutos: '',
      descrCurta: '',
      itensCaixa: '1',
      sankhyaGrupo: { Masculino: '20412' },
    },
    'Copo Térmico': {
      label: '🥤 Copo Térmico (CPT) — Tamanho Único',
      isUnique: true,
      defaultSizes: ['ÚNICO'],
      defaultPrice: '99,9',
      defaultCost: '0',
      estoqueUnico: '0',
      pesoLiq: '0,25', pesoBruto: '0,2',
      largura: '10', altura: '15', profundidade: '10',
      ncmMasc: '9617.00.10',
      cest: '',
      volumesUnico: '0',
      produtoVariacaoUnico: 'Variação',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      itensCaixa: '0',
      sankhyaGrupo: { Masculino: '13700' },
    },
    'Faca e Bainha': {
      label: '🔪 Faca e Bainha (FACA) — Tamanho Único',
      isUnique: true,
      defaultSizes: ['ÚNICO'],
      defaultPrice: '0',
      defaultCost: '0',
      estoqueUnico: '0',
      pesoLiq: '0,3', pesoBruto: '0,35',
      largura: '5', altura: '5', profundidade: '32',
      ncmMasc: '8211.93.20',
      cest: '28.038.00',
      produtoVariacaoUnico: '',
      tipoProducao: 'Terceiros',
      tipoItem: 'Mercadoria para Revenda',
      grupoProdutos: '',
      descrCurta: 'A',
      itensCaixa: '1',
      sankhyaGrupo: { Masculino: '13700' },
    },
  };

  // Tabela oficial da PLANILHA ALTURA E PESO.xlsx + HALOWEN.csv
  const WEIGHTS_BY_TABLE = {
    master: {
      Masculino: { PP: '0,225', P: '0,225', M: '0,235', G: '0,240', GG: '0,245', G1: '0,250', G2: '0,270' },
      Feminino:  { PP: '0,160', P: '0,160', M: '0,170', G: '0,180', GG: '0,195', G1: '0,215', G2: '0,220' },
      Infantil:  { PP: '0,110', P: '0,110', M: '0,116', G: '0,108', GG: '0,130', G1: '0,135', G2: '0,150' },
    },
    fusion_halowen: {
      // Conforme HALOWEN.csv (Masc = 0,25 fixo, Fem = PP 0,25, P 0,16, M 0,17, G 0,18, GG 0,195, G1 0,215, G2 0,22)
      Masculino: { PP: '0,25', P: '0,25', M: '0,25', G: '0,25', GG: '0,25', G1: '0,25', G2: '0,25' },
      Feminino:  { PP: '0,25', P: '0,16', M: '0,17', G: '0,18', GG: '0,195', G1: '0,215', G2: '0,22' },
      Infantil:  { PP: '0,11', P: '0,11', M: '0,116', G: '0,108', GG: '0,13', G1: '0,135', G2: '0,15' },
    },
    fusion: {
      Masculino: { PP: '0,280', P: '0,280', M: '0,305', G: '0,320', GG: '0,330', G1: '0,340', G2: '0,360' },
      Feminino:  { PP: '0,160', P: '0,160', M: '0,170', G: '0,180', GG: '0,195', G1: '0,215', G2: '0,220' },
      Infantil:  { PP: '0,110', P: '0,110', M: '0,116', G: '0,108', GG: '0,130', G1: '0,135', G2: '0,150' },
    },
    capuz: {
      Masculino: { PP: '0,230', P: '0,230', M: '0,245', G: '0,265', GG: '0,275', G1: '0,290', G2: '0,310' },
      Feminino:  { PP: '0,160', P: '0,160', M: '0,170', G: '0,180', GG: '0,195', G1: '0,215', G2: '0,220' },
      Infantil:  { PP: '0,110', P: '0,110', M: '0,116', G: '0,108', GG: '0,130', G1: '0,135', G2: '0,150' },
    },
    hybrid: {
      Masculino: { PP: '0,250', P: '0,250', M: '0,275', G: '0,285', GG: '0,305', G1: '0,330', G2: '0,345' },
      Feminino:  { PP: '0,235', P: '0,235', M: '0,270', G: '0,280', GG: '0,315', G1: '0,320', G2: '0,350' },
      Infantil:  { PP: '0,110', P: '0,110', M: '0,116', G: '0,108', GG: '0,130', G1: '0,135', G2: '0,150' },
    },
    casual: {
      Masculino: { PP: '0,250', P: '0,250', M: '0,250', G: '0,250', GG: '0,250', G1: '0,250', G2: '0,250' },
      Feminino:  { PP: '0,250', P: '0,250', M: '0,250', G: '0,250', GG: '0,250', G1: '0,250', G2: '0,250' },
      Infantil:  { PP: '0,250', P: '0,250', M: '0,250', G: '0,250', GG: '0,250', G1: '0,250', G2: '0,250' },
    },
    fixed_025: {
      Masculino: { PP: '0,25', P: '0,25', M: '0,25', G: '0,25', GG: '0,25', G1: '0,25', G2: '0,25' },
      Feminino:  { PP: '0,25', P: '0,25', M: '0,25', G: '0,25', GG: '0,25', G1: '0,25', G2: '0,25' },
      Infantil:  { PP: '0,25', P: '0,25', M: '0,25', G: '0,25', GG: '0,25', G1: '0,25', G2: '0,25' },
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  3. ESTADO DO FORMULÁRIO
  // ═══════════════════════════════════════════════════════════════════════════

  let formState = {
    erp: 'Bling',
    tipoProduto: 'Casual',
    codigoBase: 'CASUAL081',
    nomeProduto: 'São Francisco de Assis Laranja',
    marca: 'Brk',
    preco: '99,9',
    precoCusto: '55',
    modoPeso: 'molde_bling', // 'molde_bling' (0,250 / HALOWEN) ou 'tabela_sankhya' (PLANILHA ALTURA E PESO.xlsx)
    generos: ['Masculino', 'Feminino', 'Infantil'],
    tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2'],
    eans: '',
    urlsMasculino: '',
    urlsFeminino: '',
    urlsInfantil: '',
    step: 1,
  };

  function getSpec() {
    return PRODUCT_SPECS[formState.tipoProduto] || PRODUCT_SPECS['Camisa UV'];
  }

  function skuCount() {
    const spec = getSpec();
    const bases = parseBaseCodes(formState.codigoBase);
    const numBases = Math.max(1, bases.length);
    if (spec.isUnique) return numBases;
    return numBases * formState.generos.length * formState.tamanhos.length;
  }

  function parseBaseCodes(raw) {
    return String(raw || '')
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function parseEans(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(s => s.trim().replace(/^"|\t|"$|/g, '').trim())
      .filter(Boolean);
  }

  function normalizePipes(urlText) {
    return String(urlText || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean)
      .join('|');
  }

  /**
   * Monta o Título Oficial da linha PAI conforme o gênero e o tipo de produto,
   * seguindo 100% os exemplos de PLANILHAS EXEMPLOS.
   */
  function buildOfficialTitle(baseName, genero, tipoProduto, marca) {
    const raw = String(baseName || '').trim();
    if (!raw) return '';

    const gInsert = genero === 'Feminino' ? ' Feminina' : genero === 'Infantil' ? ' Infantil' : '';
    const lower = raw.toLowerCase();
    const hasUV = lower.includes('uv50') || lower.includes('proteção uv');

    // Se o usuário já digitou o título completo (ex: "Camiseta Brk São Francisco...")
    if (lower.startsWith('camisa') || lower.startsWith('camiseta') || lower.startsWith('bandana') || lower.startsWith('lenço') || lower.startsWith('copo') || lower.startsWith('faca')) {
      if (genero === 'Feminino' && !lower.includes('feminina')) {
        return raw.replace(/^(Camiseta|Camisa(?:\s+de\s+Botão|\s+FusionX|\s+ArmorX)?)/i, '$1 Feminina');
      }
      if (genero === 'Infantil' && !lower.includes('infantil')) {
        return raw.replace(/^(Camiseta|Camisa(?:\s+de\s+Botão|\s+FusionX|\s+ArmorX)?)/i, '$1 Infantil');
      }
      return raw;
    }

    const uvTail = hasUV ? '' : ' com Proteção UV50+';

    switch (tipoProduto) {
      case 'Casual':
        return `Camiseta${gInsert} Brk ${raw}${uvTail}`;
      case 'FusionX':
        return `Camisa FusionX${gInsert} ${raw}${uvTail}`;
      case 'Camisa de Botão':
        return `Camisa de Botão${gInsert} Brk ${raw}`;
      case 'Capuz':
        return `Camisa de Pesca com Capuz${gInsert} Brk ${raw}${uvTail}`;
      case 'Motociclismo':
        return `Camisa de Motociclismo${gInsert} Brk ${raw}${uvTail}`;
      case 'ArmorX':
        return `Camisa ArmorX${gInsert} Brk ${raw}${hasUV ? '' : ' com Luva e Proteção UV50+'}`;
      case 'Hybrid':
        return `Camisa Hybrid${gInsert} Brk ${raw}${uvTail}`;
      case 'Tubeneck':
        return `Bandana Tubeneck Brk ${raw}${uvTail}`;
      case 'Lenço':
        return `Lenço com Proteção UV50 Brk ${raw}`;
      case 'Copo Térmico':
        return `Copo Térmico ${raw} BRK`;
      case 'Faca e Bainha':
        return `Faca Brk ${raw}`;
      default: {
        const mLower = String(marca || '').toLowerCase();
        if (mLower.includes('agro')) return `Camisa Agro${gInsert} Brk ${raw}${uvTail}`;
        if (mLower.includes('motor')) return `Camisa de Motociclismo${gInsert} Brk ${raw}${uvTail}`;
        return `Camisa de Pesca${gInsert} Brk ${raw}${uvTail}`;
      }
    }
  }

  function getWeightForRow(tipoProduto, genero, size, isParent) {
    const spec = PRODUCT_SPECS[tipoProduto] || PRODUCT_SPECS['Camisa UV'];
    if (spec.isUnique) {
      return { liq: spec.pesoLiq || '0,25', bruto: spec.pesoBruto || '0,25' };
    }
    if (isParent) {
      const wPai = tipoProduto === 'Casual' ? '0,250' : '0,25';
      return { liq: wPai, bruto: wPai };
    }
    if (formState.modoPeso === 'tabela_sankhya') {
      const tbl = WEIGHTS_BY_TABLE[spec.weightTable] || WEIGHTS_BY_TABLE.master;
      const w = (tbl[genero] && tbl[genero][size]) || '0,250';
      return { liq: w, bruto: w };
    }
    // Modo Molde Bling (fiel a CASUAL081.CSV e HALOWEN.csv)
    if (tipoProduto === 'FusionX' && genero === 'Feminino') {
      const wf = WEIGHTS_BY_TABLE.fusion_halowen.Feminino[size] || '0,25';
      return { liq: wf, bruto: wf };
    }
    const wDefault = tipoProduto === 'Casual' ? '0,250' : '0,25';
    return { liq: wDefault, bruto: wDefault };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  4. GERAÇÃO DAS 59 COLUNAS EXATAS DO BLING (MOLDE PLANILHAS EXEMPLOS)
  // ═══════════════════════════════════════════════════════════════════════════

  function generateBlingRows59() {
    const rows = [];
    const spec = getSpec();
    const eans = parseEans(formState.eans);
    let eanIdx = 0;

    const preco = String(formState.preco || spec.defaultPrice || '0').trim();
    const custo = String(formState.precoCusto ?? spec.defaultCost ?? '55').trim();
    const marca = String(formState.marca || 'Brk').trim();

    // Suporta múltiplos códigos base (ex: "T566: Verde Oliva \n T567: Bege Areia" ou "CASUAL081")
    const rawEntries = String(formState.codigoBase || 'PROD001')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    const entries = rawEntries.length > 0 ? rawEntries : ['PROD001'];

    for (const entry of entries) {
      // Permite "CODIGO | Nome da Estampa" por linha quando em lote
      let baseCode = entry;
      let customEstampa = formState.nomeProduto;
      if (entry.includes('|') || entry.includes(';')) {
        const parts = entry.split(/[|;]/);
        baseCode = parts[0].trim();
        if (parts[1] && parts[1].trim()) customEstampa = parts[1].trim();
      }

      if (spec.isUnique) {
        const ean = eans[eanIdx++] || '';
        const cols = new Array(59).fill('');
        const titulo = buildOfficialTitle(customEstampa, 'Masculino', formState.tipoProduto, marca);
        const urls = normalizePipes(formState.urlsMasculino);

        cols[0]  = '';                                    // ID
        cols[1]  = baseCode;                              // Código
        cols[2]  = titulo;                                // Descrição
        cols[3]  = 'UN';                                  // Unidade
        cols[4]  = spec.ncmMasc || '6214.30.00';          // NCM
        cols[5]  = '0';                                   // Origem
        cols[6]  = preco;                                 // Preço
        cols[7]  = '0';                                   // Valor IPI fixo
        cols[9]  = 'Ativo';                               // Situação
        cols[10] = spec.estoqueUnico || '1.000,00';       // Estoque
        cols[11] = custo;                                 // Preço de custo
        cols[15] = '0';                                   // Estoque máximo
        cols[16] = '0';                                   // Estoque mínimo
        cols[17] = spec.pesoLiq || '0,25';                // Peso líquido (Kg)
        cols[18] = spec.pesoBruto || '0,25';              // Peso bruto (Kg)
        cols[19] = ean;                                   // GTIN/EAN
        cols[20] = ean;                                   // GTIN/EAN da Embalagem
        cols[21] = spec.largura || '8';                   // Largura do produto
        cols[22] = spec.altura || '1';                    // Altura do Produto
        cols[23] = spec.profundidade || '13';             // Profundidade do produto
        cols[27] = spec.itensCaixa ?? '1';                // Itens p/ caixa
        cols[28] = spec.produtoVariacaoUnico ?? 'Produto';// Produto Variação
        cols[29] = spec.tipoProducao || 'Terceiros';      // Tipo Produção
        cols[32] = spec.tipoItem || 'Mercadoria para Revenda'; // Tipo do item
        cols[34] = '0';                                   // Tributos
        cols[35] = '';                                    // Código Pai
        cols[36] = '0';                                   // Código Integração
        cols[37] = spec.grupoProdutos || '';              // Grupo de produtos
        cols[38] = marca;                                 // Marca
        cols[39] = spec.cest ?? '28.038.00';              // CEST
        cols[40] = spec.volumesUnico ?? '1';              // Volumes
        cols[41] = spec.descrCurta ?? '';                 // Descrição Curta
        cols[42] = '0';                                   // Cross-Docking
        cols[43] = urls;                                  // URL Imagens Externas
        cols[45] = '0';                                   // Meses Garantia no Fornecedor
        cols[46] = 'NÃO';                                 // Clonar dados do pai
        cols[47] = 'NOVO';                                // Condição do Produto
        cols[48] = 'NÃO';                                 // Frete Grátis
        cols[52] = 'Centímetro';                          // Unidade de Medida
        cols[53] = '0';                                   // Preço de Compra
        cols[54] = '0';                                   // Valor base ICMS ST
        cols[55] = '0';                                   // Valor ICMS ST
        cols[56] = '0';                                   // Valor ICMS próprio
        rows.push(cols);
        continue;
      }

      // ─── PRODUTOS COM VARIAÇÃO: CADA GÊNERO TEM SEU PRÓPRIO PAI + FILHOS (SEM HÍFEN) ───
      const genderSuffixMap = { Masculino: '', Feminino: 'BL', Infantil: 'I' };
      const urlsByGender = {
        Masculino: normalizePipes(formState.urlsMasculino),
        Feminino:  normalizePipes(formState.urlsFeminino || formState.urlsMasculino),
        Infantil:  normalizePipes(formState.urlsInfantil || formState.urlsMasculino),
      };

      for (const genero of formState.generos) {
        const gSuffix = genderSuffixMap[genero] || '';
        // Evita duplicar BL ou I se o usuário já digitou no código base
        const parentCode = (gSuffix && baseCode.toUpperCase().endsWith(gSuffix))
          ? baseCode
          : `${baseCode}${gSuffix}`;

        const ncm = genero === 'Feminino'
          ? (spec.ncmFem || '6102.30.00')
          : genero === 'Infantil'
          ? (spec.ncmInf || '6101.30.00')
          : (spec.ncmMasc || '6101.30.00');

        const urls = urlsByGender[genero] || '';
        const tituloPai = buildOfficialTitle(customEstampa, genero, formState.tipoProduto, marca);
        const wPai = getWeightForRow(formState.tipoProduto, genero, 'P', true);

        // 1) LINHA PAI DO GÊNERO (Ex: CASUAL081, CASUAL081BL, CASUAL081I)
        const parentCols = new Array(59).fill('');
        parentCols[1]  = parentCode;                      // Código
        parentCols[2]  = tituloPai;                       // Descrição
        parentCols[3]  = 'UN';                            // Unidade
        parentCols[4]  = ncm;                             // NCM
        parentCols[5]  = '0';                             // Origem
        parentCols[6]  = preco;                           // Preço
        parentCols[7]  = '0';                             // Valor IPI fixo
        parentCols[9]  = 'Ativo';                         // Situação
        parentCols[10] = '0';                             // Estoque PAI = 0 (conforme CASUAL081.CSV e HALOWEN.csv)
        parentCols[11] = custo;                           // Preço de custo
        parentCols[15] = '0';                             // Estoque máximo
        parentCols[16] = '0';                             // Estoque mínimo
        parentCols[17] = wPai.liq;                        // Peso líquido (Kg)
        parentCols[18] = wPai.bruto;                      // Peso bruto (Kg)
        parentCols[19] = '';                              // GTIN/EAN (vazio no PAI)
        parentCols[20] = '';                              // GTIN/EAN da Embalagem (vazio no PAI)
        parentCols[21] = spec.largura || '22';            // Largura do produto
        parentCols[22] = spec.altura || '4';              // Altura do Produto
        parentCols[23] = spec.profundidade || '30';       // Profundidade do produto
        parentCols[27] = '1';                             // Itens p/ caixa
        parentCols[28] = 'Produto';                       // Produto Variação = Produto
        parentCols[29] = spec.tipoProducao || 'Terceiros';// Tipo Produção
        parentCols[32] = spec.tipoItem || 'Mercadoria para Revenda'; // Tipo do item
        parentCols[34] = '0';                             // Tributos
        parentCols[35] = '';                              // Código Pai (vazio no PAI)
        parentCols[36] = '0';                             // Código Integração
        parentCols[37] = spec.grupoProdutos || '';        // Grupo de produtos
        parentCols[38] = marca;                           // Marca
        parentCols[39] = spec.cest || '28.038.00';        // CEST
        parentCols[40] = '1';                             // Volumes
        parentCols[41] = spec.descrCurta ?? 'A';          // Descrição Curta
        parentCols[42] = '0';                             // Cross-Docking
        parentCols[43] = urls;                            // URL Imagens Externas
        parentCols[45] = spec.garantia || '0';            // Meses Garantia no Fornecedor
        parentCols[46] = 'NÃO';                           // Clonar dados do pai
        parentCols[47] = 'NOVO';                          // Condição do Produto
        parentCols[48] = 'NÃO';                           // Frete Grátis
        parentCols[52] = 'Centímetro';                    // Unidade de Medida
        parentCols[53] = '0';                             // Preço de Compra
        parentCols[54] = '0';                             // Valor base ICMS ST
        parentCols[55] = '0';                             // Valor ICMS ST
        parentCols[56] = '0';                             // Valor ICMS próprio
        rows.push(parentCols);

        // 2) LINHAS FILHAS (VARIAÇÕES POR TAMANHO — SEM HÍFEN: CASUAL081PP, CASUAL081BLPP...)
        for (const tam of formState.tamanhos) {
          const sizeClean = tam === 'ÚNICO' ? '' : tam;
          const childCode = `${parentCode}${sizeClean}`;
          const ean = eans[eanIdx++] || '';
          const wChild = getWeightForRow(formState.tipoProduto, genero, tam, false);

          // Em Camisa de Botão (CBT FEMININA E INFANTIL.csv): "Gênero:Feminino;Tamanho:P"
          const descFilho = spec.isCBT
            ? `Gênero:${genero};Tamanho:${tam}`
            : `Tamanho:${tam}`;

          const childCols = new Array(59).fill('');
          childCols[1]  = childCode;                      // Código
          childCols[2]  = descFilho;                      // Descrição
          childCols[3]  = 'UN';                           // Unidade
          childCols[4]  = ncm;                            // NCM
          childCols[5]  = '0';                            // Origem
          childCols[6]  = preco;                          // Preço
          childCols[7]  = '0';                            // Valor IPI fixo
          childCols[9]  = 'Ativo';                        // Situação
          childCols[10] = spec.isCBT ? '0' : '1000';      // Estoque (1000 padrão, 0 em CBT revenda)
          childCols[11] = custo;                          // Preço de custo
          childCols[15] = '0';                            // Estoque máximo
          childCols[16] = '0';                            // Estoque mínimo
          childCols[17] = wChild.liq;                     // Peso líquido (Kg)
          childCols[18] = wChild.bruto;                   // Peso bruto (Kg)
          childCols[19] = ean;                            // GTIN/EAN
          childCols[20] = ean;                            // GTIN/EAN da Embalagem
          childCols[21] = spec.largura || '22';           // Largura do produto
          childCols[22] = spec.altura || '4';             // Altura do Produto
          childCols[23] = spec.profundidade || '30';      // Profundidade do produto
          childCols[27] = '1';                            // Itens p/ caixa
          childCols[28] = spec.isCBT ? '' : 'Variação';   // Produto Variação
          childCols[29] = spec.tipoProducao || 'Terceiros'; // Tipo Produção
          childCols[32] = spec.tipoItem || 'Mercadoria para Revenda'; // Tipo do item
          childCols[34] = '0';                            // Tributos
          childCols[35] = parentCode;                     // Código Pai
          childCols[36] = '0';                            // Código Integração
          childCols[37] = spec.grupoProdutos || '';       // Grupo de produtos
          childCols[38] = marca;                          // Marca
          childCols[39] = spec.cest || '28.038.00';       // CEST
          childCols[40] = '1';                            // Volumes
          childCols[41] = spec.descrCurta ?? 'A';         // Descrição Curta
          childCols[42] = '0';                            // Cross-Docking
          childCols[43] = urls;                           // URL Imagens Externas
          childCols[45] = spec.garantia || '0';           // Meses Garantia no Fornecedor
          childCols[46] = 'NÃO';                          // Clonar dados do pai
          childCols[47] = 'NOVO';                         // Condição do Produto
          childCols[48] = 'NÃO';                          // Frete Grátis
          childCols[52] = 'Centímetro';                   // Unidade de Medida
          childCols[53] = '0';                            // Preço de Compra
          childCols[54] = '0';                            // Valor base ICMS ST
          childCols[55] = '0';                            // Valor ICMS ST
          childCols[56] = '0';                            // Valor ICMS próprio
          rows.push(childCols);
        }
      }
    }

    return rows;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  5. GERAÇÃO DAS 45 COLUNAS OFICIAIS DO SANKHYA (PADRÃO OURO)
  // ═══════════════════════════════════════════════════════════════════════════

  function cleanUpperAscii(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/RAGALN/gi, 'RAGLAN')
      .trim()
      .toUpperCase();
  }

  function resolveCodMarca(marca, descr) {
    const m = cleanUpperAscii(marca);
    const d = cleanUpperAscii(descr);
    if (m.includes('AGRO') || d.includes('AGRO')) return '48';
    if (m.includes('MOTOR') || d.includes('MOTOR')) return '19';
    return '10'; // Fishing / Default
  }

  /**
   * Converte qualquer tabela de 59 colunas do Bling para as 45 colunas Padrão Ouro do Sankhya.
   */
  function convertBling59ToSankhya45(blingRows) {
    const sankhyaRows = [];
    const spec = getSpec();

    // 1ª passagem: mapear os títulos e marcas dos PAIS
    const parentMap = {};
    const parentsWithChildren = new Set();

    for (const r of blingRows) {
      const sku = String(r[1] || '').trim();
      const pai = String(r[35] || '').trim();
      if (!sku) continue;
      if (!pai) {
        parentMap[cleanUpperAscii(sku)] = {
          titulo: String(r[2] || '').trim(),
          ncm: String(r[4] || '').replace(/\D/g, ''),
          marca: String(r[38] || '').trim(),
        };
      } else {
        parentsWithChildren.add(cleanUpperAscii(pai));
      }
    }

    // 2ª passagem: gerar apenas variações (filhos) e produtos únicos (descartando PAIS que têm filhos)
    for (const r of blingRows) {
      const rawSku = String(r[1] || '').trim();
      if (!rawSku) continue;
      const skuClean = cleanUpperAscii(rawSku);
      const rawPai = String(r[35] || '').trim();
      const paiClean = cleanUpperAscii(rawPai);

      // Descarta linha PAI pura
      if (!paiClean && parentsWithChildren.has(skuClean)) continue;

      const parentInfo = paiClean ? (parentMap[paiClean] || {}) : {};
      const rawDesc = String(r[2] || '').trim();

      // Extrai tamanho
      let tamanho = '';
      const mTam = rawDesc.match(/Tamanho\s*:\s*([A-Za-z0-9]+)/i);
      if (mTam) {
        tamanho = cleanUpperAscii(mTam[1]);
      }

      const baseTitle = paiClean
        ? cleanUpperAscii(parentInfo.titulo || rawDesc)
        : cleanUpperAscii(rawDesc);

      const descrProd = tamanho
        ? `${skuClean} - ${baseTitle} - TAMANHO:${tamanho}`
        : `${skuClean} - ${baseTitle}`;

      // Determina gênero para grupo e medidas do Sankhya
      let genero = 'Masculino';
      if (descrProd.includes('FEMININ') || skuClean.includes('BL')) genero = 'Feminino';
      else if (descrProd.includes('INFANTIL') || (paiClean && paiClean.endsWith('I'))) genero = 'Infantil';

      // Grupo de produto Sankhya
      let codGrupo = (spec.sankhyaGrupo && spec.sankhyaGrupo[genero]) || '20101';
      if (skuClean.startsWith('C0')) {
        codGrupo = genero === 'Feminino' ? '20501' : genero === 'Infantil' ? '20601' : '20101';
      } else if (skuClean.startsWith('CBT')) {
        codGrupo = '13307';
      }

      const isRevenda = !codGrupo.startsWith('2') && !codGrupo.startsWith('02') && !codGrupo.startsWith('12');
      const usoProd = isRevenda ? 'R' : 'V';
      const cstIpiEnt = codGrupo === '20412' ? '99' : (isRevenda ? '-1' : '49');
      const catPro = codGrupo === '20412' ? '11' : (isRevenda ? '2' : '1');
      const codLocal = isRevenda ? '1010000' : '1040000';
      const espessura = codGrupo === '20412' ? '' : '30';

      // Peso e altura da PLANILHA ALTURA E PESO.xlsx para o Sankhya (com ponto decimal)
      const tbl = WEIGHTS_BY_TABLE[spec.weightTable] || WEIGHTS_BY_TABLE.master;
      const wStr = (tamanho && tbl[genero] && tbl[genero][tamanho])
        ? tbl[genero][tamanho]
        : String(r[18] || '0,27');
      const pesoDot = (parseFloat(wStr.replace(',', '.')) || 0.27).toFixed(2);

      let alturaSankhya = String(r[22] || '3').replace(/\D/g, '') || '3';
      let larguraSankhya = String(r[21] || '20').replace(/\D/g, '') || '20';
      if (!spec.isUnique && tamanho) {
        larguraSankhya = '20';
        alturaSankhya = genero === 'Infantil' ? '2' : '3';
        if ((spec.weightTable === 'fusion' || spec.weightTable === 'fusion_halowen') && tamanho !== 'P' && tamanho !== 'PP') {
          alturaSankhya = '4';
        }
      }

      const marcaClean = cleanUpperAscii(r[38] || parentInfo.marca || formState.marca || 'BRK');
      const ncmDigits = String(r[4] || parentInfo.ncm || '61013000').replace(/\D/g, '');
      const eanClean = String(r[19] || '').replace(/\D/g, '');
      const codMarca = resolveCodMarca(marcaClean, descrProd);

      const sRow = new Array(45).fill('');
      sRow[0]  = '';                // 1. AD_IDEXTERNO
      sRow[1]  = codGrupo;          // 2. CODGRUPOPROD
      sRow[2]  = 'UN';              // 3. CODVOL
      sRow[3]  = descrProd;         // 4. DESCRPROD
      sRow[4]  = 'N';               // 5. TEMIPICOMPRA
      sRow[5]  = 'N';               // 6. TEMIPIVENDA
      sRow[6]  = 'CM';              // 7. UNIDADE
      sRow[7]  = 'N';               // 8. USACODBARRASQTD
      sRow[8]  = usoProd;           // 9. USOPROD
      sRow[9]  = marcaClean;        // 10. MARCA
      sRow[10] = ncmDigits;         // 11. NCM
      sRow[11] = eanClean;          // 12. REFERENCIA (EAN no Sankhya)
      sRow[12] = '';                // 13. REFFORN
      sRow[13] = '';                // 14. CODPROD
      sRow[14] = pesoDot;           // 15. PESOBRUTO
      sRow[15] = pesoDot;           // 16. PESOLIQ
      sRow[16] = 'S';               // 17. TEMICMS
      sRow[17] = rawSku;            // 18. AD_IDEXTERNO2 (SKU BRK)
      sRow[18] = alturaSankhya;     // 19. ALTURA
      sRow[19] = tamanho;           // 20. AD_TAMTECIDO
      sRow[20] = 'UN';              // 21. CODVOLCOMPRA
      sRow[21] = cstIpiEnt;         // 22. CSTIPIENT
      sRow[22] = '-1';              // 23. CSTIPISAI
      sRow[23] = larguraSankhya;    // 24. LARGURA
      sRow[24] = '0';               // 25. ORIGPROD
      sRow[25] = '2';               // 26. DECVLR
      sRow[26] = '2';               // 27. DECQTD
      sRow[27] = catPro;            // 28. AD_CATEGORIAPRO
      sRow[28] = tamanho;           // 29. AD_TAMANHO
      sRow[29] = codMarca;          // 30. CODMARCA
      sRow[30] = espessura;         // 31. ESPESSURA
      sRow[31] = 'S';               // 32. ATIVO
      sRow[32] = '100';             // 33. DESCMAX
      sRow[33] = 'TODOS';           // 34. GRUPOPIS
      sRow[34] = 'TODOS';           // 35. GRUPOCOFINS
      sRow[35] = 'TODOS';           // 36. GRUPOCSSL
      sRow[36] = '0';               // 37. TIPGTINNFE
      sRow[37] = 'S';               // 38. CALCDIFAL
      sRow[38] = 'S';               // 39. TEMCOMISSAO
      sRow[39] = 'N';               // 40. DIMENSOES
      sRow[40] = '';                // 41. TIPLANCNOTA
      sRow[41] = 'S';               // 42. LOCAL
      sRow[42] = 'S';               // 43. USALOCAL
      sRow[43] = codLocal;          // 44. CODLOCALPADRAO
      sRow[44] = '';                // 45. ENDIMAGEM

      sankhyaRows.push(sRow);
    }

    return sankhyaRows;
  }

  function generateData(targetErp) {
    const erp = targetErp || formState.erp;
    const blingRows = generateBlingRows59();
    if (erp === 'Bling') return blingRows;
    return convertBling59ToSankhya45(blingRows);
  }

  function buildCsvString(targetErp) {
    const erp = targetErp || formState.erp;
    const headers = erp === 'Bling' ? BLING_HEADERS_59 : SANKHYA_HEADERS_45;
    const rows = generateData(erp);
    const sep = ';';

    const escapeCell = (val) => {
      const s = String(val ?? '');
      if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.join(sep)];
    for (const row of rows) {
      lines.push(row.map(escapeCell).join(sep));
    }
    return lines.join('\r\n');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  6. INTERFACE VISUAL LIMPA E ORGANIZADA (STEPPER + MOLDES OFICIAIS)
  // ═══════════════════════════════════════════════════════════════════════════

  function renderStepper() {
    const steps = [
      { n: 1, label: '1. Molde & Produto' },
      { n: 2, label: '2. Grade & Gêneros' },
      { n: 3, label: '3. EANs & Imagens' },
      { n: 4, label: '4. Planilha Pronta (59/45 Col)' },
    ];

    return steps.map((s, i) => {
      const cls = s.n === formState.step ? 'active' : s.n < formState.step ? 'completed' : '';
      const lineCls = i < steps.length - 1
        ? `<div class="stepper__line ${s.n < formState.step ? 'completed' : ''}"></div>`
        : '';
      return `
        <div class="stepper__step ${cls}" data-step="${s.n}" style="cursor:pointer">
          <div class="stepper__number">${s.n < formState.step ? '✓' : s.n}</div>
          <span class="stepper__label">${s.label}</span>
        </div>
        ${lineCls}
      `;
    }).join('');
  }

  function renderStep1() {
    const productOptions = Object.entries(PRODUCT_SPECS)
      .map(([key, val]) => `<option value="${key}" ${formState.tipoProduto === key ? 'selected' : ''}>${val.label}</option>`)
      .join('');

    return `
      <div class="step-panel active" id="step-1">
        <div class="card card--static" style="max-width:860px;margin:0 auto">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
            <div>
              <h3 class="card__title" style="margin:0">1. Configuração do Molde Oficial</h3>
              <p class="text-secondary text-sm" style="margin:4px 0 0">100% calibrado com as suas <b>PLANILHAS EXEMPLOS</b> (Bling 59 colunas + Sankhya 45 colunas).</p>
            </div>
            <div class="pill-toggle" id="erp-toggle">
              <span class="pill-toggle__option ${formState.erp === 'Bling' ? 'active' : ''}" data-erp="Bling">📦 Bling (59 Colunas)</span>
              <span class="pill-toggle__option ${formState.erp === 'Sankhya' ? 'active' : ''}" data-erp="Sankhya">🎣 Sankhya Ouro (45 Colunas)</span>
            </div>
          </div>

          <!-- Atalhos de Exemplos Reais (1 Clique) -->
          <div style="padding:12px 14px;border-radius:10px;background:rgba(170,255,0,0.05);border:1px solid rgba(170,255,0,0.18);margin-bottom:18px">
            <div style="font-size:11px;font-weight:700;color:#AAFF00;margin-bottom:8px;text-transform:uppercase">⚡ Carregar Molde de Exemplo com 1 Clique (PLANILHAS EXEMPLOS):</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn btn--secondary preset-btn" data-preset="casual081" style="font-size:11px;padding:5px 10px">👕 CASUAL081 (Masc/Fem/Inf)</button>
              <button type="button" class="btn btn--secondary preset-btn" data-preset="halowen" style="font-size:11px;padding:5px 10px">🔥 FUSION260 (Halloween)</button>
              <button type="button" class="btn btn--secondary preset-btn" data-preset="ana_agro" style="font-size:11px;padding:5px 10px">🌾 C01077 (Camisa Agro)</button>
              <button type="button" class="btn btn--secondary preset-btn" data-preset="cbt" style="font-size:11px;padding:5px 10px">👔 CBT01 (Camisa de Botão)</button>
              <button type="button" class="btn btn--secondary preset-btn" data-preset="tubeneck" style="font-size:11px;padding:5px 10px">🧣 T566 (Tubeneck Único)</button>
              <button type="button" class="btn btn--secondary preset-btn" data-preset="lenco" style="font-size:11px;padding:5px 10px">🧶 LEN025 (Lenço Único)</button>
              <button type="button" class="btn btn--secondary preset-btn" data-preset="copo" style="font-size:11px;padding:5px 10px">🥤 CPT050 (Copo Térmico)</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label" for="tipo-produto">Categoria / Molde de Produto</label>
              <select class="form-select" id="tipo-produto">${productOptions}</select>
            </div>

            <div class="form-group">
              <label class="form-label" for="marca">Marca Oficial</label>
              <select class="form-select" id="marca">
                ${['Brk', 'Brk Fishing', 'BRK FISHING', 'Brk Agro', 'BRK AGRO', 'Brk Motors']
                  .map(m => `<option value="${m}" ${formState.marca === m ? 'selected' : ''}>${m}</option>`)
                  .join('')}
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px">
            <div class="form-group">
              <label class="form-label" for="codigo-base">Código(s) Base</label>
              <textarea class="form-textarea" id="codigo-base" rows="2" placeholder="Ex: CASUAL081&#10;Ou vários (1 por linha)">${formState.codigoBase}</textarea>
              <small class="text-muted" style="font-size:11px">Gera automático <code>BASE</code>, <code>BASEBL</code> e <code>BASEI</code> + tamanhos sem hífen.</small>
            </div>

            <div class="form-group">
              <label class="form-label" for="nome-produto">Nome da Estampa / Descrição Base</label>
              <input class="form-input" id="nome-produto" type="text" placeholder="Ex: São Francisco de Assis Laranja" value="${window.HUB.esc(formState.nomeProduto)}">
              <small class="text-muted" style="font-size:11px">Preview título: <strong style="color:#AAFF00" id="title-live-preview">${window.HUB.esc(buildOfficialTitle(formState.nomeProduto, 'Masculino', formState.tipoProduto, formState.marca))}</strong></small>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
            <div class="form-group">
              <label class="form-label" for="preco">Preço de Venda (R$)</label>
              <input class="form-input" id="preco" type="text" placeholder="Ex: 99,9" value="${formState.preco}">
            </div>

            <div class="form-group">
              <label class="form-label" for="preco-custo">Preço de Custo (R$)</label>
              <input class="form-input" id="preco-custo" type="text" placeholder="Ex: 55" value="${formState.precoCusto}">
            </div>

            <div class="form-group">
              <label class="form-label" for="modo-peso">Regra de Pesos</label>
              <select class="form-select" id="modo-peso">
                <option value="molde_bling" ${formState.modoPeso === 'molde_bling' ? 'selected' : ''}>Padrão CSVs Bling (0,250 / Fem gradual)</option>
                <option value="tabela_sankhya" ${formState.modoPeso === 'tabela_sankhya' ? 'selected' : ''}>PLANILHA ALTURA E PESO.xlsx (Por tamanho)</option>
              </select>
            </div>
          </div>

          <div class="step-nav">
            <span></span>
            <button class="btn btn--primary" id="btn-next-1">Próximo: Grade & Gêneros →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep2() {
    const spec = getSpec();
    if (spec.isUnique) {
      return `
        <div class="step-panel active" id="step-2">
          <div class="card card--static" style="max-width:760px;margin:0 auto">
            <h3 class="card__title mb-2">2. Produto de Tamanho Único</h3>
            <p class="text-secondary text-sm mb-2">
              A categoria <strong>${spec.label}</strong> gera <strong>1 linha única por código</strong> (sem PAI/FILHO), com NCM <code>${spec.ncmMasc}</code> e medidas <code>${spec.largura}x${spec.altura}x${spec.profundidade} cm</code>.
            </p>
            <div class="sku-counter">
              <span class="sku-counter__value" id="sku-count">${skuCount()}</span>
              <span class="sku-counter__label">linha(s) única(s) serão geradas</span>
            </div>
            <div class="step-nav">
              <button class="btn btn--secondary" id="btn-prev-2">← Voltar</button>
              <button class="btn btn--primary" id="btn-next-2">Próximo: EANs & Imagens →</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="step-panel active" id="step-2">
        <div class="card card--static" style="max-width:760px;margin:0 auto">
          <h3 class="card__title mb-2">2. Gêneros & Grade de Tamanhos</h3>
          <p class="text-secondary text-sm mb-2">
            Cada gênero selecionado cria automaticamente sua linha <strong>PAI</strong> (<code>${formState.codigoBase}</code>, <code>${formState.codigoBase}BL</code>, <code>${formState.codigoBase}I</code>) seguida pelas variações sem hífen.
          </p>

          <div class="form-group">
            <label class="form-label">Gêneros (Geram blocos PAI + Filhos independentes)</label>
            <div class="checkbox-group" id="genero-group">
              ${['Masculino', 'Feminino', 'Infantil'].map(g => {
                const checked = formState.generos.includes(g);
                const suf = g === 'Feminino' ? ' (BL - NCM 6102.30.00)' : g === 'Infantil' ? ' (I - NCM 6101.30.00)' : ' (Base - NCM 6101.30.00)';
                return `
                  <label class="checkbox-pill ${checked ? 'checked' : ''}" data-value="${g}">
                    <input type="checkbox" ${checked ? 'checked' : ''}>
                    <span class="checkbox-pill__indicator"></span>
                    <span>${g}<small style="opacity:0.7">${suf}</small></span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Tamanhos das Variações</label>
            <div class="checkbox-group" id="tamanho-group">
              ${ALL_SIZES.map(sz => {
                const checked = formState.tamanhos.includes(sz);
                return `
                  <label class="checkbox-pill ${checked ? 'checked' : ''}" data-value="${sz}">
                    <input type="checkbox" ${checked ? 'checked' : ''}>
                    <span class="checkbox-pill__indicator"></span>
                    <span>${sz}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <div class="sku-counter">
            <span class="sku-counter__value" id="sku-count">${skuCount()}</span>
            <span class="sku-counter__label">variações com EAN (+ ${formState.generos.length * Math.max(1, parseBaseCodes(formState.codigoBase).length)} linha(s) PAI)</span>
          </div>

          <div class="step-nav">
            <button class="btn btn--secondary" id="btn-prev-2">← Voltar</button>
            <button class="btn btn--primary" id="btn-next-2">Próximo: EANs & Imagens →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderStep3() {
    const needed = skuCount();
    const eans = parseEans(formState.eans);
    const spec = getSpec();

    return `
      <div class="step-panel active" id="step-3">
        <div class="card card--static" style="max-width:860px;margin:0 auto">
          <h3 class="card__title mb-2">3. Códigos EAN & Links de Imagens</h3>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <!-- Coluna 1: EANs -->
            <div>
              <label class="form-label">
                GTIN / EAN (1 por linha) · Necessários: <strong style="color:#AAFF00">${needed}</strong>
              </label>
              <textarea class="form-textarea" id="ean-textarea" rows="10" placeholder="Cole os EANs aqui (opcional)...&#10;7891756998634&#10;7891757008097">${formState.eans}</textarea>
              <div id="ean-status" style="margin-top:8px">
                ${eans.length > 0 ? renderEanStatus(eans.length, needed) : '<small class="text-muted">As linhas PAI ficam sem EAN automaticamente, e cada variação recebe 1 EAN na ordem.</small>'}
              </div>
            </div>

            <!-- Coluna 2: URLs de Imagens -->
            <div>
              <label class="form-label">URL Imagens Externas (separadas por <code>|</code>)</label>
              ${(spec.isUnique || formState.generos.includes('Masculino')) ? `
              <div class="form-group">
                <label class="form-label" style="font-size:11px">${spec.isUnique ? 'Links do Produto' : 'Links Masculino (PAI + Filhos)'}</label>
                <textarea class="form-textarea" id="urls-masculino" rows="2" placeholder="https://.../1.jpg|https://.../2.jpg">${formState.urlsMasculino}</textarea>
              </div>` : ''}

              ${(!spec.isUnique && formState.generos.includes('Feminino')) ? `
              <div class="form-group">
                <label class="form-label" style="font-size:11px">Links Feminino BL (PAI + Filhos)</label>
                <textarea class="form-textarea" id="urls-feminino" rows="2" placeholder="https://.../fem1.jpg|https://.../fem2.jpg">${formState.urlsFeminino}</textarea>
              </div>` : ''}

              ${(!spec.isUnique && formState.generos.includes('Infantil')) ? `
              <div class="form-group">
                <label class="form-label" style="font-size:11px">Links Infantil I (PAI + Filhos)</label>
                <textarea class="form-textarea" id="urls-infantil" rows="2" placeholder="https://.../inf1.jpg|https://.../inf2.jpg">${formState.urlsInfantil}</textarea>
              </div>` : ''}
            </div>
          </div>

          <div class="step-nav">
            <button class="btn btn--secondary" id="btn-prev-3">← Voltar</button>
            <button class="btn btn--primary" id="btn-next-3">Ver Planilha Pronta →</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEanStatus(count, needed) {
    if (count === needed) {
      return `<div class="ean-status ean-status--ok">✅ ${count}/${needed} EANs — Quantidade exata!</div>`;
    }
    if (count < needed) {
      return `<div class="ean-status ean-status--error">⚠️ ${count}/${needed} EANs — Faltam ${needed - count}</div>`;
    }
    return `<div class="ean-status ean-status--error">⚠️ ${count}/${needed} EANs — ${count - needed} a mais</div>`;
  }

  function renderStep4() {
    const headers = formState.erp === 'Bling' ? BLING_HEADERS_59 : SANKHYA_HEADERS_45;
    const rows = generateData(formState.erp);

    return `
      <div class="step-panel active" id="step-4">
        <div class="card card--static">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
            <div>
              <h3 class="card__title" style="margin:0">4. Preview & Exportação Oficial</h3>
              <p class="text-secondary text-sm" style="margin:4px 0 0">
                Molde ativo: <strong style="color:#AAFF00">${formState.erp === 'Bling' ? 'Bling Oficial (59 Colunas)' : 'Sankhya Padrão Ouro (45 Colunas)'}</strong> · ${rows.length} linhas geradas
              </p>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn--secondary" id="btn-switch-preview-erp" style="font-size:12px">
                🔄 Alternar Preview para ${formState.erp === 'Bling' ? 'Sankhya (45 col)' : 'Bling (59 col)'}
              </button>
              <button class="btn btn--primary" id="btn-download-bling" style="background:#10b981;border-color:#10b981">
                ⬇️ Baixar CSV Bling (59 col)
              </button>
              <button class="btn btn--primary" id="btn-download-sankhya" style="background:#8b5cf6;border-color:#8b5cf6">
                ⬇️ Baixar CSV Sankhya Ouro (45 col)
              </button>
              <button class="btn btn--secondary" id="btn-copy-csv">
                📋 Copiar CSV Atual
              </button>
            </div>
          </div>

          <div class="table-wrapper" style="max-height:440px;overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:10px">
            <table class="table" style="font-size:12px">
              <thead>
                <tr>${headers.map(h => `<th style="white-space:nowrap">${window.HUB.esc(h)}</th>`).join('')}</tr>
              </thead>
              <tbody>
                ${rows.map(row => {
                  const isPai = formState.erp === 'Bling' && row[28] === 'Produto' && !row[35];
                  const rowStyle = isPai ? 'background:rgba(170,255,0,0.07);font-weight:600' : '';
                  return `<tr style="${rowStyle}">${row.map(cell => `<td style="white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis" title="${window.HUB.esc(cell ?? '')}">${window.HUB.esc(cell ?? '')}</td>`).join('')}</tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="step-nav" style="margin-top:16px">
            <button class="btn btn--secondary" id="btn-prev-4">← Voltar e Ajustar</button>
            <span></span>
          </div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  7. EVENTOS E PRESETS DOS EXEMPLOS
  // ═══════════════════════════════════════════════════════════════════════════

  function applyExamplePreset(preset) {
    if (preset === 'casual081') {
      Object.assign(formState, {
        tipoProduto: 'Casual',
        codigoBase: 'CASUAL081',
        nomeProduto: 'São Francisco de Assis Laranja',
        marca: 'Brk',
        preco: '99,9',
        precoCusto: '55',
        modoPeso: 'molde_bling',
        generos: ['Masculino', 'Feminino', 'Infantil'],
        tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2'],
      });
    } else if (preset === 'halowen') {
      Object.assign(formState, {
        tipoProduto: 'FusionX',
        codigoBase: 'FUSION260',
        nomeProduto: 'Fantasia de Esqueleto Branco',
        marca: 'BRK FISHING',
        preco: '199,9',
        precoCusto: '0',
        modoPeso: 'molde_bling',
        generos: ['Masculino', 'Feminino'],
        tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2'],
      });
    } else if (preset === 'ana_agro') {
      Object.assign(formState, {
        tipoProduto: 'Camisa UV',
        codigoBase: 'C01077',
        nomeProduto: 'Agronomia Real Tree',
        marca: 'Brk Agro',
        preco: '159,9',
        precoCusto: '55',
        modoPeso: 'molde_bling',
        generos: ['Masculino'],
        tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'G1', 'G2'],
      });
    } else if (preset === 'cbt') {
      Object.assign(formState, {
        tipoProduto: 'Camisa de Botão',
        codigoBase: 'CBT01',
        nomeProduto: 'Texas Verde Turquesa',
        marca: 'Brk Agro',
        preco: '289,9',
        precoCusto: '55',
        modoPeso: 'molde_bling',
        generos: ['Feminino', 'Infantil'],
        tamanhos: ['P', 'M', 'G', 'GG', 'G1'],
      });
    } else if (preset === 'tubeneck') {
      Object.assign(formState, {
        tipoProduto: 'Tubeneck',
        codigoBase: 'T566',
        nomeProduto: 'ArmorX Verde Oliva',
        marca: 'Brk Fishing',
        preco: '34,9',
        precoCusto: '35',
        generos: ['Masculino'],
        tamanhos: ['ÚNICO'],
      });
    } else if (preset === 'lenco') {
      Object.assign(formState, {
        tipoProduto: 'Lenço',
        codigoBase: 'LEN025',
        nomeProduto: 'Degradê Vinho',
        marca: 'Brk Fishing',
        preco: '34,9',
        precoCusto: '55',
        generos: ['Masculino'],
        tamanhos: ['ÚNICO'],
      });
    } else if (preset === 'copo') {
      Object.assign(formState, {
        tipoProduto: 'Copo Térmico',
        codigoBase: 'CPT050',
        nomeProduto: 'Oncinha Padrão',
        marca: 'Brk Fishing',
        preco: '99,9',
        precoCusto: '0',
        generos: ['Masculino'],
        tamanhos: ['ÚNICO'],
      });
    }
    renderPage();
    window.HUB.showToast?.('Molde de exemplo carregado!', 'success');
  }

  function updateTitleLivePreview() {
    const el = document.getElementById('title-live-preview');
    if (el) {
      el.textContent = buildOfficialTitle(formState.nomeProduto, 'Masculino', formState.tipoProduto, formState.marca);
    }
  }

  function bindStep1() {
    document.querySelectorAll('#erp-toggle .pill-toggle__option').forEach(opt => {
      opt.addEventListener('click', () => {
        formState.erp = opt.dataset.erp;
        renderPage();
      });
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => applyExamplePreset(btn.dataset.preset));
    });

    const tipoSel = document.getElementById('tipo-produto');
    if (tipoSel) {
      tipoSel.addEventListener('change', () => {
        formState.tipoProduto = tipoSel.value;
        const spec = getSpec();
        formState.tamanhos = [...(spec.defaultSizes || SHIRT_SIZES_FULL)];
        formState.preco = spec.defaultPrice || formState.preco;
        formState.precoCusto = spec.defaultCost ?? formState.precoCusto;
        renderPage();
      });
    }

    bindInput('codigo-base', 'codigoBase');
    bindInput('nome-produto', 'nomeProduto', updateTitleLivePreview);
    bindInput('preco', 'preco');
    bindInput('preco-custo', 'precoCusto');

    const marcaSel = document.getElementById('marca');
    if (marcaSel) {
      marcaSel.addEventListener('change', () => {
        formState.marca = marcaSel.value;
        updateTitleLivePreview();
      });
    }

    const pesoSel = document.getElementById('modo-peso');
    if (pesoSel) {
      pesoSel.addEventListener('change', () => { formState.modoPeso = pesoSel.value; });
    }

    document.getElementById('btn-next-1')?.addEventListener('click', () => goToStep(2));
  }

  function bindStep2() {
    bindCheckboxGroup('genero-group', 'generos');
    bindCheckboxGroup('tamanho-group', 'tamanhos');
    document.getElementById('btn-prev-2')?.addEventListener('click', () => goToStep(1));
    document.getElementById('btn-next-2')?.addEventListener('click', () => goToStep(3));
  }

  function bindStep3() {
    const ta = document.getElementById('ean-textarea');
    if (ta) {
      ta.addEventListener('input', () => {
        formState.eans = ta.value;
        const eans = parseEans(ta.value);
        const needed = skuCount();
        document.getElementById('ean-status').innerHTML = renderEanStatus(eans.length, needed);
      });
    }
    bindInput('urls-masculino', 'urlsMasculino');
    bindInput('urls-feminino', 'urlsFeminino');
    bindInput('urls-infantil', 'urlsInfantil');

    document.getElementById('btn-prev-3')?.addEventListener('click', () => goToStep(2));
    document.getElementById('btn-next-3')?.addEventListener('click', () => goToStep(4));
  }

  function downloadCsvForErp(targetErp) {
    const csv = buildCsvString(targetErp);
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const firstCode = parseBaseCodes(formState.codigoBase)[0] || 'PLANILHA';
    const suffix = targetErp === 'Bling' ? 'BLING_59COL' : 'OURO_SANKHYA_45COL';

    const a = document.createElement('a');
    a.href = url;
    a.download = `${firstCode}_${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    if (window.HUB.state?.counters) window.HUB.state.counters.planilhas++;
    window.HUB.showToast?.(`CSV ${targetErp} baixado com sucesso!`, 'success');
  }

  function bindStep4() {
    document.getElementById('btn-switch-preview-erp')?.addEventListener('click', () => {
      formState.erp = formState.erp === 'Bling' ? 'Sankhya' : 'Bling';
      renderPage();
    });

    document.getElementById('btn-download-bling')?.addEventListener('click', () => downloadCsvForErp('Bling'));
    document.getElementById('btn-download-sankhya')?.addEventListener('click', () => downloadCsvForErp('Sankhya'));

    document.getElementById('btn-copy-csv')?.addEventListener('click', () => {
      const csv = buildCsvString(formState.erp);
      navigator.clipboard.writeText(csv).then(() => {
        window.HUB.showToast?.(`CSV ${formState.erp} copiado para a área de transferência!`, 'success');
      });
    });

    document.getElementById('btn-prev-4')?.addEventListener('click', () => goToStep(3));
  }

  function bindInput(elId, stateKey, onAfter) {
    const el = document.getElementById(elId);
    if (el) {
      el.addEventListener('input', () => {
        formState[stateKey] = el.value;
        if (onAfter) onAfter();
      });
    }
  }

  function bindCheckboxGroup(groupId, stateKey) {
    document.querySelectorAll(`#${groupId} .checkbox-pill`).forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.preventDefault();
        const val = pill.dataset.value;
        const idx = formState[stateKey].indexOf(val);
        if (idx === -1) {
          formState[stateKey].push(val);
          pill.classList.add('checked');
          pill.querySelector('input').checked = true;
        } else if (formState[stateKey].length > 1) {
          formState[stateKey].splice(idx, 1);
          pill.classList.remove('checked');
          pill.querySelector('input').checked = false;
        }
        const counterEl = document.getElementById('sku-count');
        if (counterEl) counterEl.textContent = skuCount();
      });
    });
  }

  function goToStep(step) {
    formState.step = step;
    renderPage();
  }

  function renderPage() {
    const container = document.getElementById('app-content');
    if (!container) return;

    const stepRenderers = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 };
    const stepBinders   = { 1: bindStep1,   2: bindStep2,   3: bindStep3,   4: bindStep4 };

    container.innerHTML = `
      <div class="page-header fade-in">
        <h2 class="page-header__title">📄 Gerador de Planilhas Oficial (Bling 59 Col & Sankhya 45 Col)</h2>
        <p class="page-header__desc">Molde 100% idêntico à pasta <b>PLANILHAS EXEMPLOS</b> (PAI + Filhos sem hífen, NCM por gênero e pesos oficiais).</p>
      </div>

      <div class="stepper">
        ${renderStepper()}
      </div>

      ${stepRenderers[formState.step]()}
    `;

    stepBinders[formState.step]();

    document.querySelectorAll('.stepper__step').forEach(el => {
      el.addEventListener('click', () => {
        const target = parseInt(el.dataset.step, 10);
        if (target >= 1 && target <= 4) goToStep(target);
      });
    });
  }

  window.HUB.renderSpreadsheet = function () {
    renderPage();
  };
})();
