// Receipt layout for 58mm thermal paper (384 dots = 32 chars/line in font A).
// receiptLines() is the plain-text layout (shared by ESC/POS and the system-print fallback);
// buildEscPos() turns it into printer bytes.

import { rp, receiptDateTime, orderNoStr } from './util.js';

export const WIDTH = 32;

function ascii(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?');
}

// Left text + right-aligned amount; wraps the left text if needed.
function leftRight(left, right, indent = '') {
  const room = WIDTH - right.length - 1;
  const out = [];
  let rest = left;
  while (rest.length > room) {
    let cut = rest.lastIndexOf(' ', room);
    if (cut <= indent.length) cut = room;
    out.push(rest.slice(0, cut).trimEnd());
    rest = indent + rest.slice(cut).trimStart();
  }
  out.push(rest.padEnd(WIDTH - right.length) + right);
  return out;
}

const center = (s) => ' '.repeat(Math.max(0, Math.floor((WIDTH - s.length) / 2))) + s;
const rule = '-'.repeat(WIDTH);

// Returns [{text, big?, bold?}] rows.
export function receiptLines(order, bizName) {
  const rows = [];
  rows.push({ text: ascii(bizName).toUpperCase(), big: true, center: true });
  rows.push({ text: 'Order ' + orderNoStr(order.no), big: true, center: true });
  rows.push({ text: rule });
  for (const l of order.lines) {
    for (const t of leftRight(`${l.qty}x ${ascii(l.name)}`, rp(l.unit * l.qty), '   ')) rows.push({ text: t });
    for (const a of l.addons) {
      const price = a.price ? rp(a.price * l.qty) : '';
      for (const t of leftRight(`   + ${ascii(a.name)}`, price, '     ')) rows.push({ text: t });
    }
  }
  rows.push({ text: rule });
  rows.push({ text: 'TOTAL'.padEnd(WIDTH - rp(order.total).length) + rp(order.total), bold: true });
  rows.push({ text: rule });
  rows.push({ text: center(receiptDateTime(new Date(order.ts))) });
  return rows;
}

// ESC/POS bytes
const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

export function buildEscPos(order, bizName) {
  const bytes = [ESC, 0x40]; // init
  const push = (...b) => bytes.push(...b);
  const text = (s) => { for (const ch of s) push(ch.charCodeAt(0)); push(LF); };

  for (const row of receiptLines(order, bizName)) {
    if (row.big) {
      // double width+height fits 16 chars; longer names get double height only
      push(ESC, 0x61, 1, GS, 0x21, row.text.length <= WIDTH / 2 ? 0x11 : 0x01);
      text(row.text);
      push(GS, 0x21, 0x00, ESC, 0x61, 0);
    } else if (row.bold) {
      push(ESC, 0x45, 1); text(row.text); push(ESC, 0x45, 0);
    } else {
      text(row.text);
    }
  }
  push(ESC, 0x64, 3);          // feed 3 lines so the tear bar clears the text
  push(GS, 0x56, 0x42, 0x00);  // partial cut (ignored by printers without a cutter)
  return new Uint8Array(bytes);
}
