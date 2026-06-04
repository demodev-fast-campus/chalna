import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function JoinRoom() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");

  const utils = trpc.useUtils();

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (data) => {
      utils.room.list.invalidate();
      if (data.alreadyMember) {
        toast.info("이미 참여 중인 로그방이에요.");
      } else {
        toast.success(`${data.room.name}에 참여했어요!`);
      }
      navigate(`/room/${data.room.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "참여에 실패했어요.");
    },
  });

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast.error("초대 코드를 입력해 주세요."); return; }
    joinMutation.mutate({ inviteCode: trimmed });
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
        <h1 className="text-lg font-bold text-white">코드로 참여</h1>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-[#888] text-sm">친구에게 받은 초대 코드를 입력하세요</p>
        </div>

        {/* Code input */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-[#888]">초대 코드</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase().slice(0, 8))}
            onKeyDown={e => e.key === "Enter" && handleJoin()}
            placeholder="초대 코드 입력"
            maxLength={8}
            className="w-full px-4 py-4 rounded-[16px] text-white text-xl font-bold tracking-[0.2em] text-center outline-none placeholder-[#333] transition-all uppercase"
            style={{
              background: "#151515",
              border: "1.5px solid",
              borderColor: code.length > 0 ? "#11E6D4" : "#2a2a2a",
              letterSpacing: "0.2em",
            }}
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          {joinMutation.isError && (
            <p className="text-red-400 text-xs text-center animate-fade-in">
              {joinMutation.error.message || "존재하지 않는 초대 코드예요."}
            </p>
          )}
        </div>

        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={joinMutation.isPending || code.trim().length === 0}
          className="w-full py-4 rounded-[22px] font-semibold text-base text-black transition-all active:scale-[0.97] disabled:opacity-40"
          style={{ background: "#11E6D4" }}
        >
          {joinMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
              참여 중...
            </span>
          ) : "로그방 참여"}
        </button>

        {/* Info */}
        <div className="p-4 rounded-[16px]" style={{ background: "#0d0d0d" }}>
          <p className="text-[#444] text-xs leading-relaxed">
            · 로그방은 최대 4명까지 참여할 수 있어요<br />
            · 초대 코드는 로그방 생성 시 발급돼요<br />
            · 코드는 대소문자를 구분하지 않아요
          </p>
        </div>
      </div>
    </div>
  );
}
