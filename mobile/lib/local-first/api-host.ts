/**
 * Dev-only API host self-heal.
 *
 * Problem this solves: during local development the backend runs on the same
 * Mac as Metro, but the Mac's LAN IP changes with DHCP (observed .249 → .214 →
 * .249 within one session). A stale `EXPO_PUBLIC_BASE_URL` then makes every
 * request time out with a confusing "Network Error".
 *
 * In a dev runtime Metro already knows the Mac's current address
 * (`Constants.expoConfig.hostUri`), so when the configured host is a *private
 * LAN* address that differs from Metro's, we prefer Metro's address on the same
 * port and path.
 *
 * Safety rails — all must hold before anything is rewritten:
 *  - **opt-in**: disabled unless `EXPO_PUBLIC_API_AUTOFIX=on`
 *  - only in development builds (`__DEV__`, decided by the caller)
 *  - only when BOTH the configured host and Metro's host are private LAN IPv4
 *  - never for localhost / public hosts (Vercel, a tunnel, a remote API)
 *  - the configured port, path and protocol are preserved
 *
 * Why opt-in: Metro's advertised host is not always trustworthy — it was
 * observed advertising `192.168.0.214` on a Mac whose only LAN address was
 * `192.168.0.249`. Silently following that would turn a working URL into a dead
 * one, so the fix must be requested explicitly.
 *
 * Kept dependency-free so the pure test suite can import it.
 */

/** 10/8, 172.16/12, 192.168/16 — the ranges a home/office LAN uses. */
export function isPrivateLanHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

/** Pull a bare hostname out of "host:port", "http://host", a script URL, etc. */
export function hostnameOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    const withProto = raw.includes("://") ? raw : `http://${raw}`;
    return new URL(withProto).hostname || null;
  } catch {
    // Fall back to a loose match (e.g. "192.168.0.249:8081/path").
    const m = /^([^/:?#]+)/.exec(raw);
    return m ? m[1] : null;
  }
}

export type AutoFixResult = {
  url: string;
  /** True when the host was rewritten. */
  changed: boolean;
  /** Machine-readable reason, for logging/testing. */
  reason:
    | "applied"
    | "disabled"
    | "not-private"
    | "metro-unknown"
    | "same-host"
    | "invalid-url";
};

/**
 * Decide the effective base URL. `metroHost` is Metro's current host (or null).
 */
export function resolveApiHost(opts: {
  configuredUrl: string;
  metroHost: string | null | undefined;
  /** Pass `false` in production builds. */
  isDev: boolean;
  /**
   * Must be explicitly enabled (default false) — Metro's advertised host can be
   * stale, so this never rewrites anything unless the developer opts in.
   */
  autofixEnabled?: boolean;
}): AutoFixResult {
  const { configuredUrl, metroHost, isDev } = opts;
  const autofixEnabled = opts.autofixEnabled === true;

  if (!isDev) {
    return { url: configuredUrl, changed: false, reason: "disabled" };
  }
  if (!autofixEnabled) {
    return { url: configuredUrl, changed: false, reason: "disabled" };
  }

  let cfg: URL;
  try {
    cfg = new URL(configuredUrl);
  } catch {
    return { url: configuredUrl, changed: false, reason: "invalid-url" };
  }

  const configuredHost = cfg.hostname;
  if (!isPrivateLanHost(configuredHost)) {
    return { url: configuredUrl, changed: false, reason: "not-private" };
  }

  const metro = hostnameOf(metroHost ?? undefined);
  if (!metro || !isPrivateLanHost(metro)) {
    return { url: configuredUrl, changed: false, reason: "metro-unknown" };
  }
  if (metro === configuredHost) {
    return { url: configuredUrl, changed: false, reason: "same-host" };
  }

  // Preserve port, path, protocol and query from the configured URL.
  const port = cfg.port ? `:${cfg.port}` : "";
  const path = cfg.pathname.replace(/\/+$/, "");
  return {
    url: `${cfg.protocol}//${metro}${port}${path}${cfg.search}`,
    changed: true,
    reason: "applied",
  };
}

/**
 * A private-LAN backend served over https is almost always the protocol
 * mistake that produced "Network Error" (no TLS listener) — worth flagging.
 */
export function looksLikeHttpsLanMistake(configuredUrl: string): boolean {
  try {
    const url = new URL(configuredUrl);
    return url.protocol === "https:" && isPrivateLanHost(url.hostname);
  } catch {
    return false;
  }
}
