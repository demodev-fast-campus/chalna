import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createRoom,
  getAvailableSlots,
  getClipsForSlot,
  getRoomByInviteCode,
  getRoomById,
  getRoomMembers,
  getUserRooms,
  isRoomMember,
  joinRoom,
  upsertClip,
} from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Room procedures ──────────────────────────────────────────────────────────
  room: router({
    // List rooms for current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserRooms(ctx.user.id);
    }),

    // Get room details + members
    get: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ ctx, input }) => {
        const room = await getRoomById(input.roomId);
        if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "로그방을 찾을 수 없어요." });
        const isMember = await isRoomMember(input.roomId, ctx.user.id);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "이 로그방의 멤버가 아니에요." });
        const members = await getRoomMembers(input.roomId);
        return { ...room, members };
      }),

    // Create a new room
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(20) }))
      .mutation(async ({ ctx, input }) => {
        // Retry up to 5 times to guarantee unique invite code
        let room;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const inviteCode = nanoid(6).toUpperCase();
            room = await createRoom(input.name, inviteCode, ctx.user.id);
            break;
          } catch (err: any) {
            if (attempt === 4) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "초대 코드 생성에 실패했어요. 다시 시도해 주세요." });
          }
        }
        return room!;
      }),

    // Join a room by invite code
    join: protectedProcedure
      .input(z.object({ inviteCode: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const code = input.inviteCode.toUpperCase().trim();
        const room = await getRoomByInviteCode(code);
        if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "존재하지 않는 초대 코드예요." });
        const result = await joinRoom(room.id, ctx.user.id);
        if ((result as any).error) throw new TRPCError({ code: "BAD_REQUEST", message: (result as any).error });
        return { room, alreadyMember: result.alreadyMember };
      }),
  }),

  // ── Clip procedures ──────────────────────────────────────────────────────────
  clip: router({
    // Get clips for a specific room/date/timeSlot
    getSlot: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        date: z.string(), // YYYY-MM-DD
        timeSlot: z.number().min(0).max(23),
      }))
      .query(async ({ ctx, input }) => {
        const isMember = await isRoomMember(input.roomId, ctx.user.id);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "이 로그방의 멤버가 아니에요." });
        return getClipsForSlot(input.roomId, input.date, input.timeSlot);
      }),

    // Get available slots (dates + hours that have clips)
    availableSlots: protectedProcedure
      .input(z.object({ roomId: z.number() }))
      .query(async ({ ctx, input }) => {
        const isMember = await isRoomMember(input.roomId, ctx.user.id);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "이 로그방의 멤버가 아니에요." });
        return getAvailableSlots(input.roomId);
      }),

    // Upload a clip (base64 video data)
    upload: protectedProcedure
      .input(z.object({
        roomId: z.number(),
        date: z.string(), // YYYY-MM-DD (4am-based, computed on client)
        timeSlot: z.number().min(0).max(23),
        videoBase64: z.string(), // base64 encoded video
        mimeType: z.string().default("video/webm"),
      }))
      .mutation(async ({ ctx, input }) => {
        const isMember = await isRoomMember(input.roomId, ctx.user.id);
        if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "이 로그방의 멤버가 아니에요." });

        // Convert base64 to buffer
        const base64Data = input.videoBase64.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Store in S3
        const ext = input.mimeType.includes("mp4") ? "mp4" : "webm";
        const key = `clips/${input.roomId}/${ctx.user.id}/${input.date}/${input.timeSlot}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);

        // Upsert clip record
        const clip = await upsertClip(
          input.roomId,
          ctx.user.id,
          input.date,
          input.timeSlot,
          key,
          url
        );
        return clip;
      }),
  }),
});

export type AppRouter = typeof appRouter;
