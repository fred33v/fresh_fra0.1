-- Migration: 025_hash_refresh_tokens.sql
-- Refresh tokens were stored as-is, so anyone who could read the database (a leaked
-- backup or credential) could use them to sign in as any user. The app now stores
-- only the SHA-256 hash of each token (see src/db/tokens.ts). This converts the
-- tokens already stored, so nobody is signed out. Raw tokens are JWTs and contain
-- dots; hashes are 64 hex characters, so running this twice changes nothing.

UPDATE public.refresh_tokens
   SET token = encode(sha256(convert_to(token, 'UTF8')), 'hex')
 WHERE token LIKE '%.%';
