import { createRequire } from 'node:module';
import { X509Certificate } from 'node:crypto';

type Integer = { toString(radix: number): string };
type RsaKey = { n: Integer; e: Integer };
type Bag = { key?: RsaKey; cert?: { publicKey: RsaKey } };
// The P12 parser is the same dependency used by @signpdf/signer-p12.
const forge = createRequire(import.meta.url)('node-forge') as {
  asn1: { fromDer(bytes: string): unknown };
  pkcs12: {
    pkcs12FromAsn1(
      value: unknown,
      strict: boolean,
      passphrase: string
    ): { getBags(input: { bagType: string }): Record<string, Bag[]> };
  };
  pki: {
    oids: { certBag: string; pkcs8ShroudedKeyBag: string };
    certificateToPem(cert: NonNullable<Bag['cert']>): string;
  };
};
export function inspectSealCertificate(
  p12: Buffer,
  passphrase: string
): { fingerprint: string; subject: string; validTo: string } {
  const archive = forge.pkcs12.pkcs12FromAsn1(
    forge.asn1.fromDer(p12.toString('binary')),
    false,
    passphrase
  );
  const key = archive.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ]?.[0]?.key;
  if (!key?.n || !key.e) throw new Error('P12 needs an RSA signing key');
  const bag = archive
    .getBags({ bagType: forge.pki.oids.certBag })
    [
      forge.pki.oids.certBag
    ]?.find((b) => b.cert?.publicKey.n?.toString(16) === key.n.toString(16) && b.cert.publicKey.e.toString(16) === key.e.toString(16));
  if (!bag?.cert) throw new Error('P12 needs a certificate matching the signing key');
  const cert = new X509Certificate(forge.pki.certificateToPem(bag.cert));
  if (Date.parse(cert.validFrom) > Date.now() || Date.parse(cert.validTo) <= Date.now())
    throw new Error('Seal certificate is expired or not yet valid');
  return { fingerprint: cert.fingerprint256, subject: cert.subject, validTo: cert.validTo };
}
