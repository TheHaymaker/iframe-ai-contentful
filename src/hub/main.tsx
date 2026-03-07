import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { HubShell } from "./HubShell";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary label="Hub">
        <HubShell />
      </ErrorBoundary>
    </StrictMode>,
  );
}
