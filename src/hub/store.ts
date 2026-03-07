import { create } from "zustand";
import type { ComponentTreeNode, IframeMeta } from "../types";

export type HubTab = "export" | "import" | "generate";

interface SubscriberEntry {
  meta: IframeMeta;
  lastSeen: number;
  tree: ComponentTreeNode[];
}

interface HubState {
  // ── Tab navigation ─────────────────────────────────────────────────
  activeTab: HubTab;
  setActiveTab: (tab: HubTab) => void;

  // ── Subscriber registry ────────────────────────────────────────────
  subscribers: Map<string, SubscriberEntry>;
  upsertSubscriber: (sourceId: string, meta: IframeMeta) => void;
  setSubscriberTree: (sourceId: string, tree: ComponentTreeNode[]) => void;
  removeStaleSubscribers: (maxAge: number) => void;

  // ── Tree selection (Export tab) ────────────────────────────────────
  selectedSourceId: string | null;
  selectedNodePath: string | null;
  selectSource: (sourceId: string | null) => void;
  selectNode: (nodeId: string | null) => void;

  // ── Multi-target selection ──────────────────────────────────────────
  selectedTargets: Set<string>;
  toggleTarget: (sourceId: string) => void;
  selectAllTargets: () => void;
  deselectAllTargets: () => void;
  getSelectedTargetIds: () => string[];

  // ── Import tab state ───────────────────────────────────────────────
  importJson: string;
  setImportJson: (json: string) => void;
  importError: string | null;
  setImportError: (error: string | null) => void;
}

export const useHubStore = create<HubState>((set) => ({
  activeTab: "export",
  setActiveTab: (tab) => set({ activeTab: tab }),

  subscribers: new Map(),
  upsertSubscriber: (sourceId, meta) =>
    set((state) => {
      const next = new Map(state.subscribers);
      const existing = next.get(sourceId);
      next.set(sourceId, {
        meta,
        lastSeen: Date.now(),
        tree: existing?.tree ?? [],
      });
      // Auto-select new subscribers
      const targets = new Set(state.selectedTargets);
      targets.add(sourceId);
      return { subscribers: next, selectedTargets: targets };
    }),
  setSubscriberTree: (sourceId, tree) =>
    set((state) => {
      const next = new Map(state.subscribers);
      const existing = next.get(sourceId);
      if (existing) {
        next.set(sourceId, { ...existing, tree });
      } else {
        next.set(sourceId, {
          meta: {
            sourceId,
            url: "",
            title: "Unknown",
            componentCount: tree.length,
            timestamp: Date.now(),
          },
          lastSeen: Date.now(),
          tree,
        });
      }
      return { subscribers: next };
    }),
  removeStaleSubscribers: (maxAge) =>
    set((state) => {
      const now = Date.now();
      const next = new Map(state.subscribers);
      for (const [id, entry] of next) {
        if (now - entry.lastSeen > maxAge) {
          next.delete(id);
        }
      }
      return { subscribers: next };
    }),

  selectedSourceId: null,
  selectedNodePath: null,
  selectSource: (sourceId) => set({ selectedSourceId: sourceId, selectedNodePath: null }),
  selectNode: (nodeId) => set({ selectedNodePath: nodeId }),

  // ── Multi-target selection ──────────────────────────────────────────
  selectedTargets: new Set(),
  toggleTarget: (sourceId) =>
    set((state) => {
      const next = new Set(state.selectedTargets);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return { selectedTargets: next };
    }),
  selectAllTargets: () =>
    set((state) => ({
      selectedTargets: new Set(state.subscribers.keys()),
    })),
  deselectAllTargets: () => set({ selectedTargets: new Set() }),
  getSelectedTargetIds: () => {
    const state = useHubStore.getState();
    // If nothing explicitly selected, fall back to all subscribers
    if (state.selectedTargets.size === 0) {
      return Array.from(state.subscribers.keys());
    }
    // Filter out stale targets that are no longer in subscribers
    return Array.from(state.selectedTargets).filter((id) =>
      state.subscribers.has(id),
    );
  },

  importJson: "",
  setImportJson: (json) => set({ importJson: json, importError: null }),
  importError: null,
  setImportError: (error) => set({ importError: error }),
}));
