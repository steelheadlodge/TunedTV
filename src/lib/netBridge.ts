import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { TvNet } from '../../modules/tv-net';

/**
 * Native cap "net" (1.0.15+): raw home-network sockets for the web app's TV drivers (Samsung, LG,
 * Google TV, Vizio, TiVo, Apple TV…). The web page implements every protocol on top of these, so
 * new brands and fixes ship as web updates. Guard rails live here, not in the page:
 * - only the TunedTV page may use it (`isNetOrigin`),
 * - only private IPv4 addresses are reachable, never the internet,
 * - sockets die with the page that opened them (`resetNet` on every page load).
 */

export const NET_VERSION = 1;

const MAX_SOCKETS = 24;
const MAX_WRITE_BYTES = 1_000_000;
const MAX_SCAN_HOSTS = 512;
const MAX_SCAN_PORTS = 32;

type Inject = (script: string) => void;

let inject: Inject | null = null;
const open = new Set<string>();

function isPrivateIp(ip: unknown): ip is string {
  if (typeof ip !== 'string') return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

const isPort = (p: unknown): p is number => typeof p === 'number' && Number.isInteger(p) && p > 0 && p < 65536;
const isB64 = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9+/=]*$/.test(s);
const clampMs = (v: unknown, def: number, max: number) =>
  typeof v === 'number' && v > 0 ? Math.min(Math.round(v), max) : def;

export function isNetOrigin(pageUrl: string | undefined, devOrigin?: string): boolean {
  if (!pageUrl) return false;
  try {
    const u = new URL(pageUrl);
    if (devOrigin && u.origin === devOrigin) return true;
    return u.protocol === 'https:' && (u.hostname === 'tunedtv.com' || u.hostname === 'www.tunedtv.com');
  } catch {
    return false;
  }
}

function emit(detail: Record<string, unknown>): void {
  const json = JSON.stringify(detail);
  inject?.(`(function(){try{window.dispatchEvent(new CustomEvent('tunedtv:net-event',{detail:${json}}));}catch(e){}})();true;`);
}

function reply(id: string, body: { ok: true; result?: unknown } | { ok: false; error: string }): void {
  const json = JSON.stringify({ id, ...body });
  inject?.(`(function(){try{window.dispatchEvent(new CustomEvent('tunedtv:net-reply',{detail:${json}}));}catch(e){}})();true;`);
}

// Native starts reading as soon as a socket connects, so a TV that speaks first can deliver data
// before `tcpOpen` resolves here. Hold those events until the socket is registered.
const early = new Map<string, Record<string, unknown>[]>();

function deliver(id: string, event: Record<string, unknown>): void {
  if (open.has(id)) {
    if (event.kind === 'close') open.delete(id);
    emit(event);
    return;
  }
  const list = early.get(id) ?? [];
  list.push(event);
  early.set(id, list);
  setTimeout(() => early.delete(id), 5000);
}

function flushEarly(id: string): void {
  const list = early.get(id);
  early.delete(id);
  for (const event of list ?? []) deliver(id, event);
}

let listening = false;
function listen(): void {
  if (listening || !TvNet) return;
  listening = true;
  TvNet.addListener('onTcpData', (e) => deliver(e.id, { kind: 'data', sock: e.id, data: e.data }));
  TvNet.addListener('onTcpClose', (e) => deliver(e.id, { kind: 'close', sock: e.id, error: e.error ?? null }));
}

/** Closes every socket the previous page opened. Call when the WebView starts a new load. */
export function resetNet(): void {
  open.clear();
  early.clear();
  void TvNet?.closeAll().catch(() => {});
}

export const netAvailable = () => TvNet != null;

async function ownSubnet(): Promise<{ ip: string; hosts: string[] } | null> {
  const state = await Network.getNetworkStateAsync().catch(() => null);
  if (state?.type !== Network.NetworkStateType.WIFI && state?.type !== Network.NetworkStateType.ETHERNET) return null;
  const ip = await Network.getIpAddressAsync().catch(() => null);
  if (!isPrivateIp(ip)) return null;
  const prefix = ip.split('.').slice(0, 3).join('.');
  const hosts: string[] = [];
  for (let i = 1; i <= 254; i++) if (`${prefix}.${i}` !== ip) hosts.push(`${prefix}.${i}`);
  return { ip, hosts };
}

type Msg = Record<string, unknown> & { op?: unknown };

async function run(m: Msg): Promise<unknown> {
  const net = TvNet;
  if (!net) throw new Error('unavailable');
  switch (m.op) {
    case 'info': {
      const sub = await ownSubnet();
      return { version: NET_VERSION, platform: Platform.OS, ip: sub?.ip ?? null, wifi: sub != null };
    }
    case 'open': {
      if (!isPrivateIp(m.host) || !isPort(m.port)) throw new Error('bad_request');
      if (open.size >= MAX_SOCKETS) throw new Error('too_many_sockets');
      if (m.clientP12 !== undefined && (!isB64(m.clientP12) || (m.clientP12 as string).length > 20_000)) {
        throw new Error('bad_request');
      }
      const r = await net.tcpOpen({
        host: m.host,
        port: m.port,
        tls: m.tls === true,
        clientP12: m.clientP12 as string | undefined,
        p12Password: typeof m.p12Password === 'string' ? m.p12Password : undefined,
        timeoutMs: clampMs(m.timeoutMs, 6000, 20000),
      });
      open.add(r.id);
      // After the reply below has been injected, so the page knows the socket first.
      setTimeout(() => flushEarly(r.id), 0);
      return { sock: r.id, peerCert: r.peerCert ?? null };
    }
    case 'write': {
      if (typeof m.sock !== 'string' || !open.has(m.sock) || !isB64(m.data) || m.data.length > MAX_WRITE_BYTES) {
        throw new Error('bad_request');
      }
      await net.tcpWrite(m.sock, m.data);
      return null;
    }
    case 'close': {
      if (typeof m.sock === 'string' && open.has(m.sock)) await net.tcpClose(m.sock);
      return null;
    }
    case 'scan': {
      const ports = Array.isArray(m.ports) ? m.ports.filter(isPort).slice(0, MAX_SCAN_PORTS) : [];
      let hosts: string[];
      let self: string | null = null;
      if (m.hosts === 'subnet') {
        const sub = await ownSubnet();
        if (!sub) throw new Error('no_wifi');
        hosts = sub.hosts;
        self = sub.ip;
      } else {
        hosts = Array.isArray(m.hosts) ? m.hosts.filter(isPrivateIp).slice(0, MAX_SCAN_HOSTS) : [];
      }
      const r = await net.scan({
        hosts,
        ports,
        timeoutMs: clampMs(m.timeoutMs, 700, 5000),
        concurrency: typeof m.concurrency === 'number' ? m.concurrency : 64,
      });
      return { open: r.open.filter((o) => isPrivateIp(o.host)), denied: r.denied, self };
    }
    case 'udp': {
      if (!isPrivateIp(m.host) || !isPort(m.port) || !isB64(m.data) || m.data.length > 64_000) {
        throw new Error('bad_request');
      }
      return net.udp({
        host: m.host,
        port: m.port,
        data: m.data,
        timeoutMs: clampMs(m.timeoutMs, 1500, 8000),
        maxReplies: typeof m.maxReplies === 'number' ? Math.min(32, m.maxReplies) : 8,
      });
    }
    case 'mdns': {
      if (typeof m.type !== 'string') throw new Error('bad_request');
      const r = await net.mdns({ type: m.type, timeoutMs: clampMs(m.timeoutMs, 3000, 10000) });
      return { services: r.services.filter((s) => isPrivateIp(s.host)), error: r.error ?? null };
    }
    default:
      throw new Error('bad_request');
  }
}

/**
 * Handles `{type:'tunedtv:net', id, op, ...}` from the page. Returns true when consumed. Replies
 * arrive as `tunedtv:net-reply` events; socket data/close as `tunedtv:net-event`.
 */
export function handleNetMessage(message: unknown, pageUrl: string | undefined, injectScript: Inject, devOrigin?: string): boolean {
  if (!message || typeof message !== 'object' || (message as Msg).type !== 'tunedtv:net') return false;
  const m = message as Msg;
  const id = typeof m.id === 'string' && /^[\w-]{1,40}$/.test(m.id) ? m.id : null;
  if (!id) return true;
  inject = injectScript;
  if (!isNetOrigin(pageUrl, devOrigin)) {
    reply(id, { ok: false, error: 'forbidden' });
    return true;
  }
  listen();
  run(m)
    .then((result) => reply(id, { ok: true, result }))
    .catch((e: unknown) => {
      const code = (e as { code?: unknown })?.code;
      const msg = typeof code === 'string' ? code : e instanceof Error ? e.message : 'failed';
      reply(id, { ok: false, error: msg });
    });
  return true;
}
