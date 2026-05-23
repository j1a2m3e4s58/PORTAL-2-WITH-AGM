import { useEffect, useMemo, useState } from "react";
import { withBase } from "@/lib/app-base";

const SPLASH_SESSION_KEY = "bcb_portal_splash_seen";
const BRAND_LOGO = withBase("assets/images/bcb-logo.png");

function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function StartupSplash({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const displayDuration = useMemo(() => {
    if (typeof window === "undefined") return 0;
    return isStandaloneDisplay() ? 2200 : 1200;
  }, []);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;

    const seen = window.sessionStorage.getItem(SPLASH_SESSION_KEY);
    const shouldShow = isStandaloneDisplay() || !seen;
    if (!shouldShow) return;

    setShowSplash(true);
    window.sessionStorage.setItem(SPLASH_SESSION_KEY, "true");

    const fadeTimer = window.setTimeout(() => setIsLeaving(true), Math.max(400, displayDuration - 450));
    const closeTimer = window.setTimeout(() => {
      setShowSplash(false);
      setIsLeaving(false);
    }, displayDuration);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(closeTimer);
    };
  }, [displayDuration]);

  return (
    <>
      {children}
      {mounted && showSplash && (
        <div
          className={`startup-splash ${isLeaving ? "startup-splash--leaving" : ""}`}
          aria-hidden="true"
        >
          <div className="startup-splash__backdrop" />
          <div className="startup-splash__orbs">
            <span className="startup-splash__orb startup-splash__orb--one" />
            <span className="startup-splash__orb startup-splash__orb--two" />
            <span className="startup-splash__orb startup-splash__orb--three" />
          </div>
          <div className="startup-splash__content">
            <div className="startup-splash__rings">
              <span />
              <span />
              <span />
            </div>
            <div className="startup-splash__logo-shell">
              <div className="startup-splash__logo-glow" />
              <img
                src={BRAND_LOGO}
                alt="BCB Staff Portal"
                className="startup-splash__logo"
              />
            </div>
            <div className="startup-splash__wordmark">
              <div className="startup-splash__eyebrow">Bawjiase Community Bank PLC</div>
              <div className="startup-splash__title">BCB Staff Portal</div>
              <div className="startup-splash__subtitle">
                Secure workspace for communication, training, forms, and operations
              </div>
            </div>
            <div className="startup-splash__loader">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
