import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./LegacyApp"; // LegacyApp hosts BASIC panely; PageLayout to be integrated in subsequent steps.

const isTestEnv = process.env.NODE_ENV === "test";
const tree = <App />; // <- renderuj priamo LegacyApp

createRoot(document.getElementById("root")!).render(
  isTestEnv ? tree : <StrictMode>{tree}</StrictMode>
);
