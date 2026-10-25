#!/usr/bin/env node
// Pretend DIRECTV receiver (port 8080) and Roku (port 8060) for testing "Tune my TV" without the
// hardware. Run on a Mac on the same Wi-Fi as the phone: `node scripts/mock-tv.mjs`.
// Responses follow the published DIRECTV SHEF and Roku ECP formats; every command is logged.
import http from 'node:http';
import os from 'node:os';

const ROKU_APPS = [
  [12, 'Netflix'], [837, 'YouTube'], [2285, 'Hulu'], [13, 'Prime Video'], [291097, 'Disney Plus'],
  [61322, 'Max'], [593099, 'Peacock TV'], [31440, 'Paramount Plus'], [34376, 'ESPN'],
  [195316, 'YouTube TV'], [46041, 'Sling TV'], [41468, 'Tubi - Free Movies &amp; TV'],
  [74519, 'Pluto TV - It&apos;s Free TV'], [151908, 'The Roku Channel'],
];
const DIRECTV_ROOMS = [
  { clientAddr: '0', locationName: 'Living Room' },
  { clientAddr: 'A0B1C2D3E4F5', locationName: 'Bedroom' },
];
let channel = { major: 202, minor: 65535 };
let rokuApp = 'Home';

const log = (who, msg) => console.log(`${new Date().toLocaleTimeString()}  ${who.padEnd(8)} ${msg}`);
const json = (res, body, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};
const ok = { code: 200, commandResult: 0, msg: 'OK.', query: '' };

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/info/getVersion') {
      return json(res, { receiverId: '0288 7745 2797', stbSoftwareVersion: '0x1234', systemTime: Date.now() / 1000, status: ok });
    }
    if (url.pathname === '/info/getLocations') return json(res, { locations: DIRECTV_ROOMS, status: ok });
    if (url.pathname === '/tv/tune') {
      channel = { major: Number(url.searchParams.get('major')), minor: Number(url.searchParams.get('minor') ?? 65535) };
      const room = DIRECTV_ROOMS.find((r) => r.clientAddr === (url.searchParams.get('clientAddr') ?? '0'));
      log('DIRECTV', `TUNE -> channel ${channel.major}${channel.minor !== 65535 ? '-' + channel.minor : ''} (${room?.locationName ?? 'unknown room'})`);
      return json(res, { status: ok });
    }
    if (url.pathname === '/tv/getTuned') return json(res, { ...channel, callsign: 'MOCK', status: ok });
    json(res, { status: { code: 404, msg: 'Not found' } }, 404);
  })
  .listen(8080, '0.0.0.0');

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    res.setHeader('Content-Type', 'text/xml; charset="utf-8"');
    if (url.pathname === '/query/device-info') {
      return res.end(
        `<?xml version="1.0" encoding="UTF-8" ?>\n<device-info>\n<model-name>Roku Express</model-name>\n` +
          `<friendly-device-name>Mock Roku</friendly-device-name>\n<user-device-name>Living Room Roku</user-device-name>\n` +
          `<is-tv>false</is-tv>\n</device-info>`,
      );
    }
    if (url.pathname === '/query/apps') {
      const rows = ROKU_APPS.map(([id, name]) => `<app id="${id}" type="appl" version="1.0.0">${name}</app>`);
      return res.end(`<?xml version="1.0" encoding="UTF-8" ?>\n<apps>\n${rows.join('\n')}\n</apps>`);
    }
    const launch = /^\/launch\/(\d+)$/.exec(url.pathname);
    if (launch && req.method === 'POST') {
      const app = ROKU_APPS.find(([id]) => String(id) === launch[1]);
      if (!app) return res.writeHead(404).end();
      rokuApp = app[1];
      log('ROKU', `LAUNCH -> ${rokuApp.replace(/&amp;/g, '&').replace(/&apos;/g, "'")}`);
      return res.end();
    }
    const key = /^\/keypress\/(\w+)$/.exec(url.pathname);
    if (key && req.method === 'POST') {
      log('ROKU', `KEY -> ${key[1]}`);
      return res.end();
    }
    res.writeHead(404).end();
  })
  .listen(8060, '0.0.0.0');

const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i?.family === 'IPv4' && !i.internal).map((i) => i.address);
console.log(`Pretend DIRECTV (8080) + Roku (8060) running on ${ips.join(', ')}`);
console.log('Open TunedTV on a phone on this Wi-Fi and tap "Tune TV" or "Play on TV". Ctrl+C to stop.\n');
