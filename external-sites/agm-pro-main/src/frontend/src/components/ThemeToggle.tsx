import { Button } from "@/components/ui/button";
import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-10 w-28" aria-hidden />;
  }

  const isDark = resolvedTheme !== "light";

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="surface-highlight min-h-[40px] gap-2 px-3"
      data-ocid="theme.toggle_button"
    >
      {isDark ? (
        <SunMedium className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      <span className="text-xs font-semibold">
        {isDark ? "Light Mode" : "Dark Mode"}
      </span>
    </Button>
  );
}
