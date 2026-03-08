// ── Core component tree node ──────────────────────────────────────────
export interface ComponentTreeNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: ComponentTreeNode[];
}

// ── Prop schema for feature map / AI generation ──────────────────────
export interface PropSchema {
  type: "string" | "number" | "boolean" | "color" | "url" | "richtext" | "select";
  required?: boolean;
  default?: unknown;
  description?: string;
  options?: string[]; // for "select" type
}

export interface FeatureMapEntry {
  componentType: string;
  description: string;
  propSchema: Record<string, PropSchema>;
  /** Whether this component can contain children */
  isContainer?: boolean;
  /** Allowed child component types (empty = any) */
  allowedChildren?: string[];
}

// ── Section & Container props ────────────────────────────────────────
export interface SectionProps {
  /** Background color of the full-width section */
  backgroundColor?: string;
  /** Background image URL */
  backgroundImage?: string;
  /** Vertical padding in px */
  paddingY?: number;
  /** HTML id attribute for anchor links */
  sectionId?: string;
  /** Whether the section spans full viewport height */
  fullHeight?: boolean;
}

export interface ContainerProps {
  /** Max width of the container (e.g. "1200px", "80rem") */
  maxWidth?: string;
  /** Horizontal padding in px */
  paddingX?: number;
  /** Layout direction */
  display?: "block" | "flex" | "grid";
  /** Flex/grid direction */
  direction?: "row" | "column";
  /** Alignment along cross axis */
  alignItems?: "start" | "center" | "end" | "stretch";
  /** Alignment along main axis */
  justifyContent?: "start" | "center" | "end" | "space-between" | "space-around";
  /** Gap between children in px */
  gap?: number;
}

// ── Communication types ──────────────────────────────────────────────
export interface IframeMeta {
  sourceId: string;
  url: string;
  title: string;
  componentCount: number;
  timestamp: number;
}

export type HubMessage =
  | { type: "IFRAME_TREE_SNAPSHOT"; payload: ComponentTreeNode[]; sourceId: string }
  | { type: "IMPORT_TREE"; payload: ComponentTreeNode[]; sourceId: string; targetIds?: string[]; mergeMode?: "append" | "replace" }
  | { type: "HUB_READY"; sourceId: string }
  | { type: "IFRAME_ANNOUNCE"; sourceId: string; meta: IframeMeta }
  | { type: "IFRAME_DISCONNECT"; sourceId: string }
  | { type: "REQUEST_SNAPSHOT"; sourceId: string; targetIds?: string[] }
  | { type: "GENERATE_RESULT"; payload: ComponentTreeNode[]; sourceId: string; targetIds?: string[] }
  | { type: "BROADCAST_TREE"; payload: ComponentTreeNode[]; sourceId: string; targetIds: string[] }
  | { type: "HUB_HEARTBEAT"; sourceId: string };
