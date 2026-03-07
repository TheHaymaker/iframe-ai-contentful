import { useEffect, useCallback, useState } from "react";
import { useBroadcastChannel } from "../hooks/useBroadcastChannel";
import { CHANNEL_NAME, generateSourceId } from "../constants";
import type { HubMessage, ComponentTreeNode, IframeMeta } from "../types";

const hubSourceId = generateSourceId();

/**
 * Stub Hub shell — announces itself on mount and listens for iframe data.
 * Full tab UI (Export / Import / Generate) will be built in Phase 5.
 */
export function HubShell() {
  const [subscribers, setSubscribers] = useState<Map<string, IframeMeta>>(new Map());
  const [latestTree, setLatestTree] = useState<ComponentTreeNode[]>([]);

  const handleMessage = useCallback((msg: HubMessage) => {
    switch (msg.type) {
      case "IFRAME_ANNOUNCE":
        setSubscribers((prev) => {
          const next = new Map(prev);
          next.set(msg.sourceId, msg.meta);
          return next;
        });
        break;
      case "IFRAME_TREE_SNAPSHOT":
        setLatestTree(msg.payload);
        break;
    }
  }, []);

  const { postMessage } = useBroadcastChannel({
    channelName: CHANNEL_NAME,
    onMessage: handleMessage,
  });

  // Announce HUB_READY on mount
  useEffect(() => {
    postMessage({ type: "HUB_READY", sourceId: hubSourceId });
  }, [postMessage]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 16px", fontSize: 20, color: "#0f172a" }}>CMS Hub</h1>
      <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
        Connected iframes: {subscribers.size} &middot; Tree nodes: {latestTree.length}
      </p>

      {/* Subscriber list */}
      {subscribers.size > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, color: "#64748b", textTransform: "uppercase", margin: "0 0 8px" }}>
            Connected Windows
          </h3>
          {Array.from(subscribers.values()).map((meta) => (
            <div
              key={meta.sourceId}
              style={{
                padding: "8px 12px",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                marginBottom: 4,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              {meta.title} — {meta.componentCount} components
              <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                {meta.sourceId.slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Placeholder tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 0",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        {["Export", "Import", "Generate"].map((tab) => (
          <button
            key={tab}
            type="button"
            style={{
              padding: "8px 16px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              backgroundColor: "#fff",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 12 }}>
        Full tab UI coming in Phase 5.
      </p>
    </div>
  );
}
