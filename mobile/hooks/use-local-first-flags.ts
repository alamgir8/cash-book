import { useEffect, useState } from "react";
import {
  areLocalFirstFlagsReady,
  getLocalFirstFlagsSync,
  loadLocalFirstFlags,
  subscribeLocalFirstFlags,
  type LocalFirstFlags,
} from "@/lib/local-first/flags";

/** Reactive local-first flags for hooks/screens. */
export function useLocalFirstFlags(): LocalFirstFlags & { ready: boolean } {
  const [flags, setFlags] = useState<LocalFirstFlags>(getLocalFirstFlagsSync);
  const [ready, setReady] = useState(areLocalFirstFlagsReady);

  useEffect(() => {
    let alive = true;
    void loadLocalFirstFlags().then((f) => {
      if (!alive) return;
      setFlags(f);
      setReady(true);
    });
    return subscribeLocalFirstFlags((f) => {
      setFlags(f);
      setReady(true);
    });
  }, []);

  return { ...flags, ready };
}
