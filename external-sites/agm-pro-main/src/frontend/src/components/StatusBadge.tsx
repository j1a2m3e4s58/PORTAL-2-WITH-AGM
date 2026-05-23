import { ShareholderStatus } from "@/backend";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, UserCheck, Users } from "lucide-react";

interface StatusBadgeProps {
  status: ShareholderStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const CONFIG: Record<
  ShareholderStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    classes: string;
  }
> = {
  [ShareholderStatus.NotRegistered]: {
    label: "Not Registered",
    icon: Clock,
    classes: "bg-muted text-muted-foreground border-border",
  },
  [ShareholderStatus.RegisteredInPerson]: {
    label: "In-Person",
    icon: UserCheck,
    classes: "bg-blue-950/60 text-blue-300 border-blue-800",
  },
  [ShareholderStatus.RegisteredProxy]: {
    label: "Proxy",
    icon: Users,
    classes: "bg-amber-950/60 text-amber-300 border-amber-800",
  },
  [ShareholderStatus.CheckedIn]: {
    label: "Checked-In",
    icon: CheckCircle2,
    classes: "bg-primary/20 text-primary border-primary/40",
  },
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
  lg: "text-base px-3 py-1.5 gap-2",
};

const ICON_SIZE = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

export function StatusBadge({
  status,
  size = "md",
  className,
}: StatusBadgeProps) {
  const { label, icon: Icon, classes } = CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        classes,
        SIZE_CLASSES[size],
        className,
      )}
    >
      <Icon className={ICON_SIZE[size]} />
      {label}
    </span>
  );
}
