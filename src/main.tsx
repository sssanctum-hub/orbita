import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import OrbitOverlay from "./components/OrbitOverlay";
import { isTauri } from "@tauri-apps/api/core";
const overlay = isTauri() && new URLSearchParams(location.search).has("orbit-overlay");
if (overlay) document.documentElement.classList.add("orbit-overlay-window");
import { installControlHaptics } from "./haptics";
const removeControlHaptics = installControlHaptics();
if (import.meta.hot) import.meta.hot.dispose(removeControlHaptics);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {overlay ? <OrbitOverlay /> : <App />}
  </React.StrictMode>,
);

if (import.meta.env.PROD && !window.OrbitaDevice && (location.protocol === "https:" || location.hostname === "localhost") && "serviceWorker" in navigator) {
 window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js").catch(console.warn); });
}
