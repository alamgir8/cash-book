/**
 * Canonical JSON for checksums: stable key order (recursive sort).
 * SHA-256 via expo-crypto, loaded only when hashing.
 */

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeys(obj[key]);
    }
    return out;
  }
  return value;
}

export async function sha256Hex(input: string): Promise<string> {
  const Crypto = await import("expo-crypto");
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export async function checksumForData(data: unknown): Promise<string> {
  return sha256Hex(canonicalize(data));
}

export async function verifyChecksum(
  data: unknown,
  expected: string,
): Promise<boolean> {
  const actual = await checksumForData(data);
  return actual === expected;
}
