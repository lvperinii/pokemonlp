// scripts/probe.mjs
// Sondagem: descobre o que a TCGdex tem para o bloco Mega Evolução (em pt),
// imprimindo tudo no log do GitHub Actions. Não escreve arquivos.
// Serve para eu confirmar os dados reais antes de construir o gerador.

const BASE = 'https://api.tcgdex.net/v2';
const LANG = 'pt';

async function j(path, lang = LANG) {
  const url = `${BASE}/${lang}${path}`;
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.json();
}

function line(s = '') { console.log(s); }

try {
  line('===== SÉRIES (pt) =====');
  let series = [];
  try { series = await j('/series', 'pt'); }
  catch (e) { line('pt falhou (' + e.message + '), tentando en'); series = await j('/series', 'en'); }
  for (const s of series) line(`  ${s.id}\t${s.name}`);

  const megaNeedles = ['mega'];
  const mega = series.filter((s) => megaNeedles.some((k) => (s.name || '').toLowerCase().includes(k)));
  line('');
  line('===== SÉRIES QUE CONTÊM "mega" =====');
  for (const s of mega) line(`  ${s.id}\t${s.name}`);
  if (!mega.length) line('  (nenhuma — o bloco Mega pode ter outro nome; ver lista acima)');

  // Detalhe de cada série mega -> sets
  const megaSets = [];
  for (const s of mega) {
    line('');
    line(`===== SETS da série ${s.id} (${s.name}) =====`);
    let detail;
    try { detail = await j(`/series/${s.id}`, 'pt'); }
    catch (e) { line('  pt falhou, tentando en'); detail = await j(`/series/${s.id}`, 'en'); }
    for (const st of detail.sets || []) {
      line(`  ${st.id}\t${st.name}\tcards=${st.cardCount?.total ?? st.cardCount?.official ?? '?'}`);
      megaSets.push(st);
    }
  }

  // Inspeciona o primeiro set mega: briefs + 1 detalhe + raridades de amostra
  if (megaSets.length) {
    const target = megaSets[0];
    line('');
    line(`===== DETALHE DO SET ${target.id} (${target.name}) =====`);
    let setDetail;
    try { setDetail = await j(`/sets/${target.id}`, 'pt'); }
    catch (e) { line('  pt falhou, tentando en'); setDetail = await j(`/sets/${target.id}`, 'en'); }
    const cards = setDetail.cards || [];
    line(`  total de cartas no set: ${cards.length}`);
    line('  amostra de briefs (primeiros 3):');
    for (const c of cards.slice(0, 3)) line('    ' + JSON.stringify(c));

    if (cards.length) {
      const cid = cards[Math.min(5, cards.length - 1)].id;
      line('');
      line(`  DETALHE COMPLETO da carta ${cid}:`);
      let cd;
      try { cd = await j(`/cards/${cid}`, 'pt'); }
      catch (e) { line('  pt falhou, tentando en'); cd = await j(`/cards/${cid}`, 'en'); }
      line('    ' + JSON.stringify(cd));
      line('    -> campos: rarity=' + cd.rarity + ' | stage=' + cd.stage + ' | dexId=' + JSON.stringify(cd.dexId) + ' | category=' + cd.category);
      line('    -> image base=' + cd.image + '  (ex.: ' + (cd.image ? cd.image + '/high.webp' : 'sem imagem') + ')');
    }

    // Raridades distintas nas primeiras 25 cartas do set
    line('');
    line('  RARIDADES distintas (amostra das primeiras 25 cartas):');
    const rar = new Map();
    for (const c of cards.slice(0, 25)) {
      try {
        const cd = await j(`/cards/${c.id}`, 'pt').catch(() => j(`/cards/${c.id}`, 'en'));
        const key = cd.rarity || '(sem)';
        rar.set(key, (rar.get(key) || 0) + 1);
      } catch { /* ignora */ }
    }
    for (const [k, v] of rar) line(`    ${k}: ${v}`);
  }

  // Busca por nome (Pikachu)
  line('');
  line('===== BUSCA cards?name=Pikachu (pt) =====');
  try {
    const pika = await j('/cards?name=Pikachu&pagination:itemsPerPage=5', 'pt').catch(() => j('/cards?name=Pikachu&pagination:itemsPerPage=5', 'en'));
    line(`  retornou ${Array.isArray(pika) ? pika.length : 'N/A'} (amostra):`);
    for (const c of (Array.isArray(pika) ? pika.slice(0, 5) : [])) line('    ' + JSON.stringify(c));
  } catch (e) { line('  falhou: ' + e.message); }

  line('');
  line('===== FIM DA SONDAGEM =====');
} catch (err) {
  console.error('ERRO NA SONDAGEM:', err);
  process.exit(1);
}
