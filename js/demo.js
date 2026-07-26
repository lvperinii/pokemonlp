// demo.js
// Dados FICTÍCIOS para demonstração/offline. Não são cartas reais — servem
// só para você ver a interface funcionando antes de sincronizar com a TCGdex.
// Imagens são SVGs embutidos (data URI), sem depender de rede.

function placeholder(name, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='245' height='342'>
    <rect width='100%' height='100%' rx='14' fill='${color}'/>
    <rect x='10' y='10' width='225' height='322' rx='10' fill='none' stroke='#000' stroke-opacity='.25' stroke-width='3'/>
    <text x='50%' y='46%' font-family='sans-serif' font-size='20' fill='#fff' text-anchor='middle'>${name}</text>
    <text x='50%' y='56%' font-family='sans-serif' font-size='12' fill='#fff' fill-opacity='.75' text-anchor='middle'>DEMO</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const S = 'demo-mega-01';
const SERIES = 'demo-mega';

function card(localId, name, rarity, extra = {}) {
  return {
    id: `${S}-${localId}`,
    localId: String(localId),
    name,
    image: null,
    demoImage: placeholder(name, extra.color || '#3b4252'),
    rarity,
    category: 'Pokémon',
    stage: extra.stage || 'Basic',
    evolveFrom: extra.evolveFrom || null,
    dexId: extra.dexId || [],
    setId: S,
    setName: 'Demo — Bloco Mega (fictício)',
    seriesId: SERIES,
    seriesName: 'Demo — Mega Evolução',
    enriched: true,
    demo: true,
  };
}

export const DEMO_SERIES = [{ id: SERIES, name: 'Demo — Mega Evolução' }];

export const DEMO_SET = {
  id: S,
  name: 'Demo — Bloco Mega (fictício)',
  seriesId: SERIES,
  seriesName: 'Demo — Mega Evolução',
  logo: null,
  symbol: null,
  total: 12,
  demo: true,
};

export const DEMO_CARDS = [
  card(1, 'Bulbasaur', 'Comum', { dexId: [1], color: '#4b7f52' }),
  card(4, 'Charmander', 'Comum', { dexId: [4], color: '#a85c3b' }),
  card(7, 'Squirtle', 'Comum', { dexId: [7], color: '#3b6ea8' }),
  card(25, 'Pikachu', 'Comum', { dexId: [25], color: '#b59a2b' }),
  card(58, 'Pikachu', 'Special Illustration Rare', { dexId: [25], color: '#8a7d2b', stage: 'Basic' }),
  card(101, 'Mega Charizard ex', 'Mega Hyper Rare', { dexId: [6], stage: 'Mega', evolveFrom: 'Charizard ex', color: '#7a2f2f' }),
  card(102, 'Mega Venusaur ex', 'Ultra Rare', { dexId: [3], stage: 'Mega', evolveFrom: 'Venusaur ex', color: '#2f5a34' }),
  card(103, 'Mega Blastoise ex', 'Illustration Rare', { dexId: [9], stage: 'Mega', evolveFrom: 'Blastoise ex', color: '#2f4a7a' }),
  card(104, 'Charizard ex', 'Ultra Rare', { dexId: [6], stage: 'Stage 2', evolveFrom: 'Charmeleon', color: '#8a4a2f' }),
  card(105, 'Mega Lucario ex', 'Mega Attack Rare', { dexId: [448], stage: 'Mega', evolveFrom: 'Lucario ex', color: '#2f6a7a' }),
  card(110, 'Raichu', 'Hyper Rare', { dexId: [26], stage: 'Stage 1', evolveFrom: 'Pikachu', color: '#9a7a2b' }),
  card(30, 'Pidgey', 'Comum', { dexId: [16], color: '#4c566a' }),
];
