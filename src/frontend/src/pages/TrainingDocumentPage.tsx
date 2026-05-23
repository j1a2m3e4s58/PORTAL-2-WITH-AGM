import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PortalCard } from "@/components/PortalCard";
import { RoleGuard } from "@/components/RoleGuard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  apiArchiveTrainingDocument,
  apiDeleteTrainingDocument,
  apiGetCachedTrainingDocuments,
  apiGetMyDocumentOpenState,
  apiGetTrainingDocument,
  apiMarkDocumentOpened,
  resolveTrainingDocumentDownloadUrl,
  resolveTrainingDocumentViewUrl,
} from "@/lib/backend-client";
import { isPageReload } from "@/lib/app-base";
import type { TrainingDocument } from "@/types";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatDate(ts: bigint): string {
  return new Date(Number(ts)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TrainingDocumentPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const docId = Number(id);
  const isReload = isPageReload();

  const [doc, setDoc] = useState<TrainingDocument | null>(() =>
    isReload
      ? null
      : apiGetCachedTrainingDocuments().find((item) => item.id === docId) ?? null,
  );
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(
    () =>
      isReload ||
      apiGetCachedTrainingDocuments().find((item) => item.id === docId) == null,
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      try {
        const [docData, state] = await Promise.all([
          apiGetTrainingDocument(docId),
          apiGetMyDocumentOpenState(docId),
        ]);
        if (cancelled) return;
        setDoc(docData);
        setOpened(state.isOpened);
        if (docData && !state.isOpened) {
          try {
            await apiMarkDocumentOpened(docId);
            if (!cancelled) setOpened(true);
          } catch {
            if (!cancelled) {
              toast.error("Document open status could not be updated.");
            }
          }
        }
      } catch {
        if (cancelled) return;
        setDoc(null);
        setOpened(false);
        toast.error("Training document could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDocument();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl">
          <SkeletonCard hasImage lines={5} />
        </div>
      </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl text-center py-16">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold text-foreground">
            Document not found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This document is unavailable or outside your access scope.
          </p>
          <Button
            type="button"
            className="mt-5"
            onClick={() => navigate({ to: "/training" })}
          >
            Back to portal
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-1 gap-1.5"
          onClick={() => navigate({ to: "/training" })}
        >
          <ArrowLeft className="h-4 w-4" />
          Training portal
        </Button>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
          <div className="space-y-5">
            <PortalCard>
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="font-display text-2xl font-bold text-foreground">
                      {doc.title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {doc.description}
                    </p>
                  </div>
                  {opened && (
                    <Badge className="bg-secondary/10 text-secondary border-secondary/20">
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      Opened
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {doc.visibility === "Department"
                      ? doc.department || "Department"
                      : "General"}
                  </Badge>
                  {doc.isMandatory && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                      Mandatory
                    </Badge>
                  )}
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {doc.category}
                  </Badge>
                </div>
              </div>
            </PortalCard>

            <div className="overflow-hidden rounded-xl border border-border/40 bg-background/60">
              <iframe
                src={resolveTrainingDocumentViewUrl(doc)}
                title={doc.title}
                className="h-[76vh] w-full border-0"
              />
            </div>
          </div>

          <div className="space-y-5">
            <PortalCard title="Document Details">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Uploaded by</span>
                  <span className="font-medium text-foreground">
                    {doc.uploadedBy}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Uploaded on</span>
                  <span className="font-medium text-foreground">
                    {formatDate(doc.uploadedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Open count</span>
                  <span className="font-medium text-foreground">
                    {doc.downloadCount}
                  </span>
                </div>
              </div>
            </PortalCard>

            <PortalCard title="Actions">
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() =>
                    window.open(
                      resolveTrainingDocumentViewUrl(doc),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in new tab
                </Button>
                {doc.allowDownload && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() =>
                      window.open(
                        resolveTrainingDocumentDownloadUrl(doc),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    Download document
                  </Button>
                )}
              </div>
            </PortalCard>

            <RoleGuard roles={["SuperAdmin", "HRAdmin"]}>
              <PortalCard title="Admin Controls">
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive className="h-4 w-4" />
                    Archive document
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete document
                  </Button>
                </div>
              </PortalCard>
            </RoleGuard>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive document"
        description={`Archive "${doc.title}" from the documents portal?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          await apiArchiveTrainingDocument(doc.id);
          toast.success(`"${doc.title}" archived`);
          navigate({ to: "/training" });
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete document"
        description={`Delete "${doc.title}" permanently?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await apiDeleteTrainingDocument(doc.id);
          toast.success(`"${doc.title}" deleted`);
          navigate({ to: "/training" });
        }}
      />
    </AppShell>
  );
}
