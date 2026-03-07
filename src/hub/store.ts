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
      return { subscribers: next };
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

  importJson: "",
  setImportJson: (json) => set({ importJson: json, importError: null }),
  importError: null,
  setImportError: (error) => set({ importError: error }),
}));
