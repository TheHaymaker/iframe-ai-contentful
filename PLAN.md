# CMS Popup Hub — Implementation Plan

## Overview

A drag-and-drop CMS visual editor rendered inside an iframe, paired with an external popup window ("Hub") that communicates bidirectionally via the **BroadcastChannel API**. The Hub provides three tabs — **Export**, **Import**, and **Generate** — enabling users to inspect, transfer, and AI-generate component tree data.

The target CMS is **Contentful Studio**, but the initial implementation uses simplified data structures to validate the architecture before integrating with Contentful's content model.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Parent Window (CMS Editor Shell)                       │
│  ┌───────────────────────┐  ┌────────────────────────┐  │
│  │  Sidebar / Props Panel│  │  iframe (Preview)      │  │
│  │  - style props        │  │  ┌──────────────────┐  │  │
│  │  - content props      │  │  │ Atomic Components │  │  │
│  │                       │  │  │ + HubLauncher     │  │  │
│  │  postMessage ◄────────┼──┼──┤                   │  │  │
│  │  (prop updates)       │  │  │ BroadcastChannel  │  │  │
│  │                       │  │  │ "cms-hub"         │  │  │
│  └───────────────────────┘  │  └────────┬─────────┘  │  │
│                             └───────────┼────────────┘  │
└─────────────────────────────────────────┼───────────────┘
                                          │ BroadcastChannel
                                          │ "cms-hub"
                              ┌───────────▼───────────┐
                              │  Popup Window (Hub)    │
                              │  ┌─────┬──────┬──────┐ │
                              │  │Export│Import│Generate│
                              │  ├─────┴──────┴──────┤ │
                              │  │ Tab content area   │ │
                              │  └────────────────────┘ │
                              └────────────────────────┘
```

### Communication Layers

| Channel | Purpose | Direction |
|---------|---------|-----------|
| `postMessage` | Parent ↔ iframe prop sync (existing CMS pattern) | Bidirectional |
| `BroadcastChannel("cms-hub")` | iframe ↔ popup Hub data exchange | Bidirectional |

### Message Protocol (BroadcastChannel)

All messages conform to a typed envelope:

```ts
type HubMessage =
  | { type: "IFRAME_TREE_SNAPSHOT"; payload: ComponentTreeNode[]; sourceId: string }
  | { type: "IMPORT_TREE";         payload: ComponentTreeNode[]; sourceId: string; targetIds?: string[] }
  | { type: "HUB_READY";           sourceId: string }
  | { type: "IFRAME_ANNOUNCE";     sourceId: string; meta: IframeMeta }
  | { type: "REQUEST_SNAPSHOT";    sourceId: string; targetIds?: string[] }
  | { type: "GENERATE_RESULT";     payload: ComponentTreeNode[]; sourceId: string; targetIds?: string[] }
  | { type: "BROADCAST_TREE";      payload: ComponentTreeNode[]; sourceId: string; targetIds: string[] }
```

> **`targetIds`** — When present, only iframes whose `sourceId` matches an entry in this array should process the message. When omitted (single-target legacy mode), all iframes process it. The new `BROADCAST_TREE` message type is used when the Hub explicitly pushes the same data to a user-selected set of subscribers.

---

## Data Structures

### ComponentTreeNode (simplified, pre-Contentful)

```ts
interface ComponentTreeNode {
  id: string;                          // uuid
  type: string;                        // component type key, e.g. "Hero", "TextBlock"
  props: Record<string, unknown>;      // style + content props
  children?: ComponentTreeNode[];      // nested components
}
```

### IframeMeta

```ts
interface IframeMeta {
  sourceId: string;       // unique id for this iframe instance
  url: string;
  title: string;
  componentCount: number;
  timestamp: number;
}
```

### FeatureMap (for Generate tab)

```ts
interface FeatureMapEntry {
  componentType: string;                    // e.g. "Hero"
  description: string;                      // natural-language description for the AI
  propSchema: Record<string, PropSchema>;   // prop name → type/constraints
}

interface PropSchema {
  type: "string" | "number" | "boolean" | "color" | "url" | "richtext";
  required?: boolean;
  default?: unknown;
  description?: string;
}
```

---

## Task Breakdown

### Phase 1 — Project Scaffolding

| # | Task | Details |
|---|------|---------|
| 1.1 | **Initialize project** | Vite + React + TypeScript. Install deps: `uuid`, `zustand` (lightweight state). |
| 1.2 | **Define shared types** | Create `src/types/index.ts` with `ComponentTreeNode`, `HubMessage`, `IframeMeta`, `FeatureMapEntry`, `PropSchema`. |
| 1.3 | **Create feature map config** | `src/config/featureMap.ts` — static registry of available atomic components with their prop schemas. Start with 3–4 components (Hero, TextBlock, ImageCard, Button). |
| 1.4 | **Add shared constants** | `src/constants.ts` — channel name (`"cms-hub"`), message types enum, default sourceId generator. |

### Phase 2 — Atomic Components

| # | Task | Details |
|---|------|---------|
| 2.1 | **Create `<Hero>` component** | Full-width section with heading, subheading, background color/image, CTA text. Props exposed via sidebar. |
| 2.2 | **Create `<TextBlock>` component** | Rich text block with alignment, font-size, color props. |
| 2.3 | **Create `<ImageCard>` component** | Image + caption + optional link. Props: src, alt, caption, borderRadius. |
| 2.4 | **Create `<Button>` component** | Label, variant (primary/secondary/outline), size, href. |
| 2.5 | **Create shared component prop interface pattern** | Each component exports a `Props` type and a `propSchema` conforming to `FeatureMapEntry`. |

### Phase 3 — Editor Shell + iframe Preview

| # | Task | Details |
|---|------|---------|
| 3.1 | **Build editor shell layout** | Two-column layout: sidebar (prop editor) + iframe. |
| 3.2 | **Build iframe preview app** | Separate entry point (`src/preview/main.tsx`) that renders the component tree from state. Vite multi-page or same app with route split. |
| 3.3 | **Implement postMessage bridge** | `src/lib/postMessageBridge.ts` — typed send/receive helpers between editor shell and iframe for prop updates. |
| 3.4 | **Wire sidebar ↔ iframe prop sync** | Selecting a component in the sidebar populates prop editors; changes are sent to the iframe via postMessage and reflected live. |
| 3.5 | **Implement drag-and-drop component insertion** | Minimal DnD: drag component type from a palette in the sidebar → drops into the component tree at a position. Use `@dnd-kit/core` or simple HTML drag API. |
| 3.6 | **Component tree state store** | `src/store/treeStore.ts` (zustand) — holds the `ComponentTreeNode[]` array with add/remove/update/reorder actions. |

### Phase 4 — BroadcastChannel Communication Layer

| # | Task | Details |
|---|------|---------|
| 4.1 | **Create `useBroadcastChannel` hook** | `src/hooks/useBroadcastChannel.ts` — wraps BroadcastChannel lifecycle (open, listen, post, close). Accepts channel name + message handler. |
| 4.2 | **Create `HubLauncher` component** | Button rendered inside the iframe that calls `window.open()` to launch the popup. Stores popup `Window` ref for lifecycle tracking. |
| 4.3 | **Implement iframe-side channel logic** | On channel `HUB_READY`: respond with `IFRAME_ANNOUNCE` (meta) + `IFRAME_TREE_SNAPSHOT`. On `REQUEST_SNAPSHOT`: send current tree. On `IMPORT_TREE`: merge received nodes into tree store. |
| 4.4 | **Generate unique sourceId per iframe instance** | Use `crypto.randomUUID()` on mount; include in every outbound message so the Hub can distinguish multiple iframes (future multi-window support). |

### Phase 5 — Popup Hub Window

| # | Task | Details |
|---|------|---------|
| 5.1 | **Create popup entry point** | `src/hub/main.tsx` + `hub.html` — standalone mini-app loaded by `window.open()`. |
| 5.2 | **Hub shell with tab navigation** | Three tabs: Export, Import, Generate. Use simple state-driven tabs (no router needed). |
| 5.3 | **Hub-side BroadcastChannel setup** | On mount: open channel, send `HUB_READY`, listen for `IFRAME_ANNOUNCE` and `IFRAME_TREE_SNAPSHOT`. |
| 5.4 | **Hub state store** | `src/hub/store.ts` — holds received tree snapshots keyed by `sourceId`, active tab, selected node path. |

### Phase 6 — Export Tab

| # | Task | Details |
|---|------|---------|
| 6.1 | **Build JSON tree viewer** | Recursive collapsible tree UI that renders `ComponentTreeNode[]`. Each node shows type + id. Expand to see props. |
| 6.2 | **Node selection** | Click a node to select it; highlight it. Show its full JSON in a detail pane. |
| 6.3 | **Copy-to-clipboard** | "Copy Node" button copies selected node's JSON. "Copy All" copies entire tree. Use `navigator.clipboard.writeText()`. |
| 6.4 | **Visual polish** | Indentation guides, expand/collapse icons, syntax-highlighted JSON preview. |

### Phase 7 — Import Tab

| # | Task | Details |
|---|------|---------|
| 7.1 | **JSON text input** | Large `<textarea>` or code editor (plain textarea is fine for v1) for pasting JSON. |
| 7.2 | **Validation** | On paste/change, parse JSON and validate against `ComponentTreeNode[]` shape. Show inline errors. |
| 7.3 | **Preview before send** | Render a read-only tree view of the parsed JSON so the user can verify before importing. |
| 7.4 | **Send to iframe** | "Import" button sends `IMPORT_TREE` message over BroadcastChannel. |
| 7.5 | **Merge strategy in iframe** | Iframe receives `IMPORT_TREE` → appends nodes to tree (or replaces, based on a toggle). Deduplicates by `id` if replace mode. |

### Phase 8 — Generate Tab

| # | Task | Details |
|---|------|---------|
| 8.1 | **Image upload / paste area** | Drop zone + file input for uploading a screenshot/design image. Support clipboard paste. |
| 8.2 | **Build AI prompt template** | System prompt includes the feature map (component types + prop schemas). User prompt includes the image. Instruct the model to return valid `ComponentTreeNode[]` JSON. |
| 8.3 | **AI integration (API call)** | Call a vision-capable model (Claude API) with the prompt + image. Parse the JSON response. Handle streaming for UX. |
| 8.4 | **Result preview** | Show the generated `ComponentTreeNode[]` in the same tree viewer used in Export. Allow editing before sending. |
| 8.5 | **Send generated tree to iframe** | "Apply" button sends `GENERATE_RESULT` message. Iframe merges it into the tree store. |
| 8.6 | **Error handling & retry** | Handle malformed AI output: re-prompt with error context, show user-friendly message. |

### Phase 9 — Multi-Window Awareness & Multi-Target Push

| # | Task | Details |
|---|------|---------|
| 9.1 | **Hub subscriber registry** | Hub maintains a map of `sourceId → IframeMeta` for all iframes that have announced. Display a "Connected Windows" list in the Hub sidebar with status badges (active / stale). |
| 9.2 | **Heartbeat / presence** | Iframe sends periodic `IFRAME_ANNOUNCE` (every 5s). Hub marks stale entries after timeout (15s). Remove entries after extended absence (60s) with option to keep pinned. |
| 9.3 | **Multi-select target picker** | Checkbox-based UI in the Hub that lets users select one, many, or all connected iframes as push targets. Selection persists across tabs (Export/Import/Generate). "Select All" / "Deselect All" convenience buttons. |
| 9.4 | **Broadcast to selected targets** | When the user clicks Import/Apply/Export with multiple targets selected, Hub sends a `BROADCAST_TREE` message with `targetIds: string[]`. Each iframe checks whether its own `sourceId` is in `targetIds` before processing. |
| 9.5 | **Iframe-side target filtering** | Iframe `onmessage` handler checks `targetIds` array: if present and own `sourceId` is not included, silently ignore the message. Backwards-compatible — messages without `targetIds` are processed by all iframes. |
| 9.6 | **Bulk snapshot request** | Hub can send `REQUEST_SNAPSHOT` with `targetIds` to fetch tree snapshots from specific iframes simultaneously. Responses are collected and displayed side-by-side in the Export tab. |
| 9.7 | **Hub-to-Hub awareness** | If multiple Hubs open on the same channel, they detect each other via a `HUB_ANNOUNCE` heartbeat and coordinate (e.g., only one active Hub, or display a warning). |
| 9.8 | **Cross-window diff view** | When multiple iframes are selected, show a diff summary of their component trees so the user can see what will change before pushing. |

### Phase 10 — Polish & Hardening

| # | Task | Details |
|---|------|---------|
| 10.1 | **Popup blocked handling** | Detect when `window.open()` is blocked; show user instructions. |
| 10.2 | **Channel cleanup** | Close BroadcastChannel on unmount / `beforeunload`. |
| 10.3 | **Accessibility** | Keyboard nav for tree viewer, focus management for tabs, ARIA roles. |
| 10.4 | **Responsive Hub layout** | Hub popup should work at various window sizes. |
| 10.5 | **Error boundaries** | React error boundaries in both iframe and Hub apps. |
| 10.6 | **Unit tests** | Test message serialization/deserialization, tree merge logic, validation. |

---

## File Structure (Planned)

```
src/
├── types/
│   └── index.ts                    # Shared types
├── constants.ts                    # Channel name, message types
├── config/
│   └── featureMap.ts               # Component registry + prop schemas
├── components/                     # Atomic components
│   ├── Hero.tsx
│   ├── TextBlock.tsx
│   ├── ImageCard.tsx
│   ├── Button.tsx
│   └── index.ts                    # Barrel export
├── lib/
│   ├── postMessageBridge.ts        # postMessage typed helpers
│   └── treeUtils.ts                # Tree merge, validation, search
├── hooks/
│   └── useBroadcastChannel.ts      # BroadcastChannel React hook
├── store/
│   └── treeStore.ts                # Zustand store for component tree
├── editor/                         # Editor shell (parent window)
│   ├── EditorShell.tsx
│   ├── Sidebar.tsx
│   ├── PropEditor.tsx
│   ├── ComponentPalette.tsx
│   └── main.tsx                    # Editor entry point
├── preview/                        # iframe preview
│   ├── Preview.tsx
│   ├── HubLauncher.tsx
│   ├── ChannelBridge.tsx           # iframe-side broadcast logic
│   └── main.tsx                    # Preview entry point
├── hub/                            # Popup Hub window
│   ├── HubShell.tsx
│   ├── tabs/
│   │   ├── ExportTab.tsx
│   │   ├── ImportTab.tsx
│   │   └── GenerateTab.tsx
│   ├── components/
│   │   ├── TreeViewer.tsx          # Recursive JSON tree
│   │   ├── JsonPreview.tsx         # Syntax-highlighted JSON
│   │   ├── ImageDropZone.tsx       # Image upload for Generate
│   │   └── ConnectedWindows.tsx    # Multi-window list (Phase 9)
│   ├── store.ts                    # Hub-specific state
│   └── main.tsx                    # Hub entry point
├── App.tsx
└── main.tsx
public/
├── index.html                      # Editor shell
├── preview.html                    # iframe target
└── hub.html                        # Popup target
```

---

## Implementation Order & Dependencies

```
Phase 1 (Scaffolding) ──► Phase 2 (Components) ──► Phase 3 (Editor + iframe)
                                                         │
                                                         ▼
                                                    Phase 4 (BroadcastChannel)
                                                         │
                                                         ▼
                                                    Phase 5 (Hub Window)
                                                    ┌────┼────┐
                                                    ▼    ▼    ▼
                                                  Ph6  Ph7  Ph8
                                                (Export)(Import)(Generate)
                                                    └────┬────┘
                                                         ▼
                                                    Phase 9 (Multi-Window)
                                                         │
                                                         ▼
                                                    Phase 10 (Polish)
```

Phases 6, 7, and 8 can be developed in parallel once Phase 5 is complete.

---

## Key Design Decisions

1. **BroadcastChannel over postMessage for Hub communication** — BroadcastChannel works across any same-origin browsing contexts (including popups), doesn't require holding a `Window` reference, and naturally supports future multi-window scenarios.

2. **Separate entry points for editor, preview, and hub** — keeps bundle sizes small and concerns separated. Vite's multi-page support handles this cleanly.

3. **Simplified data model first** — `ComponentTreeNode` is intentionally simpler than Contentful's content model. A future adapter layer will map between the two.

4. **Feature map drives AI generation** — the same registry that powers the component palette also feeds the AI prompt, ensuring generated output always maps to real components.

5. **Zustand for state** — minimal boilerplate, works well with React, supports middleware (persist, devtools) for debugging.

---

## Open Questions / Future Considerations

- **Contentful Studio integration**: How do `ComponentTreeNode` maps to Contentful entries? Likely needs an adapter in a future phase.
- **Authentication for AI calls**: The Generate tab needs an API key. For v1, use an environment variable; later, a settings panel in the Hub.
- **Undo/redo**: Should the tree store support history? Zustand has middleware for this.
- **Collaborative editing**: Multiple users with the same channel name could conflict. Namespace channels per session?
- **Persistence**: Should the tree be persisted to localStorage between sessions?
