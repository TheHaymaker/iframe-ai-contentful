import { useEffect, useCallback } from "react";
import { useBroadcastChannel } from "../hooks/useBroadcastChannel";
import { CHANNEL_NAME, generateSourceId } from "../constants";
import { useHubStore, type HubTab } from "./store";
import { ExportTab } from "./tabs/ExportTab";
import { ImportTab } from "./tabs/ImportTab";
import { GenerateTab } from "./tabs/GenerateTab";
import type { HubMessage } from "../types";

const hubSourceId = generateSourceId();

const TABS: { key: HubTab; label: string }[] = [
  { key: "export", label: "Export" },
  { key: "import", label: "Import" },
  { key: "generate", label: "Generate" },
];

export function HubShell() {
  const {
    activeTab,
    setActiveTab,
    subscribers,
    upsertSubscriber,
    setSubscriberTree,
    removeStaleSubscribers,
  } = useHubStore();

  const handleMessage = useCallback(
    (msg: HubMessage) => {
      switch (msg.type) {
        case "IFRAME_ANNOUNCE":
          upsertSubscriber(msg.sourceId, msg.meta);
          break;
        case "IFRAME_TREE_SNAPSHOT":
          setSubscriberTree(msg.sourceId, msg.payload);
          break;
      }
    },
    [upsertSubscriber, setSubscriberTree],
  );

  const { postMessage } = useBroadcastChannel({
    channelName: CHANNEL_NAME,
    onMessage: handleMessage,
  });

  // Announce HUB_READY on mount
  useEffect(() => {
    postMessage({ type: "HUB_READY", sourceId: hubSourceId });
  }, [postMessage]);

  // Prune stale subscribers every 15s
  useEffect(() => {
    const interval = setInterval(() => removeStaleSubscribers(60_000), 15_000);
    return () => clearInterval(interval);
  }, [removeStaleSubscribers]);

  const subscriberCount = subscribers.size;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "system-ui",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          CMS Hub
        </h1>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {subscriberCount} connected window{subscriberCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Connected windows bar */}
      {subscriberCount > 0 && (
        <div
          style={{
            padding: "8px 20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            gap: 6,
            overflowX: "auto",
            backgroundColor: "#fafafa",
          }}
        >
          {Array.from(subscribers.values()).map((entry) => (
            <div
              key={entry.meta.sourceId}
              style={{
                padding: "4px 10px",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "monospace",
                backgroundColor: "#fff",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor:
                    Date.now() - entry.lastSeen < 15_000 ? "#22c55e" : "#f59e0b",
                  display: "inline-block",
                }}
              />
              {entry.meta.title}
              <span style={{ color: "#94a3b8" }}>
                {entry.meta.sourceId.slice(0, 6)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#fff",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: "10px 0",
              border: "none",
              borderBottom:
                activeTab === tab.key ? "2px solid #3b82f6" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === tab.key ? "#1d4ed8" : "#64748b",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {activeTab === "export" && <ExportTab postMessage={postMessage} />}
        {activeTab === "import" && <ImportTab postMessage={postMessage} />}
        {activeTab === "generate" && <GenerateTab postMessage={postMessage} />}
      </div>
    </div>
  );
}
