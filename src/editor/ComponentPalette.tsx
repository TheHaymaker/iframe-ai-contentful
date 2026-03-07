import { featureMap } from "../config/featureMap";
import type { FeatureMapEntry, PropSchema } from "../types";

interface Props {
  onAddSlice: (componentType: string, defaultProps: Record<string, unknown>) => void;
}

/** Build default props from a feature map entry's propSchema */
function buildDefaultProps(schema: Record<string, PropSchema>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(schema)) {
    if (def.default !== undefined) {
      props[key] = def.default;
    } else if (def.required) {
      // Provide placeholder values for required fields
      switch (def.type) {
        case "string":
          props[key] = `Sample ${key}`;
          break;
        case "number":
          props[key] = 0;
          break;
        case "boolean":
          props[key] = false;
          break;
        case "url":
          props[key] = "#";
          break;
        case "color":
          props[key] = "#333333";
          break;
        default:
          props[key] = "";
      }
    }
  }
  return props;
}

/** Leaf components that can be dragged/added to the page */
const leafEntries = featureMap.filter((e) => !e.isContainer);

export function ComponentPalette({ onAddSlice }: Props) {
  const handleDragStart = (
    e: React.DragEvent,
    entry: FeatureMapEntry,
  ) => {
    e.dataTransfer.setData(
      "application/x-component",
      JSON.stringify({
        componentType: entry.componentType,
        defaultProps: buildDefaultProps(entry.propSchema),
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleClick = (entry: FeatureMapEntry) => {
    onAddSlice(entry.componentType, buildDefaultProps(entry.propSchema));
  };

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
        Components
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {leafEntries.map((entry) => (
          <button
            key={entry.componentType}
            type="button"
            draggable
            onDragStart={(e) => handleDragStart(e, entry)}
            onClick={() => handleClick(entry)}
            style={{
              padding: "8px 12px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              backgroundColor: "#f8fafc",
              cursor: "grab",
              textAlign: "left",
              fontSize: 13,
              fontFamily: "system-ui",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
          >
            <strong>{entry.componentType}</strong>
            <br />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{entry.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export { buildDefaultProps };
