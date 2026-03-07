import { useCallback } from "react";
import { getFeatureEntry } from "../config/featureMap";
import type { ComponentTreeNode, PropSchema } from "../types";

interface Props {
  node: ComponentTreeNode;
  onUpdate: (id: string, props: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
}

export function PropEditor({ node, onUpdate, onRemove, onReorder }: Props) {
  const entry = getFeatureEntry(node.type);
  if (!entry) return null;

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onUpdate(node.id, { [key]: value });
    },
    [node.id, onUpdate],
  );

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>{node.type}</h3>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" onClick={() => onReorder(node.id, "up")} style={iconBtnStyle} title="Move up">
            &#9650;
          </button>
          <button type="button" onClick={() => onReorder(node.id, "down")} style={iconBtnStyle} title="Move down">
            &#9660;
          </button>
          <button
            type="button"
            onClick={() => onRemove(node.id)}
            style={{ ...iconBtnStyle, color: "#ef4444" }}
            title="Remove"
          >
            &#10005;
          </button>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(entry.propSchema).map(([key, schema]) => (
          <PropField
            key={key}
            name={key}
            schema={schema}
            value={node.props[key]}
            onChange={(val) => handleChange(key, val)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual prop field renderer ───────────────────────────────────
interface FieldProps {
  name: string;
  schema: PropSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

function PropField({ name, schema, value, onChange }: FieldProps) {
  const label = schema.description || name;

  switch (schema.type) {
    case "string":
    case "url":
    case "richtext":
      return (
        <label style={labelStyle}>
          <span style={labelTextStyle}>{label}</span>
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
        </label>
      );

    case "number":
      return (
        <label style={labelStyle}>
          <span style={labelTextStyle}>{label}</span>
          <input
            type="number"
            value={(value as number) ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
      );

    case "boolean":
      return (
        <label style={{ ...labelStyle, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={(value as boolean) ?? false}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span style={{ fontSize: 12, color: "#475569" }}>{label}</span>
        </label>
      );

    case "color":
      return (
        <label style={labelStyle}>
          <span style={labelTextStyle}>{label}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="color"
              value={(value as string) ?? "#000000"}
              onChange={(e) => onChange(e.target.value)}
              style={{ width: 32, height: 28, border: "none", cursor: "pointer" }}
            />
            <input
              type="text"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </label>
      );

    case "select":
      return (
        <label style={labelStyle}>
          <span style={labelTextStyle}>{label}</span>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          >
            <option value="">—</option>
            {schema.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      );

    default:
      return null;
  }
}

// ── Shared styles ────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid #e2e8f0",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "system-ui",
  outline: "none",
};

const iconBtnStyle: React.CSSProperties = {
  padding: "2px 6px",
  border: "1px solid #e2e8f0",
  borderRadius: 4,
  backgroundColor: "transparent",
  cursor: "pointer",
  fontSize: 10,
};
