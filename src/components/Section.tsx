import type { ReactNode, CSSProperties } from "react";
import type { SectionProps } from "../types";

interface Props extends SectionProps {
  children: ReactNode;
  /** data-node-id for the tree renderer to identify this node */
  nodeId?: string;
}

export function Section({
  backgroundColor = "transparent",
  backgroundImage,
  paddingY = 48,
  sectionId,
  fullHeight = false,
  children,
  nodeId,
}: Props) {
  const style: CSSProperties = {
    width: "100%",
    backgroundColor,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    paddingTop: paddingY,
    paddingBottom: paddingY,
    minHeight: fullHeight ? "100vh" : undefined,
    boxSizing: "border-box",
  };

  return (
    <section id={sectionId} style={style} data-node-id={nodeId} data-component="Section">
      {children}
    </section>
  );
}
