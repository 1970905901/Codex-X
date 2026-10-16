import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type ProviderBalance = {
  source: "local" | "detected";
  providerId: string;
  vendor: "deepseek" | "openrouter" | "siliconflow" | "moonshot" | null;
  supported: boolean;
  balanceKind: "balance" | "credit_limit" | null;
  balances: { currency: string; amount: string }[];
  checkedAt: string | null;
  errorCode: string | null;
};
const REFRESH_INTERVAL = 5 * 60 * 1000;

// Lives in App, so navigating away from Providers does not stop refreshing.
export function useProviderBalances(configDir: string, revision: string, ready: boolean) {
  const [snapshot, setSnapshot] = useState({ configDir, revision, balances: [] as ProviderBalance[], failed: false, loading: true });
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let inFlight = false;
    let lastAttempt = 0;
    let timer: number | undefined;
    setSnapshot({ configDir, revision, balances: [], failed: false, loading: true });
    const refresh = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      if (timer !== undefined) window.clearTimeout(timer);
      lastAttempt = Date.now();
      try {
        const balances = await invoke<ProviderBalance[]>("get_provider_balances", { configDir });
        if (!disposed) setSnapshot({ configDir, revision, balances, failed: false, loading: false });
      } catch {
        if (!disposed) setSnapshot(previous => ({ ...previous, loading: false, failed: true }));
      } finally {
        inFlight = false;
        lastAttempt = Date.now();
        // Schedule after completion so the server's five-minute cache has
        // expired; an interval from request start could skip every other poll.
        if (!disposed) timer = window.setTimeout(() => { void refresh(); }, REFRESH_INTERVAL + 250);
      }
    };
    const onWake = () => { if (Date.now() - lastAttempt >= REFRESH_INTERVAL) void refresh(); };
    void refresh();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => { disposed = true; if (timer !== undefined) window.clearTimeout(timer); window.removeEventListener("focus", onWake); document.removeEventListener("visibilitychange", onWake); };
  }, [configDir, revision, ready]);
  return snapshot.configDir === configDir && snapshot.revision === revision
    ? snapshot : { configDir, revision, balances: [] as ProviderBalance[], loading: true, failed: false };
}

export function supportsProviderBalance(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return url.protocol === "https:" && ["api.deepseek.com", "openrouter.ai", "api.siliconflow.cn", "api.moonshot.cn"].includes(url.hostname);
  } catch { return false; }
}
