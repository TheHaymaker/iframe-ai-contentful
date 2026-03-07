export interface DragPayload {
  componentType: string;
  defaultProps: Record<string, unknown>;
}

// Module-level singleton — holds the in-flight drag payload set by
// handleDragStart in ComponentPalette and consumed (then cleared) by the
// drop handler in EditorShell.  Using a module-level variable means we
// never rely on e.dataTransfer.getData(), which some browsers restrict to
// the bubbling/target phase of drop (returning "" in capture phase), and
// which is unavailable entirely if the browser routes the drop event into
// the iframe's browsing context rather than the parent document.
let _payload: DragPayload | null = null;

export function setDragPayload(p: DragPayload | null): void {
  _payload = p;
}

export function getDragPayload(): DragPayload | null {
  return _payload;
}
