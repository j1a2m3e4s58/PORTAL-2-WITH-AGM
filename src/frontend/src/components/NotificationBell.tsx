import { Button } from "@/components/ui/button";
import { apiGetUnreadNotificationCount } from "@/lib/backend-client";
import { useAuth } from "@/store/auth";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface NotificationBellProps {
  className?: string;
}

const NOTIFICATION_COUNT_KEY = "bcb_unread_notification_count";

function loadStoredUnreadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_COUNT_KEY);
    const value = Number(raw ?? "0");
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveStoredUnreadCount(count: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIFICATION_COUNT_KEY, String(Math.max(0, count)));
  } catch {
    // ignore storage failures
  }
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { user } = useAuth();
  const [count, setCount] = useState(() => loadStoredUnreadCount());
  const navigate = useNavigate();

  const fetchCount = useCallback(async () => {
    try {
      const n = await apiGetUnreadNotificationCount();
      setCount(n);
      saveStoredUnreadCount(n);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCount(0);
      saveStoredUnreadCount(0);
      return;
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, [fetchCount, user]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`relative ${className ?? ""}`}
      aria-label={`Notifications — ${count} unread`}
      data-ocid="notification_bell.button"
      onClick={() => navigate({ to: "/notifications" })}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground"
          data-ocid="notification_bell.badge"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Button>
  );
}
