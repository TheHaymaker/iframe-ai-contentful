import { ComponentRenderer } from "./components";
import { wrapInSlice, createNode } from "./lib/treeUtils";
import type { ComponentTreeNode } from "./types";

/**
 * Demo tree: two Section > Container slices, each a self-contained
 * group that can be copied/pasted as a single JSON blob.
 */
const demoTree: ComponentTreeNode[] = [
  // Slice 1 — Hero slice
  wrapInSlice(
    [
      createNode("Hero", {
        heading: "Welcome to the CMS Popup Hub",
        subheading: "Drag, drop, and export entire page sections as portable JSON slices.",
        ctaText: "Get Started",
        ctaHref: "#features",
      }),
    ],
    { backgroundColor: "#0f172a", paddingY: 0 },
    { maxWidth: "100%" },
  ),

  // Slice 2 — Features slice (flex row)
  wrapInSlice(
    [
      createNode("TextBlock", {
        text: "Build pages from composable sections. Each Section wraps a Container that holds your components — copy the whole slice as JSON.",
        fontSize: 18,
        textAlign: "center" as const,
        color: "#475569",
      }),
      createNode("ImageCard", {
        src: "https://placehold.co/400x200/e2e8f0/475569?text=Section+%2B+Container",
        alt: "Section and Container diagram",
        caption: "Section > Container > Components",
      }),
      createNode("Button", {
        label: "Export This Slice",
        variant: "primary",
        size: "large",
      }),
    ],
    { sectionId: "features", backgroundColor: "#f8fafc", paddingY: 64 },
    { maxWidth: "800px", display: "flex", direction: "column", alignItems: "center", gap: 32 },
  ),
];

function App() {
  return <ComponentRenderer nodes={demoTree} />;
}

export default App;
