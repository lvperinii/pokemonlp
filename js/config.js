// config.js
// Regras da coleção e configurações padrão.
// Tudo aqui pode ser ajustado pela tela de "Ajustes" dentro do app;
// estes são apenas os valores iniciais.

export const DEFAULT_SETTINGS = {
  // Idioma dos dados na TCGdex. O usuário coleciona só em português por enquanto.
  // 'en' é usado como fallback automático quando um recurso não existir em pt.
  language: 'pt',
  fallbackLanguage: 'en',

  // Regra 1 — Raridades "chase".
  // Como as strings de raridade variam entre EN/PT e entre blocos, guardamos
  // aqui as raridades que CONTAM como alvo. A lista é preenchida/ajustada
  // automaticamente conforme o app descobre as raridades reais dos sets
  // importados (ver rules.classifyRarity). Estas são as categorias do anexo.
  targetRarityCodes: ['UR', 'IR', 'SIR', 'HR', 'MHR', 'MAR'],

  // Raridades específicas (string exata como veio da API) que o usuário
  // marcou manualmente como alvo, mesmo que a heurística não as reconheça.
  extraTargetRarities: [],
  // Raridades que o usuário decidiu NÃO colecionar, mesmo batendo na heurística.
  excludedRarities: [],

  // Regra 2 — Pokémon específicos (todas as cartas, qualquer raridade/set).
  namedPokemon: [
    { name: 'Bulbasaur', dexId: 1 },
    { name: 'Charmander', dexId: 4 },
    { name: 'Squirtle', dexId: 7 },
    { name: 'Pikachu', dexId: 25 },
  ],

  // Regra 3 — Bloco Mega Evolução: cartas de evolução do bloco atual.
  megaBlock: {
    // Usado para AUTO-DETECTAR a série do bloco na lista de séries da API.
    seriesNameContains: ['mega evolu', 'mega evolution', 'megaevolu'],
    // ID(s) de série confirmados pelo usuário (têm prioridade sobre a heurística).
    seriesIds: [],
    // Considerar só cartas de evolução (Mega / Stage 1 / Stage 2), ignorando básicos.
    onlyEvolutions: true,
  },

  // Quais regras estão ativas.
  enabledRules: { rarity: true, named: true, megaEvo: true },
};

// Heurística de classificação de raridades -> código do anexo.
// Ordem importa: regras mais específicas primeiro (SIR antes de IR).
// keywords cobrem EN e PT.
export const RARITY_CLASSIFIERS = [
  { code: 'MHR', label: 'Mega Hyper Rare', keywords: ['mega hyper rare', 'mega hiper rara', 'mhr'] },
  { code: 'HR',  label: 'Hyper Rare',      keywords: ['hyper rare', 'hiper rara', 'rara hiper'] },
  { code: 'SIR', label: 'Special Illustration Rare', keywords: ['special illustration rare', 'ilustração especial rara', 'rara ilustração especial', 'special art rare'] },
  { code: 'IR',  label: 'Illustration Rare', keywords: ['illustration rare', 'ilustração rara', 'rara ilustração'] },
  { code: 'MAR', label: 'Mega Attack Rare', keywords: ['mega attack rare', 'mega ataque rara', 'mar'] },
  { code: 'UR',  label: 'Ultra Rare',      keywords: ['ultra rare', 'ultra rara', 'rara ultra'] },
];

export const NAMED_SET = new Set(
  DEFAULT_SETTINGS.namedPokemon.map((p) => p.name.toLowerCase())
);
export const NAMED_DEX = new Set(
  DEFAULT_SETTINGS.namedPokemon.map((p) => p.dexId)
);
