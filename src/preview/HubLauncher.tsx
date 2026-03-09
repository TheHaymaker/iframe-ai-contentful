import { useRef, useState, useCallback } from "react";
import { CHANNEL_NAME } from "../constants";
import type { HubMessage } from "../types";

interface Props {
  /** Called when the popup is successfully opened */
  onPopupOpened?: () => void;
}

const POPUP_FEATURES = "width=600,height=700,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes";

/**
 * Button rendered inside the iframe preview that opens the Hub popup
 * via `window.open()`. Pings the BroadcastChannel first to detect an
 * already-open hub before launching a new one.
 */
export function HubLauncher({ onPopupOpened }: Props) {
  const popupRef = useRef<Window | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "open" | "blocked">("idle");

  const ensureHubOpen = useCallback(() => {
    // Fast path: ref still valid
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    setStatus("checking");

    // Ping via a one-shot BroadcastChannel listener (200ms window)
    const ch = new BroadcastChannel(CHANNEL_NAME);
    let found = false;

    ch.onmessage = (e: MessageEvent<HubMessage>) => {
      if (e.data.type === "HUB_ALIVE") found = true;
    };
    ch.postMessage({ type: "HUB_PING", sourceId: "hub-launcher" });

    setTimeout(() => {
      ch.close();

      if (found) {
        // Hub is alive — BroadcastChannel confirmed it; skip window.open probe
        // (calling window.open("","cms-hub-popup") opens an about:blank window
        // when the named window isn't reachable from the current context)
        setStatus("open");
        onPopupOpened?.();
        return;
      }

      // No ping response — open for real
      const popup = window.open("/hub.html", "cms-hub-popup", POPUP_FEATURES);
      if (!popup || popup.closed) {
        setStatus("blocked");
        return;
      }

      popupRef.current = popup;
      setStatus("open");
      onPopupOpened?.();

      // Poll for popup close (no reliable event for cross-origin popups)
      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          popupRef.current = null;
          setStatus("idle");
        }
      }, 1000);
    }, 200);
  }, [onPopupOpened]);

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 10000 }}>
      <button
        type="button"
        onClick={ensureHubOpen}
        style={{
          padding: "10px 20px",
          backgroundColor: status === "open" ? "#16a34a" : status === "checking" ? "#f59e0b" : "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          fontFamily: "system-ui",
        }}
      >
        {status === "open" ? "Hub Open" : status === "checking" ? "Checking…" : "Open Hub"}
      </button>
      {status === "blocked" && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 6,
            fontSize: 12,
            color: "#991b1b",
            maxWidth: 220,
          }}
        >
          Popup was blocked. Please allow popups for this site and try again.
        </div>
      )}
    </div>
  );
}
