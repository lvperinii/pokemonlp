// rules.js
// Motor de regras: decide se uma carta é "alvo" da coleção e por quê.

import { RARITY_CLASSIFIERS, NAMED_SET, NAMED_DEX } from './config.js';

const norm = (s) => (s || '').toString().trim().toLowerCase();

// Classifica uma string de raridade da API no código do anexo (UR/IR/SIR/HR/MHR/MAR),
// ou null se não reconhecer. Usa a keyword mais longa que casar (mais específica).
export function classifyRarity(rarityStr) {
  const r = norm(rarityStr);
  if (!r) return null;
  let best = null;
  let bestLen = 0;
  for (const cls of RARITY_CLASSIFIERS) {
    for (const kw of cls.keywords) {
      if (r.includes(kw) && kw.length > bestLen) {
        best = cls.code;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

// Uma carta é "evolução" se não for básica: Mega, Stage 1/2, ou tem evolveFrom.
export function isEvolution(card) {
  const stage = norm(card.stage);
  if (card.evolveFrom) return true;
  if (!stage) return false;
  if (stage.includes('basic') || stage.includes('básic') || stage.includes('basico')) return false;
  // "Mega", "Stage1", "Stage2", "Stage 1", "VMAX", etc. contam como evolução.
  return true;
}

function matchesNamed(card) {
  if (Array.isArray(card.dexId) && card.dexId.some((d) => NAMED_DEX.has(d))) return true;
  return NAMED_SET.has(norm(card.name));
}

// Conjunto de raridades (strings exatas) que contam como alvo, montado a partir
// dos ajustes + heurística. Recebe a lista de raridades já descobertas.
export function buildTargetRaritySet(settings, discoveredRarities) {
  const set = new Set();
  const wantedCodes = new Set(settings.targetRarityCodes || []);
  const excluded = new Set((settings.excludedRarities || []).map(norm));

  for (const raw of discoveredRarities || []) {
    const code = classifyRarity(raw);
    if (code && wantedCodes.has(code) && !excluded.has(norm(raw))) {
      set.add(raw);
    }
  }
  for (const raw of settings.extraTargetRarities || []) {
    if (!excluded.has(norm(raw))) set.add(raw);
  }
  return set;
}

// Avalia uma carta e retorna as razões pelas quais ela é alvo.
// megaSeriesIds: Set de ids de série considerados "bloco Mega Evolução".
// targetRarities: Set de strings de raridade-alvo.
export function evaluateCard(card, { settings, megaSeriesIds, targetRarities }) {
  const reasons = [];
  const rules = settings.enabledRules || {};

  if (rules.rarity && card.rarity && targetRarities.has(card.rarity)) {
    reasons.push('rarity');
  }
  if (rules.named && matchesNamed(card)) {
    reasons.push('named');
  }
  if (rules.megaEvo && card.seriesId && megaSeriesIds.has(card.seriesId)) {
    const wantEvoOnly = settings.megaBlock?.onlyEvolutions;
    if (!wantEvoOnly || isEvolution(card)) {
      reasons.push('megaEvo');
    }
  }
  return reasons;
}

export const REASON_LABELS = {
  rarity: 'Raridade-chase',
  named: 'Pikachu/Starter',
  megaEvo: 'Evolução Mega',
};
