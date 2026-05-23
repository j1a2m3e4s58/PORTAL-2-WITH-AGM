import { Layout } from "@/components/Layout";
import { AgmYearSwitcher } from "@/components/AgmYearSwitcher";
import { useAgmYear } from "@/context/AgmYearContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAllCheckIns,
  useAllRegistrations,
  useAllShareholders,
  useRecordAuditEvent,
  useSettings,
  RegistrationType,
} from "@/hooks/use-backend";
import {
  filterCheckInsByRegistrations,
  filterRegistrationsByYear,
} from "@/lib/agm-year";
import type {
  AGMSettings,
  CheckIn,
  DashboardMetrics,
  Registration,
  Shareholder,
} from "@/types";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  MapPin,
  Search,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(nanoTs: bigint): string {
  const ms = Number(nanoTs / BigInt(1_000_000));
  const diff = Date.now() - ms;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ms).toLocaleDateString();
}

function exportSnapshotCSV(
  metrics: DashboardMetrics,
  settings: AGMSettings | undefined,
  activeYear: string,
) {
  const rows = [
    ["Metric", "Value"],
    ["AGM Year", activeYear],
    ["AGM Name", settings?.agmName ?? ""],
    ["AGM Date", settings?.agmDate ?? ""],
    ["Venue", settings?.venue ?? ""],
    ["Total Shareholders", metrics.totalShareholders.toString()],
    ["Registered", metrics.registered.toString()],
    ["Registered In-Person", metrics.registeredInPerson.toString()],
    ["Registered Proxy", metrics.registeredProxy.toString()],
    ["Checked In", metrics.checkedIn.toString()],
    ["Not Registered", metrics.notRegistered.toString()],
    ["Attendance Rate (%)", (metrics.attendanceRate * 100).toFixed(1)],
    ["Quorum Reached", metrics.quorumStatus ? "Yes" : "No"],
    [
      "Required Quorum (%)",
      settings ? settings.quorumThreshold.toString() : "",
    ],
    ["Snapshot Taken", new Date().toISOString()],
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agm-${activeYear}-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type AttendeeRecord = {
  id: string;
  attendeeName: string;
  attendeeType: "In Person" | "Proxy";
  shareholderName: string;
  shareholderNumber: string;
  contact: string;
  verificationCode: string;
  registeredAt: bigint;
  status: "Registered";
};

function formatTimestamp(value: bigint): string {
  return new Date(Number(value) / 1_000_000).toLocaleString();
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadXlsx(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendees");
  XLSX.writeFile(workbook, filename);
}

async function downloadPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: string[][],
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF } = await import("jspdf" as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: autoTable } = await import("jspdf-autotable" as any);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
  });
  doc.save(filename);
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function mixHex(color: string, target: string, weight: number) {
  const normalizedWeight = Math.min(Math.max(weight, 0), 1);
  const parse = (value: string) =>
    value.match(/[a-f0-9]{2}/gi)?.map((part) => Number.parseInt(part, 16)) ?? [
      0, 0, 0,
    ];
  const [r1, g1, b1] = parse(color);
  const [r2, g2, b2] = parse(target);
  const mix = (a: number, b: number) =>
    Math.round(a + (b - a) * normalizedWeight)
      .toString(16)
      .padStart(2, "0");

  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}

function DonutChart({
  segments,
  total,
}: { segments: DonutSegment[]; total: number }) {
  const nonZeroSegments = segments.filter((segment) => segment.value > 0);
  const gradient =
    total > 0 && nonZeroSegments.length > 0
      ? `conic-gradient(from -90deg, ${nonZeroSegments
          .map((segment, index) => {
            const start =
              nonZeroSegments
                .slice(0, index)
                .reduce((sum, item) => sum + item.value, 0) / total;
            const end =
              nonZeroSegments
                .slice(0, index + 1)
                .reduce((sum, item) => sum + item.value, 0) / total;
            return `${segment.color} ${Math.round(start * 1000) / 10}% ${Math.round(end * 1000) / 10}%`;
          })
          .join(", ")})`
      : "conic-gradient(from -90deg, #AEB4AF 0% 100%)";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative flex h-[136px] w-[136px] flex-shrink-0 items-center justify-center">
        <div
          className="h-[136px] w-[136px] rounded-full border border-white/10 shadow-[0_16px_40px_rgba(8,12,24,0.28)]"
          aria-hidden="true"
          style={{ background: gradient }}
        />
        <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full border border-border/70 bg-card">
          <span className="text-[22px] font-bold font-display text-foreground">
            {total.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-semibold text-foreground tabular-nums pl-3">
              {s.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stats3DChart({
  segments,
  total,
}: { segments: DonutSegment[]; total: number }) {
  const maxValue = Math.max(...segments.map((segment) => segment.value), 1);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 overflow-x-auto pb-2">
        {segments.map((segment, index) => {
          const height = Math.max(24, (segment.value / maxValue) * 180);
          const topColor = mixHex(segment.color, "#ffffff", 0.22);
          const frontBottomColor = mixHex(segment.color, "#000000", 0.18);
          const sideColor = mixHex(segment.color, "#000000", 0.34);
          return (
            <div
              key={segment.label}
              className="chart-rise min-w-[72px] flex flex-col items-center gap-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="text-center">
                <p className="text-lg font-display font-bold text-foreground tabular-nums">
                  {segment.value.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {segment.label}
                </p>
              </div>
              <div className="relative flex h-[210px] items-end">
                <div className="relative w-14" style={{ height }}>
                  <div
                    className="absolute inset-0 border border-white/10 shadow-[0_20px_40px_rgba(4,16,32,0.3)]"
                    style={{
                      background: `linear-gradient(180deg, ${segment.color} 0%, ${frontBottomColor} 100%)`,
                      transform: "perspective(240px) rotateX(10deg)",
                      transformOrigin: "bottom center",
                    }}
                  />
                  <div
                    className="absolute -top-2 left-0 right-0 h-4 border border-white/15"
                    style={{
                      background: `linear-gradient(180deg, ${topColor} 0%, ${segment.color} 100%)`,
                      transform: "skewX(-45deg)",
                    }}
                  />
                  <div
                    className="absolute top-0 -right-2 h-full w-4 border border-white/10"
                    style={{
                      background: `linear-gradient(180deg, ${sideColor} 0%, ${mixHex(sideColor, "#000000", 0.2)} 100%)`,
                      transform: "skewY(-45deg)",
                      transformOrigin: "left top",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total Shareholders
            </p>
            <p className="text-2xl font-display font-bold text-foreground">
              {total.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Leading Category
            </p>
            <p className="text-sm font-semibold text-foreground">
              {[...segments].sort((a, b) => b.value - a.value)[0]?.label ?? "N/A"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  valueColor = "text-foreground",
  ocid,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  valueColor?: string;
  ocid: string;
}) {
  return (
    <Card className="border-border/60" data-ocid={ocid}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <p
            className={`text-2xl font-display font-bold tabular-nums ${valueColor}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

function QuickAction({
  to,
  icon: Icon,
  label,
  ocid,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  ocid: string;
}) {
  return (
    <Link
      to={to}
      data-ocid={ocid}
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-smooth group min-h-[80px] justify-center"
    >
      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-smooth">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground text-center leading-tight">
        {label}
      </span>
    </Link>
  );
}

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({ checkIn, index }: { checkIn: CheckIn; index: number }) {
  return (
    <div
      data-ocid={`dashboard.activity.item.${index}`}
      className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0"
    >
      <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
        <UserCheck className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          Shareholder checked in
        </p>
        <p className="text-xs text-muted-foreground">
          ID: {checkIn.shareholderId.slice(0, 8)}… via{" "}
          {checkIn.method
            .replace("ManualQuick", "Quick")
            .replace("QRScan", "QR Scan")}
        </p>
      </div>
      <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {timeAgo(checkIn.checkedInAt)}
      </span>
    </div>
  );
}

function AttendeesPanel({
  shareholders,
  registrations,
  activeYear,
}: {
  shareholders: Shareholder[];
  registrations: Registration[];
  activeYear: string;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "in-person" | "proxy">(
    "all",
  );
  const [sortBy, setSortBy] = useState<
    "latest" | "name" | "shareholder" | "type"
  >("latest");

  const attendeeRecords = useMemo<AttendeeRecord[]>(() => {
    const shareholderMap = new Map(shareholders.map((item) => [item.id, item]));
    return registrations
      .map((registration) => {
        const shareholder = shareholderMap.get(registration.shareholderId);
        if (!shareholder) return null;
        const isProxy = registration.registrationType === RegistrationType.Proxy;
        return {
          id: registration.id,
          attendeeName: isProxy
            ? (registration.proxyName ?? "Proxy Representative")
            : shareholder.fullName,
          attendeeType: isProxy ? "Proxy" : "In Person",
          shareholderName: shareholder.fullName,
          shareholderNumber: shareholder.shareholderNumber,
          contact: isProxy
            ? (registration.proxyContact ?? "—")
            : (shareholder.phone ?? shareholder.email ?? "—"),
          verificationCode: registration.verificationCode,
          registeredAt: registration.registeredAt,
          status: "Registered",
        } satisfies AttendeeRecord;
      })
      .filter((item): item is AttendeeRecord => item !== null);
  }, [registrations, shareholders]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const nextRecords = attendeeRecords.filter((item) => {
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "in-person" && item.attendeeType === "In Person") ||
        (typeFilter === "proxy" && item.attendeeType === "Proxy");
      const matchesSearch =
        !normalizedSearch ||
        item.attendeeName.toLowerCase().includes(normalizedSearch) ||
        item.shareholderName.toLowerCase().includes(normalizedSearch) ||
        item.shareholderNumber.toLowerCase().includes(normalizedSearch) ||
        item.contact.toLowerCase().includes(normalizedSearch) ||
        item.verificationCode.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });

    return [...nextRecords].sort((left, right) => {
      switch (sortBy) {
        case "name":
          return left.attendeeName.localeCompare(right.attendeeName);
        case "shareholder":
          return left.shareholderName.localeCompare(right.shareholderName);
        case "type":
          return left.attendeeType.localeCompare(right.attendeeType);
        case "latest":
        default:
          return Number(right.registeredAt - left.registeredAt);
      }
    });
  }, [attendeeRecords, search, sortBy, typeFilter]);

  const stats = useMemo(() => {
    const total = attendeeRecords.length;
    const proxies = attendeeRecords.filter(
      (item) => item.attendeeType === "Proxy",
    ).length;
    const inPerson = attendeeRecords.filter(
      (item) => item.attendeeType === "In Person",
    ).length;
    return {
      total,
      proxies,
      inPerson,
      pending: Math.max(shareholders.length - total, 0),
    };
  }, [attendeeRecords, shareholders.length]);

  const exportHeaders = [
    "Attendee Name",
    "Attendee Type",
    "Shareholder Name",
    "Shareholder Number",
    "Contact",
    "Verification Code",
    "Registered At",
    "Status",
  ];

  const exportRows = filteredRecords.map((item) => [
    item.attendeeName,
    item.attendeeType,
    item.shareholderName,
    item.shareholderNumber,
    item.contact,
    item.verificationCode,
    formatTimestamp(item.registeredAt),
    item.status,
  ]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Registered Attendees
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Total Attendees"
            value={stats.total.toLocaleString()}
            icon={Users}
            ocid="dashboard.attendees.total"
          />
          <MetricCard
            label="In Person"
            value={stats.inPerson.toLocaleString()}
            icon={UserCheck}
            valueColor="text-primary"
            ocid="dashboard.attendees.in_person"
          />
          <MetricCard
            label="Proxies"
            value={stats.proxies.toLocaleString()}
            icon={ClipboardList}
            valueColor="text-primary"
            ocid="dashboard.attendees.proxies"
          />
          <MetricCard
            label="Pending"
            value={stats.pending.toLocaleString()}
            icon={UserX}
            valueColor="text-accent"
            ocid="dashboard.attendees.pending"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search attendee, shareholder, phone, or code"
              className="pl-9 min-h-[44px]"
              data-ocid="dashboard.attendees.search_input"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value) =>
              setTypeFilter(value as "all" | "in-person" | "proxy")
            }
          >
            <SelectTrigger
              className="w-full min-h-[44px]"
              data-ocid="dashboard.attendees.filter_select"
            >
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All attendees</SelectItem>
              <SelectItem value="in-person">In person</SelectItem>
              <SelectItem value="proxy">Proxy</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(value) =>
              setSortBy(value as "latest" | "name" | "shareholder" | "type")
            }
          >
            <SelectTrigger
              className="w-full min-h-[44px]"
              data-ocid="dashboard.attendees.sort_select"
            >
              <SelectValue placeholder="Sort records" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest first</SelectItem>
              <SelectItem value="name">Attendee name</SelectItem>
              <SelectItem value="shareholder">Shareholder name</SelectItem>
              <SelectItem value="type">Attendee type</SelectItem>
            </SelectContent>
          </Select>
          <Tabs defaultValue="csv" className="gap-0 sm:col-span-2 lg:col-span-1">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto">
              <TabsTrigger
                value="csv"
                onClick={() =>
                  downloadCsv(
                    `agm-${activeYear}-dashboard-attendees-${Date.now()}.csv`,
                    exportHeaders,
                    exportRows,
                  )
                }
                data-ocid="dashboard.attendees.export_csv"
              >
                <FileText className="w-4 h-4" />
                CSV
              </TabsTrigger>
              <TabsTrigger
                value="xlsx"
                onClick={() =>
                  void downloadXlsx(
                    `agm-${activeYear}-dashboard-attendees-${Date.now()}.xlsx`,
                    exportHeaders,
                    exportRows,
                  )
                }
                data-ocid="dashboard.attendees.export_xlsx"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </TabsTrigger>
              <TabsTrigger
                value="pdf"
                onClick={() =>
                  void downloadPdf(
                    `agm-${activeYear}-dashboard-attendees-${Date.now()}.pdf`,
                    `Registered Attendees — AGM ${activeYear}`,
                    exportHeaders,
                    exportRows,
                  )
                }
                data-ocid="dashboard.attendees.export_pdf"
              >
                <Download className="w-4 h-4" />
                PDF
              </TabsTrigger>
            </TabsList>
            <TabsContent value="csv" className="hidden" />
            <TabsContent value="xlsx" className="hidden" />
            <TabsContent value="pdf" className="hidden" />
          </Tabs>
        </div>

        <div className="md:hidden space-y-3">
          {filteredRecords.length === 0 ? (
            <div
              className="rounded-xl border border-border px-4 py-10 text-center text-sm text-muted-foreground"
              data-ocid="dashboard.attendees.empty_state"
            >
              No registered attendees match the current search or filters.
            </div>
          ) : (
            filteredRecords.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card p-4 space-y-3"
                data-ocid={`dashboard.attendees.item.${index + 1}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {item.attendeeName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.shareholderName} · #{item.shareholderNumber}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {item.attendeeType}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Contact
                    </p>
                    <p className="text-foreground break-words">{item.contact}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Verification Code
                    </p>
                    <p className="font-mono text-xs text-primary break-all">
                      {item.verificationCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Registered At
                    </p>
                    <p className="text-muted-foreground">
                      {formatTimestamp(item.registeredAt)}
                    </p>
                  </div>
                </div>
                <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs">
                  {item.status}
                </Badge>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block rounded-xl border border-border overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Attendee
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Shareholder
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Contact
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Verification Code
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Registered At
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-muted-foreground"
                    data-ocid="dashboard.attendees.empty_state"
                  >
                    No registered attendees match the current search or filters.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, index) => (
                  <tr
                    key={item.id}
                    className="border-t border-border/50 hover:bg-muted/20 transition-colors"
                    data-ocid={`dashboard.attendees.item.${index + 1}`}
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">
                        {item.attendeeName}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-xs">
                        {item.attendeeType}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-foreground">
                        {item.shareholderName}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        #{item.shareholderNumber}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {item.contact}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-primary">
                      {item.verificationCode}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatTimestamp(item.registeredAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs">
                        {item.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: settings } = useSettings();
  const { activeYear } = useAgmYear();
  const recordAuditEvent = useRecordAuditEvent();

  // Override refetchInterval for checkins to 5s
  const { data: checkIns } = useAllCheckIns();
  const { data: shareholders = [] } = useAllShareholders();
  const { data: registrations = [] } = useAllRegistrations();
  const registrationsForYear = filterRegistrationsByYear(registrations, activeYear);
  const checkInsForYear = filterCheckInsByRegistrations(checkIns ?? [], registrationsForYear);

  const recentActivity = useMemo(() => {
    if (!checkInsForYear) return [];
    return [...checkInsForYear]
      .sort((a, b) => Number(b.checkedInAt - a.checkedInAt))
      .slice(0, 10);
  }, [checkInsForYear]);

  const derivedMetrics = useMemo<DashboardMetrics>(() => {
    const registeredInPerson = registrationsForYear.filter(
      (item) => item.registrationType === RegistrationType.InPerson,
    ).length;
    const registeredProxy = registrationsForYear.filter(
      (item) => item.registrationType === RegistrationType.Proxy,
    ).length;
    const checkedInCount = checkInsForYear.length;
    const totalShareholders = shareholders.length;
    const registered = registrationsForYear.length;
    const notRegistered = Math.max(totalShareholders - registered, 0);
    const nextAttendanceRate =
      totalShareholders > 0 ? checkedInCount / totalShareholders : 0;
    const quorumTarget = settings ? Number(settings.quorumThreshold) / 100 : 0.5;

    return {
      totalShareholders: BigInt(totalShareholders),
      registered: BigInt(registered),
      registeredInPerson: BigInt(registeredInPerson),
      registeredProxy: BigInt(registeredProxy),
      checkedIn: BigInt(checkedInCount),
      notRegistered: BigInt(notRegistered),
      attendanceRate: nextAttendanceRate,
      quorumStatus: nextAttendanceRate >= quorumTarget,
      generatedAt: BigInt(Date.now()) * BigInt(1_000_000),
      lastUpdated: BigInt(Date.now()) * BigInt(1_000_000),
    };
  }, [checkInsForYear, registrationsForYear, settings, shareholders]);

  const displayMetrics = derivedMetrics;

  const attendanceRate = useMemo(() => {
    return displayMetrics.attendanceRate * 100;
  }, [displayMetrics]);

  const quorumPct = useMemo(() => {
    return settings ? Number(settings.quorumThreshold) : 50;
  }, [settings]);

  const donutSegments: DonutSegment[] = useMemo(
    () => [
      {
        label: "In Person",
        value: Number(displayMetrics.registeredInPerson),
        color: "#22C55E",
      },
      {
        label: "Proxy",
        value: Number(displayMetrics.registeredProxy),
        color: "#D4A72C",
      },
      {
        label: "Checked In",
        value: Number(displayMetrics.checkedIn),
        color: "#F87171",
      },
      {
        label: "Not Registered",
        value: Number(displayMetrics.notRegistered),
        color: "#AEB4AF",
      },
    ],
    [displayMetrics],
  );

  const handleExport = useCallback(() => {
    exportSnapshotCSV(displayMetrics, settings, activeYear);
    void recordAuditEvent.mutateAsync({
      action: "EXPORT_REPORT",
      entityType: "dashboard",
      entityId: activeYear,
      details: `Exported dashboard snapshot for AGM ${activeYear}`,
    });
  }, [activeYear, displayMetrics, recordAuditEvent, settings]);

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto" data-ocid="dashboard.page">
        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live attendance metrics and analytics for AGM {activeYear}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <AgmYearSwitcher compact />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              data-ocid="dashboard.export_button"
              className="gap-2 min-h-[44px] w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              Export Snapshot
            </Button>
          </div>
        </div>

        {/* Quorum Banner */}
        <QuorumBanner
          metrics={displayMetrics}
          quorumPct={quorumPct}
          attendanceRate={attendanceRate}
        />

        {/* Metric Cards */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          data-ocid="dashboard.metrics.section"
        >
          <MetricCard
            label="Total Shareholders"
            value={
              Number(displayMetrics.totalShareholders).toLocaleString()
            }
            icon={Users}
            ocid="dashboard.metric.total"
          />
          <MetricCard
            label="Registered"
            value={Number(displayMetrics.registered).toLocaleString()}
            icon={ClipboardList}
            valueColor="text-primary"
            ocid="dashboard.metric.registered"
          />
          <MetricCard
            label="Checked In"
            value={Number(displayMetrics.checkedIn).toLocaleString()}
            icon={CheckCircle2}
            valueColor="text-primary"
            ocid="dashboard.metric.checkedin"
          />
          <MetricCard
            label="Pending"
            value={
              Number(displayMetrics.notRegistered).toLocaleString()
            }
            icon={UserX}
            valueColor="text-accent"
            ocid="dashboard.metric.pending"
          />
        </div>

        {/* Charts + AGM Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Donut chart */}
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Attendance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="space-y-6">
                <Stats3DChart
                  segments={donutSegments}
                  total={Number(displayMetrics.totalShareholders)}
                />
                <DonutChart
                  segments={donutSegments}
                  total={Number(displayMetrics.totalShareholders)}
                />
              </div>

              {/* Attendance rate bar */}
              <div className="mt-6 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Attendance Rate</span>
                  <span className="font-semibold text-foreground">
                    {attendanceRate.toFixed(1)}%
                  </span>
                </div>
                <div
                  className="h-2.5 bg-muted overflow-hidden"
                  data-ocid="dashboard.attendance_bar"
                >
                  <div
                    className="h-full bg-primary transition-smooth"
                    style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AGM Info Card */}
          <AGMInfoCard settings={settings} />
        </div>

        {/* Recent Activity + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Activity Feed */}
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Recent Activity
                <Badge variant="secondary" className="ml-auto text-xs">
                  Auto-refreshes
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent data-ocid="dashboard.activity.list">
              {checkInsForYear.length === 0 ? (
                <div
                  data-ocid="dashboard.activity.empty_state"
                  className="flex flex-col items-center justify-center py-8 text-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <UserCheck className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No registrations for AGM {activeYear} yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activity will appear here once shareholders are registered in this AGM year
                  </p>
                </div>
              ) : (
                <div>
                  {recentActivity.map((ci, i) => (
                    <ActivityItem key={ci.id} checkIn={ci} index={i + 1} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="grid grid-cols-2 gap-2"
                data-ocid="dashboard.quick_actions.section"
              >
                <QuickAction
                  to="/registration"
                  icon={UserPlus}
                  label="Register Shareholder"
                  ocid="dashboard.register.button"
                />
                <QuickAction
                  to="/shareholders"
                  icon={Users}
                  label="View Registered List"
                  ocid="dashboard.shareholders.button"
                />
                <QuickAction
                  to="/import"
                  icon={Upload}
                  label="Import Shareholders"
                  ocid="dashboard.import.button"
                />
                <QuickAction
                  to="/reports"
                  icon={FileBarChart2}
                  label="View Reports"
                  ocid="dashboard.reports.button"
                />
              </div>
            </CardContent>
          </Card>
        </div>

            <AttendeesPanel
              shareholders={shareholders}
              registrations={registrationsForYear}
              activeYear={activeYear}
            />
      </div>
    </Layout>
  );
}

// ─── Quorum Banner ────────────────────────────────────────────────────────────

function QuorumBanner({
  metrics,
  quorumPct,
  attendanceRate,
}: {
  metrics: DashboardMetrics | undefined;
  quorumPct: number;
  attendanceRate: number;
}) {
  const reached = metrics?.quorumStatus ?? false;

  return (
    <div
      data-ocid="dashboard.quorum.banner"
      className="sea-shell sea-outline surface-highlight border border-border/60 px-5 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div
        className={`w-10 h-10 flex items-center justify-center flex-shrink-0 border ${
          reached
            ? "bg-primary/12 border-primary/30"
            : "bg-muted/50 border-border/70"
        }`}
      >
        {reached ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`font-display font-bold text-base ${
            reached ? "text-primary" : "text-foreground"
          }`}
        >
          Quorum Status: {reached ? "✓ REACHED" : "NOT YET REACHED"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Attendance:{" "}
          <span className="font-semibold text-foreground">
            {attendanceRate.toFixed(1)}%
          </span>{" "}
          &nbsp;·&nbsp; Required:{" "}
          <span className="font-semibold text-foreground">{quorumPct}%</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="h-2 w-36 bg-muted overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(attendanceRate, 100)}%` }}
            />
          </div>
        <p className="text-xs text-muted-foreground">
          Threshold at {quorumPct}%
        </p>
      </div>
    </div>
  );
}

// ─── AGM Info Card ────────────────────────────────────────────────────────────

function AGMInfoCard({
  settings,
}: {
  settings: AGMSettings | undefined;
}) {
  return (
    <Card className="border-border/60" data-ocid="dashboard.agm_info.card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          AGM Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!settings || !settings.agmName ? (
          <div
            data-ocid="dashboard.agm_info.empty_state"
            className="flex flex-col items-center text-center py-6 gap-2"
          >
            <AlertTriangle className="w-8 h-8 text-accent" />
            <p className="text-sm font-medium text-foreground">
              AGM not configured
            </p>
            <p className="text-xs text-muted-foreground">
              Go to Admin settings to configure AGM details
            </p>
            <Link
              to="/admin"
              data-ocid="dashboard.agm_info.configure_link"
              className="mt-2 text-xs text-primary hover:underline font-medium"
            >
              Configure now →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                AGM Name
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5 leading-tight">
                {settings.agmName}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm text-foreground font-medium">
                  {settings.agmDate || "Not set"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Venue</p>
                <p className="text-sm text-foreground font-medium">
                  {settings.venue || "Not set"}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-border/40">
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Quorum Threshold
                </p>
                <Badge variant="outline" className="text-xs">
                  {settings.quorumThreshold.toString()}%
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
