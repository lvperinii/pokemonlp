// scripts/probe.mjs (temporário)
// Sondagem do megadex.com.br: descobre como os dados das cartas estão
// estruturados (JSON embutido tipo Next.js, API, imagens, raridades),
// imprimindo no log do GitHub Actions. Não escreve arquivos.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function get(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/json,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    redirect: 'follow',
  });
  const text = await r.text();
  return { status: r.status, ct: r.headers.get('content-type'), text };
}

function L(s = '') { console.log(s); }

function extractNextData(html) {
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (m) return { kind: '__NEXT_DATA__', json: m[1] };
  // Nuxt / outros: __NUXT__ ou application/json
  const m2 = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (m2) return { kind: 'application/json', json: m2[1] };
  const m3 = html.match(/window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/);
  if (m3) return { kind: '__NUXT__', json: m3[1] };
  return null;
}

function keysDeep(obj, depth = 0, maxDepth = 3, path = '') {
  if (depth > maxDepth || obj == null || typeof obj !== 'object') return [];
  const out = [];
  for (const k of Object.keys(obj)) {
    const p = path ? `${path}.${k}` : k;
    const v = obj[k];
    const t = Array.isArray(v) ? `array[${v.length}]` : typeof v;
    out.push(`${p}: ${t}`);
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keysDeep(v, depth + 1, maxDepth, p));
    else if (Array.isArray(v) && v.length && typeof v[0] === 'object') out.push(...keysDeep(v[0], depth + 1, maxDepth, p + '[0]'));
  }
  return out;
}

try {
  for (const url of ['https://megadex.com.br/sets/', 'https://megadex.com.br/sets/fogo-fantasmagorico']) {
    L('\n============================================================');
    L('URL: ' + url);
    let res;
    try { res = await get(url); }
    catch (e) { L('FALHA no fetch: ' + e.message); continue; }
    L(`status=${res.status}  content-type=${res.ct}  tamanho=${res.text.length}`);
    if (res.status !== 200) { L('corpo (300):' + res.text.slice(0, 300)); continue; }

    const nd = extractNextData(res.text);
    if (nd) {
      L('JSON embutido encontrado: ' + nd.kind + ' (tamanho ' + nd.json.length + ')');
      try {
        const data = JSON.parse(nd.json);
        L('--- chaves (até 3 níveis) ---');
        for (const line of keysDeep(data, 0, 3).slice(0, 120)) L('  ' + line);
        // procurar arrays de cartas
        const s = nd.json.toLowerCase();
        L('menciona "rarid": ' + s.includes('rarid') + ' | "carta"/"card": ' + (s.includes('"cards"') || s.includes('carta')) + ' | "image"/"img": ' + (s.includes('image') || s.includes('img')));
      } catch (e) { L('nao consegui parsear o JSON: ' + e.message + ' | inicio: ' + nd.json.slice(0, 200)); }
    } else {
      L('Sem __NEXT_DATA__/JSON embutido. Procurando pistas de API no HTML...');
      const apis = [...res.text.matchAll(/["'`](\/(api|_next\/data)[^"'`]+|https?:\/\/[^"'`]*(api|megadex)[^"'`]*\.json[^"'`]*)["'`]/g)].map((m) => m[1]);
      L('possiveis endpoints: ' + JSON.stringify([...new Set(apis)].slice(0, 20)));
      // trechos ao redor de "raridade" e "carta"
      const idx = res.text.toLowerCase().indexOf('rarid');
      if (idx >= 0) L('trecho rarid: ' + res.text.slice(idx - 60, idx + 120).replace(/\s+/g, ' '));
      L('inicio do body (600): ' + res.text.replace(/\s+/g, ' ').slice(0, 600));
    }
  }
  L('\n===== FIM DA SONDAGEM =====');
} catch (err) {
  console.error('ERRO:', err);
  process.exit(1);
}
