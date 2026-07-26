// db.js
// Persistência local com IndexedDB. Guarda:
//  - store "cards": cache das cartas (com raridade, dexId, stage, etc.)
//  - store "sets":  metadados dos sets importados
//  - store "meta":  configurações, cartas possuídas, séries, etc.
// Tudo fica no dispositivo do usuário. Use Exportar/Importar para backup.

const DB_NAME = 'pokemon-lp';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sets')) {
        db.createObjectStore('sets', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeNames, mode);
        const stores = Array.isArray(storeNames)
          ? storeNames.map((n) => t.objectStore(n))
          : t.objectStore(storeNames);
        let result;
        Promise.resolve(fn(stores))
          .then((r) => { result = r; })
          .catch(reject);
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Cards ----
export async function putCards(cards) {
  if (!cards.length) return;
  return tx('cards', 'readwrite', (store) => {
    for (const c of cards) store.put(c);
  });
}

export async function getAllCards() {
  return tx('cards', 'readonly', (store) => reqAsPromise(store.getAll()));
}

export async function getCardById(id) {
  return tx('cards', 'readonly', (store) => reqAsPromise(store.get(id)));
}

export async function deleteCardsBySet(setId) {
  const all = await getAllCards();
  const ids = all.filter((c) => c.setId === setId).map((c) => c.id);
  return tx('cards', 'readwrite', (store) => {
    for (const id of ids) store.delete(id);
  });
}

// ---- Sets ----
export async function putSet(setMeta) {
  return tx('sets', 'readwrite', (store) => store.put(setMeta));
}

export async function getAllSets() {
  return tx('sets', 'readonly', (store) => reqAsPromise(store.getAll()));
}

export async function deleteSet(setId) {
  return tx('sets', 'readwrite', (store) => store.delete(setId));
}

// ---- Meta (chave/valor) ----
export async function getMeta(key, fallback = null) {
  const rec = await tx('meta', 'readonly', (store) => reqAsPromise(store.get(key)));
  return rec ? rec.value : fallback;
}

export async function setMeta(key, value) {
  return tx('meta', 'readwrite', (store) => store.put({ key, value }));
}

// ---- Backup ----
export async function exportAll() {
  const [cards, sets, ownedArr, settings, series] = await Promise.all([
    getAllCards(),
    getAllSets(),
    getMeta('owned', []),
    getMeta('settings', null),
    getMeta('series', []),
  ]);
  return {
    _format: 'pokemon-lp-backup',
    _version: 1,
    exportedAt: new Date().toISOString(),
    cards,
    sets,
    owned: ownedArr,
    settings,
    series,
  };
}

export async function importAll(data) {
  if (!data || data._format !== 'pokemon-lp-backup') {
    throw new Error('Arquivo de backup inválido.');
  }
  if (Array.isArray(data.cards)) await putCards(data.cards);
  if (Array.isArray(data.sets)) {
    for (const s of data.sets) await putSet(s);
  }
  if (Array.isArray(data.owned)) await setMeta('owned', data.owned);
  if (data.settings) await setMeta('settings', data.settings);
  if (Array.isArray(data.series)) await setMeta('series', data.series);
}

export async function clearAll() {
  return tx(['cards', 'sets', 'meta'], 'readwrite', (stores) => {
    stores.forEach((s) => s.clear());
  });
}
