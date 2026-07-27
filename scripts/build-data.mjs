// scripts/build-data.mjs
// Gera data/targets.json com as cartas-alvo do bloco Megaevolução, a partir
// da TCGdex (JSON, em pt). Roda no GitHub Actions (que tem internet).
// Também imprime um resumo (distribuição de raridades/estágios) para validação.

import { writeFile, mkdir } from 'node:fs/promises';

const BASE = 'https://api.tcgdex.net/v2';
const LANG = 'pt';
const MEGA_HINT = 'mega';
const NAMED = [
  { name: 'Bulbasaur', dex: 1 },
  { name: 'Charmander', dex: 4 },
  { name: 'Squirtle', dex: 7 },
  { name: 'Pikachu', dex: 25 },
];
const NAMED_LC = new Set(NAMED.map((n) => n.name.toLowerCase()));
const NAMED_DEX = new Set(NAMED.map((n) => n.dex));

// Classificação de raridade -> código do anexo. PT + EN. Vence a keyword mais
// longa (mais específica), então "ilustração rara especial" (SIR) vence
// "ilustração rara" (IR). Strings reais da TCGdex (pt): "Ultra Rara",
// "Ilustração Rara", "Ilustração Rara Especial", "Mega Hiper Raro".
const RARITY_RULES = [
  { code: 'MHR', kw: ['mega hiper rar', 'mega hyper rar'] },
  { code: 'MAR', kw: ['mega ataque rar', 'mega attack rar'] },
  { code: 'SIR', kw: ['ilustração rara especial', 'special illustration rare'] },
  { code: 'IR', kw: ['ilustração rara', 'illustration rare'] },
  { code: 'UR', kw: ['ultra rara', 'ultra rare'] },
  { code: 'HR', kw: ['hiper raro', 'hiper rara', 'hyper rare', 'rara dourada', 'gold'] },
];
function classify(r) {
  const s = (r || '').toLowerCase();
  let best = null, len = 0;
  for (const rule of RARITY_RULES) for (const k of rule.kw) {
    if (s.includes(k) && k.length > len) { best = rule.code; len = k.length; }
  }
  return best;
}

async function j(path, lang = LANG, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${BASE}/${lang}${path}`, { headers: { Accept: 'application/json' } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (i === tries - 1) { if (lang !== 'en') return j(path, 'en', 1); throw e; }
      await new Promise((res) => setTimeout(res, 400 * (i + 1)));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function run() { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

// Carta de Megaevolução = nome começa com "Mega " (ex.: "Mega Charizard ex").
// Evita pegar Pokémon evoluídos comuns (Meganium, etc.).
const isMega = (c) => /^mega\s/i.test((c.name || '').trim());

console.log('== Buscando séries ==');
const series = await j('/series');
const mega = (series || []).filter((s) => (s.name || '').toLowerCase().includes(MEGA_HINT));
console.log('Séries mega:', mega.map((s) => `${s.id}=${s.name}`).join(', ') || '(nenhuma)');
if (!mega.length) { console.error('Bloco Mega não encontrado.'); process.exit(1); }

const megaSeries = mega[0];
const seriesDetail = await j(`/series/${megaSeries.id}`);
const sets = (seriesDetail.sets || []);
console.log('Sets do bloco:', sets.map((s) => `${s.id}(${s.cardCount?.total ?? '?'})`).join(', '));

// Coleta todas as cartas (briefs) do bloco e enriquece com detalhe.
let allCards = [];
for (const st of sets) {
  const detail = await j(`/sets/${st.id}`);
  const briefs = detail?.cards || [];
  const enriched = await mapLimit(briefs, 12, async (b) => {
    const d = await j(`/cards/${b.id}`);
    if (!d) return null;
    return {
      id: d.id,
      localId: String(d.localId ?? b.localId ?? ''),
      name: d.name || b.name || '',
      setId: st.id,
      setName: detail.name || st.id,
      seriesId: megaSeries.id,
      seriesName: megaSeries.name,
      rarity: d.rarity || null,
      category: d.category || null,
      stage: d.stage || null,
      evolveFrom: d.evolveFrom || null,
      dexId: Array.isArray(d.dexId) ? d.dexId : (d.dexId != null ? [d.dexId] : []),
      image: d.image || null,
    };
  });
  const good = enriched.filter(Boolean);
  allCards.push(...good);
  console.log(`  set ${st.id} (${detail?.name || '?'}): ${good.length}/${briefs.length} cartas detalhadas`);
}

// Distribuições para validação.
const byRarity = new Map();
const byStage = new Map();
const unknownRar = new Set();
for (const c of allCards) {
  byRarity.set(c.rarity || '(sem)', (byRarity.get(c.rarity || '(sem)') || 0) + 1);
  byStage.set(c.stage || '(sem)', (byStage.get(c.stage || '(sem)') || 0) + 1);
  if (c.rarity && !classify(c.rarity)) unknownRar.add(c.rarity);
}
console.log('\n== DISTRIBUIÇÃO DE RARIDADES (bloco) ==');
for (const [k, v] of [...byRarity.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${classify(k) || '  '}\t${v}\t${k}`);
console.log('\n== ESTÁGIOS ==');
for (const [k, v] of [...byStage.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);
console.log('\nRaridades NÃO classificadas:', [...unknownRar].join(' | ') || '(nenhuma)');

// Regras -> reasons.
function reasonsFor(c) {
  const rs = [];
  if (classify(c.rarity)) rs.push('rarity');
  if ((Array.isArray(c.dexId) && c.dexId.some((d) => NAMED_DEX.has(d))) || NAMED_LC.has((c.name || '').toLowerCase())) rs.push('named');
  if (isMega(c)) rs.push('megaEvo');
  return rs;
}

const rarityMap = {};
for (const c of allCards) if (c.rarity && classify(c.rarity)) rarityMap[c.rarity] = classify(c.rarity);

const targets = [];
for (const c of allCards) {
  const rs = reasonsFor(c);
  if (!rs.length) continue;
  targets.push({
    id: c.id,
    n: c.localId,
    name: c.name,
    setId: c.setId,
    setName: c.setName,
    rarity: c.rarity,
    code: classify(c.rarity),
    stage: c.stage,
    dexId: c.dexId,
    reasons: rs,
    img: c.image ? c.image + '/low.webp' : null,
    imgHigh: c.image ? c.image + '/high.webp' : null,
    liga: 'https://www.ligapokemon.com.br/?view=cards/card&card=' + encodeURIComponent(c.name),
  });
}

// Resumo de alvos.
const byReason = { rarity: 0, named: 0, megaEvo: 0 };
for (const t of targets) for (const r of t.reasons) byReason[r]++;
const perSet = new Map();
for (const t of targets) perSet.set(t.setId, (perSet.get(t.setId) || 0) + 1);

const byCode = {};
for (const t of targets) { const k = t.code || '(evo/named)'; byCode[k] = (byCode[k] || 0) + 1; }
const withImg = targets.filter((t) => t.img).length;

console.log('\n== ALVOS ==');
console.log('Total de cartas no bloco:', allCards.length, '| Alvos:', targets.length);
console.log('Por razão:', JSON.stringify(byReason));
console.log('Por código de raridade:', JSON.stringify(byCode));
console.log('Por set:', [...perSet.entries()].map(([k, v]) => `${k}=${v}`).join(', '));
console.log(`Com imagem: ${withImg}/${targets.length} (${Math.round((withImg / targets.length) * 100)}%)`);
console.log('Amostra de alvos (me01):');
for (const t of targets.filter((t) => t.setId === 'me01').slice(0, 8)) console.log('  ', JSON.stringify({ id: t.id, name: t.name, code: t.code, rarity: t.rarity, reasons: t.reasons, img: t.img }));

const output = {
  source: 'tcgdex',
  lang: LANG,
  block: { seriesId: megaSeries.id, seriesName: megaSeries.name },
  sets: sets.map((s) => ({ id: s.id, name: s.name, targets: perSet.get(s.id) || 0 })).filter((s) => s.targets > 0),
  rarityMap,
  cards: targets,
};
await mkdir('data', { recursive: true });
await writeFile('data/targets.json', JSON.stringify(output));
console.log('\ndata/targets.json escrito com', targets.length, 'cartas-alvo.');
