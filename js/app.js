// app.js — Tracker do bloco Megaevolução.
// Carrega data/targets.json (gerado da TCGdex) e mostra, em cada set, o que
// você já tem e o que falta. O "tenho" fica salvo no navegador (localStorage).

const OWNED_KEY = 'pkmnlp.owned.v1';
const FILT_KEY = 'pkmnlp.filters.v1';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => (s ?? '').toString().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const REASON_LABEL = { rarity: 'Raridade-chase', named: 'Pikachu/Starter', megaEvo: 'Mega' };

const state = {
  data: null,
  owned: new Set(),
  filters: { q: '', setId: '', code: '', reason: '', status: 'missing' },
};

// ---- persistência ----
function loadOwned() {
  try { state.owned = new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')); }
  catch { state.owned = new Set(); }
}
function saveOwned() { localStorage.setItem(OWNED_KEY, JSON.stringify([...state.owned])); }
function loadFilters() {
  try { Object.assign(state.filters, JSON.parse(localStorage.getItem(FILT_KEY) || '{}')); } catch { /* ok */ }
}
function saveFilters() { localStorage.setItem(FILT_KEY, JSON.stringify(state.filters)); }

// ---- dados ----
async function loadData() {
  const res = await fetch('./data/targets.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  state.data = await res.json();
}

// ---- filtros ----
// base = filtra por busca/set/raridade/regra (SEM o status) — usado nas
// estatísticas e no progresso por set. Depois aplicamos o status na exibição.
function baseItems() {
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  const out = [];
  for (const c of state.data.cards) {
    if (f.setId && c.setId !== f.setId) continue;
    if (f.code && c.code !== f.code) continue;
    if (f.reason && !c.reasons.includes(f.reason)) continue;
    if (q && !(`${c.name} ${c.n}`.toLowerCase().includes(q))) continue;
    out.push({ c, owned: state.owned.has(c.id) });
  }
  return out;
}
function applyStatus(items) {
  const st = state.filters.status;
  if (st === 'owned') return items.filter((i) => i.owned);
  if (st === 'missing') return items.filter((i) => !i.owned);
  return items;
}

function stats(items) {
  const total = items.length;
  const owned = items.filter((i) => i.owned).length;
  return { total, owned, missing: total - owned };
}

// ---- render ----
function cardHtml({ c, owned }) {
  const badges = c.reasons.map((r) => `<span class="tag tag-${r}">${REASON_LABEL[r] || r}</span>`).join('');
  const rar = c.rarity ? `${esc(c.rarity)}${c.code ? ` · ${c.code}` : ''}` : '';
  return `
    <div class="card ${owned ? 'owned' : 'missing'}" data-id="${esc(c.id)}">
      <button class="check" title="${owned ? 'Você tem' : 'Falta'}" data-id="${esc(c.id)}">${owned ? '✓' : '+'}</button>
      <div class="thumb">${c.img ? `<img loading="lazy" src="${esc(c.img)}" alt="${esc(c.name)}">` : '<div class="noimg">sem imagem</div>'}</div>
      <div class="meta">
        <div class="name">${esc(c.name)}</div>
        <div class="sub">#${esc(c.n || '?')}${rar ? ` · ${rar}` : ''}</div>
        <div class="tags">${badges}</div>
      </div>
    </div>`;
}

function setBlockHtml(setId, setName, items, baseList) {
  const s = stats(baseList);
  const pct = s.total ? Math.round((s.owned / s.total) * 100) : 0;
  return `
    <section class="setgroup">
      <header class="sethead">
        <div>
          <h2>${esc(setName)}</h2>
          <div class="setsub">${s.owned}/${s.total} · faltam <strong>${s.missing}</strong></div>
        </div>
        <div class="setprog"><div class="setprog-bar" style="width:${pct}%"></div><span>${pct}%</span></div>
      </header>
      <div class="grid">${items.map(cardHtml).join('')}</div>
    </section>`;
}

function render() {
  const base = baseItems();          // progresso real (ignora Faltam/Tenho)
  const view = applyStatus(base);    // o que é exibido no grid

  const g = stats(base);
  $('#stat-total').textContent = g.total;
  $('#stat-owned').textContent = g.owned;
  $('#stat-missing').textContent = g.missing;
  $('#stat-pct').textContent = (g.total ? Math.round((g.owned / g.total) * 100) : 0) + '%';

  const order = state.data.sets.map((s) => s.id);
  const nameOf = (id) => (state.data.sets.find((s) => s.id === id)?.name) || id;

  // progresso por set vem da base; a exibição vem da view
  const groupBySet = (items) => {
    const m = new Map();
    for (const it of items) {
      if (!m.has(it.c.setId)) m.set(it.c.setId, []);
      m.get(it.c.setId).push(it);
    }
    return m;
  };
  const baseBySet = groupBySet(base);
  const viewBySet = groupBySet(view);

  const el = $('#content');
  if (!view.length) {
    const msg = base.length
      ? 'Nenhuma carta com esse status. Troque para "Todos" ou "Tenho".'
      : 'Nenhuma carta com os filtros atuais.';
    el.innerHTML = `<div class="empty"><h3>Nada para mostrar</h3><p>${msg}</p></div>`;
    return;
  }
  const setIds = [...viewBySet.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const html = setIds.map((id) => {
    const list = viewBySet.get(id).sort((a, b) => (parseInt(a.c.n) || 0) - (parseInt(b.c.n) || 0));
    return setBlockHtml(id, nameOf(id), list, baseBySet.get(id) || []);
  }).join('');
  el.innerHTML = html;
}

function fillSetFilter() {
  const sel = $('#f-set');
  const opts = ['<option value="">Todos os sets</option>'];
  for (const s of state.data.sets) opts.push(`<option value="${esc(s.id)}">${esc(s.name)} (${s.targets})</option>`);
  sel.innerHTML = opts.join('');
  sel.value = state.filters.setId;
}

function syncControls() {
  $('#f-q').value = state.filters.q;
  $('#f-code').value = state.filters.code;
  $('#f-reason').value = state.filters.reason;
  $('#f-set').value = state.filters.setId;
  $$('.f-status').forEach((b) => b.classList.toggle('active', b.dataset.status === state.filters.status));
}

// ---- modal da carta ----
function openCard(id) {
  const c = state.data.cards.find((x) => x.id === id);
  if (!c) return;
  const owned = state.owned.has(id);
  const img = c.imgHigh || c.img;
  $('#card-modal-body').innerHTML = `
    <div class="cm">
      <div class="cm-img">${img ? `<img src="${esc(img)}" alt="${esc(c.name)}">` : '<div class="noimg">sem imagem</div>'}</div>
      <div class="cm-info">
        <h2>${esc(c.name)}</h2>
        <p>${esc(c.setName)} · #${esc(c.n || '?')}</p>
        <p>Raridade: <strong>${esc(c.rarity || '—')}</strong>${c.code ? ` (${c.code})` : ''}</p>
        <p>${c.reasons.map((r) => `<span class="tag tag-${r}">${REASON_LABEL[r] || r}</span>`).join(' ')}</p>
        <div class="cm-actions">
          <button id="cm-toggle" class="btn ${owned ? 'primary' : ''}">${owned ? '✓ Você tem' : '+ Marcar que tenho'}</button>
          ${c.liga ? `<a class="btn ghost" href="${esc(c.liga)}" target="_blank" rel="noopener">Comprar na Liga ↗</a>` : ''}
        </div>
      </div>
    </div>`;
  $('#modal-card').classList.add('open');
  $('#cm-toggle').onclick = () => { toggle(id); openCard(id); };
}

function toggle(id) {
  if (state.owned.has(id)) state.owned.delete(id); else state.owned.add(id);
  saveOwned();
  render();
}

// ---- backup ----
function exportOwned() {
  const data = { _format: 'pkmnlp-owned', _version: 1, owned: [...state.owned], exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `colecao-mega-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function importOwned(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const arr = Array.isArray(data) ? data : data.owned;
    if (!Array.isArray(arr)) throw new Error('formato inválido');
    state.owned = new Set(arr);
    saveOwned(); render();
    alert('Coleção importada.');
  } catch (err) { alert('Falha ao importar: ' + err); }
  finally { e.target.value = ''; }
}

// ---- eventos ----
function bind() {
  $('#content').addEventListener('click', (e) => {
    const btn = e.target.closest('.check');
    if (btn) { toggle(btn.dataset.id); return; }
    const card = e.target.closest('.card');
    if (card) openCard(card.dataset.id);
  });
  $('#f-q').addEventListener('input', (e) => { state.filters.q = e.target.value; saveFilters(); render(); });
  $('#f-set').addEventListener('change', (e) => { state.filters.setId = e.target.value; saveFilters(); render(); });
  $('#f-code').addEventListener('change', (e) => { state.filters.code = e.target.value; saveFilters(); render(); });
  $('#f-reason').addEventListener('change', (e) => { state.filters.reason = e.target.value; saveFilters(); render(); });
  $$('.f-status').forEach((b) => b.addEventListener('click', () => {
    state.filters.status = b.dataset.status;
    $$('.f-status').forEach((x) => x.classList.toggle('active', x === b));
    saveFilters(); render();
  }));
  $('#btn-export').addEventListener('click', exportOwned);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', importOwned);
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => $(b.dataset.close).classList.remove('open')));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }));
}

// ---- init ----
async function init() {
  loadOwned();
  loadFilters();
  bind();
  try {
    await loadData();
  } catch (e) {
    $('#content').innerHTML = `<div class="empty"><h3>Não consegui carregar os dados</h3><p>${esc(String(e))}</p><p class="muted">Se estiver rodando local, gere o arquivo <code>data/targets.json</code> pelo GitHub Actions.</p></div>`;
    return;
  }
  // ordena os sets: principais (me01, me02, me02.5, …) primeiro, promos por último
  const rank = (id) => { const m = /^me([\d.]+)$/.exec(id); return m ? parseFloat(m[1]) : 1000; };
  state.data.sets.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

  $('#block-name').textContent = state.data.block?.seriesName || 'Megaevolução';
  fillSetFilter();
  syncControls();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
