/**
 * Pure helpers for offline settings.
 *
 * Kept dependency-free (no app aliases, no SQLite, no Expo) so the pure test
 * suite can import this module through Node's `--experimental-strip-types`.
 * `settings-sync.ts` owns the I/O and re-exports these for callers.
 */

/** Deep-merge plain objects; arrays and scalars replace. */
export function mergeSettings<T extends Record<string, any>>(
  base: T | null | undefined,
  patch: Partial<T> | Record<string, any>,
): T {
  const out: Record<string, any> = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const prev = out[key];
    if (
      prev &&
      typeof prev === "object" &&
      !Array.isArray(prev) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = mergeSettings(prev, value as Record<string, any>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Normalize the several shapes the API accepts into one server payload.
 * `login_pin` is deliberately never part of a merged payload — the PIN is
 * transmitted separately, directly from SecureStore.
 */
export function toServerProfilePayload(
  patch: Record<string, any>,
): Record<string, any> {
  const payload: Record<string, any> = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.email !== undefined) payload.email = patch.email;
  if (patch.phone !== undefined) payload.phone = patch.phone;

  const profileSettings = patch.profile_settings ?? patch.settings;
  if (profileSettings) {
    const currency = profileSettings.currency_code ?? profileSettings.currency;
    const next: Record<string, any> = { ...profileSettings };
    if (currency) next.currency_code = currency;
    delete next.currency;
    payload.profile_settings = next;
  }
  return payload;
}

/**
 * A queued PIN may only exist as "" (remove) or 5 digits (set).
 * Anything else is corrupt and must not be transmitted.
 */
export function isValidQueuedPin(pin: unknown): pin is string {
  return typeof pin === "string" && (pin === "" || /^[0-9]{5}$/.test(pin));
}

/** Client errors that will never succeed on retry — drop instead of looping. */
export function isPermanentOpFailure(status?: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 422;
}

/**
 * Apply a profile/preferences patch to the in-memory user optimistically, so
 * the UI reflects an offline save before the server confirms it. Mirrors the
 * two shapes the app uses for currency/language (`settings` and
 * `profile_settings`) so both stay consistent.
 */
export function applyProfilePatchToUser<T extends Record<string, any>>(
  user: T,
  patch: Record<string, any>,
  loginPin?: string,
): T {
  const next: Record<string, any> = { ...(user ?? {}) };

  if (patch.name !== undefined) next.name = patch.name;
  if (patch.email !== undefined) next.email = patch.email;
  if (patch.phone !== undefined) next.phone = patch.phone;

  const ps = patch.profile_settings ?? patch.settings;
  if (ps) {
    const currency = ps.currency_code ?? ps.currency;
    const language = ps.language;

    next.profile_settings = { ...(user?.profile_settings ?? {}) };
    if (currency) {
      next.profile_settings.currency_code = currency;
      next.profile_settings.currency_symbol =
        ps.currency_symbol ?? user?.profile_settings?.currency_symbol;
    }
    if (language) next.profile_settings.language = language;

    next.settings = { ...(user?.settings ?? {}) };
    if (currency) next.settings.currency = currency;
    if (language) next.settings.language = language;
  }

  if (loginPin !== undefined) {
    next.security = {
      ...(user?.security ?? {}),
      // "" means the user disabled their PIN.
      has_login_pin: loginPin !== "",
    };
  }

  return next as T;
}
