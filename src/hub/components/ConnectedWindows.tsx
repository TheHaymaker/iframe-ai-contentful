import { useHubStore } from "../store";
import type { HubMessage } from "../../types";

interface Props {
  postMessage: (msg: HubMessage) => void;
}

/**
 * Multi-select list of connected iframe windows.
 * Users check which targets receive Import/Generate/Broadcast actions.
 * Selection persists across all Hub tabs.
 */
export function ConnectedWindows({ postMessage }: Props) {
  const {
    subscribers,
    selectedTargets,
    toggleTarget,
    selectAllTargets,
    deselectAllTargets,
  } = useHubStore();

  const subscriberList = Array.from(subscribers.entries());
  const allSelected = subscriberList.length > 0 && subscriberList.every(([id]) => selectedTargets.has(id));
  const noneSelected = subscriberList.every(([id]) => !selectedTargets.has(id));

  const handleRefreshAll = () => {
    const targetIds = subscriberList
      .filter(([id]) => selectedTargets.has(id))
      .map(([id]) => id);
    if (targetIds.length === 0) return;
    postMessage({
      type: "REQUEST_SNAPSHOT",
      sourceId: "hub",
      targetIds,
    });
  };

  if (subscriberList.length === 0) {
    return (
      <div style={{ padding: "8px 16px", fontSize: 12, color: "#94a3b8" }}>
        No windows connected
      </div>
    );
  }

  return (
    <div style={{ padding: "8px 12px" }}>
      {/* Header with select all / deselect all */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          Targets ({selectedTargets.size}/{subscriberList.length})
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={allSelected ? deselectAllTargets : selectAllTargets}
            style={smallBtnStyle}
          >
            {allSelected ? "None" : "All"}
          </button>
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={noneSelected}
            style={{
              ...smallBtnStyle,
              opacity: noneSelected ? 0.4 : 1,
              cursor: noneSelected ? "default" : "pointer",
            }}
            title="Request snapshots from selected"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Subscriber checkboxes */}
      {subscriberList.map(([id, entry]) => {
        const isActive = Date.now() - entry.lastSeen < 15_000;
        const checked = selectedTargets.has(id);

        return (
          <label
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 6px",
              borderRadius: 4,
              cursor: "pointer",
              backgroundColor: checked ? "#eff6ff" : "transparent",
              transition: "background-color 0.1s",
              marginBottom: 2,
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleTarget(id)}
              style={{ margin: 0, cursor: "pointer" }}
            />
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: isActive ? "#22c55e" : "#f59e0b",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#334155" }}>
              {entry.meta.title}
            </span>
            <span style={{ fontSize: 9, color: "#94a3b8" }}>
              {id.slice(0, 6)}
            </span>
            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>
              {entry.tree.length > 0 ? `${entry.meta.componentCount}n` : "--"}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: "2px 8px",
  border: "1px solid #e2e8f0",
  borderRadius: 3,
  backgroundColor: "#fff",
  cursor: "pointer",
  fontSize: 10,
  fontFamily: "system-ui",
};
