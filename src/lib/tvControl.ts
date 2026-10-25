import * as Network from 'expo-network';

/**
 * "Tune my TV": finds DIRECTV receivers and Rokus on the phone's Wi-Fi and sends them commands
 * over their published local HTTP APIs (DIRECTV SHEF on 8080, Roku ECP on 8060). The web app owns
 * the UI and remembers the chosen device; this file only discovers and executes.
 */

export type TvDevice =
  | { kind: 'directv'; ip: string; name: string; rooms: { clientAddr: string; name: string }[] }
  | { kind: 'roku'; ip: string; name: string };

export type TvRequest =
  | { action: 'discover'; hints?: unknown }
  | { action: 'tune'; ip?: unknown; major?: unknown; minor?: unknown; clientAddr?: unknown }
  | { action: 'launch'; ip?: unknown; appName?: unknown };

export type TvResult =
  | { ok: true; devices?: TvDevice[]; detail?: string }
  | { ok: false; error: 'not_found' | 'no_wifi' | 'blocked' | 'not_installed' | 'unreachable' | 'bad_request' };

const PROBE_TIMEOUT_MS = 1500;
const COMMAND_TIMEOUT_MS = 4000;
const SCAN_CONCURRENCY = 48;

/** Commands only ever go to private LAN addresses, never anywhere the web page names. */
function isPrivateIp(ip: unknown): ip is string {
  if (typeof ip !== 'string') return false;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function get(url: string, timeoutMs: number, method: 'GET' | 'POST' = 'GET'): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { method, signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache' } });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function xmlTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml);
  return m ? m[1].trim() : null;
}

async function probeRoku(ip: string): Promise<TvDevice | null> {
  const res = await get(`http://${ip}:8060/query/device-info`, PROBE_TIMEOUT_MS);
  if (!res?.ok) return null;
  const xml = await res.text().catch(() => '');
  if (!xml.includes('<device-info')) return null;
  const name =
    xmlTag(xml, 'user-device-name') || xmlTag(xml, 'friendly-device-name') || xmlTag(xml, 'model-name') || 'Roku';
  return { kind: 'roku', ip, name };
}

async function probeDirectv(ip: string): Promise<TvDevice | null> {
  const res = await get(`http://${ip}:8080/info/getVersion`, PROBE_TIMEOUT_MS);
  if (!res?.ok) return null;
  const info = (await res.json().catch(() => null)) as { receiverId?: unknown } | null;
  if (!info || typeof info.receiverId !== 'string') return null;
  const rooms: { clientAddr: string; name: string }[] = [];
  const loc = await get(`http://${ip}:8080/info/getLocations`, PROBE_TIMEOUT_MS);
  const body = loc?.ok ? ((await loc.json().catch(() => null)) as { locations?: unknown } | null) : null;
  if (Array.isArray(body?.locations)) {
    for (const l of body.locations as { clientAddr?: unknown; locationName?: unknown }[]) {
      if (typeof l.clientAddr === 'string' && /^[0-9A-Fa-f]{1,12}$/.test(l.clientAddr)) {
        rooms.push({ clientAddr: l.clientAddr, name: typeof l.locationName === 'string' ? l.locationName : 'TV' });
      }
    }
  }
  return { kind: 'directv', ip, name: 'DIRECTV receiver', rooms };
}

async function probe(ip: string): Promise<TvDevice[]> {
  const found = await Promise.all([probeRoku(ip), probeDirectv(ip)]);
  return found.filter((d): d is TvDevice => d !== null);
}

/**
 * iOS shows the Local Network prompt on the first LAN request and fails every request until the
 * user answers it, so the first search of a session gets one automatic retry.
 */
let firstSearch = true;

async function discover(hints: unknown): Promise<TvResult> {
  const result = await discoverOnce(hints);
  if (result.ok || result.error !== 'not_found' || !firstSearch) {
    firstSearch = false;
    return result;
  }
  firstSearch = false;
  await new Promise((r) => setTimeout(r, 4000));
  return discoverOnce(hints);
}

async function discoverOnce(hints: unknown): Promise<TvResult> {
  const known = Array.isArray(hints) ? hints.filter(isPrivateIp).slice(0, 8) : [];
  const fromHints = (await Promise.all(known.map(probe))).flat();
  if (fromHints.length > 0) return { ok: true, devices: fromHints };

  const state = await Network.getNetworkStateAsync().catch(() => null);
  if (state?.type !== Network.NetworkStateType.WIFI && state?.type !== Network.NetworkStateType.ETHERNET) {
    return { ok: false, error: 'no_wifi' };
  }
  const own = await Network.getIpAddressAsync().catch(() => null);
  if (!isPrivateIp(own)) return { ok: false, error: 'no_wifi' };
  const prefix = own.split('.').slice(0, 3).join('.');
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) if (`${prefix}.${i}` !== own) ips.push(`${prefix}.${i}`);

  const devices: TvDevice[] = [];
  let next = 0;
  const worker = async () => {
    while (next < ips.length) devices.push(...(await probe(ips[next++])));
  };
  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker));
  return devices.length > 0 ? { ok: true, devices } : { ok: false, error: 'not_found' };
}

async function tune(req: Extract<TvRequest, { action: 'tune' }>): Promise<TvResult> {
  const major = Number(req.major);
  if (!isPrivateIp(req.ip) || !Number.isInteger(major) || major < 1 || major > 9999) {
    return { ok: false, error: 'bad_request' };
  }
  const params = new URLSearchParams({ major: String(major) });
  const minor = Number(req.minor);
  if (Number.isInteger(minor) && minor > 0 && minor < 65535) params.set('minor', String(minor));
  if (typeof req.clientAddr === 'string' && /^[0-9A-Fa-f]{1,12}$/.test(req.clientAddr)) {
    params.set('clientAddr', req.clientAddr);
  }
  const res = await get(`http://${req.ip}:8080/tv/tune?${params}`, COMMAND_TIMEOUT_MS);
  if (!res) return { ok: false, error: 'unreachable' };
  if (res.status === 403) return { ok: false, error: 'blocked' };
  const body = (await res.json().catch(() => null)) as { status?: { code?: number } } | null;
  return res.ok && (body?.status?.code ?? 200) === 200 ? { ok: true } : { ok: false, error: 'blocked' };
}

function normalizeAppName(s: string): string {
  return s.toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9+]/g, '');
}

async function launch(req: Extract<TvRequest, { action: 'launch' }>): Promise<TvResult> {
  if (!isPrivateIp(req.ip) || typeof req.appName !== 'string' || !req.appName.trim()) {
    return { ok: false, error: 'bad_request' };
  }
  const res = await get(`http://${req.ip}:8060/query/apps`, COMMAND_TIMEOUT_MS);
  if (!res) return { ok: false, error: 'unreachable' };
  if (res.status === 403) return { ok: false, error: 'blocked' };
  const xml = await res.text().catch(() => '');
  const want = normalizeAppName(req.appName);
  const apps = [...xml.matchAll(/<app id="(\d+)"[^>]*>([^<]*)<\/app>/g)].map((m) => ({
    id: m[1],
    name: normalizeAppName(m[2]),
  }));
  const app = apps.find((a) => a.name === want) ?? apps.find((a) => a.name.startsWith(want) || want.startsWith(a.name));
  if (!app) return { ok: false, error: 'not_installed' };
  const go = await get(`http://${req.ip}:8060/launch/${app.id}`, COMMAND_TIMEOUT_MS, 'POST');
  if (!go) return { ok: false, error: 'unreachable' };
  if (go.status === 403) return { ok: false, error: 'blocked' };
  return go.ok ? { ok: true } : { ok: false, error: 'unreachable' };
}

export async function handleTvRequest(req: TvRequest): Promise<TvResult> {
  switch (req.action) {
    case 'discover':
      return discover(req.hints);
    case 'tune':
      return tune(req);
    case 'launch':
      return launch(req);
    default:
      return { ok: false, error: 'bad_request' };
  }
}
