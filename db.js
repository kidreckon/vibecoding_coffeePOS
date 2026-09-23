// Tiny IndexedDB wrapper.
// Stores:
//   kv     – key/value: settings, menu, order counter
//   orders – one record per order (keyPath "id"), indexed by local day

const DB_NAME = 'seceda-pos';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('orders')) {
          const s = db.createObjectStore('orders', { keyPath: 'id' });
          s.createIndex('day', 'day');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function kvGet(key, fallback) {
  const v = await wrap((await store('kv')).get(key));
  return v === undefined ? fallback : v;
}

export async function kvSet(key, value) {
  return wrap((await store('kv', 'readwrite')).put(value, key));
}

export async function putOrder(order) {
  return wrap((await store('orders', 'readwrite')).put(order));
}

export async function getOrder(id) {
  return wrap((await store('orders')).get(id));
}

// Orders whose local day is within [fromDay, toDay] (inclusive, 'YYYY-MM-DD'), oldest first.
export async function ordersBetween(fromDay, toDay) {
  const idx = (await store('orders')).index('day');
  const list = await wrap(idx.getAll(IDBKeyRange.bound(fromDay, toDay)));
  return list.sort((a, b) => a.ts.localeCompare(b.ts));
}

export async function allOrders() {
  const list = await wrap((await store('orders')).getAll());
  return list.sort((a, b) => a.ts.localeCompare(b.ts));
}

// Atomically allocate the next running order number.
// mode 'daily' resets to 1 each new day; 'continuous' never resets.
export async function nextOrderNo(day, mode) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite');
    const s = tx.objectStore('kv');
    const req = s.get('counter');
    let n;
    req.onsuccess = () => {
      const c = req.result || { day, n: 0 };
      n = (mode === 'daily' && c.day !== day) ? 1 : c.n + 1;
      s.put({ day, n }, 'counter');
    };
    tx.oncomplete = () => resolve(n);
    tx.onerror = () => reject(tx.error);
  });
}
