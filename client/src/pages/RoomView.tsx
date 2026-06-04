import { useState, useMemo, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, UserPlus, Copy, ChevronLeft, ChevronRight, Camera, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { getCurrentSlot, formatHour, formatDate, getTodayDate } from "@/lib/timeSlot";

// PRD: 좌우 여백 24, 카드 간격 6, border-radius 22, 모든 카드 동일 너비·높이
const CARD_ASPECT = "3/4";

// ── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({
  userName, storageUrl, timeSlot, isMe,
}: { userName: string; storageUrl: string; timeSlot: number; isMe: boolean }) {
  return (
    <div
      className="relative w-full overflow-hidden flex-shrink-0"
      style={{ borderRadius: 22, background: "#151515", aspectRatio: CARD_ASPECT }}
    >
      <video
        src={storageUrl}
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)" }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-white font-bold" style={{ fontSize: 28, textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>
          {formatHour(timeSlot)}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-center gap-1.5">
        <span className="text-white text-sm font-semibold" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
          {userName}
        </span>
        {isMe && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(17,230,212,0.2)", color: "#11E6D4" }}>
            나
          </span>
        )}
      </div>
    </div>
  );
}

// ── EmptyMemberCard ──────────────────────────────────────────────────────────

function EmptyMemberCard({
  userName, isMe, onShoot,
}: { userName: string; isMe: boolean; onShoot?: () => void }) {
  return (
    <div
      className="relative w-full flex flex-col items-center justify-center gap-3 flex-shrink-0"
      style={{ borderRadius: 22, background: "#151515", aspectRatio: CARD_ASPECT }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
        style={{ background: "#1e1e1e", color: isMe ? "#11E6D4" : "#444" }}
      >
        {userName.charAt(0).toUpperCase()}
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-white text-sm font-medium">{userName}</span>
        {isMe ? (
          <button
            onClick={onShoot}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-black transition-all active:scale-95"
            style={{ background: "#11E6D4" }}
          >
            <Camera size={12} />
            지금 찍기
          </button>
        ) : (
          <span className="text-[#444] text-xs">아직 로그 없음</span>
        )}
      </div>
    </div>
  );
}

// ── InviteCard ───────────────────────────────────────────────────────────────

function InviteCard({ inviteCode }: { inviteCode: string }) {
  return (
    <div
      className="relative w-full flex flex-col items-center justify-center gap-3 flex-shrink-0 cursor-pointer transition-all active:scale-[0.98]"
      style={{ borderRadius: 22, background: "#0d0d0d", aspectRatio: CARD_ASPECT, border: "1.5px dashed #2a2a2a" }}
      onClick={() => {
        navigator.clipboard.writeText(inviteCode).then(() => toast.success("초대 코드가 복사됐어요!"));
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(17,230,212,0.06)", border: "1.5px dashed rgba(17,230,212,0.4)" }}
      >
        <UserPlus size={20} style={{ color: "#11E6D4" }} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-semibold" style={{ color: "#11E6D4" }}>+ 친구 초대</span>
        <span className="text-xs" style={{ color: "#333" }}>{inviteCode}</span>
      </div>
    </div>
  );
}

// ── SlotPicker modal ─────────────────────────────────────────────────────────

function SlotPicker({
  open,
  onClose,
  slotList,
  selectedDate,
  selectedHour,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  slotList: { date: string; hour: number }[];
  selectedDate: string;
  selectedHour: number;
  onSelect: (date: string, hour: number) => void;
}) {
  // Group slots by date
  const grouped = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of slotList) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s.hour);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [slotList]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[390px] rounded-t-[28px] pb-8 animate-fade-in"
        style={{ background: "#111" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: "#333" }} />
        </div>
        <p className="text-white font-bold text-base px-6 mb-4">시간 슬롯 선택</p>
        <div className="scroll-area max-h-[50vh] px-6 flex flex-col gap-4">
          {grouped.map(([date, hours]) => (
            <div key={date}>
              <p className="text-[#555] text-xs font-medium mb-2">{formatDate(date)}</p>
              <div className="flex flex-wrap gap-2">
                {hours.sort((a, b) => a - b).map(hour => {
                  const isSelected = date === selectedDate && hour === selectedHour;
                  return (
                    <button
                      key={hour}
                      onClick={() => { onSelect(date, hour); onClose(); }}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all active:scale-95"
                      style={{
                        background: isSelected ? "#11E6D4" : "#1e1e1e",
                        color: isSelected ? "#000" : "#aaa",
                      }}
                    >
                      {formatHour(hour)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── RoomView ─────────────────────────────────────────────────────────────────

export default function RoomView() {
  const params = useParams<{ roomId: string }>();
  const roomId = Number(params.roomId);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const currentSlot = useMemo(() => getCurrentSlot(), []);
  const [selectedDate, setSelectedDate] = useState(currentSlot.date);
  const [selectedHour, setSelectedHour] = useState(currentSlot.hour);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: room, isLoading: roomLoading } = trpc.room.get.useQuery(
    { roomId },
    { enabled: !!roomId && !isNaN(roomId) }
  );

  const { data: clips, isLoading: clipsLoading } = trpc.clip.getSlot.useQuery(
    { roomId, date: selectedDate, timeSlot: selectedHour },
    { enabled: !!roomId && !isNaN(roomId), refetchInterval: 10000 }
  );

  const { data: availableSlots } = trpc.clip.availableSlots.useQuery(
    { roomId },
    { enabled: !!roomId && !isNaN(roomId) }
  );

  // Build ordered slot list
  const slotList = useMemo(() => {
    const today = getTodayDate();
    const slots = new Map<string, Set<number>>();
    const addSlot = (date: string, hour: number) => {
      if (!slots.has(date)) slots.set(date, new Set());
      slots.get(date)!.add(hour);
    };
    addSlot(today, currentSlot.hour);
    if (availableSlots) {
      for (const s of availableSlots) addSlot(s.date, s.timeSlot);
    }
    const result: { date: string; hour: number }[] = [];
    const sortedDates = Array.from(slots.keys()).sort((a, b) => b.localeCompare(a));
    for (const date of sortedDates) {
      const hours = Array.from(slots.get(date)!).sort((a, b) => b - a);
      for (const hour of hours) result.push({ date, hour });
    }
    return result;
  }, [availableSlots, currentSlot]);

  const currentSlotIndex = useMemo(
    () => slotList.findIndex(s => s.date === selectedDate && s.hour === selectedHour),
    [slotList, selectedDate, selectedHour]
  );

  const goToPrevSlot = useCallback(() => {
    if (currentSlotIndex < slotList.length - 1) {
      const prev = slotList[currentSlotIndex + 1];
      setSelectedDate(prev.date);
      setSelectedHour(prev.hour);
    }
  }, [currentSlotIndex, slotList]);

  const goToNextSlot = useCallback(() => {
    if (currentSlotIndex > 0) {
      const next = slotList[currentSlotIndex - 1];
      setSelectedDate(next.date);
      setSelectedHour(next.hour);
    }
  }, [currentSlotIndex, slotList]);

  const handleShoot = useCallback(() => navigate(`/camera/${roomId}`), [navigate, roomId]);

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="w-8 h-8 rounded-full border-2 border-[#11E6D4] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black gap-4 px-6">
        <p className="text-[#555] text-sm">로그방을 찾을 수 없어요.</p>
        <button onClick={() => navigate("/")} className="text-[#11E6D4] text-sm">홈으로 돌아가기</button>
      </div>
    );
  }

  const myMember = room.members.find(m => m.userId === user?.id);
  const otherMembers = room.members.filter(m => m.userId !== user?.id);
  const emptySlots = Math.max(0, 4 - room.members.length);
  const getClipForUser = (userId: number) => clips?.find(c => c.userId === userId);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-14 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{ background: "#151515" }}
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">{room.name}</h1>
            <p className="text-[#444] text-xs">{room.members.length}/4명</p>
          </div>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(room.inviteCode);
            toast.success("초대 코드가 복사됐어요!");
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
          style={{ background: "#151515", color: "#11E6D4" }}
        >
          <Copy size={11} />
          {room.inviteCode}
        </button>
      </div>

      {/* Time slot navigator */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid #111" }}
      >
        <button
          onClick={goToPrevSlot}
          disabled={currentSlotIndex >= slotList.length - 1}
          className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-20 transition-all active:scale-95"
          style={{ background: "#151515" }}
        >
          <ChevronLeft size={16} className="text-white" />
        </button>

        {/* Tappable slot label — opens picker */}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex flex-col items-center gap-0.5 transition-all active:scale-95"
        >
          <div className="flex items-center gap-1">
            <p className="text-white font-bold text-base">{formatHour(selectedHour)}</p>
            <ChevronDown size={14} className="text-[#555]" />
          </div>
          <p className="text-[#555] text-xs">{formatDate(selectedDate)}</p>
        </button>

        <button
          onClick={goToNextSlot}
          disabled={currentSlotIndex <= 0}
          className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-20 transition-all active:scale-95"
          style={{ background: "#151515" }}
        >
          <ChevronRight size={16} className="text-white" />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 scroll-area">
        <div className="px-6 py-4 flex flex-col gap-[6px]">
          {clipsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="w-full animate-pulse flex-shrink-0"
                style={{ borderRadius: 22, background: "#151515", aspectRatio: CARD_ASPECT }}
              />
            ))
          ) : (
            <>
              {/* My card — always first */}
              {myMember && (() => {
                const clip = getClipForUser(myMember.userId);
                return clip ? (
                  <VideoCard
                    key={`me-${myMember.userId}`}
                    userName={myMember.userName || "나"}
                    storageUrl={clip.storageUrl}
                    timeSlot={selectedHour}
                    isMe={true}
                  />
                ) : (
                  <EmptyMemberCard
                    key={`me-empty-${myMember.userId}`}
                    userName={myMember.userName || "나"}
                    isMe={true}
                    onShoot={handleShoot}
                  />
                );
              })()}

              {/* Friend cards — fixed order, no reordering */}
              {otherMembers.map(member => {
                const clip = getClipForUser(member.userId);
                return clip ? (
                  <VideoCard
                    key={`friend-${member.userId}`}
                    userName={member.userName || "친구"}
                    storageUrl={clip.storageUrl}
                    timeSlot={selectedHour}
                    isMe={false}
                  />
                ) : (
                  <EmptyMemberCard
                    key={`friend-empty-${member.userId}`}
                    userName={member.userName || "친구"}
                    isMe={false}
                  />
                );
              })}

              {/* Invite cards — always last */}
              {Array.from({ length: emptySlots }).map((_, i) => (
                <InviteCard key={`invite-${i}`} inviteCode={room.inviteCode} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Slot picker modal */}
      <SlotPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        slotList={slotList}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        onSelect={(date, hour) => {
          setSelectedDate(date);
          setSelectedHour(hour);
        }}
      />
    </div>
  );
}
