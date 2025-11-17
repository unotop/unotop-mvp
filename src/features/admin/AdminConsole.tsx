/**
 * PR-12: Admin Console - PRO režim unlock s heslom
 *
 * PROD guard:
 * - V PROD vždy vyžaduje heslo "BohaKrista20" + checkbox "Som administrátor"
 * - V DEV/Preview heslo voliteľné (ale stále dostupné)
 *
 * Ovládanie:
 * - Otvorenie cez AdminShortcuts komponent (Ctrl+Shift+P, Alt+Shift+A, triple-click, ?admin=true)
 * - Esc zatvára modal
 */

import React, { useState } from "react";
import { writeV3 } from "../../persist/v3";
import { requiresAdminPassword, getEnvName } from "../../shared/env";

const ADMIN_PASSWORD = "BohaKrista20"; // TODO: Move to env var for production
const SESSION_KEY = "unotop:admin:pro-unlocked";

interface AdminConsoleProps {
  visible: boolean;
  onClose: () => void;
}

export function AdminConsole({ visible, onClose }: AdminConsoleProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [adminConfirmed, setAdminConfirmed] = useState(false); // PR-12: "Som administrátor" checkbox

  const isProdMode = requiresAdminPassword();

  // Esc close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && visible) {
        onClose();
        setInput("");
        setError("");
        setAdminConfirmed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // PR-12: PROD guard - vyžaduj checkbox "Som administrátor"
    if (isProdMode && !adminConfirmed) {
      setError("Prosím potvrďte že ste administrátor");
      setTimeout(() => setError(""), 2000);
      return;
    }

    if (input === ADMIN_PASSWORD) {
      // Unlock PRO mode
      sessionStorage.setItem(SESSION_KEY, "true");
      writeV3({ profile: { modeUi: "PRO" } });

      onClose();
      setInput("");
      setError("");
      setAdminConfirmed(false);

      // Toast feedback
      const toast = document.createElement("div");
      toast.textContent = "✅ PRO režim aktivovaný";
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: 500;
        z-index: 9999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // Reload page to apply PRO mode
      setTimeout(() => window.location.reload(), 500);
    } else {
      setError("Nesprávne heslo");
      setTimeout(() => setError(""), 2000);
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1f2937",
          border: "2px solid #374151",
          borderRadius: "12px",
          padding: "24px",
          minWidth: "400px",
          maxWidth: "500px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: "16px",
            color: "#f3f4f6",
            fontSize: "18px",
            fontWeight: 600,
          }}
        >
          Admin Console
        </h2>

        <p
          style={{
            margin: 0,
            marginBottom: "20px",
            color: "#9ca3af",
            fontSize: "14px",
          }}
        >
          {isProdMode
            ? `Zadaj heslo pre prístup do PRO režimu (PROD mode - ${getEnvName()})`
            : `Zadaj heslo pre prístup do PRO režimu (${getEnvName()} mode)`}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Heslo..."
            autoFocus
            style={{
              width: "100%",
              padding: "10px 14px",
              backgroundColor: "#111827",
              border: "1px solid #374151",
              borderRadius: "6px",
              color: "#f3f4f6",
              fontSize: "14px",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#374151";
            }}
          />

          {/* PR-12: PROD guard - checkbox "Som administrátor" */}
          {isProdMode && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "12px",
                color: "#f3f4f6",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={adminConfirmed}
                onChange={(e) => setAdminConfirmed(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  cursor: "pointer",
                }}
              />
              Som administrátor a mám oprávnenie odomknúť PRO režim
            </label>
          )}

          {error && (
            <p
              style={{
                margin: "12px 0 0 0",
                color: "#ef4444",
                fontSize: "13px",
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              marginTop: "20px",
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                backgroundColor: "#374151",
                color: "#f3f4f6",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Zrušiť
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Odomknúť
            </button>
          </div>
        </form>

        <p
          style={{
            margin: "20px 0 0 0",
            paddingTop: "16px",
            borderTop: "1px solid #374151",
            color: "#6b7280",
            fontSize: "12px",
          }}
        >
          Tip: Stlač{" "}
          <kbd
            style={{
              backgroundColor: "#111827",
              padding: "2px 6px",
              borderRadius: "4px",
              fontFamily: "monospace",
            }}
          >
            Ctrl+Shift+P
          </kbd>{" "}
          alebo{" "}
          <kbd
            style={{
              backgroundColor: "#111827",
              padding: "2px 6px",
              borderRadius: "4px",
            }}
          >
            Esc
          </kbd>{" "}
          pre zatvorenie
        </p>
      </div>
    </div>
  );
}

/**
 * Check if PRO mode is unlocked via admin console
 */
export function isProUnlocked(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}
