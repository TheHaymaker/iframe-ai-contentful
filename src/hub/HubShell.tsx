import { useEffect, useCallback, useRef } from "react";
import { useBroadcastChannel } from "../hooks/useBroadcastChannel";
import { CHANNEL_NAME, generateSourceId } from "../constants";
import { useHubStore, type HubTab } from "./store";
import { ConnectedWindows } from "./components/ConnectedWindows";
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
    removeSubscriber,
    removeStaleSubscribers,
  } = useHubStore();

  const postMessageRef = useRef<(msg: HubMessage) => void>(() => {});

  const handleMessage = useCallback(
    (msg: HubMessage) => {
      switch (msg.type) {
        case "IFRAME_ANNOUNCE":
          upsertSubscriber(msg.sourceId, msg.meta);
          break;
        case "IFRAME_TREE_SNAPSHOT":
          setSubscriberTree(msg.sourceId, msg.payload);
          break;
        case "IFRAME_DISCONNECT":
          removeSubscriber(msg.sourceId);
          break;
        case "HUB_PING":
          postMessageRef.current({ type: "HUB_ALIVE", sourceId: hubSourceId });
          break;
      }
    },
    [upsertSubscriber, setSubscriberTree, removeSubscriber],
  );

  const { postMessage } = useBroadcastChannel({
    channelName: CHANNEL_NAME,
    onMessage: handleMessage,
  });

  postMessageRef.current = postMessage;

  // Announce HUB_READY on mount + periodic heartbeat every 5s
  useEffect(() => {
    postMessage({ type: "HUB_READY", sourceId: hubSourceId });
    const interval = setInterval(() => {
      postMessage({ type: "HUB_HEARTBEAT", sourceId: hubSourceId });
    }, 5000);
    return () => clearInterval(interval);
  }, [postMessage]);

  // Periodically remove subscribers that haven't heartbeated in 60s
  useEffect(() => {
    const interval = setInterval(() => {
      removeStaleSubscribers(60_000);
    }, 5_000);
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

      {/* Connected windows with multi-select checkboxes */}
      {subscriberCount > 0 && (
        <div
          style={{
            borderBottom: "1px solid #e2e8f0",
            backgroundColor: "#fafafa",
          }}
        >
          <ConnectedWindows postMessage={postMessage} />
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Hub tabs"
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
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
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
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        style={{ flex: 1, overflow: "auto", padding: 20 }}
      >
        {activeTab === "export" && <ExportTab postMessage={postMessage} />}
        {activeTab === "import" && <ImportTab postMessage={postMessage} />}
        {activeTab === "generate" && <GenerateTab postMessage={postMessage} />}
      </div>
    </div>
  );
}
