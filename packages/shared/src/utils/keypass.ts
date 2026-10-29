/**
 * What to tell someone whose key-pass was refused, from the error the API sent.
 * Codes the API does not know about fall back to the server's own message.
 */
export function keyPassErrorMessage(error?: { code?: string; message?: string } | null): string {
  switch (error?.code) {
    case 'NOT_FOUND':
      return "We don't recognise that code. Check it against the one your employer gave you.";
    case 'EXPIRED':
      return 'This code has expired. Ask your employer for a new one.';
    case 'NOT_AVAILABLE':
    case 'ALREADY_USED':
      return 'This code has already been used or was withdrawn. Ask your employer for a new one.';
    case 'PACKAGE_INACTIVE':
      return "Your organisation's package is no longer active. Ask your employer to renew it, then try again.";
    case 'ACCOUNT_EXISTS':
      return 'An account with this email already exists. Sign in instead.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'VALIDATION_ERROR':
      return 'Please check your details and try again.';
    case 'NETWORK_ERROR':
    case 'TIMEOUT':
      return "We couldn't reach the server. Check your connection and try again.";
    default:
      return error?.message || 'Invalid key-pass code';
  }
}
