import { afterEach, describe, expect, it } from '@jest/globals';
import net from 'node:net';
import { clamdScanner, scanRequired, scannerFromEnv, ScanUnavailableError } from '../src/provider-document-scan.js';

// A stand-in clamd: it records exactly what the client sends and answers with a canned reply.
type Reply = string | 'hang' | 'close';
function fakeClamd(reply: Reply) {
  const received: Buffer[] = [];
  const server = net.createServer((socket) => {
    const chunks: Buffer[] = [];
    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const all = Buffer.concat(chunks);
      // The command, then length-prefixed frames, ended by a zero-length frame.
      let offset = 'zINSTREAM\0'.length;
      if (all.length < offset) return;
      while (all.length >= offset + 4) {
        const length = all.readUInt32BE(offset);
        if (length === 0) {
          received.push(all);
          if (reply === 'hang') return;
          if (reply !== 'close') socket.write(reply);
          return void socket.end();
        }
        offset += 4 + length;
      }
    });
    socket.on('error', () => undefined);
  });
  return new Promise<{ port: number; received: Buffer[]; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: (server.address() as net.AddressInfo).port, received, close: () => server.close() })
    )
  );
}

const open: Array<() => void> = [];
afterEach(() => {
  while (open.length) open.pop()!();
  delete process.env.PROVIDER_DOCUMENT_SCAN;
  delete process.env.PROVIDER_DOCUMENT_REQUIRE_SCAN;
});
async function scannerAgainst(reply: Reply, timeoutMs = 2000) {
  const server = await fakeClamd(reply);
  open.push(server.close);
  return { server, scanner: clamdScanner({ host: '127.0.0.1', port: server.port, timeoutMs }) };
}

describe('clamdScanner', () => {
  it('frames the file as an INSTREAM request and reports a clean verdict', async () => {
    const { server, scanner } = await scannerAgainst('stream: OK\0');
    const content = Buffer.alloc(150_000, 9); // more than two 64 KiB frames
    await expect(scanner.scan(content)).resolves.toEqual({ status: 'clean', engine: 'clamd' });
    const sent = server.received[0];
    expect(sent.subarray(0, 10).toString()).toBe('zINSTREAM\0');
    let offset = 10;
    const frames: Buffer[] = [];
    for (;;) {
      const length = sent.readUInt32BE(offset);
      offset += 4;
      if (length === 0) break;
      frames.push(sent.subarray(offset, offset + length));
      offset += length;
    }
    expect(offset).toBe(sent.length); // nothing after the terminating zero-length frame
    expect(frames.length).toBe(3);
    expect(Buffer.concat(frames).equals(content)).toBe(true);
  });

  it('reports an infected verdict with the signature name', async () => {
    const { scanner } = await scannerAgainst('stream: Eicar-Test-Signature FOUND\0');
    await expect(scanner.scan(Buffer.from('%PDF-1.7 x'))).resolves.toEqual({
      status: 'infected',
      engine: 'clamd',
      signature: 'Eicar-Test-Signature',
    });
  });

  it.each([
    ['a scanner error', 'INSTREAM size limit exceeded. ERROR\0'],
    ['an unexpected reply', 'stream: something else\0'],
    ['an empty reply', 'close' as const],
  ])('does not treat %s as clean', async (_name, reply) => {
    const { scanner } = await scannerAgainst(reply);
    await expect(scanner.scan(Buffer.from('%PDF-1.7 x'))).rejects.toBeInstanceOf(ScanUnavailableError);
  });

  it('fails when the scanner does not answer in time', async () => {
    const { scanner } = await scannerAgainst('hang', 150);
    await expect(scanner.scan(Buffer.from('%PDF-1.7 x'))).rejects.toThrow('timed out');
  });

  it('fails when nothing is listening', async () => {
    const closed = await fakeClamd('stream: OK\0');
    closed.close();
    const scanner = clamdScanner({ host: '127.0.0.1', port: closed.port, timeoutMs: 1000 });
    await expect(scanner.scan(Buffer.from('%PDF-1.7 x'))).rejects.toBeInstanceOf(ScanUnavailableError);
  });
});

describe('scanner configuration', () => {
  it('is off unless clamd is asked for, and scanning is not required by default', () => {
    expect(scannerFromEnv()).toBeNull();
    process.env.PROVIDER_DOCUMENT_SCAN = 'something-else';
    expect(scannerFromEnv()).toBeNull();
    process.env.PROVIDER_DOCUMENT_SCAN = 'clamd';
    expect(scannerFromEnv()?.engine).toBe('clamd');
    expect(scanRequired()).toBe(false);
    process.env.PROVIDER_DOCUMENT_REQUIRE_SCAN = '1';
    expect(scanRequired()).toBe(true);
  });
});
