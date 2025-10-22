import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./RootLayout"; // RootLayout wraps BASIC/PRO conditional rendering

const isTestEnv = process.env.NODE_ENV === "test";
const tree = <App />;

createRoot(document.getElementById("root")!).render(
  isTestEnv ? tree : <StrictMode>{tree}</StrictMode>
);
