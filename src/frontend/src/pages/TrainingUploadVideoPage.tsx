import { AppShell } from "@/components/AppShell";
import { PortalCard } from "@/components/PortalCard";
import { RoleGuard } from "@/components/RoleGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  canManageAllDepartmentsForBranch,
  formatAudienceSummary,
  formatManageableScopeSummary,
  getManageableBranches,
  getManageableDepartmentsForBranch,
  getScopeCoverageWarning,
  apiUploadTrainingVideo,
  apiUploadTrainingVideoFile,
} from "@/lib/backend-client";
import { DEPARTMENTS } from "@/types";
import { useAuth } from "@/store/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CloudUpload,
  Info,
  Link as LinkIcon,
  Upload,
  Video,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MAX_VIDEO_UPLOAD_MB = 1024;

// ── Helper ────────────────────────────────────────────────────────────────────

function extractDriveId(input: string): string {
  const match =
    input.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ??
    input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? input.trim();
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainingUploadVideoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [storageType, setStorageType] = useState<"Drive" | "Local">("Drive");
  const [driveInput, setDriveInput] = useState("");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"General" | "Department">(
    "General",
  );
  const [branchTarget, setBranchTarget] = useState("ALL");
  const [department, setDepartment] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [allowDownload, setAllowDownload] = useState(false);
  const [sendExternalEmails, setSendExternalEmails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const manageableBranches = getManageableBranches(user);
  const canTargetAllBranches =
    user?.role === "SuperAdmin" || user?.role === "HRAdmin";
  const manageableDepartments =
    branchTarget === "ALL"
      ? [...DEPARTMENTS]
      : getManageableDepartmentsForBranch(user, branchTarget);
  useEffect(() => {
    if (!canTargetAllBranches && manageableBranches.length > 0) {
      setBranchTarget((current) => (current === "ALL" ? manageableBranches[0] : current));
    }
  }, [canTargetAllBranches, manageableBranches]);

  useEffect(() => {
    if (
      visibility === "Department" &&
      branchTarget !== "ALL" &&
      !department &&
      manageableDepartments.length > 0
    ) {
      setDepartment(manageableDepartments[0]);
      return;
    }
    if (
      visibility === "General" &&
      branchTarget !== "ALL" &&
      !canManageAllDepartmentsForBranch(user, branchTarget)
    ) {
      setVisibility("Department");
      if (manageableDepartments.length > 0) {
        setDepartment(manageableDepartments[0]);
      }
    }
  }, [branchTarget, department, manageableDepartments, user, visibility]);

  const audienceSummary = formatAudienceSummary(
    branchTarget === "ALL" ? ["ALL"] : [branchTarget],
    visibility === "Department" && department ? [department] : ["ALL"],
  );
  const scopeWarning = getScopeCoverageWarning(
    user,
    branchTarget,
    visibility === "Department" ? department : "ALL",
  );
  const actingScope = formatManageableScopeSummary(user);

  const driveId = driveInput ? extractDriveId(driveInput) : "";
  const isValid =
    title.trim().length > 0 &&
    (storageType === "Drive" ? driveId.length > 0 : localFile !== null) &&
    (visibility === "General" || department.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;
    if (
      storageType === "Local" &&
      localFile &&
      localFile.size > MAX_VIDEO_UPLOAD_MB * 1024 * 1024
    ) {
      toast.error(
        `Video is too large. Please keep uploads under ${MAX_VIDEO_UPLOAD_MB} MB.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const videoUrl =
        storageType === "Drive"
          ? `DRIVE:${driveId}`
          : `LOCAL:${(await apiUploadTrainingVideoFile(localFile as File)).filename}`;

      const result = await apiUploadTrainingVideo({
        title: title.trim(),
        description: description.trim(),
        videoUrl,
        storageType,
        visibility,
        department: visibility === "Department" ? department : undefined,
        branchScope: branchTarget === "ALL" ? ["ALL"] : [branchTarget],
        departmentScope:
          visibility === "Department" && department ? [department] : ["ALL"],
        mandatory,
        allowDownload,
        sendExternalEmails,
      });
      if ("err" in result) {
        throw new Error(result.err);
      }
      toast.success("Video uploaded successfully");
      navigate({ to: "/training" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <RoleGuard
        roles={["SuperAdmin", "HRAdmin", "Supervisor"]}
        permission="trainingVideos"
        fallback={
          <div className="text-center py-16 text-muted-foreground">
            You do not have permission to upload training videos.
          </div>
        }
      >
        <div className="max-w-2xl mx-auto space-y-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 -ml-1"
            onClick={() => navigate({ to: "/training" })}
            data-ocid="training.upload_video.back_button"
          >
            <ArrowLeft className="h-4 w-4" />
            Training Portal
          </Button>

          <div className="flex items-center gap-2 mb-2">
            <Video className="h-5 w-5 text-primary" />
            <h1 className="font-display font-bold text-xl text-foreground">
              Upload Training Video
            </h1>
          </div>
          {actingScope ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
              {actingScope}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Info */}
            <PortalCard title="Video Information" elevated>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Cybersecurity Awareness Training"
                    required
                    data-ocid="training.upload_video.title_input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this video..."
                    rows={3}
                    data-ocid="training.upload_video.description_input"
                  />
                </div>
              </div>
            </PortalCard>

            {/* Storage Type */}
            <PortalCard title="Video Source" elevated>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Storage Type *</Label>
                  <div className="flex gap-3">
                    {(["Drive", "Local"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setStorageType(type)}
                        className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-smooth ${
                          storageType === type
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border/50 hover:border-primary/30 text-muted-foreground"
                        }`}
                        data-ocid={`training.upload_video.storage_${type.toLowerCase()}_button`}
                      >
                        {type === "Drive" ? (
                          <LinkIcon className="h-5 w-5" />
                        ) : (
                          <CloudUpload className="h-5 w-5" />
                        )}
                        <span className="text-sm font-medium">
                          {type === "Drive" ? "Google Drive" : "Upload File"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {storageType === "Drive" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="driveInput">
                      Google Drive URL or File ID *
                    </Label>
                    <Input
                      id="driveInput"
                      value={driveInput}
                      onChange={(e) => setDriveInput(e.target.value)}
                      placeholder="Paste Drive URL or file ID..."
                      data-ocid="training.upload_video.drive_input"
                    />
                    {driveInput && driveId && (
                      <div className="flex items-center gap-1.5 text-xs text-secondary">
                        <Info className="h-3.5 w-3.5" />
                        Extracted ID:{" "}
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono"
                        >
                          {driveId}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="videoFile">Video File *</Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-smooth cursor-pointer ${
                        localFile
                          ? "border-secondary bg-secondary/5"
                          : "border-border/50 hover:border-primary/40"
                      }`}
                      data-ocid="training.upload_video.dropzone"
                    >
                      <input
                        id="videoFile"
                        type="file"
                        accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm"
                        className="hidden"
                        onChange={(e) =>
                          setLocalFile(e.target.files?.[0] ?? null)
                        }
                      />
                      <label
                        htmlFor="videoFile"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        {localFile ? (
                          <div className="text-center">
                            <span className="text-sm font-medium text-secondary">
                              {localFile.name}
                            </span>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatFileSize(localFile.size)}
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium text-foreground">
                              Click to select video
                            </span>
                            <span className="text-xs text-muted-foreground">
                              MP4, MOV, AVI, MKV, WebM
                            </span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </PortalCard>

            {/* Visibility */}
            <PortalCard title="Visibility &amp; Access" elevated>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Branch Audience</Label>
                  <Select value={branchTarget} onValueChange={setBranchTarget}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {canTargetAllBranches ? (
                        <SelectItem value="ALL">All branches</SelectItem>
                      ) : null}
                      {manageableBranches.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Visible To *</Label>
                  <Select
                    value={visibility}
                    onValueChange={(v) =>
                      setVisibility(v as "General" | "Department")
                    }
                  >
                    <SelectTrigger data-ocid="training.upload_video.visibility_select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="General">
                        All Staff (General)
                      </SelectItem>
                      <SelectItem value="Department">
                        Specific Department
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {visibility === "Department" && (
                  <div className="space-y-1.5">
                    <Label>Department *</Label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger data-ocid="training.upload_video.department_select">
                        <SelectValue placeholder="Select department..." />
                      </SelectTrigger>
                      <SelectContent>
                        {manageableDepartments.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="rounded-lg border border-border/40 bg-background/40 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {audienceSummary}
                  </p>
                  {scopeWarning ? (
                    <p className="mt-1 text-xs text-amber-500">{scopeWarning}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Eligible staff inside this scope will see this video and receive the normal in-app notice.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Mandatory Training
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mark as required for eligible staff
                    </div>
                  </div>
                  <Switch
                    checked={mandatory}
                    onCheckedChange={setMandatory}
                    data-ocid="training.upload_video.mandatory_switch"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Allow Download
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Let staff download this video
                    </div>
                  </div>
                  <Switch
                    checked={allowDownload}
                    onCheckedChange={setAllowDownload}
                    data-ocid="training.upload_video.download_switch"
                  />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-border/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Send external email too
                    </div>
                    <div className="text-xs text-muted-foreground">
                      In-app notifications will still go out even if this stays
                      off.
                    </div>
                  </div>
                  <Switch
                    checked={sendExternalEmails}
                    onCheckedChange={setSendExternalEmails}
                    data-ocid="training.upload_video.external_email_switch"
                  />
                </div>
              </div>
            </PortalCard>

            {/* Submit */}
            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: "/training" })}
                data-ocid="training.upload_video.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || submitting}
                className="gap-1.5"
                data-ocid="training.upload_video.submit_button"
              >
                {submitting ? (
                  "Uploading..."
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Video
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </RoleGuard>
    </AppShell>
  );
}
