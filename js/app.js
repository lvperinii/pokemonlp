// app.js — orquestra estado, sincronização e interface.

import { DEFAULT_SETTINGS, RARITY_CLASSIFIERS } from './config.js';
import * as api from './api.js';
import * as db from './db.js';
import * as rules from './rules.js';
import { DEMO_CARDS, DEMO_SET, DEMO_SERIES } from './demo.js';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------
const state = {
  settings: structuredClone(DEFAULT_SETTINGS),
  owned: new Set(),          // ids de cartas que o usuário possui
  cards: [],                 // todas as cartas em cache
  sets: [],                  // metadados dos sets importados
  series: [],                // catálogo de séries (id, name)
  catalogSets: [],           // catálogo de sets (id, name, ...) da API
  megaSeriesIds: new Set(),  // séries consideradas "bloco Mega Evolução"
  megaSetIds: new Set(),     // sets pertencentes ao bloco Mega
  filters: { q: '', setId: '', reason: '', code: '', status: 'all' },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => (s ?? '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------
// Derivações
// ---------------------------------------------------------------------------
function discoveredRarities() {
  const set = new Set();
  for (const c of state.cards) if (c.rarity) set.add(c.rarity);
  return [...set];
}

function targetRaritySet() {
  return rules.buildTargetRaritySet(state.settings, discoveredRarities());
}

function computeMegaSeries() {
  const ids = new Set(state.settings.megaBlock?.seriesIds || []);
  const needles = (state.settings.megaBlock?.seriesNameContains || []).map((s) => s.toLowerCase());
  for (const s of state.series) {
    const n = (s.name || '').toLowerCase();
    if (needles.some((k) => n.includes(k))) ids.add(s.id);
  }
  state.megaSeriesIds = ids;
  // sets do bloco = sets cujo seriesId está em ids
  const setIds = new Set();
  for (const st of state.sets) if (ids.has(st.seriesId)) setIds.add(st.id);
  for (const st of state.catalogSets) if (st.seriesId && ids.has(st.seriesId)) setIds.add(st.id);
  state.megaSetIds = setIds;
}

// Retorna { reasons } avaliando a carta pelas regras atuais.
function evalCard(card, targetRarities) {
  return rules.evaluateCard(card, {
    settings: state.settings,
    megaSeriesIds: state.megaSeriesIds,
    targetRarities,
  });
}

// Lista de cartas-alvo (com reasons), já aplicando filtros de UI.
function targetCards() {
  const tr = targetRaritySet();
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  const out = [];
  for (const c of state.cards) {
    const reasons = evalCard(c, tr);
    if (!reasons.length) continue;
    if (f.setId && c.setId !== f.setId) continue;
    if (f.reason && !reasons.includes(f.reason)) continue;
    if (f.code && rules.classifyRarity(c.rarity) !== f.code) continue;
    if (q && !(`${c.name} ${c.localId}`.toLowerCase().includes(q))) continue;
    const isOwned = state.owned.has(c.id);
    if (f.status === 'owned' && !isOwned) continue;
    if (f.status === 'missing' && isOwned) continue;
    out.push({ card: c, reasons, owned: isOwned });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Persistência de estado
// ---------------------------------------------------------------------------
async function loadState() {
  const saved = await db.getMeta('settings', null);
  if (saved) state.settings = { ...structuredClone(DEFAULT_SETTINGS), ...saved };
  state.owned = new Set(await db.getMeta('owned', []));
  state.series = await db.getMeta('series', []);
  state.catalogSets = await db.getMeta('catalogSets', []);
  state.cards = await db.getAllCards();
  state.sets = await db.getAllSets();
  api.setLanguages(state.settings.language, state.settings.fallbackLanguage);
  computeMegaSeries();
}

const saveOwned = () => db.setMeta('owned', [...state.owned]);
const saveSettings = () => db.setMeta('settings', state.settings);

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------
let syncCancel = null;

function logSync(msg) {
  const el = $('#sync-log');
  if (el) { el.textContent = msg + '\n' + el.textContent; }
}
function setProgress(done, total) {
  const bar = $('#sync-progress-bar');
  const txt = $('#sync-progress-text');
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = total ? `${done}/${total} (${pct}%)` : '';
}

async function loadCatalog() {
  logSync('Buscando catálogo de séries e sets…');
  const [series, sets] = await Promise.all([api.listSeries(), api.listSets()]);
  state.series = (series || []).map((s) => ({ id: s.id, name: s.name }));
  state.catalogSets = (sets || []).map((s) => ({
    id: s.id, name: s.name, logo: s.logo || null, symbol: s.symbol || null,
    total: s.cardCount?.total ?? s.cardCount?.official ?? null, seriesId: null,
  }));
  await db.setMeta('series', state.series);

  // Descobrir sets do bloco Mega buscando o detalhe das séries Mega.
  computeMegaSeries();
  const megaIds = [...state.megaSeriesIds];
  for (const sid of megaIds) {
    try {
      const detail = await api.getSeries(sid);
      const setsOfSeries = detail?.sets || [];
      for (const st of setsOfSeries) {
        const found = state.catalogSets.find((x) => x.id === st.id);
        if (found) found.seriesId = sid;
        state.megaSetIds.add(st.id);
      }
    } catch (e) { /* ignora série sem detalhe */ }
  }
  await db.setMeta('catalogSets', state.catalogSets);
  logSync(`Catálogo: ${state.series.length} séries, ${state.catalogSets.length} sets. Bloco Mega: ${state.megaSetIds.size} sets.`);
}

async function importSet(setId, seriesInfo) {
  logSync(`Importando set ${setId}…`);
  const detail = await api.getSet(setId);
  if (!detail) { logSync(`Set ${setId} não encontrado.`); return; }
  const seriesId = seriesInfo?.id || detail.serie?.id || (state.megaSetIds.has(setId) ? [...state.megaSeriesIds][0] : null);
  const seriesName = seriesInfo?.name || detail.serie?.name || null;
  const briefs = detail.cards || [];

  const cards = briefs.map((b) => ({
    id: b.id,
    localId: b.localId != null ? String(b.localId) : (api.setIdFromCardId(b.id) === setId ? b.id.slice(setId.length + 1) : ''),
    name: b.name || '',
    image: b.image || null,
    rarity: b.rarity || null,
    category: null, stage: null, evolveFrom: null, dexId: [],
    setId, setName: detail.name || setId, seriesId, seriesName,
    enriched: false,
  }));
  await db.putCards(cards);
  await db.putSet({
    id: setId, name: detail.name || setId, seriesId, seriesName,
    logo: detail.logo || null, symbol: detail.symbol || null,
    total: detail.cardCount?.total ?? briefs.length,
  });

  // Enriquecer (raridade, dexId, stage) — necessário para aplicar as regras.
  const need = cards.filter((c) => !c.rarity);
  logSync(`Set ${detail.name || setId}: ${cards.length} cartas. Detalhando ${need.length}…`);
  const { promise, cancel } = await api.mapLimit(need, 8, async (c) => {
    const d = await api.getCard(c.id);
    if (d) {
      c.rarity = d.rarity || c.rarity || null;
      c.category = d.category || null;
      c.stage = d.stage || null;
      c.evolveFrom = d.evolveFrom || null;
      c.dexId = Array.isArray(d.dexId) ? d.dexId : (d.dexId != null ? [d.dexId] : []);
      c.enriched = true;
    }
    return c;
  }, (done, total) => setProgress(done, total));
  syncCancel = cancel;
  await promise;
  syncCancel = null;
  await db.putCards(cards);
  logSync(`Set ${detail.name || setId} importado.`);
}

async function importNamedPokemon() {
  const setMap = new Map(state.catalogSets.map((s) => [s.id, s]));
  for (const p of state.settings.namedPokemon) {
    logSync(`Buscando cartas de ${p.name}…`);
    let briefs = [];
    try { briefs = await api.findCardsByName(p.name); } catch (e) { logSync(`Falha ao buscar ${p.name}: ${e}`); continue; }
    const cards = briefs.map((b) => {
      const setId = api.setIdFromCardId(b.id);
      const sm = setMap.get(setId);
      return {
        id: b.id,
        localId: b.localId != null ? String(b.localId) : '',
        name: b.name || p.name,
        image: b.image || null,
        rarity: b.rarity || null,
        category: null, stage: null, evolveFrom: null, dexId: [p.dexId],
        setId, setName: sm?.name || setId, seriesId: sm?.seriesId || null, seriesName: null,
        enriched: false,
      };
    });
    await db.putCards(cards);
    logSync(`${p.name}: ${cards.length} cartas encontradas (detalhando raridade em segundo plano).`);

    // Enriquecer em lote para termos raridade/set corretos.
    const { promise } = await api.mapLimit(cards, 8, async (c) => {
      const d = await api.getCard(c.id);
      if (d) {
        c.rarity = d.rarity || null;
        c.stage = d.stage || null;
        c.evolveFrom = d.evolveFrom || null;
        if (d.set?.name) c.setName = d.set.name;
        c.enriched = true;
      }
      return c;
    }, (done, total) => setProgress(done, total));
    await promise;
    await db.putCards(cards);
  }
  logSync('Pokémon nomeados importados.');
}

async function runSync(selectedSetIds, includeNamed) {
  const btn = $('#do-import');
  if (btn) btn.disabled = true;
  try {
    for (const setId of selectedSetIds) {
      const cat = state.catalogSets.find((s) => s.id === setId);
      await importSet(setId, cat?.seriesId ? { id: cat.seriesId } : null);
    }
    if (includeNamed) await importNamedPokemon();
    // Recarrega estado a partir do DB.
    state.cards = await db.getAllCards();
    state.sets = await db.getAllSets();
    computeMegaSeries();
    renderRarityUI();
    render();
    logSync('Sincronização concluída ✔');
  } catch (e) {
    logSync('Erro na sincronização: ' + e);
  } finally {
    if (btn) btn.disabled = false;
    setProgress(0, 0);
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function statsGlobal(items) {
  const total = items.length;
  const owned = items.filter((i) => i.owned).length;
  return { total, owned, missing: total - owned };
}

function groupBySet(items) {
  const map = new Map();
  for (const it of items) {
    const k = it.card.setId || '—';
    if (!map.has(k)) map.set(k, { setId: k, name: it.card.setName || k, items: [] });
    map.get(k).items.push(it);
  }
  const arr = [...map.values()];
  arr.sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  for (const g of arr) g.items.sort((a, b) => (parseInt(a.card.localId) || 0) - (parseInt(b.card.localId) || 0));
  return arr;
}

function cardHtml(it) {
  const c = it.card;
  const img = c.demoImage || api.imageUrl(c.image, 'low') || '';
  const code = rules.classifyRarity(c.rarity);
  const badges = it.reasons.map((r) => `<span class="tag tag-${r}">${rules.REASON_LABELS[r]}</span>`).join('');
  return `
    <div class="card ${it.owned ? 'owned' : 'missing'}" data-id="${esc(c.id)}">
      <button class="check" title="${it.owned ? 'Tenho' : 'Falta'}" data-id="${esc(c.id)}">${it.owned ? '✓' : '+'}</button>
      <div class="thumb">${img ? `<img loading="lazy" src="${esc(img)}" alt="${esc(c.name)}">` : `<div class="noimg">sem imagem</div>`}</div>
      <div class="meta">
        <div class="name">${esc(c.name)}</div>
        <div class="sub">#${esc(c.localId || '?')}${c.rarity ? ` · ${esc(c.rarity)}${code ? ` (${code})` : ''}` : ''}</div>
        <div class="tags">${badges}</div>
      </div>
    </div>`;
}

function setSectionHtml(group) {
  const s = statsGlobal(group.items);
  const pct = s.total ? Math.round((s.owned / s.total) * 100) : 0;
  return `
    <section class="setgroup" data-set="${esc(group.setId)}">
      <header class="sethead">
        <div>
          <h2>${esc(group.name)}</h2>
          <div class="setsub">${s.owned}/${s.total} · faltam ${s.missing}</div>
        </div>
        <div class="setprog"><div class="setprog-bar" style="width:${pct}%"></div><span>${pct}%</span></div>
      </header>
      <div class="grid">${group.items.map(cardHtml).join('')}</div>
    </section>`;
}

function render() {
  const items = targetCards();
  const g = statsGlobal(items);
  $('#stat-total').textContent = g.total;
  $('#stat-owned').textContent = g.owned;
  $('#stat-missing').textContent = g.missing;
  $('#stat-pct').textContent = (g.total ? Math.round((g.owned / g.total) * 100) : 0) + '%';

  // preencher filtro de sets com todos os sets que têm cartas-alvo
  const setSel = $('#f-set');
  if (setSel) {
    const trAll = targetRaritySet();
    const setsWithTargets = new Map();
    for (const c of state.cards) {
      if (evalCard(c, trAll).length) setsWithTargets.set(c.setId, c.setName || c.setId);
    }
    const signature = [...setsWithTargets.keys()].sort().join('|');
    if (setSel.dataset.sig !== signature) {
      const opts = ['<option value="">Todos os sets</option>'];
      [...setsWithTargets.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt'))
        .forEach(([id, name]) => opts.push(`<option value="${esc(id)}">${esc(name)}</option>`));
      setSel.innerHTML = opts.join('');
      setSel.dataset.sig = signature;
    }
    setSel.value = state.filters.setId;
  }

  const container = $('#content');
  if (!items.length) {
    container.innerHTML = state.cards.length
      ? `<div class="empty">Nenhuma carta-alvo com os filtros atuais.</div>`
      : `<div class="empty">
           <h3>Sua coleção está vazia</h3>
           <p>Clique em <strong>Sincronizar</strong> para importar sets da TCGdex,
              ou em <strong>Ver demo</strong> para experimentar a interface com dados fictícios.</p>
         </div>`;
    return;
  }
  const groups = groupBySet(items);
  container.innerHTML = groups.map(setSectionHtml).join('');
}

// UI de raridades (na tela de Ajustes) — mostra as raridades descobertas.
function renderRarityUI() {
  const box = $('#rarity-list');
  if (!box) return;
  const found = discoveredRarities().sort((a, b) => a.localeCompare(b, 'pt'));
  const target = targetRaritySet();
  if (!found.length) { box.innerHTML = '<p class="muted">Nenhuma raridade descoberta ainda. Sincronize um set.</p>'; return; }
  box.innerHTML = found.map((r) => {
    const code = rules.classifyRarity(r);
    const checked = target.has(r) ? 'checked' : '';
    return `<label class="rarow">
      <input type="checkbox" data-rarity="${esc(r)}" ${checked}>
      <span>${esc(r)}</span>
      <span class="code">${code || '—'}</span>
    </label>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function bindEvents() {
  // Toggle "tenho"
  $('#content').addEventListener('click', (e) => {
    const btn = e.target.closest('.check');
    if (!btn) {
      const card = e.target.closest('.card');
      if (card) openCardModal(card.dataset.id);
      return;
    }
    const id = btn.dataset.id;
    if (state.owned.has(id)) state.owned.delete(id); else state.owned.add(id);
    saveOwned();
    render();
  });

  // Filtros
  $('#f-q').addEventListener('input', (e) => { state.filters.q = e.target.value; render(); });
  $('#f-set').addEventListener('change', (e) => { state.filters.setId = e.target.value; render(); });
  $('#f-reason').addEventListener('change', (e) => { state.filters.reason = e.target.value; render(); });
  $('#f-code').addEventListener('change', (e) => { state.filters.code = e.target.value; render(); });
  $$('.f-status').forEach((b) => b.addEventListener('click', () => {
    state.filters.status = b.dataset.status;
    $$('.f-status').forEach((x) => x.classList.toggle('active', x === b));
    render();
  }));

  // Barra de ações
  $('#btn-sync').addEventListener('click', openSync);
  $('#btn-settings').addEventListener('click', () => toggleModal('#modal-settings', true));
  $('#btn-demo').addEventListener('click', loadDemo);
  $('#btn-export').addEventListener('click', doExport);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', doImport);

  // Fechar modais
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => toggleModal(b.dataset.close, false)));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) toggleModal('#' + m.id, false); }));

  // Ajustes: raridades
  $('#rarity-list').addEventListener('change', (e) => {
    const cb = e.target.closest('input[type=checkbox]');
    if (!cb) return;
    const r = cb.dataset.rarity;
    const extra = new Set(state.settings.extraTargetRarities);
    const excl = new Set(state.settings.excludedRarities);
    const code = rules.classifyRarity(r);
    const wanted = new Set(state.settings.targetRarityCodes);
    const heuristicOn = code && wanted.has(code);
    if (cb.checked) { excl.delete(r); if (!heuristicOn) extra.add(r); }
    else { extra.delete(r); if (heuristicOn) excl.add(r); }
    state.settings.extraTargetRarities = [...extra];
    state.settings.excludedRarities = [...excl];
    saveSettings(); render();
  });

  // Ajustes: regras on/off
  $$('.rule-toggle').forEach((cb) => cb.addEventListener('change', () => {
    state.settings.enabledRules[cb.dataset.rule] = cb.checked;
    saveSettings(); render();
  }));
  $('#opt-evo-only').addEventListener('change', (e) => {
    state.settings.megaBlock.onlyEvolutions = e.target.checked;
    saveSettings(); render();
  });

  // Sync: executar
  $('#do-import').addEventListener('click', () => {
    const ids = $$('#set-picker input[type=checkbox]:checked').map((c) => c.value);
    const named = $('#opt-import-named').checked;
    if (!ids.length && !named) { logSync('Selecione ao menos um set ou marque Pikachu/Starters.'); return; }
    runSync(ids, named);
  });
  $('#cancel-sync').addEventListener('click', () => { if (syncCancel) { syncCancel(); logSync('Cancelando…'); } });
  $('#reset-all').addEventListener('click', async () => {
    if (!confirm('Isso apaga TODO o cache e o que você marcou como "tenho". Continuar?')) return;
    await db.clearAll();
    location.reload();
  });
}

// ---------------------------------------------------------------------------
// Modais
// ---------------------------------------------------------------------------
function toggleModal(sel, show) {
  const m = $(sel);
  if (m) m.classList.toggle('open', show);
}

function openCardModal(id) {
  const c = state.cards.find((x) => x.id === id);
  if (!c) return;
  const img = c.demoImage || api.imageUrl(c.image, 'high') || '';
  $('#card-modal-body').innerHTML = `
    <div class="cm">
      <div class="cm-img">${img ? `<img src="${esc(img)}" alt="${esc(c.name)}">` : '<div class="noimg">sem imagem</div>'}</div>
      <div class="cm-info">
        <h2>${esc(c.name)}</h2>
        <p>${esc(c.setName || c.setId)} · #${esc(c.localId || '?')}</p>
        <p>Raridade: <strong>${esc(c.rarity || '—')}</strong> ${rules.classifyRarity(c.rarity) ? `(${rules.classifyRarity(c.rarity)})` : ''}</p>
        ${c.evolveFrom ? `<p>Evolui de: ${esc(c.evolveFrom)}</p>` : ''}
        ${c.stage ? `<p>Estágio: ${esc(c.stage)}</p>` : ''}
        <button id="cm-toggle" class="btn ${state.owned.has(id) ? 'primary' : ''}">${state.owned.has(id) ? '✓ Tenho' : '+ Marcar que tenho'}</button>
      </div>
    </div>`;
  toggleModal('#modal-card', true);
  $('#cm-toggle').onclick = () => {
    if (state.owned.has(id)) state.owned.delete(id); else state.owned.add(id);
    saveOwned(); render(); openCardModal(id);
  };
}

async function openSync() {
  toggleModal('#modal-sync', true);
  $('#sync-log').textContent = '';
  const picker = $('#set-picker');
  picker.innerHTML = '<p class="muted">Carregando catálogo…</p>';
  try {
    if (!state.catalogSets.length) await loadCatalog();
    else computeMegaSeries();
    renderSetPicker();
  } catch (e) {
    picker.innerHTML = `<p class="muted">Não consegui carregar o catálogo (rede/API). ${esc(String(e))}</p>`;
  }
}

function renderSetPicker() {
  const picker = $('#set-picker');
  const onlyMega = $('#only-mega')?.checked;
  let sets = state.catalogSets.slice();
  if (onlyMega) sets = sets.filter((s) => state.megaSetIds.has(s.id));
  sets.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt'));
  if (!sets.length) { picker.innerHTML = '<p class="muted">Nenhum set encontrado.</p>'; return; }
  picker.innerHTML = sets.map((s) => {
    const isMega = state.megaSetIds.has(s.id);
    const already = state.sets.find((x) => x.id === s.id);
    return `<label class="setrow">
      <input type="checkbox" value="${esc(s.id)}" ${isMega ? 'checked' : ''}>
      <span class="setrow-name">${esc(s.name)}</span>
      ${isMega ? '<span class="pill">Mega</span>' : ''}
      ${already ? '<span class="pill ok">importado</span>' : ''}
      <span class="setrow-id">${esc(s.id)}</span>
    </label>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Demo / Backup
// ---------------------------------------------------------------------------
async function loadDemo() {
  await db.putCards(DEMO_CARDS);
  await db.putSet(DEMO_SET);
  const series = new Map(state.series.map((s) => [s.id, s]));
  for (const s of DEMO_SERIES) series.set(s.id, s);
  state.series = [...series.values()];
  await db.setMeta('series', state.series);
  state.cards = await db.getAllCards();
  state.sets = await db.getAllSets();
  computeMegaSeries();
  renderRarityUI();
  render();
}

async function doExport() {
  const data = await db.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `colecao-pokemon-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function doImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    await db.importAll(data);
    await loadState();
    renderRarityUI();
    render();
    alert('Backup importado com sucesso.');
  } catch (err) {
    alert('Falha ao importar: ' + err);
  } finally {
    e.target.value = '';
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
async function init() {
  await loadState();
  bindEvents();
  renderRarityUI();
  render();

  // reagir a "só bloco Mega" no picker
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'only-mega') renderSetPicker();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
