import { useEffect, useRef, useCallback } from "react";
import { useBroadcastChannel } from "../hooks/useBroadcastChannel";
import { CHANNEL_NAME } from "../constants";
import { countNodes } from "../lib/treeUtils";
import type { ComponentTreeNode, HubMessage, IframeMeta } from "../types";

interface Props {
  /** Current component tree from the preview */
  nodes: ComponentTreeNode[];
  /** Unique identifier for this iframe instance */
  sourceId: string;
  /** Called when the Hub sends an IMPORT_TREE or BROADCAST_TREE.
   *  `replace` is true when the incoming message specifies mergeMode "replace". */
  onImportTree: (nodes: ComponentTreeNode[], replace?: boolean) => void;
}

/**
 * Iframe-side BroadcastChannel logic.
 *
 * Responsibilities:
 * - On HUB_READY: respond with IFRAME_ANNOUNCE + IFRAME_TREE_SNAPSHOT
 * - On REQUEST_SNAPSHOT: send current tree (if targetIds includes us or is absent)
 * - On IMPORT_TREE / BROADCAST_TREE / GENERATE_RESULT: merge into tree
 * - Periodic IFRAME_ANNOUNCE heartbeat (every 5s)
 */
export function ChannelBridge({ nodes, sourceId, onImportTree }: Props) {
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const buildMeta = useCallback((): IframeMeta => ({
    sourceId,
    url: window.location.href,
    title: document.title || "Preview",
    componentCount: countNodes(nodesRef.current),
    timestamp: Date.now(),
  }), [sourceId]);

  const handleMessage = useCallback(
    (msg: HubMessage) => {
      // Target filtering: if message has targetIds and we're not in it, ignore
      if ("targetIds" in msg && msg.targetIds && !msg.targetIds.includes(sourceId)) {
        return;
      }

      switch (msg.type) {
        case "HUB_READY":
          // Hub just opened — announce ourselves and send current tree
          postMessage({
            type: "IFRAME_ANNOUNCE",
            sourceId,
            meta: buildMeta(),
          });
          postMessage({
            type: "IFRAME_TREE_SNAPSHOT",
            payload: nodesRef.current,
            sourceId,
          });
          break;

        case "REQUEST_SNAPSHOT":
          postMessage({
            type: "IFRAME_TREE_SNAPSHOT",
            payload: nodesRef.current,
            sourceId,
          });
          break;

        case "IMPORT_TREE":
          onImportTree(msg.payload, msg.mergeMode === "replace");
          break;

        case "BROADCAST_TREE":
          onImportTree(msg.payload);
          break;

        case "GENERATE_RESULT":
          onImportTree(msg.payload);
          break;
      }
    },
    [sourceId, buildMeta, onImportTree],
  );

  const { postMessage } = useBroadcastChannel({
    channelName: CHANNEL_NAME,
    onMessage: handleMessage,
  });

  // ── Heartbeat: periodic IFRAME_ANNOUNCE every 5s ───────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      postMessage({
        type: "IFRAME_ANNOUNCE",
        sourceId,
        meta: buildMeta(),
      });
    }, 5000);

    // Send initial announce
    postMessage({
      type: "IFRAME_ANNOUNCE",
      sourceId,
      meta: buildMeta(),
    });

    return () => clearInterval(interval);
  }, [postMessage, sourceId, buildMeta]);

  // ── Disconnect: notify hub when window is closed ────────────────────
  useEffect(() => {
    const handleUnload = () => {
      postMessage({ type: "IFRAME_DISCONNECT", sourceId });
    };
    window.addEventListener("pagehide", handleUnload);
    return () => window.removeEventListener("pagehide", handleUnload);
  }, [postMessage, sourceId]);

  // This is a logic-only component — no UI
  return null;
}
