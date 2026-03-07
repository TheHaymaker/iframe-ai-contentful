import type { CSSProperties } from "react";

export interface ImageCardProps {
  src: string;
  alt: string;
  caption?: string;
  href?: string;
  borderRadius?: number;
  objectFit?: "cover" | "contain" | "fill";
  nodeId?: string;
}

export function ImageCard({
  src,
  alt,
  caption,
  href,
  borderRadius = 8,
  objectFit = "cover",
  nodeId,
}: ImageCardProps) {
  const cardStyle: CSSProperties = {
    borderRadius,
    overflow: "hidden",
    border: "1px solid #e0e0e0",
  };

  const imgStyle: CSSProperties = {
    width: "100%",
    height: 200,
    objectFit,
    display: "block",
  };

  const content = (
    <div style={cardStyle} data-node-id={nodeId} data-component="ImageCard">
      <img src={src} alt={alt} style={imgStyle} />
      {caption && (
        <p style={{ margin: 0, padding: "12px 16px", fontSize: 14, color: "#555" }}>{caption}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {content}
      </a>
    );
  }

  return content;
}
