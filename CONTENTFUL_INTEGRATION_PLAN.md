# Contentful Studio Integration Plan

## Context

The current proof-of-concept has a 3-window architecture: a custom CMS editor shell (`index.html`), a preview iframe (`preview.html`), and a Hub popup (`hub.html`). The goal is to **replace the custom editor shell with Contentful Studio**, making our preview app work inside Studio's iframe-based visual editor (Experiences) while preserving the Hub popup workflow for multi-window tree management, import/export, and AI generation.

**Key constraint**: Contentful Studio overlays an interaction-blocking layer over the preview iframe. This means the existing `HubLauncher` button cannot be clicked by the user. The Hub must **auto-launch on preview mount** and **reuse (focus) the existing window** on all future "launches" within the same session.

---

## Architecture Shift

### What Gets Replaced
| Old | New |
|-----|-----|
| `index.html` editor shell (our custom UI) | **Contentful Studio** is the editor |
| Mock `ComponentTreeNode` as the data source | **Contentful Experience entries** |
| Our drag-and-drop palette + prop editor | Studio's native UI (we register components via `defineComponents()`) |

### What Stays
- All atomic components: `Hero`, `TextBlock`, `ImageCard`, `Button`, `Section`, `Container`
- Hub popup window (`hub.html`) — all three tabs mostly unchanged
- BroadcastChannel `"cms-hub"` communication layer
- `HubMessage` protocol (with additions for Contentful types)
- Multi-window coordination logic

### What Gets Adapted
- Preview app → use `@contentful/experiences-sdk-react` → `ExperienceRoot`
- `HubLauncher` → auto-launches on mount, reuses/focuses existing popup
- `ChannelBridge` → translates between Contentful Experience format and `ComponentTreeNode`
- Hub tabs → understand Contentful data format alongside existing format

---

## New Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Contentful Studio (host window)                               │
│  ┌───────────────────────┐  ┌────────────────────────────────┐│
│  │  Studio Sidebar        │  │  Experience Preview iframe      ││
│  │  - Component palette   │  │  (our app — preview.html)      ││
│  │  - Field editors       │  │  ┌──────────────────────────┐  ││
│  │  - Entry navigator     │  │  │ <ExperienceRoot>           │  ││
│  │                        │  │  │  registers our components  │  ││
│  │  Experiences SDK  ◄────┼──┼──┤                           │  ││
│  │  postMessage protocol  │  │  │ AutoHubLauncher (useEffect)│  ││
│  │                        │  │  │   → opens Hub on mount     │  ││
│  └───────────────────────┘  │  │   → focus if already open  │  ││
│                              │  │                           │  ││
│                              │  │ ChannelBridge              │  ││
│                              │  └────────────┬─────────────┘  ││
│                              └───────────────┼────────────────┘│
└──────────────────────────────────────────────┼─────────────────┘
                                               │ BroadcastChannel
                                               │ "cms-hub"
                               ┌───────────────▼───────────────┐
                               │  Hub Popup Window              │
                               │  (hub.html — extended)         │
                               │  Export | Import | Generate     │
                               └───────────────────────────────┘
```

---

## Implementation Phases

### Phase 0 — Contentful Space Setup

Before any code changes, the Contentful space needs to be created and configured. This is a one-time manual step done in the Contentful web UI.

**0.1 — Create a Contentful account and space**
- Sign up at contentful.com and create a new Space (free tier is sufficient for development)
- Note the **Space ID** from Settings → General Settings

**0.2 — Enable Contentful Studio / Experiences**
- In the space, go to **Apps → Contentful Apps** and install **Contentful Studio** (also listed as "Experiences" in some plans)
- This activates the Experience content type scaffolding and the visual editor UI

**0.3 — Create the Experience content type**
Contentful Studio auto-creates an `Experience` content type when the app is installed. Verify it exists under **Content model**. It should have at minimum:
- `title` (Short text)
- `slug` (Short text, unique) — used by `useFetchBySlug`
- `componentTree` (JSON object) — managed internally by the Experiences SDK; do not edit manually

**0.4 — Generate API keys**
In Settings → API keys, create a key set and note:
- **Space ID**
- **Content Delivery API access token** (read-only, for `useFetchBySlug` in dev mode)
- **Content Preview API access token** (for draft content in dev mode)

Add these to `.env.local`:
```
VITE_CONTENTFUL_SPACE_ID=xxx
VITE_CONTENTFUL_ENVIRONMENT=master
VITE_CONTENTFUL_ACCESS_TOKEN=xxx
VITE_CONTENTFUL_PREVIEW_TOKEN=xxx
```

**0.5 — Register the preview URL with Studio**
In **Settings → Content preview**, create a preview configuration:
- Content type: Experience
- Preview URL: `https://<tunnel-or-deployed-url>/preview.html?slug={entry.fields.slug}`
- For local dev: use `ngrok http 5173` to get a stable tunnel URL, then register `https://<ngrok-id>.ngrok.io/preview.html?slug={entry.fields.slug}`

**0.6 — Create a test Experience entry**
In **Content → Add entry → Experience**, create one entry with a slug (e.g., `home`). This will be used to verify the end-to-end flow once the preview app is wired up.

---

### Phase 1 — Install Contentful Dependencies

**`package.json`** additions:
```
@contentful/experiences-sdk-react
@contentful/app-sdk
contentful  (delivery API client, for dev/standalone fetch mode)
```

No structural changes yet — just dependency installation and type verification.

---

### Phase 2 — Component Registration for Experiences

**New file: `src/config/experienceComponents.ts`**

Register our atomic components with Contentful's `defineComponents()`. Map our existing `featureMap` prop schemas to Contentful's `variables` format:

```ts
// Our PropSchema.type → Contentful variable type mapping:
// "string" | "richtext" | "url" → "Text"
// "number"                      → "Number"
// "boolean"                     → "Boolean"
// "color"                       → "Text" (with validation hint)
// "select"                      → "Text" (with options)
```

Each component definition:
```ts
{
  component: Hero,
  definition: {
    id: "hero",
    name: "Hero",
    category: "Layout",
    variables: { /* mapped from featureMap propSchema */ }
  }
}
```

**Modified: `src/preview/main.tsx`**
Call `defineComponents(experienceComponents)` once at startup before React mounts.

---

### Phase 3 — Preview App → Experience-Compatible

**Modified: `src/preview/Preview.tsx`**

Replace our custom `ComponentRenderer` loop with `ExperienceRoot` from `@contentful/experiences-sdk-react`.

Support two runtime modes detected from URL params or `window.location`:

| Mode | How | When |
|------|-----|-------|
| **Studio mode** (default) | `ExperienceRoot` with no `experience` prop — SDK receives data via postMessage from Studio | Production / Contentful preview URL |
| **Standalone/dev mode** | `useFetchBySlug` hook with env vars (`VITE_CONTENTFUL_SPACE_ID`, `VITE_CONTENTFUL_ACCESS_TOKEN`) | Local dev, testing outside Studio |

The `ExperienceRoot` renders our registered components and handles Studio's postMessage protocol (the same iframe ↔ parent communication we already use, just with the Experiences SDK as the intermediary).

---

### Phase 4 — Auto Hub Launcher

**Modified: `src/preview/HubLauncher.tsx`**

#### Studio detection

Detect whether the preview is running inside Contentful Studio by checking for the Experiences SDK's `isInsideWithExperiencesSDK` flag or by inspecting the referrer/postMessage handshake. A simple reliable check:

```ts
const isInsideStudio = (): boolean =>
  window.self !== window.top &&
  document.referrer.includes("app.contentful.com");
```

For local dev with our custom editor shell (`index.html`), `document.referrer` will be `localhost`, so `isInsideStudio()` returns `false`.

#### Dual behavior

```ts
// Singleton window reference — module-level (survives re-renders)
let hubWindowRef: Window | null = null;

export function getOrOpenHub(): void {
  if (hubWindowRef && !hubWindowRef.closed) {
    hubWindowRef.focus();   // reuse existing popup
    return;
  }
  hubWindowRef = window.open("/hub.html", "cms-hub-popup", POPUP_FEATURES);
}

export function HubLauncher() {
  const inStudio = isInsideStudio();

  // Auto-launch when inside Studio (overlay blocks button clicks)
  useEffect(() => {
    if (inStudio) {
      getOrOpenHub();
    }
  }, []);  // runs once on preview mount

  // In our custom editor (local dev): render the clickable button as before
  // Inside Studio: render nothing — Hub was already opened by useEffect
  if (inStudio) return null;

  return (
    <button onClick={getOrOpenHub} /* ...existing styles... */>
      Open Hub
    </button>
  );
}
```

Key behaviors by context:

| Context | Button visible | Hub launch trigger |
|---------|---------------|-------------------|
| Local dev (`index.html` editor) | Yes | User clicks button |
| Inside Contentful Studio | No (returns `null`) | `useEffect` on mount |

Additional behaviors:
- **User navigates between entries in Studio**: `useEffect` fires on each new preview mount → `hubWindowRef` checked → if still open, `.focus()` instead of reopening
- **User closes Hub**: Next preview mount auto-relaunches it
- **Popup blocked**: Detect `null` return from `window.open()`, log a warning; in standalone mode show the existing "popup blocked" message UI

---

### Phase 5 — Contentful Data Adapter

**New file: `src/lib/contentfulAdapter.ts`**

Bidirectional conversion between Contentful Experience data and our `ComponentTreeNode` format:

```ts
// Contentful Experience entry → our tree (for Hub display/export)
export function experienceToComponentTree(
  experience: ExperienceEntry
): ComponentTreeNode[]

// Our tree → Contentful Experience format (for import back into Studio)
export function componentTreeToExperience(
  nodes: ComponentTreeNode[],
  baseEntry?: ExperienceEntry
): ExperienceEntry
```

The adapter bridges the structural gap:
- Contentful Experience: nested `componentTree` with `definitionId`, `variables`, `children`
- Our format: `ComponentTreeNode[]` with `type`, `props`, `children`, `id`

**Modified: `src/types/index.ts`**

Add new message types to `HubMessage`:
```ts
| { type: "CONTENTFUL_SNAPSHOT"; payload: ExperienceEntry; sourceId: string }
| { type: "CONTENTFUL_IMPORT"; payload: ExperienceEntry; sourceId: string; targetIds?: string[] }
```

---

### Phase 6 — ChannelBridge Contentful Integration

**Modified: `src/preview/ChannelBridge.tsx`**

Extend bridge to work with Contentful data:

1. **On `IFRAME_ANNOUNCE`**: Include Contentful experience ID in `meta` if available
2. **On `REQUEST_SNAPSHOT`**: Send both `IFRAME_TREE_SNAPSHOT` (ComponentTreeNode format) AND `CONTENTFUL_SNAPSHOT` (raw Contentful Experience JSON) — Hub can display either
3. **On `CONTENTFUL_IMPORT`**: Receive Contentful Experience JSON from Hub, convert via adapter, update the experience in preview
4. **Tap into Experiences SDK events**: When Studio updates the experience (user dragging components in Studio), capture the updated data and broadcast `IFRAME_TREE_SNAPSHOT` to Hub to keep it in sync

---

### Phase 7 — Hub Contentful Awareness

**Modified: `src/hub/tabs/ExportTab.tsx`**

Add a format toggle: **"Component Tree" | "Contentful JSON"**
- Component Tree: existing collapsible `TreeViewer` (unchanged)
- Contentful JSON: raw Experience entry structure in `JsonPreview`
- Both sourced from the same snapshot; adapter converts on demand

**Modified: `src/hub/tabs/ImportTab.tsx`**

Auto-detect pasted format (try parse as Contentful Experience first, then as `ComponentTreeNode[]`):
- If Contentful format: send `CONTENTFUL_IMPORT` message
- If ComponentTreeNode format: send `IMPORT_TREE` message (existing behavior)
- Show format detection result in UI

**Modified: `src/hub/tabs/GenerateTab.tsx`**

Output toggle: **"Our Format" | "Contentful Format"**
Generate tab's "Apply" button sends the appropriate message type based on toggle.

---

### Window Management — Singleton Hub Pattern

The key pattern across all contexts: **one Hub, always**.

```
Preview mounts in Studio
  → useEffect fires
  → getOrOpenHub() called
  → hubWindowRef null or closed? → window.open() → new Hub
  → hubWindowRef alive?          → hubWindowRef.focus()

User opens another experience in Studio (new iframe instance)
  → same domain, same "cms-hub-popup" window name
  → window.open() returns reference to existing popup
  → both iframes now broadcast to the same Hub via BroadcastChannel
  → Hub's ConnectedWindows panel shows both iframes
```

The `"cms-hub-popup"` window name (already in use) ensures the browser reuses the same window slot across `window.open()` calls from the same origin, even if `hubWindowRef` is lost.

---

## Critical Files

| File | Action | Purpose |
|------|--------|---------|
| `src/config/experienceComponents.ts` | **Create** | Contentful `defineComponents()` registration |
| `src/lib/contentfulAdapter.ts` | **Create** | Contentful ↔ ComponentTreeNode bidirectional adapter |
| `src/preview/main.tsx` | **Modify** | Call `defineComponents()` at startup |
| `src/preview/Preview.tsx` | **Modify** | Use `ExperienceRoot`, support dual mode (Studio / standalone) |
| `src/preview/HubLauncher.tsx` | **Modify** | Auto-launch on mount, singleton window ref, reuse/focus logic |
| `src/preview/ChannelBridge.tsx` | **Modify** | Add Contentful snapshot/import message handling |
| `src/types/index.ts` | **Modify** | Add `CONTENTFUL_SNAPSHOT`, `CONTENTFUL_IMPORT` message types, `ExperienceEntry` type |
| `src/hub/tabs/ExportTab.tsx` | **Modify** | Dual-format display (Component Tree / Contentful JSON) |
| `src/hub/tabs/ImportTab.tsx` | **Modify** | Auto-detect and route import format |
| `src/hub/tabs/GenerateTab.tsx` | **Modify** | Output format toggle |
| `package.json` | **Modify** | Add Contentful SDK dependencies |

**Files that stay unchanged:**
- `hub.html`, `src/hub/main.tsx`, `src/hub/HubShell.tsx`
- `src/hub/store.ts`
- `src/hub/components/ConnectedWindows.tsx`, `TreeViewer.tsx`, `JsonPreview.tsx`
- All atomic components (`Hero.tsx`, `TextBlock.tsx`, etc.)
- `src/lib/postMessageBridge.ts`, `src/hooks/useBroadcastChannel.ts`
- `src/store/treeStore.ts`

---

## Existing Utilities to Reuse

- `src/lib/treeUtils.ts` — `cloneWithNewIds()`, tree traversal (reused in adapter)
- `src/hooks/useBroadcastChannel.ts` — unchanged, used by ChannelBridge as before
- `src/config/featureMap.ts` — source of truth for mapping to Contentful variables
- `POPUP_FEATURES` constant from `HubLauncher.tsx` — same window dimensions

---

## Verification Steps

1. **Standalone mode**: Run `npm run dev`, open `http://localhost:5173/preview.html?mode=standalone&slug=<slug>`. Verify Hub auto-opens, components render from Contentful, Export tab shows both formats.

2. **Studio mode**: Open a Contentful Experience entry in Studio. Verify:
   - Preview iframe loads our app
   - Hub popup auto-opens without any user interaction
   - Hub's Connected Windows shows the preview iframe
   - Dragging a component in Studio updates Hub's Export view
   - Importing JSON from Hub updates the preview

3. **Singleton Hub**: With Studio open, navigate between entries. Verify Hub window is reused (focused, not reopened) each time.

4. **Multi-window**: Open two Contentful Experience entries in separate Studio tabs. Verify Hub's Connected Windows shows both, and broadcast from Hub updates both previews.
