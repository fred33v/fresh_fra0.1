import { describe, expect, it } from '@jest/globals';
import {
  attachmentDisposition,
  detectDocumentMime,
  safeDocumentFilename,
  sha256Hex,
} from '../src/provider-documents.js';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
const jpeg = Buffer.from([255, 216, 255, 224, 0, 16]);

describe('detectDocumentMime', () => {
  it('recognises PDF, PNG and JPEG by their own signature', () => {
    expect(detectDocumentMime(Buffer.from('%PDF-1.7\n%âãÏÓ'))).toBe('application/pdf');
    expect(detectDocumentMime(png)).toBe('image/png');
    expect(detectDocumentMime(jpeg)).toBe('image/jpeg');
  });

  it('refuses anything else, whatever the file is called or the browser claims', () => {
    expect(detectDocumentMime(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectDocumentMime(Buffer.from('MZ\x90\x00\x03\x00\x00\x00'))).toBeNull(); // Windows executable
    expect(detectDocumentMime(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectDocumentMime(Buffer.from('PK\x03\x04........'))).toBeNull(); // zip, Office documents
    expect(detectDocumentMime(Buffer.alloc(0))).toBeNull();
  });

  it('does not accept a signature that is only partly present', () => {
    expect(detectDocumentMime(Buffer.from('%PDF'))).toBeNull();
    expect(detectDocumentMime(png.subarray(0, 7))).toBeNull();
    expect(detectDocumentMime(jpeg.subarray(0, 2))).toBeNull();
  });
});

describe('safeDocumentFilename', () => {
  it('removes control characters and path separators', () => {
    expect(safeDocumentFilename('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeDocumentFilename('a\\b\u0000c\nd.pdf')).toBe('a_b_c_d.pdf');
  });

  it('bounds the length and never returns an empty name', () => {
    expect(safeDocumentFilename('x'.repeat(500))).toHaveLength(160);
    expect(safeDocumentFilename('   ')).toBe('evidence');
    expect(safeDocumentFilename('')).toBe('evidence');
  });
});

describe('attachmentDisposition', () => {
  it('always sends an attachment with a header-safe ASCII fallback and the real name encoded', () => {
    const header = attachmentDisposition('Passport "scan"; é.pdf');
    expect(header.startsWith('attachment; filename="')).toBe(true);
    expect(header).not.toMatch(/"scan"/);
    expect(header).toContain("filename*=UTF-8''Passport%20%22scan%22%3B%20%C3%A9.pdf");
  });
});

describe('sha256Hex', () => {
  it('matches the known digest', () => {
    expect(sha256Hex(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
