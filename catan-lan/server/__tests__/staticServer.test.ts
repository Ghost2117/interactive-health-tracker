import { createServer, get, type Server } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serveStatic } from '../staticServer.js';

let root: string;
let httpServer: Server;
let port: number;

function request(path: string): Promise<{ status: number; body: string; contentType: string | undefined }> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
          contentType: res.headers['content-type'],
        });
      });
    }).on('error', reject);
  });
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'catan-static-test-'));
  writeFileSync(join(root, 'index.html'), '<html>the app</html>');
  writeFileSync(join(root, 'app.js'), 'console.log(1)');
  writeFileSync(join(root, 'style.css'), 'body{}');

  httpServer = createServer(serveStatic(root));
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  port = typeof address === 'object' && address ? address.port : 0;
});

afterEach(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  rmSync(root, { recursive: true, force: true });
});

describe('serveStatic', () => {
  it('serves an existing file with the right content and content-type', async () => {
    const res = await request('/app.js');
    expect(res.status).toBe(200);
    expect(res.body).toBe('console.log(1)');
    expect(res.contentType).toContain('text/javascript');
  });

  it('serves index.html at the root', async () => {
    const res = await request('/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('the app');
    expect(res.contentType).toContain('text/html');
  });

  it('falls back to index.html for unknown client-side routes (SPA routing)', async () => {
    const res = await request('/lobby/some-room-code');
    expect(res.status).toBe(200);
    expect(res.body).toContain('the app');
  });

  it('uses application/octet-stream for unrecognized extensions', async () => {
    writeFileSync(join(root, 'data.bin'), 'raw');
    const res = await request('/data.bin');
    expect(res.status).toBe(200);
    expect(res.contentType).toBe('application/octet-stream');
  });

  it('returns 404 with a helpful message when even index.html is missing (unbuilt client)', async () => {
    rmSync(join(root, 'index.html'));
    const res = await request('/');
    expect(res.status).toBe(404);
    expect(res.body).toContain('npm run build:client');
  });

  it('blocks percent-encoded path traversal that a naive join() would fall for', async () => {
    // Encoding the slashes too (%2f) hides the ".." segments from the URL
    // parser's own dot-segment normalization, which only collapses ".."
    // when it sees literal "/" separators - decodeURIComponent() then
    // reveals the traversal *after* that normalization already ran. This
    // is exactly the vector serveStatic's startsWith(root) guard exists for.
    const res = await request('/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd');
    expect(res.status).toBe(403);
    expect(res.body).toBe('Forbidden');
  });

  it('plain (unencoded) ../ in the URL never leaks anything outside root', async () => {
    // The URL constructor collapses literal ".." segments (bounded at the
    // root) before serveStatic ever sees them, so this just becomes a
    // lookup for a nonexistent path and falls back to the SPA shell - the
    // important thing is it can never leak real filesystem content.
    const res = await request('/../../../etc/passwd');
    expect(res.body).not.toContain('root:'); // telltale /etc/passwd content
    expect(res.body).toContain('the app'); // safely fell back to index.html
  });
});
