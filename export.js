// Order -> flat rows (one per line item), shared by CSV export and Google Sheets sync.

import { lineTotal, timeStr } from './util.js';

export const COLUMNS = [
  'order_no', 'date', 'time', 'item', 'qty', 'unit_price', 'addons', 'addons_price',
  'line_total', 'order_total', 'payment', 'status', 'order_id', 'customer',
];

export function orderRows(order) {
  const t = new Date(order.ts);
  return order.lines.map((l) => [
    order.no,
    order.day,
    timeStr(t),
    l.name,
    l.qty,
    l.unit,
    l.addons.map((a) => a.name).join(' + '),
    l.addons.reduce((s, a) => s + a.price, 0),
    lineTotal(l),
    order.total,
    order.payment,
    order.status,
    order.id,
    order.customer || '',
  ]);
}

function cell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(orders) {
  const lines = [COLUMNS.join(',')];
  for (const o of orders) for (const r of orderRows(o)) lines.push(r.map(cell).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function downloadCsv(orders, filename) {
  const blob = new Blob(['﻿' + toCsv(orders)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
