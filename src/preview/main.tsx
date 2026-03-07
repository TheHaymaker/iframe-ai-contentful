import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Preview } from "./Preview";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary label="Preview">
        <Preview />
      </ErrorBoundary>
    </StrictMode>,
  );
}
