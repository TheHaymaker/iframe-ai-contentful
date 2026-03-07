import { useRef, useState, useCallback } from "react";

interface Props {
  /** Called when the popup is successfully opened */
  onPopupOpened?: () => void;
}

const POPUP_FEATURES = "width=600,height=700,menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes";

/**
 * Button rendered inside the iframe preview that opens the Hub popup
 * via `window.open()`. Tracks popup lifecycle and handles blocked popups.
 */
export function HubLauncher({ onPopupOpened }: Props) {
  const popupRef = useRef<Window | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const openHub = useCallback(() => {
    // If already open, focus the existing popup
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    const popup = window.open("/hub.html", "cms-hub-popup", POPUP_FEATURES);

    if (!popup || popup.closed) {
      setBlocked(true);
      return;
    }

    popupRef.current = popup;
    setIsOpen(true);
    setBlocked(false);
    onPopupOpened?.();

    // Poll for popup close (no reliable event for cross-origin popups)
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        popupRef.current = null;
        setIsOpen(false);
      }
    }, 1000);
  }, [onPopupOpened]);

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 10000 }}>
      <button
        type="button"
        onClick={openHub}
        style={{
          padding: "10px 20px",
          backgroundColor: isOpen ? "#16a34a" : "#3b82f6",
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
        {isOpen ? "Hub Open" : "Open Hub"}
      </button>
      {blocked && (
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
