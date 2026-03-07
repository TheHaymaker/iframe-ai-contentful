import type { CSSProperties } from "react";

export interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "small" | "medium" | "large";
  href?: string;
  nodeId?: string;
}

const VARIANT_STYLES: Record<string, CSSProperties> = {
  primary: { backgroundColor: "#3b82f6", color: "#fff", border: "none" },
  secondary: { backgroundColor: "#64748b", color: "#fff", border: "none" },
  outline: { backgroundColor: "transparent", color: "#3b82f6", border: "2px solid #3b82f6" },
};

const SIZE_STYLES: Record<string, CSSProperties> = {
  small: { padding: "6px 16px", fontSize: 13 },
  medium: { padding: "10px 24px", fontSize: 15 },
  large: { padding: "14px 32px", fontSize: 17 },
};

export function Button({
  label,
  variant = "primary",
  size = "medium",
  href,
  nodeId,
}: ButtonProps) {
  const style: CSSProperties = {
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    borderRadius: 6,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-block",
    textAlign: "center",
  };

  if (href) {
    return (
      <a href={href} style={style} data-node-id={nodeId} data-component="Button">
        {label}
      </a>
    );
  }

  return (
    <button type="button" style={style} data-node-id={nodeId} data-component="Button">
      {label}
    </button>
  );
}
