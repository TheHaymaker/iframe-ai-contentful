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

/**
 * Palette component that, when added to the canvas:
 *  - Auto-opens (or focuses) the Hub popup window
 *  - Registers this iframe with the Hub via BroadcastChannel
 *  - Provides a live message discovery log for all postMessage and
 *    BroadcastChannel traffic (both directions)
 *
 * Remove this component to disconnect the iframe from the Hub.
 */
export function HubConnector({ nodeId }: { nodeId?: string }) {
  const nodesRef = useRef<ComponentTreeNode[]>([]);

  const [hubStatus, setHubStatus] = useState<"open" | "closed" | "blocked">(() =>
    hubWindow && !hubWindow.closed ? "open" : "closed",
  );
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pushLog = useCallback(
    (channel: LogChannel, direction: LogDirection, msgType: string, data: unknown) => {
      setLog((prev) =>
        [
          { id: crypto.randomUUID(), ts: Date.now(), channel, direction, msgType, data },
          ...prev,
        ].slice(0, 100),
      );
    },
    [],
  );

  // ── postMessage discovery: capture ALL raw window.message events ──────
  // Logs every incoming message regardless of shape — useful for
  // discovering unknown message types during integration testing.
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
  }, [pushLog]);

  // ── buildMeta ─────────────────────────────────────────────────────────
  const buildMeta = useCallback(
    (): IframeMeta => ({
      sourceId: MODULE_SOURCE_ID,
      url: window.location.href,
      title: document.title || "Preview",
      componentCount: countNodes(nodesRef.current),
      timestamp: Date.now(),
    }),
    [],
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
      // Round-trip: editor receives TREE_UPDATED → updates store → sends SET_TREE back
      sendToEditor({ type: "TREE_UPDATED", payload: next });
    },
    [sendToEditor],
  );

  // ── BroadcastChannel send (logged) ────────────────────────────────────
  // broadcastPostRef breaks the circular dep:
  //   handleHubMessage → sendToHub → postMessage (from useBroadcastChannel)
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
    [pushLog, sendToHub, buildMeta, handleImportTree],
  );

  const { postMessage } = useBroadcastChannel({
    channelName: CHANNEL_NAME,
    onMessage: handleHubMessage,
  });

  // Keep ref current (postMessage is stable so this is effectively a one-time sync)
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
  const openOrFocusHub = useCallback(() => {
    if (hubWindow && !hubWindow.closed) {
      hubWindow.focus();
      return;
    }
    const popup = window.open("/hub.html", "cms-hub-popup", POPUP_FEATURES);
    if (!popup || popup.closed) {
      setHubStatus("blocked");
      hubWindow = null;
      return;
    }
    hubWindow = popup;
    setHubStatus("open");
  }, []);

  // Auto-launch on mount + poll for popup close
  useEffect(() => {
    openOrFocusHub();
    const poll = setInterval(() => {
      if (hubWindow?.closed) {
        hubWindow = null;
        setHubStatus("closed");
      }
    }, 1000);
    return () => clearInterval(poll);
  }, [openOrFocusHub]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      data-node-id={nodeId}
      data-component="HubConnector"
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
          onClick={openOrFocusHub}
          style={{
            padding: "10px 20px",
            backgroundColor:
              hubStatus === "open" ? "#16a34a" : hubStatus === "blocked" ? "#dc2626" : "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {hubStatus === "open" ? "Hub Open" : hubStatus === "blocked" ? "Popup Blocked" : "Open Hub"}
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
