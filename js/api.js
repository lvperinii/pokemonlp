// api.js
// Adaptador para a API pública da TCGdex (https://tcgdex.dev).
// Roda no NAVEGADOR do usuário (CORS liberado pela TCGdex), com fallback de
// idioma e um limitador de concorrência para os "enriquecimentos" em lote.

const BASE = 'https://api.tcgdex.net/v2';

let LANG = 'pt';
let FALLBACK = 'en';

export function setLanguages(lang, fallback) {
  if (lang) LANG = lang;
  if (fallback) FALLBACK = fallback;
}

async function getJson(path, { lang = LANG, allowFallback = true, timeout = 20000 } = {}) {
  const url = `${BASE}/${lang}${path}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return await res.json();
  } catch (err) {
    // Tenta o idioma de fallback uma única vez.
    if (allowFallback && lang !== FALLBACK) {
      return getJson(path, { lang: FALLBACK, allowFallback: false, timeout });
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

export function listSeries() {
  return getJson('/series');
}

export function getSeries(id) {
  return getJson(`/series/${encodeURIComponent(id)}`);
}

export function listSets() {
  return getJson('/sets');
}

export function getSet(id) {
  return getJson(`/sets/${encodeURIComponent(id)}`);
}

export function getCard(id) {
  return getJson(`/cards/${encodeURIComponent(id)}`);
}

// Busca cartas por nome (usa o parâmetro de filtro da TCGdex). Retorna "briefs".
export async function findCardsByName(name) {
  // A TCGdex filtra por "contém" em name; pedimos página grande.
  const q = encodeURIComponent(name);
  const data = await getJson(`/cards?name=${q}&pagination:itemsPerPage=1000`);
  return Array.isArray(data) ? data : [];
}

// Monta a URL de imagem a partir do campo "image" (que é uma base sem extensão).
export function imageUrl(base, quality = 'low', ext = 'webp') {
  if (!base) return null;
  return `${base}/${quality}.${ext}`;
}

// Deriva o ID do set a partir do ID da carta ("sv08-25" -> "sv08").
export function setIdFromCardId(cardId) {
  if (!cardId) return null;
  const i = cardId.lastIndexOf('-');
  return i > 0 ? cardId.slice(0, i) : cardId;
}

// Limitador de concorrência simples para enriquecer muitos cards sem
// derrubar a API nem o navegador.
export async function mapLimit(items, limit, worker, onProgress) {
  const results = new Array(items.length);
  let index = 0;
  let done = 0;
  let cancelled = false;
  const cancel = () => { cancelled = true; };

  async function run() {
    while (index < items.length && !cancelled) {
      const i = index++;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { __error: String(err) };
      }
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, run);
  const promise = Promise.all(runners).then(() => ({ results, cancelled }));
  return { promise, cancel };
}
