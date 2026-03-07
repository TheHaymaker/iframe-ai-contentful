import type { ReactNode, CSSProperties } from "react";
import type { ContainerProps } from "../types";

interface Props extends ContainerProps {
  children: ReactNode;
  nodeId?: string;
}

export function Container({
  maxWidth = "1200px",
  paddingX = 24,
  display = "block",
  direction = "column",
  alignItems,
  justifyContent,
  gap = 0,
  children,
  nodeId,
}: Props) {
  const style: CSSProperties = {
    maxWidth,
    marginLeft: "auto",
    marginRight: "auto",
    paddingLeft: paddingX,
    paddingRight: paddingX,
    boxSizing: "border-box",
    ...(display !== "block" && {
      display,
      flexDirection: display === "flex" ? direction : undefined,
      gridAutoFlow: display === "grid" ? (direction === "row" ? "column" : "row") : undefined,
      alignItems,
      justifyContent,
      gap,
    }),
  };

  return (
    <div style={style} data-node-id={nodeId} data-component="Container">
      {children}
    </div>
  );
}
