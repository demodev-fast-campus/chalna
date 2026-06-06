import { Router, Request, Response } from "express";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { and, eq } from "drizzle-orm";
import { roomMembers, clips } from "../drizzle/schema";

const router = Router();

/**
 * POST /api/uploadClip
 * Upload a video clip as raw binary data
 * 
 * Query params:
 * - roomId: number
 * - userId: number
 * - date: string (YYYY-MM-DD)
 * - timeSlot: number (0-23)
 * 
 * Body: raw binary video data (already buffered by express.raw middleware)
 * Content-Type: video/webm or video/mp4
 */
router.post("/uploadClip", async (req: Request, res: Response) => {
  try {
    const { roomId, userId, date, timeSlot } = req.query;

    // Validate inputs
    if (!roomId || !userId || !date || timeSlot === undefined) {
      console.error("[Upload] Missing required query parameters");
      return res.status(400).json({ error: "Missing required query parameters" });
    }

    const roomIdNum = Number(roomId);
    const userIdNum = Number(userId);
    const timeSlotNum = Number(timeSlot);

    if (isNaN(roomIdNum) || isNaN(userIdNum) || isNaN(timeSlotNum)) {
      console.error("[Upload] Invalid parameter types");
      return res.status(400).json({ error: "Invalid parameter types" });
    }

    if (timeSlotNum < 0 || timeSlotNum > 23) {
      console.error("[Upload] Invalid timeSlot:", timeSlotNum);
      return res.status(400).json({ error: "timeSlot must be 0-23" });
    }

    // Get video buffer from request body (already buffered by express.raw middleware)
    const videoBuffer = req.body as Buffer;
    
    console.log(`[Upload] Received buffer size: ${videoBuffer?.length || 0} bytes`);

    if (!videoBuffer || videoBuffer.length === 0) {
      console.error("[Upload] Empty video data");
      return res.status(400).json({ error: "Empty video data" });
    }

    // Check if user is member of room
    const db = await getDb();
    if (!db) {
      console.error("[Upload] Database not available");
      return res.status(500).json({ error: "Database not available" });
    }

    const membership = await db
      .select()
      .from(roomMembers)
      .where(
        and(
          eq(roomMembers.roomId, roomIdNum),
          eq(roomMembers.userId, userIdNum)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      console.error("[Upload] User not a member of room");
      return res.status(403).json({ error: "User is not a member of this room" });
    }

    // Determine file extension from Content-Type
    const contentType = (req.headers["content-type"] || "video/webm") as string;
    const ext = contentType.includes("mp4") ? "mp4" : "webm";
    const mimeType = contentType.includes("mp4") ? "video/mp4" : "video/webm";

    // Store in S3
    const key = `clips/${roomIdNum}/${userIdNum}/${date}/${timeSlotNum}.${ext}`;
    const { url } = await storagePut(key, videoBuffer, mimeType);

    console.log(`[Upload] Stored at ${key}, Size: ${videoBuffer.length} bytes, URL: ${url}`);

    // Upsert clip record in database
    // First check if clip already exists for this room/date/timeslot
    const existingClip = await db
      .select()
      .from(clips)
      .where(
        and(
          eq(clips.roomId, roomIdNum),
          eq(clips.userId, userIdNum),
          eq(clips.date, date as string),
          eq(clips.timeSlot, timeSlotNum)
        )
      )
      .limit(1);

    if (existingClip.length > 0) {
      // Update existing clip
      await db
        .update(clips)
        .set({
          storageKey: key,
          storageUrl: url,
        })
        .where(eq(clips.id, existingClip[0].id));
      console.log(`[Upload] Updated existing clip record: ${existingClip[0].id}`);
    } else {
      // Insert new clip
      await db.insert(clips).values({
        roomId: roomIdNum,
        userId: userIdNum,
        date: date as string,
        timeSlot: timeSlotNum,
        storageKey: key,
        storageUrl: url,
      });
      console.log(`[Upload] Created new clip record`);
    }

    res.json({ success: true, url, key });
  } catch (error) {
    console.error("[Upload] Error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
