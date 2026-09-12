import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import qrcodeTerminal from 'qrcode-terminal';
import { attachGameServer } from './gameServer.js';
import { serveStatic } from './staticServer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = join(__dirname, '..', 'client', 'dist');

const httpServer = createServer(serveStatic(CLIENT_DIST));
attachGameServer(httpServer);

function getLanAddress(): string | null {
  const interfaces = networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const lanIp = getLanAddress();
  console.log(`\nCatan LAN server running on port ${PORT}`);
  console.log(`  On this machine: http://localhost:${PORT}`);
  if (lanIp) {
    const url = `http://${lanIp}:${PORT}`;
    console.log(`  For other players on this WiFi/LAN: ${url}\n`);
    qrcodeTerminal.generate(url, { small: true });
  } else {
    console.log('  Could not detect a LAN IP address; make sure this machine is on WiFi/Ethernet.\n');
  }
});
