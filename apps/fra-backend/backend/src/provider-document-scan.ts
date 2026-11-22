import net from 'node:net';

/**
 * Virus scanning for evidence uploads, through a ClamAV daemon (clamd) reached over TCP with its INSTREAM command.
 * It is off unless PROVIDER_DOCUMENT_SCAN=clamd. When it is on it fails closed: a file is stored only after the scanner
 * has said it is clean, and if the scanner cannot be reached the upload is refused, never waved through.
 * Detection is only as good as the signatures the deployed clamd carries; this code frames the file and reads the verdict.
 */
export type ScanVerdict = { status: 'clean'; engine: string } | { status: 'infected'; engine: string; signature: string };

export class ScanUnavailableError extends Error {}

export interface Scanner {
  engine: string;
  scan(content: Buffer): Promise<ScanVerdict>;
}

const FRAME_BYTES = 64 * 1024;

export function clamdScanner(options: { host: string; port: number; timeoutMs: number }): Scanner {
  return {
    engine: 'clamd',
    scan(content) {
      return new Promise<ScanVerdict>((resolve, reject) => {
        const socket = net.connect({ host: options.host, port: options.port });
        const replies: Buffer[] = [];
        let settled = false;
        const finish = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.destroy();
          fn();
        };
        const timer = setTimeout(() => finish(() => reject(new ScanUnavailableError('Scanner timed out'))), options.timeoutMs);

        socket.on('error', (error) => finish(() => reject(new ScanUnavailableError(`Scanner unreachable: ${error.message}`))));
        socket.on('data', (chunk) => replies.push(chunk));
        socket.on('close', () => {
          const reply = Buffer.concat(replies).toString('utf8').replace(/\0/g, '').trim();
          if (reply === 'stream: OK') return finish(() => resolve({ status: 'clean', engine: 'clamd' }));
          const found = /^stream: (.+) FOUND$/.exec(reply);
          if (found) return finish(() => resolve({ status: 'infected', engine: 'clamd', signature: found[1] }));
          // "... ERROR", a size-limit refusal, an empty reply: the file was not shown to be clean.
          finish(() => reject(new ScanUnavailableError(`Scanner gave no usable verdict: ${reply.slice(0, 80) || 'empty reply'}`)));
        });

        socket.on('connect', () => {
          socket.write('zINSTREAM\0');
          for (let offset = 0; offset < content.length; offset += FRAME_BYTES) {
            const frame = content.subarray(offset, offset + FRAME_BYTES);
            const length = Buffer.alloc(4);
            length.writeUInt32BE(frame.length);
            socket.write(length);
            socket.write(frame);
          }
          socket.write(Buffer.alloc(4)); // a zero-length frame ends the stream
        });
      });
    },
  };
}

let injected: Scanner | null | undefined;
/** Tests substitute a scanner; pass undefined to go back to the configured one. */
export function setScannerForTests(scanner: Scanner | null | undefined): void {
  injected = scanner;
}

export function scannerFromEnv(): Scanner | null {
  if (injected !== undefined) return injected;
  if (process.env.PROVIDER_DOCUMENT_SCAN !== 'clamd') return null;
  const port = Number(process.env.CLAMD_PORT ?? 3310);
  const timeoutMs = Number(process.env.CLAMD_TIMEOUT_MS ?? 20_000);
  return clamdScanner({
    host: process.env.CLAMD_HOST ?? '127.0.0.1',
    port: Number.isInteger(port) ? port : 3310,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20_000,
  });
}

/** Once scanning is required, a file that was never scanned (uploaded before it was switched on) cannot be verified. */
export function scanRequired(): boolean {
  return process.env.PROVIDER_DOCUMENT_REQUIRE_SCAN === '1';
}
