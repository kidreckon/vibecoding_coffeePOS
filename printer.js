// Bluetooth (BLE) ESC/POS printing via Web Bluetooth (Android Chrome, or Bluefy on iPhone).
// Cheap 58mm printers (EPPOS, Goojprt, "MTP-II", etc.) expose one of a handful of
// serial-over-BLE services, often with several writable characteristics of which only
// one actually prints. We collect every writable characteristic as a "channel", pick the
// best-known one (or the one the user chose in Settings), and stream bytes in small chunks.

const SERVICES = [
  0x18f0, 0xff00, 0xffe0, 0xfee7, 0xae30, 0xae00, 0xff10, 0xfff0, 0xae3a,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
];

// Characteristics known to be the print data channel on common printers, best first.
const PREFERRED = [
  '00002af1-0000-1000-8000-00805f9b34fb', // 0x18F0 service
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // e7810a71 service
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // ISSC transparent UART (TX)
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000fff2-0000-1000-8000-00805f9b34fb',
];

const CHUNK = 20;        // fits the default BLE MTU on every printer
const CHANNEL_KEY = 'seceda-printer-channel';

let device = null;
let channels = [];       // [{ service, uuid, char, props }]
let active = null;
const listeners = new Set();

export const supported = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
export const isConnected = () => !!(device && device.gatt.connected && active);
export const deviceName = () => (device && device.name) || '';
export function onChange(fn) { listeners.add(fn); }
const emit = () => listeners.forEach((fn) => fn());

const short = (uuid) => (/^0000[0-9a-f]{4}-0000-1000-8000-00805f9b34fb$/.test(uuid) ? uuid.slice(4, 8) : uuid.slice(0, 8));

function savedChannel() {
  try { return localStorage.getItem(CHANNEL_KEY); } catch { return null; }
}

async function attach(dev) {
  device = dev;
  device.removeEventListener('gattserverdisconnected', onDisconnect);
  device.addEventListener('gattserverdisconnected', onDisconnect);
  const server = await device.gatt.connect();
  channels = [];
  for (const svc of await server.getPrimaryServices()) {
    let chars = [];
    try { chars = await svc.getCharacteristics(); } catch { continue; }
    for (const c of chars) {
      if (c.properties.write || c.properties.writeWithoutResponse) {
        channels.push({ service: svc.uuid, uuid: c.uuid, char: c, props: c.properties });
      }
    }
  }
  if (!channels.length) {
    device.gatt.disconnect();
    throw new Error('No writable printer channel found on this device.');
  }
  const saved = savedChannel();
  active = channels.find((ch) => ch.service + '/' + ch.uuid === saved)
    || PREFERRED.map((u) => channels.find((ch) => ch.uuid === u)).find(Boolean)
    || channels[0];
  emit();
}

function onDisconnect() { active = null; emit(); }

// Must be called from a user tap (browser requirement for the device picker).
export async function connect() {
  if (!supported()) throw new Error('Bluetooth printing needs Chrome on Android (or the Bluefy browser on iPhone).');
  const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SERVICES });
  await attach(dev);
}

// Reconnect to a previously chosen printer without showing the picker, when possible.
export async function reconnect() {
  if (device) { await attach(device); return true; }
  if (navigator.bluetooth && navigator.bluetooth.getDevices) {
    const devs = await navigator.bluetooth.getDevices();
    if (devs.length) { await attach(devs[0]); return true; }
  }
  return false;
}

async function ensure() {
  if (isConnected()) return;
  if (await reconnect().catch(() => false)) return;
  await connect();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function writeTo(ch, bytes) {
  // Prefer write-without-response (what these printers expect); pace it so the buffer keeps up.
  const noResp = ch.props.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    if (noResp) {
      await ch.char.writeValueWithoutResponse(chunk);
      await sleep(20);
    } else {
      await ch.char.writeValueWithResponse(chunk);
    }
  }
}

export async function printBytes(bytes) {
  await ensure();
  await writeTo(active, bytes);
}

// ---- Troubleshooting ----

export function listChannels() {
  return channels.map((ch, i) => ({
    index: i,
    label: `Channel ${i + 1} (${short(ch.service)}/${short(ch.uuid)}${/^0000/.test(ch.uuid) ? '' : '-' + ch.uuid.slice(9, 13)})`,
    active: ch === active,
  }));
}

export function useChannel(i) {
  active = channels[i];
  try { localStorage.setItem(CHANNEL_KEY, active.service + '/' + active.uuid); } catch { /* ignore */ }
  emit();
}

// Sends "CHANNEL n" to every writable channel so you can see which one prints.
export async function probeChannels() {
  await ensure();
  const enc = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
  for (let i = 0; i < channels.length; i++) {
    try {
      await writeTo(channels[i], new Uint8Array([0x1b, 0x40]));
      await writeTo(channels[i], enc(`CHANNEL ${i + 1} WORKS\n\n\n`));
    } catch { /* channel rejected the write; skip */ }
    await sleep(400);
  }
  return channels.length;
}

// ---- RawBT (classic Bluetooth) ----
// Many printers (e.g. ones used with GrabMerchant) only print over classic Bluetooth (SPP),
// which browsers cannot reach. The free Android app "RawBT" bridges it: we hand it the
// ESC/POS bytes through an Android intent and it sends them to the paired printer.
export function printViaRawBT(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  window.location.href = 'intent:base64,' + btoa(bin) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
}
