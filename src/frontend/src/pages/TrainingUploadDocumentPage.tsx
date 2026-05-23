import { AppShell } from "@/components/AppShell";
import { PortalCard } from "@/components/PortalCard";
import { RoleGuard } from "@/components/RoleGuard";
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
  apiUploadTrainingDocument,
  apiUploadTrainingDocumentFile,
} from "@/lib/backend-client";
import { DEPARTMENTS } from "@/types";
import { useAuth } from "@/store/auth";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  BookOpen,
  CloudUpload,
  Link as LinkIcon,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const MAX_DOCUMENT_UPLOAD_MB = 100;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrainingUploadDocumentPage() {
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
  const [allowDownload, setAllowDownload] = useState(true);
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

  const isValid =
    title.trim().length > 0 &&
    (storageType === "Drive"
      ? driveInput.trim().length > 0
      : localFile !== null) &&
    (visibility === "General" || department.length > 0);

  function formatFileSize(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileType(file: File): string {
    if (file.type) return file.type;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    return map[ext] ?? "application/octet-stream";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;
    if (
      storageType === "Local" &&
      localFile &&
      localFile.size > MAX_DOCUMENT_UPLOAD_MB * 1024 * 1024
    ) {
      toast.error(
        `Document is too large. Please keep uploads under ${MAX_DOCUMENT_UPLOAD_MB} MB.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const fileUrl =
        storageType === "Drive"
          ? `DRIVE:${driveInput.trim()}`
          : `LOCAL:${(await apiUploadTrainingDocumentFile(localFile as File)).filename}`;
      const fileType =
        storageType === "Local" && localFile ? getFileType(localFile) : "drive";

      const result = await apiUploadTrainingDocument({
        title: title.trim(),
        description: description.trim(),
        fileUrl,
        fileType,
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
      const { delivery } = result.ok;
      if (sendExternalEmails && delivery.emailsFailed > 0) {
        toast.warning(
          `Document uploaded, but ${delivery.emailsFailed} external email${delivery.emailsFailed === 1 ? "" : "s"} failed. In-app notifications still went out.`,
        );
      } else if (sendExternalEmails && delivery.emailsAttempted === 0) {
        toast.warning(
          "Document uploaded, but no external emails were attempted for the eligible staff audience.",
        );
      } else {
        toast.success("Document uploaded successfully");
      }
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
        permission="trainingDocuments"
        fallback={
          <div className="text-center py-16 text-muted-foreground">
            You do not have permission to upload training documents.
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
            data-ocid="training.upload_doc.back_button"
          >
            <ArrowLeft className="h-4 w-4" />
            Training Portal
          </Button>

          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="font-display font-bold text-xl text-foreground">
              Upload Training Document
            </h1>
          </div>
          {actingScope ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
              {actingScope}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic Info */}
            <PortalCard title="Document Information" elevated>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-title">Title *</Label>
                  <Input
                    id="doc-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Anti-Money Laundering Policy 2026"
                    required
                    data-ocid="training.upload_doc.title_input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-description">Description</Label>
                  <Textarea
                    id="doc-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this document..."
                    rows={3}
                    data-ocid="training.upload_doc.description_input"
                  />
                </div>
              </div>
            </PortalCard>

            {/* Storage */}
            <PortalCard title="Document Source" elevated>
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
                        data-ocid={`training.upload_doc.storage_${type.toLowerCase()}_button`}
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
                    <Label htmlFor="drive-url">
                      Google Drive URL or File ID *
                    </Label>
                    <Input
                      id="drive-url"
                      value={driveInput}
                      onChange={(e) => setDriveInput(e.target.value)}
                      placeholder="Paste Drive URL or file ID..."
                      data-ocid="training.upload_doc.drive_input"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-file">Document File *</Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-smooth ${
                        localFile
                          ? "border-secondary bg-secondary/5"
                          : "border-border/50 hover:border-primary/40"
                      }`}
                      data-ocid="training.upload_doc.dropzone"
                    >
                      <input
                        id="doc-file"
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) =>
                          setLocalFile(e.target.files?.[0] ?? null)
                        }
                      />
                      <label
                        htmlFor="doc-file"
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
                              Click to select document
                            </span>
                            <span className="text-xs text-muted-foreground">
                              PDF, Word, Excel, PowerPoint
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
                    <SelectTrigger data-ocid="training.upload_doc.visibility_select">
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
                      <SelectTrigger data-ocid="training.upload_doc.department_select">
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
                      Only staff inside this branch and department scope will see this document.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Mandatory Reading
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Mark as required for eligible staff
                    </div>
                  </div>
                  <Switch
                    checked={mandatory}
                    onCheckedChange={setMandatory}
                    data-ocid="training.upload_doc.mandatory_switch"
                  />
                </div>

                <div className="flex items-center justify-between py-2 border-t border-border/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Allow Download
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Let staff download this document
                    </div>
                  </div>
                  <Switch
                    checked={allowDownload}
                    onCheckedChange={setAllowDownload}
                    data-ocid="training.upload_doc.download_switch"
                  />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-border/30">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Send external email too
                    </div>
                    <div className="text-xs text-muted-foreground">
                      In-app notifications will still be sent automatically.
                    </div>
                  </div>
                  <Switch
                    checked={sendExternalEmails}
                    onCheckedChange={setSendExternalEmails}
                    data-ocid="training.upload_doc.external_email_switch"
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
                data-ocid="training.upload_doc.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || submitting}
                className="gap-1.5"
                data-ocid="training.upload_doc.submit_button"
              >
                {submitting ? (
                  "Uploading..."
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Document
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
