import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HubShell } from "./HubShell";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HubShell />
    </StrictMode>,
  );
}
