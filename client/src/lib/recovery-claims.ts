export const RECOVERY_PATH = '/reset-password';
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

/** Only call this with claims verified by Supabase getClaims(), never decoded browser input. */
export function hasValidRecoveryClaims(
  claims: { sub?: unknown; exp?: unknown; session_id?: unknown; amr?: unknown } | null | undefined,
  userId: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!claims || !userId || claims.sub !== userId ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.session_id !== 'string' || !claims.session_id ||
      !Array.isArray(claims.amr)) return false;

  return claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return false;
    const proof = entry as { method?: unknown; timestamp?: unknown };
    return proof.method === 'recovery' && typeof proof.timestamp === 'number' &&
      Number.isFinite(proof.timestamp) && proof.timestamp <= now + 30 &&
      now - proof.timestamp <= RECOVERY_WINDOW_SECONDS;
  });
}
