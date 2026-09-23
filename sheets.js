// Optional Google Sheets sync through a Google Apps Script web app (see apps-script/Code.gs).
// Orders carry `synced: false` until the script confirms them; the script upserts by
// order_id, so retries and voids never create duplicate rows.

import { allOrders, putOrder } from './db.js';
import { orderRows } from './export.js';

let running = false;

async function post(url, payload) {
  // text/plain keeps this a "simple" CORS request (no preflight, which Apps Script can't answer).
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Sheets returned HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Sheets script error');
  return data;
}

export async function pendingOrders() {
  return (await allOrders()).filter((o) => !o.synced);
}

// Pushes unsynced orders in batches. Returns the number synced.
export async function syncPending(url) {
  if (!url || running || !navigator.onLine) return 0;
  running = true;
  let count = 0;
  try {
    const pending = await pendingOrders();
    for (let i = 0; i < pending.length; i += 25) {
      const batch = pending.slice(i, i + 25);
      await post(url, { orders: batch.map((o) => ({ order_id: o.id, rows: orderRows(o) })) });
      for (const o of batch) { o.synced = true; await putOrder(o); }
      count += batch.length;
    }
  } finally {
    running = false;
  }
  return count;
}

export async function testConnection(url) {
  return post(url, { orders: [] });
}
