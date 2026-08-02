import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  loadLocalFirstFlags,
  subscribeLocalFirstFlags,
  type LocalFirstFlags,
} from "@/lib/local-first/flags";

/**
 * When local-first flags finish loading or change, drop any Mongo-scoped
 * React Query cache so Home/Ledger/Accounts re-read from SQLite.
 */
export function useInvalidateOnLocalFirstFlags() {
  const queryClient = useQueryClient();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const bump = (flags: LocalFirstFlags) => {
      const key = `${flags.localFirstEnabled}:${flags.cloudSyncEnabled}`;
      if (prev.current === key) return;
      const hadPrev = prev.current !== null;
      prev.current = key;
      // Only when flags *change* after first load — not on every subscriber wake.
      if (hadPrev) {
        void queryClient.invalidateQueries();
      }
    };

    void loadLocalFirstFlags().then(bump);
    return subscribeLocalFirstFlags(bump);
  }, [queryClient]);
}
