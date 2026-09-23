// Bluetooth (BLE) ESC/POS printing via Web Bluetooth (Android Chrome, or Bluefy on iPhone).
// Cheap 58mm printers (EPPOS, Goojprt, "MTP-II", etc.) expose one of a handful of
// serial-over-BLE services; we connect, find the first writable characteristic and
// stream bytes to it in small chunks.

const SERVICES = [
  0x18f0, 0xff00, 0xffe0, 0xfee7, 0xae30, 0xae00,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

let device = null;
let characteristic = null;
const listeners = new Set();

export const supported = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
export const isConnected = () => !!(device && device.gatt.connected && characteristic);
export const deviceName = () => (device && device.name) || '';
export function onChange(fn) { listeners.add(fn); }
const emit = () => listeners.forEach((fn) => fn());

async function attach(dev) {
  device = dev;
  device.removeEventListener('gattserverdisconnected', onDisconnect);
  device.addEventListener('gattserverdisconnected', onDisconnect);
  const server = await device.gatt.connect();
  characteristic = null;
  const services = await server.getPrimaryServices();
  for (const svc of services) {
    let chars = [];
    try { chars = await svc.getCharacteristics(); } catch { continue; }
    const c = chars.find((ch) => ch.properties.write || ch.properties.writeWithoutResponse);
    if (c) { characteristic = c; break; }
  }
  if (!characteristic) {
    device.gatt.disconnect();
    throw new Error('No writable printer characteristic found on this device.');
  }
  emit();
}

function onDisconnect() { characteristic = null; emit(); }

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

export async function printBytes(bytes) {
  await ensure();
  const withResponse = characteristic.properties.write;
  // Writes with response can use long writes; write-without-response must fit the default MTU.
  const size = withResponse ? 100 : 20;
  for (let i = 0; i < bytes.length; i += size) {
    const chunk = bytes.slice(i, i + size);
    if (withResponse) {
      await characteristic.writeValueWithResponse(chunk);
    } else {
      await characteristic.writeValueWithoutResponse(chunk);
      await sleep(15);
    }
  }
}
