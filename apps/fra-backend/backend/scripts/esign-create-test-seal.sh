#!/usr/bin/env bash
# Creates a self-signed development platform seal. Never establishes AES/QES identity.
set -euo pipefail
umask 077
if [[ $# -ne 1 ]]; then
  echo 'Usage: bash scripts/esign-create-test-seal.sh /absolute/private/output-directory' >&2
  exit 2
fi
command -v openssl >/dev/null
case "$1" in /*) ;; *) echo 'Use an absolute output directory.' >&2; exit 2;; esac
mkdir -p "$1"
if [[ -e "$1/seal-test.p12" || -e "$1/seal-test.crt" ]]; then
  echo 'Refusing to overwrite an existing certificate.' >&2
  exit 2
fi
esign_work_dir=$(mktemp -d)
trap 'rm -rf "$esign_work_dir"' EXIT
openssl req -x509 -newkey rsa:3072 -sha256 -days 365 -nodes \
  -keyout "$esign_work_dir/key.pem" -out "$esign_work_dir/cert.pem" \
  -subj '/CN=FRA development platform seal - not a qualified signature'
# OpenSSL prompts securely for the P12 export password. Do not put it in shell history.
openssl pkcs12 -export -inkey "$esign_work_dir/key.pem" -in "$esign_work_dir/cert.pem" -out "$1/seal-test.p12"
cp "$esign_work_dir/cert.pem" "$1/seal-test.crt"
chmod 600 "$1/seal-test.p12" "$1/seal-test.crt"
echo 'Development seal created. Keep the P12 and its password private; PDF readers will not trust this self-signed certificate automatically.'
