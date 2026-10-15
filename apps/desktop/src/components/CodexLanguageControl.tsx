import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Languages, Loader2, RefreshCw } from "lucide-react";
import type { CodexLanguageStatus, CodexLocale } from "../codexLanguageTypes";
import { Button, Checkbox, ModalShell } from "./ui";
import "../styles/codex-language.css";

export function CodexLanguageControl({ lang, configDir, active = true, disabled = false, onBusyChange }: {
  lang: "zh" | "en";
  configDir: string;
  active?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const text = (zh: string, en: string) => lang === "zh" ? zh : en;
  const [status, setStatus] = useState<CodexLanguageStatus | null>(null);
  const [locale, setLocale] = useState<CodexLocale>("auto");
  const [enabled, setEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"apply" | "restore" | null>(null);
  const generation = useRef(0);
  const operationInFlight = useRef(false);
  const statusRequest = useRef(0);
  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => { generation.current += 1; setDirty(false); setStatus(null); setError(""); setNotice(""); setConfirm(null); setBusy(false); }, [configDir]);
  useEffect(() => () => { generation.current += 1; }, []);

  useEffect(() => {
    const current = generation.current;
    let disposed = false;
    let loading = false;
    const load = async () => {
      if (loading || disposed || !active || operationInFlight.current) return;
      loading = true;
      const request = ++statusRequest.current;
      try {
        const next = await invoke<CodexLanguageStatus>("get_codex_language_status", { configDir });
        if (!disposed && generation.current === current && request === statusRequest.current && !operationInFlight.current) {
          setStatus(next);
          setError("");
        }
      } catch (cause) {
        if (!disposed && generation.current === current && request === statusRequest.current && !operationInFlight.current) setError(String(cause));
      } finally { loading = false; }
    };
    loadRef.current = load;
    if (active) void load();
    const interval = active ? window.setInterval(() => { void load(); }, 1800) : undefined;
    return () => { disposed = true; if (interval !== undefined) window.clearInterval(interval); };
  }, [configDir, active]);

  useEffect(() => {
    if (!dirty && status) { setLocale(status.locale); setEnabled(status.enabled); }
  }, [status, dirty]);
  useEffect(() => { if (!active && !busy) setConfirm(null); }, [active, busy]);

  const save = async () => {
    if (busy || disabled || operationInFlight.current) return;
    operationInFlight.current = true;
    statusRequest.current += 1;
    onBusyChange?.(true);
    const current = generation.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = await invoke<CodexLanguageStatus>("save_codex_language_preferences", { configDir, locale, enabled });
      if (current === generation.current) { setStatus(next); setDirty(false); setNotice(text("偏好已保存，点击“应用并重启”生效。", "Preferences saved. Apply and restart to use them.")); }
    } catch (cause) { if (current === generation.current) setError(String(cause)); }
    finally { operationInFlight.current = false; onBusyChange?.(false); if (current === generation.current) setBusy(false); }
  };
  const apply = async () => {
    if (!confirm || busy || disabled || operationInFlight.current) return;
    operationInFlight.current = true;
    statusRequest.current += 1;
    onBusyChange?.(true);
    const restore = confirm === "restore";
    const current = generation.current;
    setBusy(true); setError(""); setNotice("");
    try {
      if (!restore && dirty) {
        await invoke<CodexLanguageStatus>("save_codex_language_preferences", { configDir, locale, enabled });
        if (current !== generation.current) return;
      }
      const next = await invoke<CodexLanguageStatus>("apply_codex_language_preferences", { configDir, restore });
      if (current === generation.current) { setStatus(next); setDirty(false); setNotice(restore ? text("已恢复语言设置并重新启动客户端。", "Locale restored and client restarted.") : ""); setConfirm(null); }
    } catch (cause) { if (current === generation.current) { setError(String(cause)); setConfirm(null); } }
    finally { operationInFlight.current = false; onBusyChange?.(false); if (current === generation.current) setBusy(false); }
  };
  const starting = status?.phase === "starting";
  const blocked = busy || disabled;
  return <section className="cx-codex-language" aria-labelledby="codex-language-title">
    <div className="cx-codex-language-heading"><Languages size={19} aria-hidden="true" /><div>
      <h3 id="codex-language-title">{text("Codex 客户端界面语言", "Codex client interface language")}</h3>
      <p>{text("为 Codex / ChatGPT 客户端选择语言。第三方 API 下仍显示英文时，可开启中文兼容。", "Choose the Codex / ChatGPT client language. Enable Chinese compatibility when API sign-in still shows English.")}</p>
    </div></div>
    <div className="cx-codex-language-options">
      <label>{text("目标语言", "Target language")}<select value={locale} disabled={blocked || !status} onChange={event => {
        const next = event.target.value as CodexLocale; setLocale(next); setEnabled(next === "zh-CN"); setDirty(true); setNotice("");
      }}><option value="auto">{text("自动检测", "Auto detect")}</option><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></label>
      <Checkbox checked={enabled} disabled={blocked || locale !== "zh-CN" || !status} onCheckedChange={value => { setEnabled(value); setDirty(true); setNotice(""); }} label={text("兼容第三方 API 的中文界面", "Chinese compatibility for API sign-in")} />
    </div>
    <p className="cx-codex-language-detail">{text("兼容模式目前支持 macOS 官方客户端，需重启并保持 Codex-X 运行。它会临时启用本机调试连接来应用翻译；可随时恢复。", "Compatibility currently supports the official macOS client. Restart and keep Codex-X running. It temporarily uses a localhost debugging connection to apply translation and can be restored.")}</p>
    {status?.appName && <p className="cx-codex-language-detail">{status.appName} {status.appVersion}</p>}
    <div className="cx-codex-language-actions">
      <Button size="sm" disabled={blocked || starting || !status?.supported} onClick={() => setConfirm("apply")}>{text("应用并重启 Codex", "Apply and restart Codex")}</Button>
      <Button size="sm" variant="secondary" disabled={blocked || !dirty} onClick={() => void save()}>{text("仅保存偏好", "Save for later")}</Button>
      <Button size="sm" variant="secondary" disabled={blocked || starting || !status?.restoreAvailable || !status.supported} onClick={() => setConfirm("restore")}>{text("恢复并重启", "Restore and restart")}</Button>
      <Button size="sm" variant="ghost" disabled={busy} icon={<RefreshCw size={14} />} onClick={() => void loadRef.current()}>{text("刷新状态", "Refresh status")}</Button>
    </div>
    {busy && <p role="status"><Loader2 size={14} className="cx-page-spin" /> {text("正在处理，请勿重复操作…", "Working. Please wait…")}</p>}
    {notice && <p className="cx-codex-language-notice" role="status">{notice}</p>}
    {status && <p className={`cx-codex-language-status cx-codex-language-status--${status.phase}`} role="status">{status.phase === "active" ? text(`已验证 ${status.readyPages} 个官方界面。`, `Verified ${status.readyPages} official page(s).`) : status.message}</p>}
    {error && <p className="cx-codex-language-error" role="alert">{error}</p>}
    <ModalShell open={confirm !== null} onClose={() => { if (!busy) setConfirm(null); }} title={confirm === "restore" ? text("恢复 Codex 界面设置", "Restore Codex interface settings") : text("应用界面语言并重启 Codex", "Apply interface language and restart Codex")} description={text("这会正常退出并重新启动官方 Codex/ChatGPT 客户端，包括当前对话窗口。请先结束任务并保存工作；确认后才会执行。", "This will quit and restart the official Codex/ChatGPT client, including the current conversation window. Finish tasks and save your work first. Nothing runs until you confirm.")} closeLabel={text("关闭", "Close")} closeOnEscape={!busy} closeOnBackdrop={!busy} footer={<><Button variant="secondary" disabled={busy} data-initial-focus onClick={() => setConfirm(null)}>{text("取消", "Cancel")}</Button><Button disabled={blocked} onClick={() => void apply()}>{text("确认并重启", "Confirm and restart")}</Button></>}><p>{confirm === "restore" ? text("恢复先前语言键，保留无关设置，并关闭此次兼容启动的调试通道。", "Restore the previous locale, preserve unrelated settings, and restart without the compatibility debugging channel.") : text("将保存所选语言并重启客户端。兼容模式需要 Codex-X 保持运行。", "The selected language will be saved before restarting. Keep Codex-X running while using compatibility mode.")}</p></ModalShell>
  </section>;
}
