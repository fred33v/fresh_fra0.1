/// <reference types="jest" />

import zlib from 'node:zlib';
import { expect } from '@jest/globals';

/** Unpack a ZIP made by src/zip.ts into name → text, checking each file's CRC. */
export function readZip(buf: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const method = buf.readUInt16LE(at + 8);
    const crc = buf.readUInt32LE(at + 14);
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26);
    const extraLen = buf.readUInt16LE(at + 28);
    const name = buf.subarray(at + 30, at + 30 + nameLen).toString('utf8');
    const start = at + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + size);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    expect(zlib.crc32(data)).toBe(crc);
    files.set(name, data.toString('utf8'));
    at = start + size;
  }
  expect(buf.readUInt32LE(at)).toBe(0x02014b50); // central directory follows
  return files;
}
