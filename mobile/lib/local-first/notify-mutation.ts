/**
 * Fire-and-forget: after a successful local ledger write, ask the sync
 * scheduler to push when the network/backend allow it.
 */
export async function notifyLocalLedgerMutation(): Promise<void> {
  try {
    const { isLocalFirstEnabled, isCloudSyncEnabled } = await import(
      "@/lib/local-first/flags"
    );
    if (!isLocalFirstEnabled() || !isCloudSyncEnabled()) return;
    const { requestSyncSoon } = await import("@/sync/scheduler");
    requestSyncSoon("mutation");
  } catch {
    /* scheduler may not be loaded yet */
  }
}
