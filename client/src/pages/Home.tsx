import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl, isLoginConfigured } from "@/const";
import { useLocation } from "wouter";
import { Plus, Hash, ChevronRight, Users, LogIn } from "lucide-react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const loginConfigured = isLoginConfigured();
  const loginUrl = getLoginUrl();

  const { data: rooms, isLoading: roomsLoading } = trpc.room.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="w-8 h-8 rounded-full border-2 border-[#11E6D4] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col h-full bg-black px-6 justify-center items-center gap-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">찰나</h1>
          <p className="text-[#555] text-sm">친구들과 나누는 2초의 순간</p>
        </div>

        {/* Login button */}
        <a
          href={loginUrl}
          onClick={(event) => {
            if (!loginConfigured) event.preventDefault();
          }}
          aria-disabled={!loginConfigured}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-[22px] font-semibold text-base text-black disabled:opacity-50"
          style={{ background: loginConfigured ? "#11E6D4" : "#555" }}
        >
          <LogIn size={18} />
          시작하기
        </a>

        {!loginConfigured && (
          <p className="text-center text-xs leading-5 text-[#777]">
            로컬 개발 환경에 OAuth 설정이 없어 로그인은 비활성화되어 있어요.
            배포 환경 또는 Manus 웹앱 환경에서는 정상적으로 로그인할 수 있습니다.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="px-6 pt-14 pb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">찰나</h1>
        <p className="text-[#555] text-sm mt-1">
          {user?.name ? `${user.name}님의 로그` : "나의 로그"}
        </p>
      </div>

      {/* Action buttons */}
      <div className="px-6 flex gap-3 mb-6">
        <button
          onClick={() => navigate("/create-room")}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[16px] font-semibold text-sm text-black transition-all duration-150 active:scale-[0.97]"
          style={{ background: "#11E6D4" }}
        >
          <Plus size={16} strokeWidth={2.5} />
          로그방 만들기
        </button>
        <button
          onClick={() => navigate("/join-room")}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[16px] font-semibold text-sm text-white border border-[#2a2a2a] transition-all duration-150 active:scale-[0.97]"
          style={{ background: "#151515" }}
        >
          <Hash size={16} strokeWidth={2.5} />
          코드로 참여
        </button>
      </div>

      {/* Room list */}
      <div className="flex-1 scroll-area px-6 pb-4">
        {roomsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 rounded-[22px] bg-[#151515] animate-pulse" />
            ))}
          </div>
        ) : !rooms || rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-[#151515] flex items-center justify-center">
              <Users size={28} className="text-[#333]" />
            </div>
            <div className="text-center">
              <p className="text-[#555] text-sm">아직 참여한 로그방이 없어요</p>
              <p className="text-[#333] text-xs mt-1">로그방을 만들거나 초대 코드로 참여해 보세요</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 stagger-children">
            <p className="text-[#555] text-xs font-medium mb-1">참여 중인 로그방</p>
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => navigate(`/room/${room.id}`)}
                className="flex items-center justify-between p-4 rounded-[22px] text-left transition-all duration-150 active:scale-[0.98]"
                style={{ background: "#151515" }}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-white font-semibold text-base">{room.name}</span>
                  <span className="text-[#555] text-xs">
                    멤버 {room.memberCount ?? 1}명 · 코드 {room.inviteCode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "#1a1a1a" }}>
                    <Users size={11} className="text-[#555]" />
                    <span className="text-[#555] text-xs">{room.memberCount ?? 1}/4</span>
                  </div>
                  <ChevronRight size={16} className="text-[#333]" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
