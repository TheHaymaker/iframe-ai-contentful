import type { ComponentType } from "react";
import type { ComponentTreeNode } from "../types";
import { Section } from "./Section";
import { Container } from "./Container";
import { Hero } from "./Hero";
import { TextBlock } from "./TextBlock";
import { ImageCard } from "./ImageCard";
import { Button } from "./Button";
import { HubConnector } from "./HubConnector";

/**
 * Map of component type keys → React components.
 * Section and Container are "shell" components that accept children;
 * atomic components are leaf nodes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_MAP: Record<string, ComponentType<any>> = {
  Section,
  Container,
  Hero,
  TextBlock,
  ImageCard,
  Button,
  HubConnector,
};

interface Props {
  /** The component tree (or sub-tree) to render */
  nodes: ComponentTreeNode[];
}

/**
 * Recursively renders a `ComponentTreeNode[]` into React elements.
 *
 * The typical structure users will copy/paste is:
 *
 * ```
 * Section
 *   └─ Container
 *        ├─ Hero
 *        ├─ TextBlock
 *        └─ Button
 * ```
 *
 * Each Section + Container pair forms a self-contained "slice" that
 * can be exported as JSON and imported elsewhere.
 */
export function ComponentRenderer({ nodes }: Props) {
  return (
    <>
      {nodes.map((node) => {
        const Component = COMPONENT_MAP[node.type];

        if (!Component) {
          return (
            <div
              key={node.id}
              style={{
                padding: 16,
                border: "2px dashed #e74c3c",
                color: "#e74c3c",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            >
              Unknown component: <strong>{node.type}</strong>
            </div>
          );
        }

        const childElements =
          node.children && node.children.length > 0 ? (
            <ComponentRenderer nodes={node.children} />
          ) : null;

        return (
          <Component key={node.id} {...node.props} nodeId={node.id}>
            {childElements}
          </Component>
        );
      })}
    </>
  );
}
