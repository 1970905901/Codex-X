import { Wallet } from "lucide-react";
import type { ProviderBalance } from "../providerBalance";
import "../styles/official-account-badge.css";

function errorLabel(code: string | null, zh: boolean) {
  if (code === "permission_denied") return zh ? "余额查询无权限" : "Balance access denied";
  if (code === "invalid_credential" || code === "authentication_failed") return zh ? "请检查 API Key" : "Check API key";
  if (code === "missing_key") return zh ? "未设置 API Key" : "API key missing";
  if (code === "rate_limited") return zh ? "余额查询限流" : "Rate limited";
  return zh ? "余额暂不可用" : "Balance unavailable";
}
export function ProviderBalanceBadge({ balance, loading, failed, lang }: {
  balance?: ProviderBalance; loading: boolean; failed: boolean; lang: "zh" | "en";
}) {
  const zh = lang === "zh";
  const hasBalance = Boolean(balance?.balances.length);
  const amount = balance?.balances.map(item => `${item.currency === "CNY" ? "¥" : item.currency === "USD" ? "$" : item.currency + " "}${item.amount}`).join(" / ");
  const label = hasBalance
    ? `${balance?.balanceKind === "credit_limit" ? (zh ? "可用额度" : "Credit left") : (zh ? "余额" : "Balance")} ${amount}`
    : loading ? (zh ? "查询余额中…" : "Loading balance…") : errorLabel(balance?.errorCode ?? null, zh);
  const updated = balance?.checkedAt ? new Date(balance.checkedAt) : null;
  const updateText = updated && Number.isFinite(updated.getTime()) ? `${zh ? "更新于" : "Updated"} ${updated.toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US")}` : "";
  const title = [label, balance?.balanceKind === "credit_limit" ? (zh ? "此 API Key 的剩余额度，不是账户余额。" : "Remaining credit for this API key, not the account balance.") : "", failed || balance?.errorCode ? (zh ? "查询失败，将自动重试。" : "Unable to refresh. Will retry automatically.") : "", updateText, zh ? "Codex-X 运行期间每 5 分钟自动刷新。" : "Refreshes every 5 minutes while Codex-X is running."].filter(Boolean).join("\n");
  return <span className="cx-official-account cx-providers-login-badge" title={title}>
    <span className={`cx-official-account-badge${hasBalance && !failed && !balance?.errorCode ? " cx-official-account-badge--signed-in" : ""}`}>
      <Wallet size={14} strokeWidth={1.8} aria-hidden="true" /><span>{label}{hasBalance && (failed || balance?.errorCode) ? (zh ? " · 未刷新" : " · stale") : ""}</span>
    </span>
  </span>;
}
