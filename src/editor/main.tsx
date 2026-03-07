import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { EditorShell } from "./EditorShell";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary label="Editor">
        <EditorShell />
      </ErrorBoundary>
    </StrictMode>,
  );
}
