import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgmYear } from "@/context/AgmYearContext";
import { useRecordAuditEvent } from "@/hooks/use-backend";
import { useAuth } from "@/hooks/use-auth";

export function AgmYearSwitcher({
  title = "AGM Year",
  compact = false,
}: {
  title?: string;
  compact?: boolean;
}) {
  const { activeYear, setActiveYear, yearOptions } = useAgmYear();
  const { user } = useAuth();
  const recordAuditEvent = useRecordAuditEvent();

  const handleYearChange = (year: string) => {
    if (year === activeYear) return;
    setActiveYear(year);
    if (user) {
      void recordAuditEvent.mutateAsync({
        action: "SWITCH_AGM_YEAR",
        entityType: "agmYear",
        entityId: year,
        details: `Switched active AGM year from ${activeYear} to ${year}`,
      });
    }
  };

  return (
    <div className={compact ? "min-w-[104px]" : "min-w-[150px]"}>
      <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </Label>
      <Select value={activeYear} onValueChange={handleYearChange}>
        <SelectTrigger
          data-ocid="agm_year.global_select"
          className={compact ? "h-11 px-3 font-medium" : "h-11 px-3.5 font-medium"}
        >
          <SelectValue placeholder="Select AGM year" />
        </SelectTrigger>
        <SelectContent className="max-h-72 min-w-[104px]">
          {yearOptions.map((year) => (
            <SelectItem key={year} value={year}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
