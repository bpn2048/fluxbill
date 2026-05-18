import React, { useEffect, useRef, useState } from "react";
import "./AssistantWidget.css";
import { useAssistantRegistry } from "./AssistantRegistry";
import micIdleIcon from "../assets/mic-1.png";
import micRecordingIcon from "../assets/mic-2.png";
import sendIcon from "../assets/send.png";

const MAX_RECORDING_SECONDS = 45;
const MAX_INITIAL_SILENCE_MS = 5000;
const STOP_AFTER_SILENCE_MS = 1200;
const SILENCE_RMS_THRESHOLD = 0.02;
const MUTATION_ACTIONS = new Set([
  "create_invoice",
  "delete_invoice",
  "update_invoice",
  "create_customer",
  "delete_customer",
  "create_subscription",
  "delete_subscription",
]);
const INLINE_MODES = {
  NONE: "none",
  INVOICE: "invoice",
  CUSTOMER: "customer",
  SUBSCRIPTION: "subscription",
  FILTER: "filter",
};
const ASSISTANT_SESSION_STORAGE_KEY = "fluxbill.assistant.session_id";

function formatTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function shouldSuppressConfirmationReply(command, reply) {
  const action = String(command?.action || "").trim().toLowerCase();
  if (!MUTATION_ACTIONS.has(action)) return false;
  return /\bare you sure\b|\bconfirm\b/i.test(String(reply || ""));
}

function createAssistantSessionId() {
  const fallback = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window === "undefined") return fallback;
  try {
    const existing = window.localStorage.getItem(ASSISTANT_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const generated = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : fallback;
    window.localStorage.setItem(ASSISTANT_SESSION_STORAGE_KEY, generated);
    return generated;
  } catch {
    return fallback;
  }
}

export default function AssistantWidget({ activeTab, onCommand }) {
  const backend =
    import.meta.env.VITE_API_BASE ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_DATA_API_BASE ||
    "http://127.0.0.1:8000";
  const registry = useAssistantRegistry();

  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [inlineMode, setInlineMode] = useState(INLINE_MODES.NONE);
  const [invoiceCompanyId, setInvoiceCompanyId] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerTier, setCustomerTier] = useState("");
  const [customerHealth, setCustomerHealth] = useState("");
  const [subscriptionCustomerId, setSubscriptionCustomerId] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState("");
  const [subscriptionMrr, setSubscriptionMrr] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "try: create invoice customer id CUS-0001 amount 45000, add customer name acme industries tier SMB status new, create subscription customer id CUS-0001 plan Starter mrr 12000",
    },
  ]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const autoStopTimeoutRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const sessionIdRef = useRef(createAssistantSessionId());
  const recordingStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserDataRef = useRef(null);
  const silenceMonitorFrameRef = useRef(null);
  const speechDetectedRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);

  function clearRecordingTimers() {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function clearSilenceMonitor() {
    if (silenceMonitorFrameRef.current) {
      cancelAnimationFrame(silenceMonitorFrameRef.current);
      silenceMonitorFrameRef.current = null;
    }

    analyserRef.current = null;
    analyserDataRef.current = null;
    speechDetectedRef.current = false;
    lastSpeechAtRef.current = 0;
    recordingStartedAtRef.current = 0;

    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && typeof ctx.close === "function" && ctx.state !== "closed") {
      void ctx.close().catch(() => {});
    }
  }

  function stopRecordingStream() {
    if (!recordingStreamRef.current) return;
    recordingStreamRef.current.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  function startSilenceMonitor(stream) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const analyser = ctx.createAnalyser();
    const source = ctx.createMediaStreamSource(stream);
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.15;
    source.connect(analyser);

    const sampleBuffer = new Uint8Array(analyser.fftSize);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    analyserDataRef.current = sampleBuffer;
    speechDetectedRef.current = false;
    recordingStartedAtRef.current = performance.now();
    lastSpeechAtRef.current = recordingStartedAtRef.current;

    if (typeof ctx.resume === "function") {
      void ctx.resume().catch(() => {});
    }

    const tick = () => {
      const recorder = mediaRecorderRef.current;
      const activeAnalyser = analyserRef.current;
      const activeBuffer = analyserDataRef.current;
      if (!recorder || recorder.state === "inactive" || !activeAnalyser || !activeBuffer) {
        return;
      }

      activeAnalyser.getByteTimeDomainData(activeBuffer);
      let sumSquares = 0;
      for (let i = 0; i < activeBuffer.length; i += 1) {
        const normalized = (activeBuffer[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / activeBuffer.length);
      const now = performance.now();
      const elapsed = now - recordingStartedAtRef.current;

      if (rms >= SILENCE_RMS_THRESHOLD) {
        speechDetectedRef.current = true;
        lastSpeechAtRef.current = now;
      }

      const silentFor = now - lastSpeechAtRef.current;
      const waitedForSpeech = !speechDetectedRef.current && elapsed >= MAX_INITIAL_SILENCE_MS;
      const userStoppedSpeaking = speechDetectedRef.current && silentFor >= STOP_AFTER_SILENCE_MS;

      if (waitedForSpeech || userStoppedSpeaking) {
        stopRecording();
        return;
      }

      silenceMonitorFrameRef.current = window.requestAnimationFrame(tick);
    };

    silenceMonitorFrameRef.current = window.requestAnimationFrame(tick);
  }

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      clearSilenceMonitor();
      stopRecordingStream();
    };
  }, []);

  function pushMsg(role, text) {
    setMessages((prev) => [...prev, { role, text }]);
  }

  function syncSessionId(nextSessionId) {
    const normalized = String(nextSessionId || "").trim();
    if (!normalized || normalized === sessionIdRef.current) return;
    sessionIdRef.current = normalized;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ASSISTANT_SESSION_STORAGE_KEY, normalized);
    } catch {
      // ignore local storage failures (private mode, blocked storage, etc)
    }
  }

  function getAvailableTargets() {
    if (!registry || typeof registry.listTargets !== "function") return [];
    try {
      return registry.listTargets();
    } catch {
      return [];
    }
  }

  async function execCommand(cmd) {
    if (!cmd || !cmd.action) return false;
    const normalized = { ...cmd, args: cmd.args || {} };
    const plannedTargets =
      normalized.action === "type" && Array.isArray(normalized.args?.search_targets)
        ? normalized.args.search_targets
        : [];

    const visited = new Set();
    for (const target of plannedTargets) {
      const clean = String(target || "").trim();
      if (!clean || visited.has(clean)) continue;
      visited.add(clean);
      if (registry.dispatch({ ...normalized, target: clean })) return true;
    }

    if (registry.dispatch(normalized)) return true;

    if (normalized.action === "scroll") {
      const position = normalized.args?.position ?? normalized.position ?? 0;
      window.scrollTo({ top: position, behavior: "smooth" });
      return true;
    }

    if (typeof onCommand === "function") {
      return Boolean(await onCommand(normalized));
    }

    return false;
  }

  function handleAssistantSideEffects(data) {
    if (data?.filter) {
      window.dispatchEvent(new CustomEvent("billing:setInvoiceFilter", { detail: data.filter }));
    }
    if (data?.data_changed) {
      window.dispatchEvent(new Event("billing:refresh"));
    }
  }

  function resetInlineEntry() {
    setInlineMode(INLINE_MODES.NONE);
    setInvoiceCompanyId("");
    setInvoiceAmount("");
    setCustomerName("");
    setCustomerTier("");
    setCustomerHealth("");
    setSubscriptionCustomerId("");
    setSubscriptionPlan("");
    setSubscriptionMrr("");
    setSubscriptionStatus("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
  }

  function buildInlineInvoiceCommand() {
    const companyId = String(invoiceCompanyId || "").trim();
    if (!companyId) {
      pushMsg("assistant", "company id is required");
      return "";
    }

    const amount = Number(String(invoiceAmount || "").replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      pushMsg("assistant", "amount must be greater than 0");
      return "";
    }

    return `create invoice customer id ${companyId} amount ${Math.round(amount)}`;
  }

  function buildInlineCustomerCommand() {
    const name = String(customerName || "").trim();
    if (!name) {
      pushMsg("assistant", "customer name is required");
      return "";
    }

    const tier = String(customerTier || "").trim() || "SMB";
    const status = String(customerHealth || "").trim() || "new";
    return `add customer ${name} tier ${tier} status ${status}`;
  }

  function buildInlineSubscriptionCommand() {
    const customerId = String(subscriptionCustomerId || "").trim();
    if (!customerId) {
      pushMsg("assistant", "customer id is required");
      return "";
    }

    const mrr = Number(String(subscriptionMrr || "").replace(/,/g, "").trim());
    if (!Number.isFinite(mrr) || mrr < 0) {
      pushMsg("assistant", "mrr must be a valid number");
      return "";
    }

    const plan = String(subscriptionPlan || "").trim() || "Starter";
    const status = String(subscriptionStatus || "").trim() || "active";
    return `create subscription customer id ${customerId} plan ${plan} mrr ${Math.round(mrr)} status ${status}`;
  }

  function buildInlineFilterCommand() {
    const minRaw = String(filterMinAmount || "").replace(/,/g, "").trim();
    const maxRaw = String(filterMaxAmount || "").replace(/,/g, "").trim();

    if (!minRaw && !maxRaw) {
      pushMsg("assistant", "enter min amount, max amount, or both");
      return "";
    }

    const hasMin = minRaw !== "";
    const hasMax = maxRaw !== "";
    const min = hasMin ? Number(minRaw) : null;
    const max = hasMax ? Number(maxRaw) : null;

    if (hasMin && (!Number.isFinite(min) || min < 0)) {
      pushMsg("assistant", "min amount must be 0 or higher");
      return "";
    }
    if (hasMax && (!Number.isFinite(max) || max < 0)) {
      pushMsg("assistant", "max amount must be 0 or higher");
      return "";
    }
    if (hasMin && hasMax && min > max) {
      pushMsg("assistant", "min amount cannot be greater than max amount");
      return "";
    }

    const parts = ["filter invoices"];
    if (hasMin) parts.push(`min ${Math.round(min)}`);
    if (hasMax) parts.push(`max ${Math.round(max)}`);
    return parts.join(" ");
  }

  async function sendText(overrideText) {
    const text = String(overrideText ?? typed).trim();
    if (!text) return;

    setTyped("");
    pushMsg("user", text);
    setBusy(true);

    try {
      const r = await fetch(`${backend}/assistant/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          active_tab: activeTab || "dashboard",
          available_targets: getAvailableTargets(),
          session_id: sessionIdRef.current,
        }),
      });
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(msg || `assistant text request failed: ${r.status}`);
      }

      const data = await r.json();
      syncSessionId(data?.session_id);
      if (data?.transcript) {
        // transcript already pushed, no need to double push
      }

      const executed = await execCommand(data.command);
      const reply = data?.command?.reply || (executed ? "done." : "ok");
      if (shouldSuppressConfirmationReply(data?.command, reply)) {
        if (executed) pushMsg("assistant", "done.");
      } else {
        pushMsg("assistant", reply);
      }

      handleAssistantSideEffects(data);
    } catch (e) {
      const msg = String(e?.message || "").trim();
      pushMsg("assistant", msg || "backend not reachable. make sure fastapi is running on 127.0.0.1:8000");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    resetInlineEntry();
    if (!navigator.mediaDevices?.getUserMedia) {
      pushMsg("assistant", "mic not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      pushMsg("assistant", "MediaRecorder not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onerror = () => {
        clearRecordingTimers();
        clearSilenceMonitor();
        stopRecordingStream();
        mediaRecorderRef.current = null;
        setRecording(false);
        setRecordingSeconds(0);
        pushMsg("assistant", "mic recording failed.");
      };

      mr.onstop = async () => {
        clearRecordingTimers();
        clearSilenceMonitor();
        setRecording(false);
        setRecordingSeconds(0);
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
          if (!blob.size) {
            pushMsg("assistant", "I could not hear anything. Try again.");
            return;
          }

          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          fd.append("active_tab", activeTab || "dashboard");
          fd.append("available_targets_json", JSON.stringify(getAvailableTargets()));
          fd.append("session_id", sessionIdRef.current);

          const r = await fetch(`${backend}/assistant/voice`, { method: "POST", body: fd });
          if (!r.ok) {
            const msg = await r.text();
            throw new Error(msg || `assistant voice request failed: ${r.status}`);
          }
          const data = await r.json();
          syncSessionId(data?.session_id);

          if (data?.transcript) pushMsg("user", data.transcript);

          const executed = await execCommand(data.command);
          const reply = data?.command?.reply || (executed ? "done." : "ok");
          if (shouldSuppressConfirmationReply(data?.command, reply)) {
            if (executed) pushMsg("assistant", "done.");
          } else {
            pushMsg("assistant", reply);
          }

          handleAssistantSideEffects(data);
        } catch (e) {
          const msg = String(e?.message || "").trim();
          pushMsg("assistant", msg || "voice request failed. check backend logs.");
        } finally {
          stopRecordingStream();
          mediaRecorderRef.current = null;
          chunksRef.current = [];
          setBusy(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
      clearRecordingTimers();
      clearSilenceMonitor();
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => Math.min(prev + 1, MAX_RECORDING_SECONDS));
      }, 1000);
      autoStopTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
      startSilenceMonitor(stream);
      setRecording(true);
    } catch (e) {
      stopRecordingStream();
      clearSilenceMonitor();
      const msg = String(e?.message || "").trim();
      pushMsg("assistant", msg || "mic permission denied.");
    }
  }

  function stopRecording() {
    clearRecordingTimers();
    clearSilenceMonitor();
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    setRecording(false);
    setRecordingSeconds(0);
  }

  function quick(cmd) {
    setTyped(cmd);
    resetInlineEntry();
    setOpen(true);
  }

  function openInlineMode(mode) {
    setTyped("");
    resetInlineEntry();
    setInlineMode(mode);
    setOpen(true);
  }

  function quickCreateInvoice() {
    openInlineMode(INLINE_MODES.INVOICE);
  }

  function quickAddCustomer() {
    openInlineMode(INLINE_MODES.CUSTOMER);
  }

  function quickCreateSubscription() {
    openInlineMode(INLINE_MODES.SUBSCRIPTION);
  }

  function quickFilterInvoices() {
    openInlineMode(INLINE_MODES.FILTER);
  }

  async function sendInlineEntry() {
    let cmd = "";
    if (inlineMode === INLINE_MODES.INVOICE) {
      cmd = buildInlineInvoiceCommand();
    } else if (inlineMode === INLINE_MODES.CUSTOMER) {
      cmd = buildInlineCustomerCommand();
    } else if (inlineMode === INLINE_MODES.SUBSCRIPTION) {
      cmd = buildInlineSubscriptionCommand();
    } else if (inlineMode === INLINE_MODES.FILTER) {
      cmd = buildInlineFilterCommand();
    }
    if (!cmd) return;
    resetInlineEntry();
    await sendText(cmd);
  }

  function handleSendClick() {
    if (inlineMode !== INLINE_MODES.NONE) {
      sendInlineEntry();
      return;
    }
    sendText();
  }

  const isInlineMode = inlineMode !== INLINE_MODES.NONE;
  const inlineAmountNumber = Number(String(invoiceAmount || "").replace(/,/g, "").trim());
  const inlineMrrNumber = Number(String(subscriptionMrr || "").replace(/,/g, "").trim());
  const minFilterRaw = String(filterMinAmount || "").replace(/,/g, "").trim();
  const maxFilterRaw = String(filterMaxAmount || "").replace(/,/g, "").trim();
  const hasMinFilter = minFilterRaw !== "";
  const hasMaxFilter = maxFilterRaw !== "";
  const minFilterNumber = hasMinFilter ? Number(minFilterRaw) : null;
  const maxFilterNumber = hasMaxFilter ? Number(maxFilterRaw) : null;
  const canSendInlineInvoice = String(invoiceCompanyId || "").trim() !== ""
    && Number.isFinite(inlineAmountNumber)
    && inlineAmountNumber > 0;
  const canSendInlineCustomer = String(customerName || "").trim() !== "";
  const canSendInlineSubscription = String(subscriptionCustomerId || "").trim() !== ""
    && Number.isFinite(inlineMrrNumber)
    && inlineMrrNumber >= 0;
  const canSendInlineFilter = (hasMinFilter || hasMaxFilter)
    && (!hasMinFilter || (Number.isFinite(minFilterNumber) && minFilterNumber >= 0))
    && (!hasMaxFilter || (Number.isFinite(maxFilterNumber) && maxFilterNumber >= 0))
    && (!(hasMinFilter && hasMaxFilter) || minFilterNumber <= maxFilterNumber);
  const canSendInline = inlineMode === INLINE_MODES.INVOICE
    ? canSendInlineInvoice
    : inlineMode === INLINE_MODES.CUSTOMER
      ? canSendInlineCustomer
      : inlineMode === INLINE_MODES.SUBSCRIPTION
        ? canSendInlineSubscription
        : inlineMode === INLINE_MODES.FILTER
          ? canSendInlineFilter
          : false;

  function handleInlineEnter(event) {
    if (event.key === "Enter") sendInlineEntry();
  }

  return (
    <>
      <button
        className={`assistantFab ${recording ? "assistantFabRecording" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="AI assistant"
        title="AI assistant"
        type="button"
      >
        🤖
      </button>

      {open && (
        <div className="assistantPanel" role="dialog" aria-label="AI assistant panel">
          <div className="assistantHeader">
            <div>
              <div className="assistantTitle">ai assistant</div>
              <div className="assistantSub">voice + chat navigation • current tab: {activeTab}</div>
            </div>
            <button className="assistantClose" onClick={() => setOpen(false)} aria-label="Close" type="button">
              ✕
            </button>
          </div>

          <div className="assistantQuick">
            <button className="chip" onClick={() => quick("open invoices")} type="button">open invoices</button>
            <button className="chip" onClick={quickCreateInvoice} type="button">create invoice</button>
            <button className="chip" onClick={quickFilterInvoices} type="button">filter amount</button>
            <button className="chip" onClick={quickAddCustomer} type="button">add customer</button>
            <button className="chip" onClick={quickCreateSubscription} type="button">create subscription</button>
          </div>

          <div className="assistantChat">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "bubble bubbleUser" : "bubble bubbleAssistant"}>
                <div className="bubbleRole">{m.role}</div>
                <div className="bubbleText">{m.text}</div>
              </div>
            ))}
          </div>

          <div className="assistantControls">
            <div className="assistantHint">
              {busy ? "thinking..." : ""}
            </div>
          </div>

          <div className="assistantComposer">
            {recording ? (
              <div className="assistantRecordingTimer" aria-live="polite">
                {formatTimer(recordingSeconds)}
              </div>
            ) : isInlineMode ? (
              <div className="assistantInlineForm">
                {inlineMode === INLINE_MODES.INVOICE ? (
                  <>
                    <input
                      className="assistantInput assistantInlineField assistantInlineFieldWide"
                      value={invoiceCompanyId}
                      onChange={(e) => setInvoiceCompanyId(e.target.value)}
                      placeholder="company id"
                      aria-label="company id"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField assistantInlineAmountField"
                      value={invoiceAmount}
                      onChange={(e) => setInvoiceAmount(e.target.value)}
                      placeholder="amount"
                      aria-label="amount"
                      inputMode="numeric"
                      onKeyDown={handleInlineEnter}
                    />
                  </>
                ) : null}

                {inlineMode === INLINE_MODES.CUSTOMER ? (
                  <>
                    <input
                      className="assistantInput assistantInlineField assistantInlineFieldWide"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="customer name"
                      aria-label="customer name"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField"
                      value={customerTier}
                      onChange={(e) => setCustomerTier(e.target.value)}
                      placeholder="tier"
                      aria-label="tier"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField"
                      value={customerHealth}
                      onChange={(e) => setCustomerHealth(e.target.value)}
                      placeholder="health"
                      aria-label="health"
                      onKeyDown={handleInlineEnter}
                    />
                  </>
                ) : null}

                {inlineMode === INLINE_MODES.SUBSCRIPTION ? (
                  <>
                    <input
                      className="assistantInput assistantInlineField"
                      value={subscriptionCustomerId}
                      onChange={(e) => setSubscriptionCustomerId(e.target.value)}
                      placeholder="customer id"
                      aria-label="customer id"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField"
                      value={subscriptionPlan}
                      onChange={(e) => setSubscriptionPlan(e.target.value)}
                      placeholder="plan"
                      aria-label="plan"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField assistantInlineAmountField"
                      value={subscriptionMrr}
                      onChange={(e) => setSubscriptionMrr(e.target.value)}
                      placeholder="mrr"
                      aria-label="mrr"
                      inputMode="numeric"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField"
                      value={subscriptionStatus}
                      onChange={(e) => setSubscriptionStatus(e.target.value)}
                      placeholder="status"
                      aria-label="status"
                      onKeyDown={handleInlineEnter}
                    />
                  </>
                ) : null}

                {inlineMode === INLINE_MODES.FILTER ? (
                  <>
                    <input
                      className="assistantInput assistantInlineField assistantInlineAmountField"
                      value={filterMinAmount}
                      onChange={(e) => setFilterMinAmount(e.target.value)}
                      placeholder="min amount"
                      aria-label="min amount"
                      inputMode="numeric"
                      onKeyDown={handleInlineEnter}
                    />
                    <input
                      className="assistantInput assistantInlineField assistantInlineAmountField"
                      value={filterMaxAmount}
                      onChange={(e) => setFilterMaxAmount(e.target.value)}
                      placeholder="max amount"
                      aria-label="max amount"
                      inputMode="numeric"
                      onKeyDown={handleInlineEnter}
                    />
                  </>
                ) : null}

                <button className="assistantInlineCancel" onClick={resetInlineEntry} type="button">
                  cancel
                </button>
              </div>
            ) : (
              <input
                className="assistantInput"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="type a command..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendText();
                }}
              />
            )}
            <button
              className="assistantSend"
              onClick={handleSendClick}
              disabled={busy || recording || (isInlineMode ? !canSendInline : !typed.trim())}
              aria-label="send"
              title="send"
              type="button"
            >
              <img
                className="assistantSendIcon"
                src={sendIcon}
                alt=""
                aria-hidden="true"
              />
            </button>
            {!isInlineMode || recording ? (
              <button
                className={`assistantMic assistantActionBtn ${recording ? "assistantMicRecording" : ""}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={busy}
                aria-label={recording ? "stop mic" : "start mic"}
                title={recording ? "stop mic" : "start mic"}
                type="button"
              >
                <img
                  className="assistantMicIcon"
                  src={recording ? micRecordingIcon : micIdleIcon}
                  alt=""
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
