import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { useLocation } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export default function PlaceholderPage() {
  const location = useLocation();
  const pageName =
    location.pathname
      .split("/")
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") || "Dashboard";

  return (
    <AppShell>
      <EmptyState
        icon={<Construction className="h-8 w-8" />}
        title={`${pageName} — Coming Soon`}
        description="This section is being built and will be available shortly."
        data-ocid="placeholder.empty_state"
      />
    </AppShell>
  );
}
