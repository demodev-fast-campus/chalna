import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { RotateCcw, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { getCurrentSlot } from "@/lib/timeSlot";

type CameraState = "idle" | "permission_denied" | "ready" | "recording" | "uploading" | "done";

const RECORD_DURATION_MS = 2000;

export default function CameraView() {
  const params = useParams<{ roomId?: string }>();
  const roomId = params.roomId ? Number(params.roomId) : undefined;
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [state, setState] = useState<CameraState>("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>(roomId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: rooms } = trpc.room.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const uploadMutation = trpc.clip.upload.useMutation({
    onSuccess: () => {
      utils.clip.getSlot.invalidate();
      setState("done");
      toast.success("영상이 업로드됐어요!");
      setTimeout(() => {
        if (selectedRoomId) navigate(`/room/${selectedRoomId}`);
        else navigate("/");
      }, 1200);
    },
    onError: (err) => {
      toast.error(err.message || "업로드에 실패했어요.");
      setState("ready");
    },
  });

  // Start camera
  const startCamera = useCallback(async (facing: "user" | "environment") => {
    // Stop existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setState("ready");
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setState("permission_denied");
      } else {
        toast.error("카메라를 시작할 수 없어요.");
        setState("permission_denied");
      }
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const switchCamera = useCallback(() => {
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  // Start recording
  const startRecording = useCallback(() => {
    if (!streamRef.current || state !== "ready") return;
    chunksRef.current = [];

    // Determine supported MIME type
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : MediaRecorder.isTypeSupported("video/mp4")
      ? "video/mp4"
      : "";

    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      handleUpload(blob, mimeType || "video/webm");
    };

    recorder.start();
    setState("recording");
    setProgress(0);

    // Progress animation
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / RECORD_DURATION_MS) * 100, 100);
      setProgress(pct);
      if (elapsed >= RECORD_DURATION_MS) {
        clearInterval(progressIntervalRef.current!);
        recorder.stop();
      }
    }, 16);
  }, [state]);

  const handleUpload = useCallback(async (blob: Blob, mimeType: string) => {
    if (!selectedRoomId) {
      toast.error("업로드할 로그방을 선택해 주세요.");
      setState("ready");
      return;
    }
    setState("uploading");
    const slot = getCurrentSlot();

    // Convert blob to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      uploadMutation.mutate({
        roomId: selectedRoomId,
        date: slot.date,
        timeSlot: slot.hour,
        videoBase64: base64,
        mimeType,
      });
    };
    reader.readAsDataURL(blob);
  }, [selectedRoomId, uploadMutation]);

  const handleClose = useCallback(() => {
    if (selectedRoomId) navigate(`/room/${selectedRoomId}`);
    else navigate("/");
  }, [navigate, selectedRoomId]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (state === "permission_denied") {
    return (
      <div className="flex flex-col h-full bg-black items-center justify-center px-6 gap-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#151515" }}>
          <Camera size={28} className="text-[#555]" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-base mb-2">카메라 권한이 필요해요</p>
          <p className="text-[#555] text-sm leading-relaxed">
            브라우저 설정에서 카메라 권한을 허용한 후<br />다시 시도해 주세요.
          </p>
        </div>
        <button
          onClick={() => startCamera(facingMode)}
          className="px-6 py-3 rounded-[16px] font-semibold text-sm text-black transition-all active:scale-95"
          style={{ background: "#11E6D4" }}
        >
          다시 시도
        </button>
        <button onClick={handleClose} className="text-[#555] text-sm">돌아가기</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black relative">
      {/* Camera preview - full screen */}
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
        {/* Dark overlay when uploading/done */}
        {(state === "uploading" || state === "done") && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            {state === "uploading" ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-[#11E6D4] border-t-transparent animate-spin" />
                <p className="text-white text-sm font-medium">업로드 중...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(17,230,212,0.15)" }}>
                  <Camera size={24} className="text-[#11E6D4]" />
                </div>
                <p className="text-white text-sm font-medium">업로드 완료!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top controls */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-14 pb-4">
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
        >
          <X size={18} className="text-white" />
        </button>

        {/* Room selector (if no roomId from params) */}
        {!roomId && rooms && rooms.length > 0 && (
          <select
            value={selectedRoomId ?? ""}
            onChange={e => setSelectedRoomId(Number(e.target.value))}
            className="px-3 py-2 rounded-full text-sm font-medium text-white outline-none"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <option value="" disabled>로그방 선택</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        {/* Switch camera */}
        <button
          onClick={switchCamera}
          disabled={state === "recording" || state === "uploading"}
          className="w-10 h-10 flex items-center justify-center rounded-full disabled:opacity-40"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
        >
          <RotateCcw size={18} className="text-white" />
        </button>
      </div>

      {/* Progress bar */}
      {state === "recording" && (
        <div className="relative z-10 px-6">
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
            <div
              className="h-full rounded-full transition-none"
              style={{ width: `${progress}%`, background: "#11E6D4" }}
            />
          </div>
          <p className="text-center text-white text-xs mt-2 font-medium">
            {((RECORD_DURATION_MS - (progress / 100) * RECORD_DURATION_MS) / 1000).toFixed(1)}초
          </p>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center pb-12 gap-4">
        {/* Shutter button */}
        <button
          onClick={startRecording}
          disabled={state !== "ready"}
          className="relative flex items-center justify-center transition-all disabled:opacity-40"
          style={{ width: 80, height: 80 }}
        >
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{ border: "3px solid rgba(255,255,255,0.8)" }}
          />
          {/* Inner circle */}
          <div
            className={`rounded-full transition-all duration-150 ${state === "recording" ? "animate-record" : ""}`}
            style={{
              width: 60,
              height: 60,
              background: state === "recording" ? "#11E6D4" : "white",
              borderRadius: state === "recording" ? "12px" : "50%",
            }}
          />
        </button>

        <p className="text-white/60 text-xs">
          {state === "idle" ? "카메라 시작 중..." :
           state === "ready" ? "버튼을 눌러 2초 촬영" :
           state === "recording" ? "촬영 중..." :
           state === "uploading" ? "업로드 중..." :
           "완료!"}
        </p>
      </div>
    </div>
  );
}
