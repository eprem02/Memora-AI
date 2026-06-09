import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Force dark mode on startup
document.documentElement.classList.add("dark");

// Setup API auth token attachment
setAuthTokenGetter(() => localStorage.getItem("memora_token"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
