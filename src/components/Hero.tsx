import type { CSSProperties } from "react";

export interface HeroProps {
  heading: string;
  subheading?: string;
  ctaText?: string;
  ctaHref?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  textColor?: string;
  textAlign?: "left" | "center" | "right";
  nodeId?: string;
}

export function Hero({
  heading,
  subheading,
  ctaText,
  ctaHref = "#",
  backgroundColor = "#1a1a2e",
  backgroundImage,
  textColor = "#ffffff",
  textAlign = "center",
  nodeId,
}: HeroProps) {
  const wrapperStyle: CSSProperties = {
    padding: "64px 24px",
    backgroundColor,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: textColor,
    textAlign,
  };

  return (
    <div style={wrapperStyle} data-node-id={nodeId} data-component="Hero">
      <h1 style={{ margin: 0, fontSize: "2.5rem", lineHeight: 1.2 }}>{heading}</h1>
      {subheading && (
        <p style={{ marginTop: 16, fontSize: "1.25rem", opacity: 0.85 }}>{subheading}</p>
      )}
      {ctaText && (
        <a
          href={ctaHref}
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: "12px 32px",
            backgroundColor: textColor,
            color: backgroundColor,
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {ctaText}
        </a>
      )}
    </div>
  );
}
