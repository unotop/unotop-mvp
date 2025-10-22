import React, { useEffect, useState } from "react";

interface SuccessFeedbackProps {
  show: boolean;
  message?: string;
  duration?: number;
  onComplete?: () => void;
}

export const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({
  show,
  message = "✓ Hotovo",
  duration = 2000,
  onComplete,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onComplete]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[200] px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium shadow-lg animate-[slideInRight_0.3s_ease-out] flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span className="text-lg animate-[pulseGlow_1s_ease-in-out_infinite]">
        ✓
      </span>
      {message}
    </div>
  );
};
