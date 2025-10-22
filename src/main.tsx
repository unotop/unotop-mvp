import { StrictMode, Component, ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./RootLayout"; // RootLayout wraps BASIC/PRO conditional rendering

// Error Boundary for production debugging
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "2rem",
            backgroundColor: "#1e293b",
            color: "#f1f5f9",
            minHeight: "100vh",
            fontFamily: "system-ui",
          }}
        >
          <h1 style={{ color: "#ef4444", marginBottom: "1rem" }}>
            ⚠️ Chyba pri načítaní
          </h1>
          <pre
            style={{
              backgroundColor: "#0f172a",
              padding: "1rem",
              borderRadius: "0.5rem",
              overflow: "auto",
              fontSize: "0.875rem",
            }}
          >
            {this.state.error?.message || "Neznáma chyba"}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            🔄 Obnoviť stránku
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const isTestEnv = process.env.NODE_ENV === "test";
const tree = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(
  isTestEnv ? tree : <StrictMode>{tree}</StrictMode>
);
