import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { RotateCcw, X, Camera } from "lucide-react";
import { toast } from "sonner";
import { getCurrentSlot } from "@/lib/timeSlot";

type RecordingState = "idle" | "recording" | "uploading" | "done";

const RECORD_DURATION_MS = 2000;

export default function CameraView() {
  const params = useParams<{ roomId?: string }>();
  const roomId = params.roomId ? Number(params.roomId) : undefined;
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();

  // 카메라 상태 (독립적)
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // 녹화 상태 (독립적)
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [progress, setProgress] = useState(0);

  // 로그방 선택
  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>(roomId);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: rooms, isLoading: roomsLoading } = trpc.room.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  // Auto-select first room
  useEffect(() => {
    if (!roomId && !roomsLoading && rooms && rooms.length > 0 && !selectedRoomId) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, roomsLoading, roomId, selectedRoomId]);

  // ─────────────────────────────────────────────────────────────────────────
  // 카메라 초기화: 화면 진입 시 딱 한 번만 실행
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log("[Camera] Initializing with facingMode:", facingMode);

    const initCamera = async () => {
      try {
        // 기존 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // 자동 재생 강제
          videoRef.current.play().catch(err => console.error("[Camera] Play error:", err));
        }

        setCameraReady(true);
        setCameraError(false);
        console.log("[Camera] Ready");
      } catch (err) {
        console.error("[Camera] Error:", err);
        setCameraError(true);
        setCameraReady(false);
      }
    };

    initCamera();

    // 화면 나갈 때만 정리
    return () => {
      console.log("[Camera] Cleanup on unmount");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraReady(false);
    };
  }, [isAuthenticated, facingMode]); // facingMode 변경 시만 재초기화

  // ─────────────────────────────────────────────────────────────────────────
  // 전면/후면 전환
  // ─────────────────────────────────────────────────────────────────────────
  const toggleFacingMode = useCallback(() => {
    console.log("[Camera] Toggling facing mode");
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    // facingMode 변경 → useEffect 트리거 → 카메라 재초기화
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // 녹화 시작
  // ─────────────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current || !cameraReady || !selectedRoomId) {
      console.error("[Recording] Cannot start: stream=", !!streamRef.current, "ready=", cameraReady, "room=", selectedRoomId);
      return;
    }

    console.log("[Recording] Starting 2-second recording");
    chunksRef.current = [];

    // MIME 타입 결정
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
      console.log("[Recording] Data chunk:", e.data.size, "bytes");
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      console.log("[Recording] Stopped. Total blob size:", blob.size, "bytes");
      handleUpload(blob, mimeType || "video/webm");
    };

    recorder.onerror = (e) => {
      console.error("[Recording] Error:", e.error);
      toast.error("녹화 중 오류 발생");
      setRecordingState("idle");
    };

    recorder.start();
    setRecordingState("recording");
    setProgress(0);

    // 2초 타이머
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / RECORD_DURATION_MS) * 100, 100);
      setProgress(pct);

      if (elapsed >= RECORD_DURATION_MS) {
        clearInterval(progressIntervalRef.current!);
        console.log("[Recording] 2 seconds elapsed, stopping");
        recorder.stop();
      }
    }, 16);
  }, [cameraReady, selectedRoomId]);

  // ─────────────────────────────────────────────────────────────────────────
  // 업로드
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpload = useCallback(async (blob: Blob, mimeType: string) => {
    if (!selectedRoomId || !user) {
      toast.error("로그방을 선택해주세요");
      setRecordingState("idle");
      return;
    }

    setRecordingState("uploading");
    const slot = getCurrentSlot();

    try {
      console.log(`[Upload] Uploading: room=${selectedRoomId}, user=${user.id}, date=${slot.date}, slot=${slot.hour}, size=${blob.size} bytes`);

      const response = await fetch(
        `/api/uploadClip?roomId=${selectedRoomId}&userId=${user.id}&date=${slot.date}&timeSlot=${slot.hour}`,
        {
          method: 'POST',
          body: blob,
          headers: {
            'Content-Type': mimeType,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      console.log('[Upload] Success:', result);

      utils.clip.getSlot.invalidate();
      setRecordingState("done");
      toast.success("영상이 업로드됐어요!");

      setTimeout(() => {
        navigate(`/room/${selectedRoomId}`);
      }, 1200);
    } catch (error) {
      console.error('[Upload] Error:', error);
      setRecordingState("idle");
      toast.error(error instanceof Error ? error.message : "업로드 실패");
    }
  }, [selectedRoomId, user, utils, navigate]);

  const handleClose = useCallback(() => {
    if (selectedRoomId) navigate(`/room/${selectedRoomId}`);
    else navigate("/");
  }, [navigate, selectedRoomId]);

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <p className="text-white">로딩 중...</p>
      </div>
    );
  }

  if (cameraError) {
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

  const isRecording = recordingState === "recording";
  const isUploading = recordingState === "uploading";
  const isDone = recordingState === "done";

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
        {/* 카메라 미리보기 - 항상 표시 */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ borderRadius: 22 }}
        />

        {/* 녹화 진행도 */}
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

        {/* 업로드 완료 */}
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
          disabled={isRecording || isUploading || !selectedRoomId || !cameraReady}
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
