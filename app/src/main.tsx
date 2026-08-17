import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tokens.css";
import App from "./App.tsx";

// No <StrictMode> here deliberately: the question runner (Runner.tsx) finalizes an abandoned
// practice attempt as "partial" from an effect cleanup on unmount, and StrictMode's dev-only
// double-invoke (mount -> cleanup -> mount) would fire that finalize immediately on first load,
// clearing the in-progress attempt it had just created. Revisit if Runner's lifecycle logic
// changes to not depend on unmount-cleanup semantics.
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
