// Shared helpers: money, dates, ids.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n, w = 2) => String(n).padStart(w, '0');

// 25000 -> "25.000"
export function thousands(n) {
  const s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return n < 0 ? '-' + s : s;
}

// 25000 -> "Rp25.000" (compact, used on receipts); spaced=true -> "Rp 25.000"
export function rp(n, spaced = false) {
  return 'Rp' + (spaced ? ' ' : '') + thousands(n);
}

// Local calendar day, 'YYYY-MM-DD'
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "23 Sep 2026  14:32"
export function receiptDateTime(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ${timeStr(d)}`;
}

export function orderNoStr(n) {
  return '#' + pad(n, 3);
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function lineTotal(line) {
  const addons = line.addons.reduce((s, a) => s + a.price, 0);
  return (line.unit + addons) * line.qty;
}
