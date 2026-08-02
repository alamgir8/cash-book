/** Client-side UUID for local-first primary keys. Lazy-loads expo-crypto. */

export async function createLocalId(): Promise<string> {
  try {
    const Crypto = await import("expo-crypto");
    return Crypto.randomUUID();
  } catch {
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function createClientRequestId(): string {
  // Sync-safe idempotency key (unique enough for retries)
  return `crid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
