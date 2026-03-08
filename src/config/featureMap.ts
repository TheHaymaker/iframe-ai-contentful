import type { FeatureMapEntry } from "../types";

/**
 * Registry of all available components, their prop schemas, and containment rules.
 * This drives:
 *  - the component palette in the editor sidebar
 *  - AI prompt construction in the Generate tab
 *  - validation of imported JSON
 */
export const featureMap: FeatureMapEntry[] = [
  // ── Layout shells ──────────────────────────────────────────────────
  {
    componentType: "Section",
    description:
      "Full-width page section that acts as a horizontal slice. Wraps a Container and its children so the entire group can be copied/pasted as one unit.",
    isContainer: true,
    allowedChildren: ["Container"],
    propSchema: {
      backgroundColor: {
        type: "color",
        default: "transparent",
        description: "Section background color",
      },
      backgroundImage: {
        type: "url",
        description: "Optional background image URL",
      },
      paddingY: {
        type: "number",
        default: 48,
        description: "Vertical padding in px",
      },
      sectionId: {
        type: "string",
        description: "HTML id for anchor links",
      },
      fullHeight: {
        type: "boolean",
        default: false,
        description: "Whether the section fills the viewport height",
      },
    },
  },
  {
    componentType: "Container",
    description:
      "Constrained-width wrapper inside a Section. Controls max-width, padding, and flex/grid layout of its children.",
    isContainer: true,
    allowedChildren: [], // any child allowed
    propSchema: {
      maxWidth: {
        type: "string",
        default: "1200px",
        description: "Max container width (CSS value)",
      },
      paddingX: {
        type: "number",
        default: 24,
        description: "Horizontal padding in px",
      },
      display: {
        type: "select",
        options: ["block", "flex", "grid"],
        default: "block",
        description: "Layout mode",
      },
      direction: {
        type: "select",
        options: ["row", "column"],
        default: "column",
        description: "Flex/grid direction",
      },
      alignItems: {
        type: "select",
        options: ["start", "center", "end", "stretch"],
        description: "Cross-axis alignment",
      },
      justifyContent: {
        type: "select",
        options: ["start", "center", "end", "space-between", "space-around"],
        description: "Main-axis alignment",
      },
      gap: {
        type: "number",
        default: 0,
        description: "Gap between children in px",
      },
    },
  },

  // ── Atomic components ──────────────────────────────────────────────
  {
    componentType: "Hero",
    description: "Full-width hero banner with heading, subheading, and optional CTA button.",
    propSchema: {
      heading: {
        type: "string",
        required: true,
        description: "Main heading text",
      },
      subheading: {
        type: "string",
        description: "Supporting text below the heading",
      },
      ctaText: {
        type: "string",
        description: "Call-to-action button label",
      },
      ctaHref: {
        type: "url",
        default: "#",
        description: "CTA link target",
      },
      backgroundColor: {
        type: "color",
        default: "#1a1a2e",
        description: "Hero background color",
      },
      backgroundImage: {
        type: "url",
        description: "Optional background image",
      },
      textColor: {
        type: "color",
        default: "#ffffff",
        description: "Text color",
      },
      textAlign: {
        type: "select",
        options: ["left", "center", "right"],
        default: "center",
        description: "Text alignment",
      },
    },
  },
  {
    componentType: "TextBlock",
    description: "A paragraph of text with configurable size, color, and alignment.",
    propSchema: {
      text: {
        type: "string",
        required: true,
        description: "The text content",
      },
      fontSize: {
        type: "number",
        default: 16,
        description: "Font size in px",
      },
      color: {
        type: "color",
        default: "#333333",
        description: "Text color",
      },
      textAlign: {
        type: "select",
        options: ["left", "center", "right", "justify"],
        default: "left",
        description: "Text alignment",
      },
      fontWeight: {
        type: "select",
        options: ["light", "normal", "bold"],
        default: "normal",
        description: "Font weight",
      },
      lineHeight: {
        type: "number",
        default: 1.6,
        description: "Line height multiplier",
      },
    },
  },
  {
    componentType: "ImageCard",
    description: "An image with optional caption and link, rendered in a card frame.",
    propSchema: {
      src: {
        type: "url",
        required: true,
        description: "Image source URL",
      },
      alt: {
        type: "string",
        required: true,
        description: "Alt text for accessibility",
      },
      caption: {
        type: "string",
        description: "Caption below the image",
      },
      href: {
        type: "url",
        description: "Optional link wrapping the card",
      },
      borderRadius: {
        type: "number",
        default: 8,
        description: "Border radius in px",
      },
      objectFit: {
        type: "select",
        options: ["cover", "contain", "fill"],
        default: "cover",
        description: "Image fit mode",
      },
    },
  },
  {
    componentType: "Button",
    description: "A clickable button with variant and size options.",
    propSchema: {
      label: {
        type: "string",
        required: true,
        description: "Button label text",
      },
      variant: {
        type: "select",
        options: ["primary", "secondary", "outline"],
        default: "primary",
        description: "Visual variant",
      },
      size: {
        type: "select",
        options: ["small", "medium", "large"],
        default: "medium",
        description: "Button size",
      },
      href: {
        type: "url",
        description: "If set, renders as a link styled as a button",
      },
    },
  },

  // ── Utility / integration ───────────────────────────────────────────
  {
    componentType: "HubConnector",
    description:
      "Registers this iframe with the Hub for import, export, and AI generation. Auto-opens the Hub window when added; focuses the existing window if already open. Remove to disconnect from the Hub.",
    isContainer: false,
    propSchema: {},
  },
];

/** Lookup a feature map entry by component type */
export function getFeatureEntry(componentType: string): FeatureMapEntry | undefined {
  return featureMap.find((e) => e.componentType === componentType);
}

/** All container component types */
export const containerTypes = featureMap
  .filter((e) => e.isContainer)
  .map((e) => e.componentType);

/** All leaf (non-container) component types */
export const leafTypes = featureMap
  .filter((e) => !e.isContainer)
  .map((e) => e.componentType);
