import type { CSSProperties } from "react";

export interface TextBlockProps {
  text: string;
  fontSize?: number;
  color?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  fontWeight?: "normal" | "bold" | "light";
  lineHeight?: number;
  nodeId?: string;
}

export function TextBlock({
  text,
  fontSize = 16,
  color = "#333333",
  textAlign = "left",
  fontWeight = "normal",
  lineHeight = 1.6,
  nodeId,
}: TextBlockProps) {
  const style: CSSProperties = {
    fontSize,
    color,
    textAlign,
    fontWeight: fontWeight === "light" ? 300 : fontWeight === "bold" ? 700 : 400,
    lineHeight,
  };

  return (
    <div style={style} data-node-id={nodeId} data-component="TextBlock">
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}
