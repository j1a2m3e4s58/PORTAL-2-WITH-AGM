import { withBase } from "@/lib/app-base";

const BRAND_LOGO = withBase("assets/images/bcb-logo.png");

interface BrandLoaderProps {
  label?: string;
  fullscreen?: boolean;
  compact?: boolean;
}

export function BrandLoader({
  label = "Loading...",
  fullscreen = false,
  compact = false,
}: BrandLoaderProps) {
  return (
    <div
      className={
        fullscreen
          ? "min-h-screen bg-background flex items-center justify-center px-6"
          : "w-full flex items-center justify-center px-6 py-12"
      }
      data-ocid="brand_loader"
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div
          className={`brand-loader__shell ${compact ? "brand-loader__shell--compact" : ""}`}
        >
          <span className="brand-loader__ring brand-loader__ring--outer" />
          <span className="brand-loader__ring brand-loader__ring--inner" />
          <img
            src={BRAND_LOGO}
            alt="BCB Staff Portal"
            className="brand-loader__logo"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">
            BCB Staff Portal
          </p>
        </div>
      </div>
    </div>
  );
}
