// Local shim for @caffeineai/qr-code
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface QRResult {
  data: string;
  timestamp: number;
}

export interface QRScannerConfig {
  facingMode?: "user" | "environment";
  scanInterval?: number;
  maxResults?: number;
  jsQRUrl?: string;
}

export interface UseQRScannerReturn {
  qrResults: QRResult[];
  isScanning: boolean;
  jsQRLoaded: boolean;
  isActive: boolean;
  isSupported: boolean | null;
  error: { message: string } | null;
  isLoading: boolean;
  currentFacingMode: "user" | "environment";
  startScanning: () => Promise<boolean>;
  stopScanning: () => Promise<void>;
  switchCamera: () => Promise<boolean>;
  clearResults: () => void;
  reset: () => void;
  retry: () => Promise<boolean>;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isReady: boolean;
  canStartScanning: boolean;
}

declare global {
  interface Window {
    jsQR?: (
      data: Uint8ClampedArray,
      width: number,
      height: number,
    ) => { data: string } | null;
  }
}

export function useQRScanner(config: QRScannerConfig = {}): UseQRScannerReturn {
  const {
    scanInterval = 100,
    maxResults = 10,
    jsQRUrl = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
  } = config;
  const [qrResults, setQrResults] = useState<QRResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [jsQRLoaded, setJsQRLoaded] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [currentFacingMode, setCurrentFacingMode] = useState<
    "user" | "environment"
  >(config.facingMode ?? "environment");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScanRef = useRef("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  const loadJsQR = useCallback(() => {
    if (window.jsQR) {
      setJsQRLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = jsQRUrl;
    script.onload = () => {
      if (isMountedRef.current) setJsQRLoaded(true);
    };
    document.head.appendChild(script);
  }, [jsQRUrl]);

  const scanQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !window.jsQR) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(imgData.data, imgData.width, imgData.height);
    if (code?.data && code.data !== lastScanRef.current) {
      lastScanRef.current = code.data;
      if (isMountedRef.current) {
        setQrResults((prev) => [
          { data: code.data, timestamp: Date.now() },
          ...prev.slice(0, maxResults - 1),
        ]);
      }
    }
  }, [maxResults]);

  const startScanning = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const supported = "mediaDevices" in navigator;
      setIsSupported(supported);
      if (!supported) {
        setIsLoading(false);
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setIsScanning(true);
      loadJsQR();
      scanIntervalRef.current = setInterval(scanQRCode, scanInterval);
      setIsLoading(false);
      return true;
    } catch {
      setIsLoading(false);
      setIsSupported(false);
      return false;
    }
  }, [currentFacingMode, loadJsQR, scanQRCode, scanInterval]);

  const stopScanning = useCallback(async (): Promise<void> => {
    setIsScanning(false);
    setIsActive(false);
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    lastScanRef.current = "";
  }, []);

  const switchCamera = useCallback(async (): Promise<boolean> => {
    const newMode =
      currentFacingMode === "environment" ? "user" : "environment";
    setCurrentFacingMode(newMode);
    if (isActive) {
      await stopScanning();
      return startScanning();
    }
    return true;
  }, [currentFacingMode, isActive, stopScanning, startScanning]);

  const clearResults = useCallback(() => {
    setQrResults([]);
    lastScanRef.current = "";
  }, []);

  const reset = useCallback(() => {
    setIsScanning(false);
    clearResults();
  }, [clearResults]);

  return {
    qrResults,
    isScanning,
    jsQRLoaded,
    isActive,
    isSupported,
    error: null as { message: string } | null,
    isLoading,
    currentFacingMode,
    startScanning,
    stopScanning,
    switchCamera,
    clearResults,
    reset,
    retry: startScanning,
    videoRef,
    canvasRef,
    isReady: jsQRLoaded && isSupported !== false,
    canStartScanning: isSupported === true && !isLoading,
  };
}
