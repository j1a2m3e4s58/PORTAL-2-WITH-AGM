import { Button } from "@/components/ui/button";
import { useAuth } from "@/store/auth";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { themeMode, toggleTheme } = useAuth();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
      className={`transition-smooth ${className ?? ""}`}
      data-ocid="theme_toggle.button"
      onClick={toggleTheme}
    >
      {themeMode === "dark" ? (
        <Sun className="h-5 w-5 text-foreground/70" />
      ) : (
        <Moon className="h-5 w-5 text-foreground/70" />
      )}
    </Button>
  );
}
