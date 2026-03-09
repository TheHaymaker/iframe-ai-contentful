import { useEffect, useRef, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import { useBroadcastChannel } from "../hooks/useBroadcastChannel";
import { CHANNEL_NAME, generateSourceId } from "../constants";
import { cloneWithNewIds, countNodes } from "../lib/treeUtils";
import { postToEditor } from "../lib/postMessageBridge";
import type { ComponentTreeNode, HubMessage, IframeMeta } from "../types";

const POPUP_FEATURES =
  "width=600,height=700,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes";

// Stable iframe identity — survives component remounts
const MODULE_SOURCE_ID = generateSourceId();

// Module-level hub window ref — survives add/remove/re-add of the component
let hubWindow: Window | null = null;

// ── Singleton guard: only one HubConnector instance per editor window ─
let activeInstanceId: string | null = null;

type LogChannel = "postMessage" | "broadcast";
type LogDirection = "in" | "out";

interface LogEntry {
  id: string;
  ts: number;
  channel: LogChannel;
  direction: LogDirection;
  msgType: string;
  data: unknown;
}

// Hub liveness: consider hub stale after 20s of no heartbeat
const HUB_STALE_MS = 20_000;

/**
 * Palette component that, when added to the canvas:
 *  - Auto-opens (or focuses) the Hub popup window
 *  - Registers this iframe with the Hub via BroadcastChannel
 *  - Shows a status beacon with connection state and sourceId
 *  - Provides a live message discovery log for all postMessage and
 *    BroadcastChannel traffic (both directions)
 *  - Enforces singleton: only one instance per editor window
 *
 * Remove this component to disconnect the iframe from the Hub.
 */
export function HubConnector({ nodeId }: { nodeId?: string }) {
  const [instanceId] = useState(() => crypto.randomUUID());
  const [isDuplicate, setIsDuplicate] = useState(false);
  const nodesRef = useRef<ComponentTreeNode[]>([]);

  const [hubStatus, setHubStatus] = useState<"open" | "alive" | "closed" | "blocked" | "checking">(() =>
    hubWindow && !hubWindow.closed ? "open" : "closed",
  );
  const [hubConnected, setHubConnected] = useState(false);
  const hubLastSeenRef = useRef<number>(0);
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  // ── Singleton enforcement ───────────────────────────────────────────
  useEffect(() => {
    if (activeInstanceId !== null && activeInstanceId !== instanceId) {
      console.warn(
        `[HubConnector] Duplicate instance blocked (active: ${activeInstanceId.slice(0, 6)}, this: ${instanceId.slice(0, 6)}). Only one HubConnector per editor window is allowed.`,
      );
      setIsDuplicate(true);
      return;
    }
    activeInstanceId = instanceId;
    setIsDuplicate(false);
    return () => {
      if (activeInstanceId === instanceId) {
        activeInstanceId = null;
      }
    };
  }, [instanceId]);

  // If this is a duplicate, render a warning badge and nothing else
  if (isDuplicate) {
    return (
      <div
        data-node-id={nodeId}
        data-component="HubConnector"
        style={{
          padding: "8px 12px",
          backgroundColor: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: 6,
          fontSize: 12,
          color: "#991b1b",
          fontFamily: "system-ui",
        }}
      >
        Duplicate HubConnector — only one is allowed per editor window. Remove this instance.
      </div>
    );
  }

  return (
    <HubConnectorInner
      nodeId={nodeId}
      nodesRef={nodesRef}
      hubStatus={hubStatus}
      setHubStatus={setHubStatus}
      hubConnected={hubConnected}
      setHubConnected={setHubConnected}
      hubLastSeenRef={hubLastSeenRef}
      showLog={showLog}
      setShowLog={setShowLog}
      log={log}
      setLog={setLog}
    />
  );
}

// Inner component that only renders when singleton check passes.
// Separated to avoid hook ordering issues with the early return.
function HubConnectorInner({
  nodeId,
  nodesRef,
  hubStatus,
  setHubStatus,
  hubConnected,
  setHubConnected,
  hubLastSeenRef,
  showLog,
  setShowLog,
  log,
  setLog,
}: {
  nodeId?: string;
  nodesRef: React.MutableRefObject<ComponentTreeNode[]>;
  hubStatus: "open" | "alive" | "closed" | "blocked" | "checking";
  setHubStatus: React.Dispatch<React.SetStateAction<"open" | "alive" | "closed" | "blocked" | "checking">>;
  hubConnected: boolean;
  setHubConnected: React.Dispatch<React.SetStateAction<boolean>>;
  hubLastSeenRef: React.MutableRefObject<number>;
  showLog: boolean;
  setShowLog: React.Dispatch<React.SetStateAction<boolean>>;
  log: LogEntry[];
  setLog: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}) {
  const pushLog = useCallback(
    (channel: LogChannel, direction: LogDirection, msgType: string, data: unknown) => {
      setLog((prev) =>
        [
          { id: crypto.randomUUID(), ts: Date.now(), channel, direction, msgType, data },
          ...prev,
        ].slice(0, 100),
      );
    },
    [setLog],
  );

  // ── Hub liveness check: poll every 5s ────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (hubLastSeenRef.current > 0 && Date.now() - hubLastSeenRef.current > HUB_STALE_MS) {
        setHubConnected(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hubLastSeenRef, setHubConnected]);

  // ── postMessage discovery: capture ALL raw window.message events ──────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msgType =
        e.data != null && typeof e.data === "object" && typeof e.data.type === "string"
          ? (e.data.type as string)
          : "(non-typed)";
      pushLog("postMessage", "in", msgType, e.data);

      // Shadow-track the tree so we can answer snapshot requests
      if (e.data?.type === "SET_TREE" && Array.isArray(e.data.payload)) {
        nodesRef.current = e.data.payload as ComponentTreeNode[];
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pushLog, nodesRef]);

  // ── buildMeta ─────────────────────────────────────────────────────────
  const buildMeta = useCallback(
    (): IframeMeta => ({
      sourceId: MODULE_SOURCE_ID,
      url: window.location.href,
      title: document.title || "Preview",
      componentCount: countNodes(nodesRef.current),
      timestamp: Date.now(),
    }),
    [nodesRef],
  );

  // ── Outbound postToEditor (logged) ────────────────────────────────────
  const sendToEditor = useCallback(
    (msg: Parameters<typeof postToEditor>[0]) => {
      pushLog("postMessage", "out", msg.type, msg);
      postToEditor(msg);
    },
    [pushLog],
  );

  // ── Import handler ────────────────────────────────────────────────────
  const handleImportTree = useCallback(
    (imported: ComponentTreeNode[], replace?: boolean) => {
      const cloned = cloneWithNewIds(imported);
      const next = replace ? cloned : [...nodesRef.current, ...cloned];
      nodesRef.current = next;
      sendToEditor({ type: "TREE_UPDATED", payload: next });
    },
    [sendToEditor, nodesRef],
  );

  // ── BroadcastChannel send (logged) ────────────────────────────────────
  const broadcastPostRef = useRef<(msg: HubMessage) => void>(() => {});

  const sendToHub = useCallback(
    (msg: HubMessage) => {
      pushLog("broadcast", "out", msg.type, msg);
      broadcastPostRef.current(msg);
    },
    [pushLog],
  );

  // ── Incoming hub messages ─────────────────────────────────────────────
  const handleHubMessage = useCallback(
    (msg: HubMessage) => {
      pushLog("broadcast", "in", msg.type, msg);

      // Ignore messages targeted at other iframes
      if ("targetIds" in msg && msg.targetIds && !msg.targetIds.includes(MODULE_SOURCE_ID)) {
        return;
      }

      // Track hub liveness from any hub-originated message
      if (
        msg.type === "HUB_READY" ||
        msg.type === "HUB_HEARTBEAT" ||
        msg.type === "HUB_ALIVE" ||
        msg.type === "REQUEST_SNAPSHOT" ||
        msg.type === "IMPORT_TREE" ||
        msg.type === "BROADCAST_TREE" ||
        msg.type === "GENERATE_RESULT"
      ) {
        hubLastSeenRef.current = Date.now();
        setHubConnected(true);
      }

      switch (msg.type) {
        case "HUB_READY":
          sendToHub({ type: "IFRAME_ANNOUNCE", sourceId: MODULE_SOURCE_ID, meta: buildMeta() });
          sendToHub({
            type: "IFRAME_TREE_SNAPSHOT",
            payload: nodesRef.current,
            sourceId: MODULE_SOURCE_ID,
          });
          break;

        case "REQUEST_SNAPSHOT":
          sendToHub({
            type: "IFRAME_TREE_SNAPSHOT",
            payload: nodesRef.current,
            sourceId: MODULE_SOURCE_ID,
          });
          break;

        case "IMPORT_TREE":
          handleImportTree(msg.payload, msg.mergeMode === "replace");
          break;

        case "BROADCAST_TREE":
          handleImportTree(msg.payload);
          break;

        case "GENERATE_RESULT":
          handleImportTree(msg.payload);
          break;
      }
    },
    [pushLog, sendToHub, buildMeta, handleImportTree, hubLastSeenRef, setHubConnected, nodesRef],
  );

  const { postMessage } = useBroadcastChannel({
    channelName: CHANNEL_NAME,
    onMessage: handleHubMessage,
  });

  broadcastPostRef.current = postMessage;

  // ── Heartbeat ─────────────────────────────────────────────────────────
  useEffect(() => {
    sendToHub({ type: "IFRAME_ANNOUNCE", sourceId: MODULE_SOURCE_ID, meta: buildMeta() });
    const interval = setInterval(
      () => sendToHub({ type: "IFRAME_ANNOUNCE", sourceId: MODULE_SOURCE_ID, meta: buildMeta() }),
      5000,
    );
    return () => clearInterval(interval);
  }, [sendToHub, buildMeta]);

  // ── Re-announce when tab becomes visible (counteracts background throttling) ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        sendToHub({ type: "IFRAME_ANNOUNCE", sourceId: MODULE_SOURCE_ID, meta: buildMeta() });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sendToHub, buildMeta]);

  // ── Disconnect on unmount / page close ────────────────────────────────
  useEffect(() => {
    const onUnload = () => sendToHub({ type: "IFRAME_DISCONNECT", sourceId: MODULE_SOURCE_ID });
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      sendToHub({ type: "IFRAME_DISCONNECT", sourceId: MODULE_SOURCE_ID });
    };
  }, [sendToHub]);

  // ── Hub window management ─────────────────────────────────────────────
  const ensureHubOpen = useCallback(() => {
    // Fast path: ref still valid
    if (hubWindow && !hubWindow.closed) {
      hubWindow.focus();
      return;
    }

    setHubStatus("checking");

    // Ping via a one-shot BroadcastChannel listener (200ms window)
    const ch = new BroadcastChannel(CHANNEL_NAME);
    let found = false;

    ch.onmessage = (e: MessageEvent<HubMessage>) => {
      if (e.data.type === "HUB_ALIVE") found = true;
    };
    ch.postMessage({ type: "HUB_PING", sourceId: MODULE_SOURCE_ID });

    setTimeout(() => {
      ch.close();

      if (found) {
        // Hub is alive — BroadcastChannel confirmed it; skip window.open probe
        // (calling window.open("","cms-hub-popup") opens an about:blank window
        // when the named window isn't reachable from the current context)
        // We don't have a window ref, so we can't focus — use "alive" status
        setHubStatus("alive");
        return;
      }

      // No ping response — open for real
      const popup = window.open("/hub.html", "cms-hub-popup", POPUP_FEATURES);
      if (!popup || popup.closed) {
        setHubStatus("blocked");
        hubWindow = null;
        return;
      }
      hubWindow = popup;
      setHubStatus("open");
    }, 200);
  }, [setHubStatus]);

  // Auto-launch on mount + poll for popup close
  useEffect(() => {
    ensureHubOpen();
    const poll = setInterval(() => {
      if (hubWindow?.closed) {
        hubWindow = null;
        setHubStatus("closed");
      }
    }, 1000);
    return () => clearInterval(poll);
  }, [ensureHubOpen, setHubStatus]);

  const isLive = hubConnected && (hubStatus === "open" || hubStatus === "alive");

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Inject pulse animation (once, shared by both inline and overlay) */}
      <style>{`
        @keyframes hub-beacon-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
          50% { opacity: 0.85; box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        }
        @keyframes hub-connector-scan {
          0% { transform: translateY(-100%); opacity: 0.18; }
          100% { transform: translateY(100%); opacity: 0; }
        }
      `}</style>

      {/* ── Inline canvas placeholder ──────────────────────────────────
          Sits at the component's actual position in the tree so the
          editor selection ring and tree outline align correctly.        */}
      <div
        data-node-id={nodeId}
        data-component="HubConnector"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          margin: "4px 0",
          background: isLive
            ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)"
            : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          border: `1px solid ${isLive ? "#4f46e5" : "#334155"}`,
          borderLeft: `3px solid ${isLive ? "#6366f1" : "#475569"}`,
          borderRadius: 6,
          fontFamily: "system-ui",
          overflow: "hidden",
          boxShadow: isLive
            ? "0 0 0 1px rgba(99,102,241,0.2), 0 2px 8px rgba(0,0,0,0.3)"
            : "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        {/* Animated scan line (visible only when live) */}
        {isLive && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 0%, rgba(99,102,241,0.12) 50%, transparent 100%)",
              animation: "hub-connector-scan 3s linear infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Icon */}
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
          {isLive ? "⬡" : "⬢"}
        </span>

        {/* Label + ID */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Hub Connector
          </div>
          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", marginTop: 1 }}>
            id: {MODULE_SOURCE_ID.slice(0, 8)}
          </div>
        </div>

        {/* Status beacon */}
        <StatusBeacon
          hubConnected={hubConnected}
          hubStatus={hubStatus}
          sourceId={MODULE_SOURCE_ID}
        />

        {/* Open/focus button */}
        <button
          type="button"
          onClick={ensureHubOpen}
          disabled={hubStatus === "alive"}
          title={hubStatus === "open" ? "Focus hub window" : hubStatus === "alive" ? "Hub is running in another window" : hubStatus === "checking" ? "Checking for hub…" : "Open hub"}
          style={{
            padding: "4px 10px",
            backgroundColor: hubStatus === "alive" ? "#0d9488" : isLive ? "#4f46e5" : hubStatus === "blocked" ? "#dc2626" : hubStatus === "checking" ? "#f59e0b" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            cursor: hubStatus === "alive" ? "default" : "pointer",
            flexShrink: 0,
            opacity: hubStatus === "alive" ? 0.8 : 1,
          }}
        >
          {hubStatus === "open" ? "Focus" : hubStatus === "alive" ? "Connected" : hubStatus === "blocked" ? "Blocked" : hubStatus === "checking" ? "Checking…" : "Open"}
        </button>
      </div>

      {/* ── Fixed overlay (log panel + controls) ──────────────────────
          Floats above the canvas for the message log; no data-node-id
          so it doesn't interfere with the editor selection ring.       */}
      <div
        style={{ position: "fixed", bottom: 16, right: 16, zIndex: 10000, fontFamily: "system-ui" }}
      >
        {showLog && (
          <MessageLog log={log} onClear={() => setLog([])} onClose={() => setShowLog(false)} />
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            title="Toggle message discovery log"
            style={{
              padding: "6px 10px",
              backgroundColor: showLog ? "#6366f1" : "#475569",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            {showLog ? "Hide Log" : "Log"}{log.length > 0 ? ` (${log.length})` : ""}
          </button>

          <button
            type="button"
            onClick={ensureHubOpen}
            disabled={hubStatus === "alive"}
            title={hubStatus === "alive" ? "Hub is running in another window" : undefined}
            style={{
              padding: "10px 20px",
              backgroundColor:
                hubStatus === "open" ? "#16a34a" : hubStatus === "alive" ? "#0d9488" : hubStatus === "blocked" ? "#dc2626" : hubStatus === "checking" ? "#f59e0b" : "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: hubStatus === "alive" ? "default" : "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              opacity: hubStatus === "alive" ? 0.8 : 1,
            }}
          >
            {hubStatus === "open" ? "Hub Open" : hubStatus === "alive" ? "Hub Connected" : hubStatus === "blocked" ? "Popup Blocked" : hubStatus === "checking" ? "Checking…" : "Open Hub"}
          </button>
        </div>

        {hubStatus === "blocked" && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              fontSize: 12,
              color: "#991b1b",
              maxWidth: 260,
            }}
          >
            Popup blocked. Allow popups for this site and click the button.
          </div>
        )}
      </div>
    </>
  );
}

// ── Status Beacon ────────────────────────────────────────────────────────────

function StatusBeacon({
  hubConnected,
  hubStatus,
  sourceId,
}: {
  hubConnected: boolean;
  hubStatus: "open" | "alive" | "closed" | "blocked" | "checking";
  sourceId: string;
}) {
  const isLive = hubConnected && (hubStatus === "open" || hubStatus === "alive");
  const dotColor = isLive ? "#22c55e" : hubStatus === "blocked" ? "#ef4444" : hubStatus === "checking" ? "#f59e0b" : "#94a3b8";
  const label = isLive ? "Connected" : hubStatus === "blocked" ? "Blocked" : hubStatus === "checking" ? "Checking" : "Disconnected";

  return (
    <div
      title={`Hub ${label} — Source ID: ${sourceId}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        backgroundColor: "#1e293b",
        borderRadius: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      {/* Pulsing beacon dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: dotColor,
          flexShrink: 0,
          animation: isLive ? "hub-beacon-pulse 2s ease-in-out infinite" : "none",
        }}
      />
      {/* Source ID */}
      <span
        style={{
          fontSize: 10,
          fontFamily: "monospace",
          color: "#94a3b8",
          letterSpacing: "0.04em",
        }}
      >
        {sourceId.slice(0, 8)}
      </span>
    </div>
  );
}

// ── Message Log Panel ────────────────────────────────────────────────────────

interface MessageLogProps {
  log: LogEntry[];
  onClear: () => void;
  onClose: () => void;
}

function MessageLog({ log, onClear, onClose }: MessageLogProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const copyAll = () =>
    navigator.clipboard.writeText(JSON.stringify(log, null, 2)).catch(() => {});

  return (
    <div
      style={{
        marginBottom: 8,
        width: 440,
        maxHeight: 420,
        backgroundColor: "#0f172a",
        border: "1px solid #334155",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid #1e293b",
          backgroundColor: "#1e293b",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: "#94a3b8",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            fontFamily: "monospace",
          }}
        >
          MSG DISCOVERY LOG
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <HeaderBtn onClick={copyAll} title="Copy all to clipboard">Copy</HeaderBtn>
          <HeaderBtn onClick={onClear}>Clear</HeaderBtn>
          <HeaderBtn onClick={onClose} style={{ color: "#f87171" }}>✕</HeaderBtn>
        </div>
      </div>

      {/* Entries */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {log.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: "#475569",
              fontSize: 12,
              fontFamily: "monospace",
              textAlign: "center",
            }}
          >
            Waiting for messages…
          </div>
        ) : (
          log.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              expanded={expanded.has(entry.id)}
              onToggle={() => toggle(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Header button helper ──────────────────────────────────────────────────────

function HeaderBtn({
  children,
  onClick,
  title,
  style,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "2px 8px",
        backgroundColor: "transparent",
        color: "#94a3b8",
        border: "1px solid #334155",
        borderRadius: 4,
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "system-ui",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Log row ──────────────────────────────────────────────────────────────────

function LogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const time = new Date(entry.ts).toISOString().slice(11, 23); // HH:MM:SS.mmm

  // Blue = postMessage, purple = broadcast
  const channelColor = entry.channel === "postMessage" ? "#60a5fa" : "#a78bfa";
  // Green = in, orange = out
  const dirColor = entry.direction === "in" ? "#34d399" : "#fb923c";
  const dirLabel = entry.direction === "in" ? "▼" : "▲";

  return (
    <div style={{ borderBottom: "1px solid #1e293b", fontFamily: "monospace", fontSize: 11 }}>
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          cursor: "pointer",
          userSelect: "none",
          backgroundColor: expanded ? "#1e293b" : "transparent",
        }}
      >
        <span style={{ color: "#475569", minWidth: 86, flexShrink: 0 }}>{time}</span>
        <span style={{ color: channelColor, minWidth: 74, flexShrink: 0 }}>
          {entry.channel === "postMessage" ? "postMsg" : "broadcast"}
        </span>
        <span style={{ color: dirColor, minWidth: 14, flexShrink: 0 }}>{dirLabel}</span>
        <span
          style={{
            color: "#f1f5f9",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.msgType}
        </span>
        <span style={{ color: "#475569", flexShrink: 0 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <pre
          style={{
            margin: 0,
            padding: "6px 12px 10px",
            backgroundColor: "#020617",
            color: "#7dd3fc",
            fontSize: 10,
            overflowX: "auto",
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {JSON.stringify(entry.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
