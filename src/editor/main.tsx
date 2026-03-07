import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EditorShell } from "./EditorShell";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <EditorShell />
    </StrictMode>,
  );
}
