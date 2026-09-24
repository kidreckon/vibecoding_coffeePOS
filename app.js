import * as db from './db.js';
import * as printer from './printer.js';
import { buildEscPos, receiptLines } from './receipt.js';
import { downloadCsv } from './export.js';
import { syncPending, pendingOrders, testConnection } from './sheets.js';
import { SAMPLE_MENU, MENU_VERSION } from './menu.js';
import { rp, dayKey, timeStr, orderNoStr, uid, lineTotal, thousands } from './util.js';
import { ICONS, itemIcon } from './icons.js';

const DEFAULT_SETTINGS = {
  bizName: 'Seceda Homebrew',
  counterMode: 'daily',
  printMode: 'bluetooth',
  sheetsUrl: '',
  payments: ['Cash', 'QRIS', 'Card'],
};

const state = {
  menu: null,
  settings: null,
  cart: [],
  cat: null,
  picker: null,     // { item, addons:Set, qty }
  draft: null,      // menu being edited in Settings
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- Toast ----------
let toastTimer;
function toast(msg, { error = false, actions = [], ms = 3000 } = {}) {
  const el = $('toast');
  el.className = 'toast' + (error ? ' error' : '');
  el.innerHTML = `<span class="msg">${esc(msg)}</span>`;
  for (const [label, fn] of actions) {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = label;
    b.onclick = () => { el.hidden = true; fn(); };
    el.appendChild(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), actions.length ? Math.max(ms, 8000) : ms);
}

// ---------- Navigation ----------
function show(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('button[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.body.classList.toggle('on-order', view === 'order');
  if (view === 'sales') renderSales();
  if (view === 'settings') renderSettings();
  window.scrollTo(0, 0);
}

// ---------- Order screen ----------
const categories = () => [...new Set(state.menu.items.map((i) => i.cat || 'Other'))];

function renderOrder() {
  const cats = categories();
  if (!cats.includes(state.cat)) state.cat = cats[0];
  $('cats').innerHTML = cats.map((c) =>
    `<button data-cat="${esc(c)}" class="${c === state.cat ? 'active' : ''}">${esc(c)}</button>`).join('');
  const counts = {};
  for (const l of state.cart) counts[l.itemId] = (counts[l.itemId] || 0) + l.qty;
  $('grid').innerHTML = state.menu.items
    .filter((i) => (i.cat || 'Other') === state.cat)
    .map((i) => `<button class="tile${counts[i.id] ? ' in-cart' : ''}" data-item="${esc(i.id)}">
        <span class="ico-circle">${itemIcon(i)}</span>
        <span><span class="name">${esc(i.name)}</span>
        <span class="price">${rp(i.price, true)}</span></span>
        ${counts[i.id] ? `<span class="badge">${counts[i.id]}</span>` : ''}
      </button>`).join('');
  renderCartBar();
}

const cartTotal = () => state.cart.reduce((s, l) => s + lineTotal(l), 0);
const cartCount = () => state.cart.reduce((s, l) => s + l.qty, 0);

function renderCartBar() {
  const n = cartCount();
  $('cart-summary').innerHTML = n
    ? `<small>${n} item${n > 1 ? 's' : ''}</small><b>${rp(cartTotal(), true)}</b>`
    : '<small>Tap a drink to start</small><b>Rp 0</b>';
  $('charge-btn').disabled = !n;
}

function addToCart(item, addonIds, qty) {
  const addons = state.menu.addons.filter((a) => addonIds.includes(a.id)).map(({ id, name, price }) => ({ id, name, price }));
  const key = item.id + '|' + addons.map((a) => a.id).sort().join(',');
  const existing = state.cart.find((l) => l.key === key);
  if (existing) existing.qty += qty;
  else state.cart.push({ key, itemId: item.id, name: item.name, unit: item.price, qty, addons });
  renderOrder();
}

function openPicker(item) {
  const available = state.menu.addons.filter((a) => (item.addons || []).includes(a.id));
  if (!available.length) { addToCart(item, [], 1); return; }
  state.picker = { item, addons: new Set(), qty: 1 };
  $('addon-title').textContent = item.name;
  renderPicker();
  $('addon-sheet').hidden = false;
}

function renderPicker() {
  const { item, addons, qty } = state.picker;
  $('addon-grid').innerHTML = state.menu.addons
    .filter((a) => (item.addons || []).includes(a.id))
    .map((a) => `<button data-addon="${esc(a.id)}" class="${addons.has(a.id) ? 'on' : ''}">
        ${esc(a.name)}${a.price ? `<small>+${rp(a.price, true)}</small>` : ''}</button>`).join('');
  $('addon-qty').textContent = qty;
  const unit = item.price + state.menu.addons.filter((a) => addons.has(a.id)).reduce((s, a) => s + a.price, 0);
  $('addon-confirm').textContent = `Add · ${rp(unit * qty, true)}`;
}

async function openCheckout() {
  if (!state.cart.length) return;
  renderCheckout();
  const c = await db.kvGet('counter', null);
  const today = dayKey();
  const next = !c ? 1 : (state.settings.counterMode === 'daily' && c.day !== today ? 1 : c.n + 1);
  $('next-no').textContent = orderNoStr(next);
  $('checkout-sheet').hidden = false;
}

function renderCheckout() {
  $('cart-lines').innerHTML = state.cart.map((l, i) => `
    <div class="cart-line">
      <button class="btn" data-line-dec="${i}">−</button>
      <div class="info"><b>${l.qty}× ${esc(l.name)}</b>
        ${l.addons.length ? `<small>+ ${l.addons.map((a) => esc(a.name)).join(', ')}</small>` : ''}</div>
      <span class="amt">${rp(lineTotal(l), true)}</span>
      <button class="btn" data-line-inc="${i}">+</button>
    </div>`).join('');
  $('cart-total').textContent = rp(cartTotal(), true);
  $('pay-grid').innerHTML = state.settings.payments
    .map((p) => `<button class="btn" data-pay="${esc(p)}">${esc(p)}</button>`).join('');
}

function closeSheets() {
  $('addon-sheet').hidden = true;
  $('checkout-sheet').hidden = true;
  state.picker = null;
}

let charging = false;
async function charge(payment) {
  if (charging || !state.cart.length) return;
  charging = true;
  try {
    const now = new Date();
    const day = dayKey(now);
    const no = await db.nextOrderNo(day, state.settings.counterMode);
    const order = {
      id: uid(), no, day, ts: now.toISOString(), payment, status: 'ok', synced: false,
      customer: $('cust-name').value.trim(),
      lines: state.cart.map(({ name, unit, qty, addons }) => ({ name, unit, qty, addons })),
      total: cartTotal(),
    };
    await db.putOrder(order);
    state.cart = [];
    $('cust-name').value = '';
    closeSheets();
    renderOrder();
    toast(`Order ${orderNoStr(no)} saved · ${rp(order.total, true)}`);
    printOrder(order);
    autoSync();
  } finally {
    charging = false;
  }
}

// ---------- Printing ----------
// Reprint / test print should still print even when auto-print is off.
const printModeForManual = () => (state.settings.printMode === 'none' ? 'bluetooth' : state.settings.printMode);

function systemPrint(order) {
  $('print-area').innerHTML = receiptLines(order, state.settings.bizName)
    .map((r) => `<div class="${r.big ? 'big' : r.bold ? 'bold' : ''}">${esc(r.text) || '&nbsp;'}</div>`).join('');
  window.print();
}

async function printOrder(order, mode = state.settings.printMode) {
  if (mode === 'none') return;
  if (mode === 'system') { systemPrint(order); return; }
  if (mode === 'rawbt') { printer.printViaRawBT(buildEscPos(order, state.settings.bizName)); return; }
  try {
    await printer.printBytes(buildEscPos(order, state.settings.bizName));
    toast(`${order.no ? orderNoStr(order.no) + ' s' : 'S'}ent to printer ✓`, { ms: 1500 });
  } catch (err) {
    if (err && err.name === 'NotFoundError') return; // user closed the device picker
    toast(`Print failed: ${err.message || err}`, {
      error: true,
      actions: [['Reprint', () => printOrder(order, 'bluetooth')], ['Phone print', () => systemPrint(order)]],
    });
  }
}

function renderPrinter() {
  const ok = printer.isConnected();
  const rawbt = state.settings.printMode === 'rawbt';
  const btn = $('printer-btn');
  btn.textContent = rawbt ? '🖨 Test print' : ok ? '🖨 Ready' : '🖨 Connect';
  btn.dataset.action = rawbt ? 'test-print' : 'printer-connect';
  btn.classList.toggle('ok', ok && !rawbt);
  $('ble-printer').hidden = rawbt;
  $('rawbt-help').hidden = !rawbt;
  $('ble-trouble').hidden = rawbt;
  $('printer-status').textContent = !printer.supported()
    ? 'This browser cannot use Bluetooth. Use Chrome on Android (or the Bluefy browser on iPhone), or choose "phone print dialog" above.'
    : ok ? `Connected to ${printer.deviceName() || 'printer'}.` : 'Not connected. Turn the printer on, then tap Connect printer.';
  $('channels').innerHTML = printer.listChannels().map((c) =>
    `<button data-channel="${c.index}" class="${c.active ? 'on' : ''}">${esc(c.label)}${c.active ? ' ✓' : ''}</button>`).join('');
}

async function probeChannels() {
  try {
    const n = await printer.probeChannels();
    toast(`Sent a test line to ${n} channel${n > 1 ? 's' : ''}. Tap the one that printed.`, { ms: 5000 });
  } catch (err) {
    if (err.name !== 'NotFoundError') toast(err.message || String(err), { error: true });
  }
  renderPrinter();
}

async function connectPrinter() {
  try {
    await printer.connect();
    toast(`Printer connected: ${printer.deviceName() || 'OK'}`);
  } catch (err) {
    if (err.name !== 'NotFoundError') toast(err.message || String(err), { error: true });
  }
  renderPrinter();
}

// ---------- Sales ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Compact money for big stat numbers: 1250000 -> "Rp 1,25jt", 85000 -> "Rp 85rb"
function rpShort(n) {
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace('.', ',').replace(/,?0+$/, '') + 'jt';
  if (n >= 1e4) return 'Rp ' + Math.round(n / 1e3) + 'rb';
  return rp(n, true);
}

function statCard(label, value, icon, hero = false) {
  return `<div class="stat${hero ? ' hero' : ''}">
    <span class="ico-circle">${icon}</span>
    <div><small>${esc(label)}</small><b>${esc(value)}</b></div>
  </div>`;
}

// Bar chart as inline SVG. bars: [{label, value}]
function barChart(bars) {
  const W = 560, H = 240, padL = 34, padB = 26, padT = 10;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * 4;
  const plotW = W - padL, plotH = H - padB - padT;
  const slot = plotW / bars.length;
  const bw = Math.min(46, slot * 0.62);
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const y = padT + plotH - (plotH * i) / 4;
    out += `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" stroke="#343434" stroke-dasharray="3 4"/>`;
    out += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" fill="#9a9aa0" font-size="12">${step * i}</text>`;
  }
  bars.forEach((b, i) => {
    const h = (plotH * b.value) / top;
    const x = padL + slot * i + (slot - bw) / 2;
    if (b.value) out += `<rect x="${x}" y="${padT + plotH - h}" width="${bw}" height="${h}" rx="6" fill="#bfe7da"><title>${esc(b.label)}: ${b.value}</title></rect>`;
    out += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" fill="#9a9aa0" font-size="12">${esc(b.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Orders chart">${out}</svg>`;
}

function chartData(valid, from, to) {
  if (from === to) {
    // Orders per hour for a single day
    const hours = valid.map((o) => new Date(o.ts).getHours());
    const lo = Math.min(8, ...hours), hi = Math.max(20, ...hours);
    const bars = [];
    for (let h = lo; h <= hi; h++) bars.push({ label: String(h), value: hours.filter((x) => x === h).length });
    return { title: 'Orders by hour', bars };
  }
  // Orders per day (last 14 days of the range at most)
  const days = [];
  const end = new Date(to + 'T00:00:00');
  for (let d = new Date(end); dayKey(d) >= from && days.length < 14; d.setDate(d.getDate() - 1)) days.unshift(new Date(d));
  const short = days.length > 7;
  return {
    title: 'Orders by day',
    bars: days.map((d) => ({
      label: short ? String(d.getDate()) : DOW[d.getDay()],
      value: valid.filter((o) => o.day === dayKey(d)).length,
    })),
  };
}

async function renderSales() {
  const from = $('from').value || dayKey();
  const to = $('to').value || from;
  const orders = await db.ordersBetween(from, to);
  const valid = orders.filter((o) => o.status !== 'void');
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const items = valid.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty, 0), 0);
  $('stats').innerHTML = [
    statCard('Revenue', rpShort(revenue), ICONS.money, true),
    statCard('Paid orders', valid.length, ICONS.receipt),
    statCard('Items sold', items, ICONS.cup),
    statCard('Average order', valid.length ? rpShort(Math.round(revenue / valid.length)) : '–', ICONS.tag),
  ].join('');

  const byPay = {};
  for (const o of valid) byPay[o.payment] = (byPay[o.payment] || 0) + o.total;
  $('pay-split').innerHTML = valid.length
    ? `Revenue Rp ${thousands(revenue)} · ` + Object.entries(byPay).map(([k, v]) => `${esc(k)} <b>${rp(v, true)}</b>`).join(' · ')
    : '';

  // Top items
  const tally = {};
  const itemByName = Object.fromEntries(state.menu.items.map((i) => [i.name, i]));
  for (const o of valid) for (const l of o.lines) {
    const t = (tally[l.name] ||= { qty: 0, amt: 0 });
    t.qty += l.qty;
    t.amt += lineTotal(l);
  }
  const top = Object.entries(tally).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  $('top-items').innerHTML = top.length ? top.map(([name, t]) => `
    <div class="top-item">
      <span class="ico-circle sm">${itemIcon(itemByName[name] || { name })}</span>
      <div><div class="t-name">${esc(name)}</div><div class="t-sub">Sold: ${t.qty}</div></div>
      <span class="t-amt">${rpShort(t.amt)}</span>
    </div>`).join('') : '<p class="empty">No sales yet in this range.</p>';

  const chart = chartData(valid, from, to);
  $('chart-title').textContent = chart.title;
  $('chart').innerHTML = valid.length ? barChart(chart.bars) : '<p class="empty">No orders yet.</p>';

  $('orders').innerHTML = orders.slice().reverse().map((o) => `
    <div class="order-card ${o.status === 'void' ? 'void' : ''}">
      <header><span>${orderNoStr(o.no)}${o.customer ? ' · ' + esc(o.customer) : ''}</span><span class="o-total">${rp(o.total, true)}</span></header>
      <div class="o-meta">${esc(dateLabel(o.day))} ${timeStr(new Date(o.ts))} · ${esc(o.payment)}${o.status === 'void' ? ' · VOID' : ''}${state.settings.sheetsUrl && !o.synced ? ' · not synced' : ''}</div>
      <div class="o-items">${o.lines.map((l) => `${l.qty}× ${esc(l.name)}${l.addons.length ? ' (' + l.addons.map((a) => esc(a.name)).join(', ') + ')' : ''}`).join('<br>')}</div>
      <div class="row">
        <button class="btn small" data-reprint="${esc(o.id)}">🖨 Reprint</button>
        <button class="btn small" data-void="${esc(o.id)}">${o.status === 'void' ? 'Un-void' : 'Void'}</button>
      </div>
    </div>`).join('') || '<p class="empty">No orders in this range.</p>';
  renderSyncLine();
}

// '2026-09-24' -> '24 Sep'
function dateLabel(day) {
  const [, m, d] = day.split('-');
  return `${+d} ${MONTHS[+m - 1]}`;
}

async function renderSyncLine() {
  const el = $('sync-line');
  if (!state.settings.sheetsUrl) { el.innerHTML = 'Google Sheets sync is off (set it up in Settings).'; return; }
  const n = (await pendingOrders()).length;
  el.innerHTML = n
    ? `${n} order${n > 1 ? 's' : ''} waiting to sync to Google Sheets <button class="btn small" data-action="sync-now">Sync now</button>`
    : '✓ All orders synced to Google Sheets';
}

async function exportCsv() {
  const from = $('from').value || dayKey();
  const to = $('to').value || from;
  const orders = await db.ordersBetween(from, to);
  if (!orders.length) { toast('No orders in this range'); return; }
  downloadCsv(orders, from === to ? `seceda-sales-${from}.csv` : `seceda-sales-${from}_to_${to}.csv`);
}

async function toggleVoid(id) {
  const o = await db.getOrder(id);
  if (!o) return;
  if (o.status !== 'void' && !confirm(`Void order ${orderNoStr(o.no)} (${rp(o.total, true)})?`)) return;
  o.status = o.status === 'void' ? 'ok' : 'void';
  o.synced = false;
  await db.putOrder(o);
  renderSales();
  autoSync();
}

// ---------- Google Sheets ----------
async function autoSync(manual = false) {
  const url = state.settings.sheetsUrl;
  if (!url) { if (manual) toast('Add your Google Sheets script URL in Settings first', { error: true }); return; }
  try {
    const n = await syncPending(url);
    if (manual) toast(n ? `Synced ${n} order${n > 1 ? 's' : ''}` : 'Nothing to sync');
  } catch (err) {
    if (manual) toast('Sync failed: ' + (err.message || err), { error: true });
  }
  if ($('view-sales').classList.contains('active')) renderSales();
}

// ---------- Settings & menu editor ----------
function renderSettings() {
  const s = state.settings;
  $('s-biz').value = s.bizName;
  $('s-counter').value = s.counterMode;
  $('s-print').value = s.printMode;
  $('s-sheets').value = s.sheetsUrl;
  if (!state.draft) state.draft = clone(state.menu);
  renderPrinter();
  renderMenuEditor();
}

function renderMenuEditor() {
  const m = state.draft;
  $('menu-items').innerHTML = m.items.map((it, i) => `
    <div class="edit-card">
      <div class="row">
        <label>Name <input data-item-field="name" data-i="${i}" value="${esc(it.name)}"></label>
        <button class="btn small danger" data-item-del="${i}">✕</button>
      </div>
      <div class="row">
        <label>Price (Rp) <input type="number" inputmode="numeric" min="0" step="500" data-item-field="price" data-i="${i}" value="${it.price}"></label>
        <label>Category <input data-item-field="cat" data-i="${i}" value="${esc(it.cat || '')}" list="cat-list"></label>
      </div>
      <div class="toggles">${m.addons.map((a) =>
        `<button data-item-addon="${i}" data-addon-id="${esc(a.id)}" class="${(it.addons || []).includes(a.id) ? 'on' : ''}">${esc(a.name)}</button>`).join('')}</div>
    </div>`).join('') +
    `<datalist id="cat-list">${[...new Set(m.items.map((i) => i.cat))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
  $('menu-addons').innerHTML = m.addons.map((a, i) => `
    <div class="edit-card"><div class="row">
      <label>Name <input data-addon-field="name" data-i="${i}" value="${esc(a.name)}"></label>
      <label>Price (Rp) <input type="number" inputmode="numeric" min="0" step="500" data-addon-field="price" data-i="${i}" value="${a.price}"></label>
      <button class="btn small danger" data-addon-del="${i}">✕</button>
    </div></div>`).join('');
}

async function saveSettings() {
  const s = state.settings;
  s.bizName = $('s-biz').value.trim() || DEFAULT_SETTINGS.bizName;
  s.counterMode = $('s-counter').value;
  s.printMode = $('s-print').value;
  s.sheetsUrl = $('s-sheets').value.trim();
  const m = state.draft;
  m.items = m.items.filter((i) => i.name.trim());
  m.addons = m.addons.filter((a) => a.name.trim());
  for (const i of m.items) { i.name = i.name.trim(); i.cat = (i.cat || '').trim() || 'Other'; i.price = Math.max(0, Math.round(+i.price || 0)); }
  for (const a of m.addons) { a.name = a.name.trim(); a.price = Math.max(0, Math.round(+a.price || 0)); }
  state.menu = clone(m);
  await db.kvSet('settings', s);
  await db.kvSet('menu', state.menu);
  document.querySelectorAll('.brand-name').forEach((el) => (el.textContent = s.bizName));
  renderMenuEditor();
  renderOrder();
  toast('Saved');
  autoSync();
}

// ---------- Events ----------
function onClick(e) {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;

  if (d.view) return show(d.view);
  if (d.cat) { state.cat = d.cat; return renderOrder(); }
  if (d.item) { const item = state.menu.items.find((i) => i.id === d.item); if (item) openPicker(item); return; }
  if (d.addon && state.picker) {
    const set = state.picker.addons;
    set.has(d.addon) ? set.delete(d.addon) : set.add(d.addon);
    // Hot/Iced are mutually exclusive
    if (d.addon === 'hot') set.delete('iced');
    if (d.addon === 'iced') set.delete('hot');
    return renderPicker();
  }
  if (d.lineInc !== undefined) { state.cart[+d.lineInc].qty++; renderCheckout(); return renderOrder(); }
  if (d.lineDec !== undefined) {
    const l = state.cart[+d.lineDec];
    if (--l.qty <= 0) state.cart.splice(+d.lineDec, 1);
    renderOrder();
    if (!state.cart.length) return closeSheets();
    return renderCheckout();
  }
  if (d.pay) return charge(d.pay);
  if (d.reprint) return db.getOrder(d.reprint).then((o) => o && printOrder(o, printModeForManual()));
  if (d.void) return toggleVoid(d.void);
  if (d.channel !== undefined) { printer.useChannel(+d.channel); return toast('Printer channel saved. Try Test print.'); }

  if (d.itemDel !== undefined) { state.draft.items.splice(+d.itemDel, 1); return renderMenuEditor(); }
  if (d.addonDel !== undefined) {
    const [a] = state.draft.addons.splice(+d.addonDel, 1);
    for (const it of state.draft.items) it.addons = (it.addons || []).filter((id) => id !== a.id);
    return renderMenuEditor();
  }
  if (d.itemAddon !== undefined) {
    const it = state.draft.items[+d.itemAddon];
    it.addons = it.addons || [];
    const k = it.addons.indexOf(d.addonId);
    k >= 0 ? it.addons.splice(k, 1) : it.addons.push(d.addonId);
    t.classList.toggle('on', k < 0);
    return;
  }

  switch (d.action) {
    case 'qty-inc': state.picker.qty++; return renderPicker();
    case 'qty-dec': state.picker.qty = Math.max(1, state.picker.qty - 1); return renderPicker();
    case 'addon-confirm': {
      const { item, addons, qty } = state.picker;
      closeSheets();
      return addToCart(item, [...addons], qty);
    }
    case 'sheet-close': return closeSheets();
    case 'checkout-open': return openCheckout();
    case 'cart-clear': state.cart = []; $('cust-name').value = ''; closeSheets(); return renderOrder();
    case 'printer-connect': return connectPrinter();
    case 'probe-channels': return probeChannels();
    case 'test-print': return printOrder({
      no: 0, ts: new Date().toISOString(), total: 33000,
      lines: [{ name: 'Test Latte', unit: 28000, qty: 1, addons: [{ name: 'Oat milk', price: 5000 }, { name: 'Iced', price: 0 }] }],
    }, printModeForManual());
    case 'export': return exportCsv();
    case 'sync-now': return autoSync(true);
    case 'sheets-test': {
      const url = $('s-sheets').value.trim();
      if (!url) return toast('Paste the script URL first', { error: true });
      return testConnection(url).then(() => toast('✓ Google Sheets connected — tap Save'))
        .catch((err) => toast('Could not reach the script: ' + (err.message || err), { error: true }));
    }
    case 'settings-save': return saveSettings();
    case 'item-add':
      state.draft.items.push({ id: uid(), name: 'New item', price: 20000, cat: state.draft.items.at(-1)?.cat || 'Coffee', addons: [] });
      return renderMenuEditor();
    case 'addon-add':
      state.draft.addons.push({ id: uid(), name: 'New add-on', price: 0 });
      return renderMenuEditor();
    case 'menu-reset':
      if (confirm('Replace the menu with the sample menu? (Tap Save afterwards to keep it.)')) {
        state.draft = clone(SAMPLE_MENU);
        renderMenuEditor();
      }
  }
}

function onInput(e) {
  const t = e.target, d = t.dataset;
  if (d.itemField) state.draft.items[+d.i][d.itemField] = d.itemField === 'price' ? +t.value : t.value;
  if (d.addonField) state.draft.addons[+d.i][d.addonField] = d.addonField === 'price' ? +t.value : t.value;
}

// Keep the screen awake while the POS is open (supported on Android Chrome & recent iOS).
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
}

// ---------- Boot ----------
async function init() {
  state.settings = { ...DEFAULT_SETTINGS, ...(await db.kvGet('settings', {})) };
  state.menu = await db.kvGet('menu', null);
  if (!state.menu || (await db.kvGet('menuVersion', 0)) < MENU_VERSION) {
    state.menu = clone(SAMPLE_MENU);
    await db.kvSet('menu', state.menu);
    await db.kvSet('menuVersion', MENU_VERSION);
  }
  document.querySelectorAll('.brand-name').forEach((el) => (el.textContent = state.settings.bizName));
  $('from').value = $('to').value = dayKey();

  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  $('from').addEventListener('change', renderSales);
  $('to').addEventListener('change', renderSales);
  $('cust-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('s-print').addEventListener('change', async () => {
    state.settings.printMode = $('s-print').value;
    await db.kvSet('settings', state.settings);
    renderPrinter();
  });
  document.querySelectorAll('.sheet').forEach((s) => s.addEventListener('click', (e) => { if (e.target === s) closeSheets(); }));
  window.addEventListener('online', () => autoSync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); autoSync(); } });
  printer.onChange(renderPrinter);

  show('order');
  renderOrder();
  renderPrinter();
  keepAwake();
  autoSync();
  printer.reconnect().catch(() => {}).finally(renderPrinter);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
