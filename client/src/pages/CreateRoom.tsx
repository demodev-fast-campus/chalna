import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function CreateRoom() {
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [createdRoom, setCreatedRoom] = useState<{ id: number; name: string; inviteCode: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createMutation = trpc.room.create.useMutation({
    onSuccess: (room) => {
      setCreatedRoom(room);
    },
    onError: (err) => {
      toast.error(err.message || "로그방 생성에 실패했어요.");
    },
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("방 이름을 입력해 주세요."); return; }
    if (trimmed.length > 20) { toast.error("방 이름은 20자 이하로 입력해 주세요."); return; }
    createMutation.mutate({ name: trimmed });
  };

  const handleCopy = () => {
    if (!createdRoom) return;
    navigator.clipboard.writeText(createdRoom.inviteCode).then(() => {
      setCopied(true);
      toast.success("초대 코드가 복사됐어요!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGoToRoom = () => {
    if (createdRoom) navigate(`/room/${createdRoom.id}`);
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-14 pb-6">
        <button
          onClick={() => navigate("/")}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
          style={{ background: "#151515" }}
        >
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">로그방 만들기</h1>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-6">
        {!createdRoom ? (
          <>
            {/* Input */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-[#888]">방 이름</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 20))}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  placeholder="방 이름을 입력하세요 (1~20자)"
                  maxLength={20}
                  className="w-full px-4 py-4 rounded-[16px] text-white text-base outline-none placeholder-[#444] transition-all"
                  style={{
                    background: "#151515",
                    border: "1.5px solid",
                    borderColor: name.length > 0 ? "#11E6D4" : "#2a2a2a",
                  }}
                  autoFocus
                />
                <span
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: name.length >= 18 ? "#11E6D4" : "#444" }}
                >
                  {name.length}/20
                </span>
              </div>
            </div>

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || name.trim().length === 0}
              className="w-full py-4 rounded-[22px] font-semibold text-base text-black transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ background: "#11E6D4" }}
            >
              {createMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  생성 중...
                </span>
              ) : "로그방 만들기"}
            </button>
          </>
        ) : (
          /* Success state - show invite code */
          <div className="flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(17,230,212,0.12)" }}>
              <Check size={28} className="text-[#11E6D4]" />
            </div>

            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-1">{createdRoom.name}</h2>
              <p className="text-[#555] text-sm">로그방이 만들어졌어요!</p>
            </div>

            {/* Invite code display */}
            <div className="w-full p-5 rounded-[22px] flex flex-col items-center gap-3" style={{ background: "#151515" }}>
              <p className="text-[#555] text-xs font-medium">초대 코드</p>
              <p className="text-3xl font-bold tracking-[0.2em] text-white">{createdRoom.inviteCode}</p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95"
                style={{ background: copied ? "rgba(17,230,212,0.15)" : "#1a1a1a", color: copied ? "#11E6D4" : "#888" }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "복사됨!" : "코드 복사"}
              </button>
            </div>

            <p className="text-[#444] text-xs text-center px-4">
              친구에게 초대 코드를 공유하면<br />같은 로그방에서 영상을 기록할 수 있어요
            </p>

            {/* Go to room */}
            <button
              onClick={handleGoToRoom}
              className="w-full py-4 rounded-[22px] font-semibold text-base text-black transition-all active:scale-[0.97]"
              style={{ background: "#11E6D4" }}
            >
              로그방으로 이동
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
