import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function RouteLoadingBar() {
  const isLoading = useRouterState({
    select: (state) => state.status === "pending",
  });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let intervalId: number | undefined;
    let timeoutId: number | undefined;

    if (isLoading) {
      setVisible(true);
      setProgress((current) => (current > 8 ? current : 12));
      intervalId = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 88) return current;
          const remaining = 92 - current;
          return current + Math.max(3, remaining * 0.18);
        });
      }, 160);
    } else if (visible) {
      setProgress(100);
      timeoutId = window.setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isLoading, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 bg-transparent">
      <div
        className="h-full bg-primary shadow-[0_0_18px_rgba(79,142,247,0.5)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${Math.min(progress, 100)}%`, opacity: progress >= 100 ? 0 : 1 }}
      />
    </div>
  );
}
