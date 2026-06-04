import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { RotateCcw, X, Camera, Plus, Hash } from "lucide-react";
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

  const { data: rooms, isLoading: roomsLoading } = trpc.room.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  // Auto-select first room if no roomId from params
  useEffect(() => {
    if (!roomId && !roomsLoading && rooms && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, roomsLoading, roomId, selectedRoomId]);

  const uploadMutation = trpc.clip.uploadBlob.useMutation({
    onSuccess: () => {
      utils.clip.getSlot.invalidate();
      setState("done");
      toast.success("영상이 업로드됐어요!");
      setTimeout(() => {
        if (selectedRoomId) navigate(`/room/${selectedRoomId}`);
        else navigate("/");
      }, 1200);
    },
    onError: (err: any) => {
      setState("ready");
      toast.error(err.message || "업로드 실패");
    },
  });

  // ── Request Camera Permission ─────────────────────────────────────────────

  useEffect(() => {
    if (state !== "idle") return;

    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setState("ready");
      } catch (err) {
        console.error("Camera permission denied:", err);
        setState("permission_denied");
      }
    };

    requestCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [state, facingMode]);

  // ── Toggle Facing Mode ────────────────────────────────────────────────────

  const toggleFacingMode = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setState("idle");
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }, []);

  // ── Start Recording ───────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (!streamRef.current || state !== "ready" || !selectedRoomId) return;
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
  }, [state, selectedRoomId]);

  const handleUpload = useCallback(async (blob: Blob, mimeType: string) => {
    if (!selectedRoomId) {
      toast.error("업로드할 로그방을 선택해 주세요.");
      setState("ready");
      return;
    }
    setState("uploading");
    const slot = getCurrentSlot();

    // Convert blob to Uint8Array for transmission
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    uploadMutation.mutate({
      roomId: selectedRoomId,
      date: slot.date,
      timeSlot: slot.hour,
      videoBlob: uint8Array,
      mimeType,
    });
  }, [selectedRoomId, uploadMutation]);

  const handleClose = useCallback(() => {
    if (selectedRoomId) navigate(`/room/${selectedRoomId}`);
    else navigate("/");
  }, [navigate, selectedRoomId]);

  // ── Render: Permission Denied ─────────────────────────────────────────────

  if (state === "permission_denied") {
    return (
      <div className="flex flex-col h-full bg-black items-center justify-center px-6 gap-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#151515" }}>
          <Camera size={28} className="text-[#555]" />
        </div>
        <div className="text-center">
          <h2 className="text-white font-bold text-lg mb-2">카메라 권한이 필요해요</h2>
          <p className="text-[#555] text-sm">브라우저 설정에서 카메라 권한을 허용해 주세요.</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 rounded-full font-semibold text-black transition-all active:scale-95"
          style={{ background: "#11E6D4" }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  // ── Render: Ready / Recording / Uploading ─────────────────────────────────

  const isRecording = state === "recording";
  const isUploading = state === "uploading";
  const isDone = state === "done";

  return (
    <div className="flex flex-col h-screen w-full bg-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-14 pb-3 flex-shrink-0 h-[60px]">
        <h1 className="text-base font-bold text-white">2초 촬영</h1>
        <button
          onClick={handleClose}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
          style={{ background: "#151515" }}
        >
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* Camera Preview */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 overflow-hidden relative px-6">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ borderRadius: 22 }}
        />

        {/* Recording Progress Overlay */}
        {isRecording && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: 22 }}>
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{ background: "rgba(17,230,212,0.2)", border: "3px solid #11E6D4" }}
            >
              <span className="text-white font-bold">{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {/* Done Overlay */}
        {isDone && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: 22, background: "rgba(0,0,0,0.7)" }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#11E6D4" }}>
                <span className="text-2xl">✓</span>
              </div>
              <p className="text-white font-bold">업로드 완료!</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-6 pb-8 pt-4 flex-shrink-0 h-[100px]">
        {/* Room Selector */}
        <div className="flex items-center gap-2">
          {roomsLoading ? (
            <div className="w-8 h-8 rounded-full border-2 border-[#11E6D4] border-t-transparent animate-spin" />
          ) : rooms && rooms.length > 0 ? (
            <select
              value={selectedRoomId || ""}
              onChange={(e) => setSelectedRoomId(Number(e.target.value))}
              className="px-3 py-2 rounded-full text-xs font-medium text-white transition-all"
              style={{ background: "#151515", color: "#11E6D4" }}
              disabled={isRecording || isUploading}
            >
              {rooms.map(room => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          ) : (
            <p className="text-[#555] text-xs">로그방 없음</p>
          )}
        </div>

        {/* Shutter Button */}
        <button
          onClick={startRecording}
          disabled={isRecording || isUploading || !selectedRoomId}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
          style={{ background: "#11E6D4" }}
        >
          <Camera size={24} className="text-black" />
        </button>

        {/* Toggle Facing Mode */}
        <button
          onClick={toggleFacingMode}
          disabled={isRecording || isUploading}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-30"
          style={{ background: "#151515" }}
        >
          <RotateCcw size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
