import { AppShell } from "@/components/AppShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PortalCard } from "@/components/PortalCard";
import { RoleGuard } from "@/components/RoleGuard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  apiArchiveTrainingVideo,
  apiDeleteTrainingVideo,
  apiGetCachedTrainingVideos,
  apiGetMyVideoProgress,
  apiGetTrainingVideo,
  apiSendVideoTrainingReminder,
  apiUpdateTrainingProgress,
  resolveTrainingVideoDownloadUrl,
  resolveTrainingVideoEmbedUrl,
  resolveTrainingVideoOpenUrl,
} from "@/lib/backend-client";
import { isPageReload } from "@/lib/app-base";
import type { TrainingVideo } from "@/types";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  Archive,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Download,
  ExternalLink,
  PlayCircle,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function formatDate(ts: bigint): string {
  return new Date(Number(ts)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isDriveVideo(video: TrainingVideo) {
  return video.storageType !== "Local";
}

function supportsPlaybackTracking(video: TrainingVideo) {
  return video.storageType === "Local";
}

function VideoViewer({
  video,
  initialProgress,
  onProgressUpdate,
  onComplete,
}: {
  video: TrainingVideo;
  initialProgress: number;
  onProgressUpdate: (pct: number) => void;
  onComplete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportRef = useRef(0);
  const completedRef = useRef(false);
  const highestAllowedTimeRef = useRef(0);
  const isGuardSeekRef = useRef(false);
  const initialSeekAppliedRef = useRef(false);
  const lastKnownTimeRef = useRef(0);

  useEffect(() => {
    lastReportRef.current = initialProgress;
    completedRef.current = initialProgress >= 98;
    highestAllowedTimeRef.current = 0;
    isGuardSeekRef.current = false;
    initialSeekAppliedRef.current = false;
    lastKnownTimeRef.current = 0;
  }, [initialProgress]);

  const seekToAllowedTime = useCallback((targetTime: number) => {
    const element = videoRef.current;
    if (!element) return;
    isGuardSeekRef.current = true;
    element.currentTime = Math.max(0, targetTime);
    window.setTimeout(() => {
      isGuardSeekRef.current = false;
    }, 120);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const element = videoRef.current;
    if (!element || !element.duration || initialSeekAppliedRef.current) return;
    const resumeTime = Math.min(
      (initialProgress / 100) * element.duration,
      Math.max(element.duration - 1, 0),
    );
    highestAllowedTimeRef.current = resumeTime;
    lastKnownTimeRef.current = resumeTime;
    initialSeekAppliedRef.current = true;
    if (resumeTime > 0.5) {
      seekToAllowedTime(resumeTime);
    }
  }, [initialProgress, seekToAllowedTime]);

  const handleTimeUpdate = useCallback(() => {
    const element = videoRef.current;
    if (!element || !element.duration) return;
    if (isGuardSeekRef.current) {
      lastKnownTimeRef.current = element.currentTime;
      return;
    }
    highestAllowedTimeRef.current = Math.max(
      highestAllowedTimeRef.current,
      element.currentTime,
    );
    lastKnownTimeRef.current = element.currentTime;
    const pct = (element.currentTime / element.duration) * 100;
    if (pct >= 98 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
    if (pct - lastReportRef.current >= 5) {
      lastReportRef.current = pct;
      onProgressUpdate(pct);
    }
  }, [onComplete, onProgressUpdate]);

  const handleSeeking = useCallback(() => {
    const element = videoRef.current;
    if (!element || !element.duration || isGuardSeekRef.current) return;
    const allowedTime = highestAllowedTimeRef.current;
    const tolerance = 1.25;
    if (element.currentTime > allowedTime + tolerance) {
      seekToAllowedTime(Math.max(allowedTime, lastKnownTimeRef.current));
      return;
    }
    lastKnownTimeRef.current = element.currentTime;
  }, [seekToAllowedTime]);

  if (isDriveVideo(video)) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/40 bg-background/60">
        <iframe
          src={resolveTrainingVideoEmbedUrl(video)}
          title={video.title}
          className="aspect-video w-full border-0"
          allow="autoplay"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-background/60">
      <video
        ref={videoRef}
        src={resolveTrainingVideoOpenUrl(video)}
        controls
        preload="metadata"
        className="aspect-video w-full"
        onLoadedMetadata={handleLoadedMetadata}
        onSeeking={handleSeeking}
        onTimeUpdate={handleTimeUpdate}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}

export default function TrainingVideoPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const navigate = useNavigate();
  const videoId = Number(id);
  const isReload = isPageReload();

  const [video, setVideo] = useState<TrainingVideo | null>(() =>
    isReload
      ? null
      : apiGetCachedTrainingVideos().find((item) => item.id === videoId) ?? null,
  );
  const [loading, setLoading] = useState(
    () =>
      isReload ||
      apiGetCachedTrainingVideos().find((item) => item.id === videoId) == null,
  );
  const [progress, setProgress] = useState(0);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadVideo() {
      try {
        const [videoData, progressData] = await Promise.all([
          apiGetTrainingVideo(videoId),
          apiGetMyVideoProgress(videoId),
        ]);
        if (cancelled) return;
        setVideo(videoData);
        setProgress(progressData?.progressPercent ?? 0);
      } catch {
        if (cancelled) return;
        setVideo(null);
        setProgress(0);
        toast.error("Training video could not be loaded. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadVideo();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const completed = progress >= 98;
  const supportsTracking = !!video && supportsPlaybackTracking(video);

  const handleProgressUpdate = useCallback(
    async (pct: number) => {
      await apiUpdateTrainingProgress(videoId, pct);
      setProgress(pct);
    },
    [videoId],
  );

  const handleComplete = useCallback(async () => {
    await apiUpdateTrainingProgress(videoId, 100);
    setProgress(100);
    toast.success("Training marked complete.");
  }, [videoId]);

  const handleAcknowledgeDriveVideo = useCallback(async () => {
    await apiUpdateTrainingProgress(videoId, 100);
    setProgress(100);
    toast.success("Training acknowledged.");
  }, [videoId]);

  const viewerNote = useMemo(() => {
    if (!video) return "";
    return isDriveVideo(video)
      ? "This video is streamed through Google Drive preview. Google Drive does not expose reliable playback progress, so completion here uses manual acknowledgement instead of automatic watch tracking."
      : "This local upload follows the internal viewer flow and keeps progress tracking active while you watch.";
  }, [video]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl">
          <SkeletonCard hasImage lines={5} />
        </div>
      </AppShell>
    );
  }

  if (!video) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl text-center py-16">
          <PlayCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold text-foreground">
            Training video not found
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This training item is unavailable or you no longer have permission
            to view it.
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
      <div className="mx-auto max-w-6xl space-y-5">
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

        <div className="grid gap-5 xl:grid-cols-[1.5fr_.9fr]">
          <div className="space-y-5">
            <VideoViewer
              video={video}
              initialProgress={progress}
              onProgressUpdate={handleProgressUpdate}
              onComplete={handleComplete}
            />

            <PortalCard>
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h1 className="font-display text-2xl font-bold text-foreground">
                      {video.title}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {video.description}
                    </p>
                  </div>
                  <Badge
                    className={
                      completed
                        ? "bg-secondary/10 text-secondary border-secondary/20"
                        : "bg-primary/10 text-primary border-primary/20"
                    }
                  >
                    {completed
                      ? supportsTracking
                        ? "Completed"
                        : "Acknowledged"
                      : supportsTracking
                        ? "In progress"
                        : "Pending acknowledgement"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {video.visibility === "Department"
                      ? video.department || "Department"
                      : "General"}
                  </Badge>
                  {video.isMandatory && (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                      Mandatory
                    </Badge>
                  )}
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {video.category}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {supportsTracking
                        ? "Your completion progress"
                        : "Acknowledgement status"}
                    </span>
                    <span>
                      {supportsTracking
                        ? `${Math.round(progress)}%`
                        : completed
                          ? "Acknowledged"
                          : "Pending"}
                    </span>
                  </div>
                  <Progress
                    value={supportsTracking ? progress : completed ? 100 : 0}
                    className="h-2.5"
                  />
                  {completed && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-secondary">
                      <CheckCircle2 className="h-4 w-4" />
                      {supportsTracking
                        ? "You have completed this training video."
                        : "You have acknowledged this training video."}
                    </div>
                  )}
                  {!supportsTracking && !completed && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                      Because this video is hosted on Google Drive, the portal cannot
                      measure real playback completion. Use the acknowledgement button
                      below after you finish watching it.
                    </div>
                  )}
                </div>
              </div>
            </PortalCard>
          </div>

          <div className="space-y-5">
            <PortalCard
              title="Training Details"
              subtitle="Structured from the original training view flow."
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Uploaded by</span>
                  <span className="font-medium text-foreground">
                    {video.uploadedBy}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Uploaded on</span>
                  <span className="font-medium text-foreground">
                    {formatDate(video.uploadedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Eligible audience
                  </span>
                  <span className="font-medium text-foreground">
                    {video.visibility === "Department"
                      ? video.department || "Department"
                      : "All staff"}
                  </span>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/50 p-3 text-xs leading-6 text-muted-foreground">
                  {viewerNote}
                </div>
              </div>
            </PortalCard>

            <PortalCard title="Actions">
              <div className="space-y-2">
                {!supportsTracking && (
                  <Button
                    type="button"
                    className="w-full justify-start gap-2"
                    onClick={handleAcknowledgeDriveVideo}
                    disabled={completed}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completed ? "Training acknowledged" : "Acknowledge after watching"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() =>
                    window.open(
                      resolveTrainingVideoOpenUrl(video),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in full view
                </Button>
                {video.allowDownload && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() =>
                      window.open(
                        resolveTrainingVideoDownloadUrl(video),
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    <Download className="h-4 w-4" />
                    Download video
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
                    onClick={() => setReminderOpen(true)}
                  >
                    <Bell className="h-4 w-4" />
                    Send reminder
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setArchiveOpen(true)}
                  >
                    <Archive className="h-4 w-4" />
                    Archive video
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete video
                  </Button>
                </div>
              </PortalCard>
            </RoleGuard>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        title="Send reminder"
        description={`Send a reminder for "${video.title}" to staff who have not completed it yet?`}
        confirmLabel="Send Reminder"
        onConfirm={async () => {
          await apiSendVideoTrainingReminder(video.id);
          toast.success("Reminder sent.");
          setReminderOpen(false);
        }}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive video"
        description={`Archive "${video.title}" from the training portal?`}
        confirmLabel="Archive"
        onConfirm={async () => {
          await apiArchiveTrainingVideo(video.id);
          toast.success(`"${video.title}" archived`);
          navigate({ to: "/training" });
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete video"
        description={`Delete "${video.title}" permanently?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await apiDeleteTrainingVideo(video.id);
          toast.success(`"${video.title}" deleted`);
          navigate({ to: "/training" });
        }}
      />
    </AppShell>
  );
}
