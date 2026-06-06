import { Router, Request, Response } from "express";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { roomMembers } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

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
 * Body: raw binary video data
 * Content-Type: video/webm or video/mp4
 */
router.post("/uploadClip", async (req: Request, res: Response) => {
  try {
    const { roomId, userId, date, timeSlot } = req.query;

    // Validate inputs
    if (!roomId || !userId || !date || timeSlot === undefined) {
      return res.status(400).json({ error: "Missing required query parameters" });
    }

    const roomIdNum = Number(roomId);
    const userIdNum = Number(userId);
    const timeSlotNum = Number(timeSlot);

    if (isNaN(roomIdNum) || isNaN(userIdNum) || isNaN(timeSlotNum)) {
      return res.status(400).json({ error: "Invalid parameter types" });
    }

    if (timeSlotNum < 0 || timeSlotNum > 23) {
      return res.status(400).json({ error: "timeSlot must be 0-23" });
    }

    // Check if user is member of room
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "Database not available" });
    }

    const membership = await db
      .select()
      .from(roomMembers)
      .where(
        eq(roomMembers.roomId, roomIdNum) &&
        eq(roomMembers.userId, userIdNum)
      )
      .limit(1);

    if (membership.length === 0) {
      return res.status(403).json({ error: "User is not a member of this room" });
    }

    // Get raw binary data from request body
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", async () => {
      try {
        const videoBuffer = Buffer.concat(chunks);
        console.log(`[Upload] Room ${roomIdNum}, User ${userIdNum}, Date ${date}, Slot ${timeSlotNum}, Size: ${videoBuffer.length} bytes`);

        if (videoBuffer.length === 0) {
          return res.status(400).json({ error: "Empty video data" });
        }

        // Determine file extension from Content-Type
        const contentType = req.headers["content-type"] || "video/webm";
        const ext = contentType.includes("mp4") ? "mp4" : "webm";
        const mimeType = contentType.includes("mp4") ? "video/mp4" : "video/webm";

        // Store in S3
        const key = `clips/${roomIdNum}/${userIdNum}/${date}/${timeSlotNum}.${ext}`;
        const { url } = await storagePut(key, videoBuffer, mimeType);

        console.log(`[Upload] Stored at ${key}, URL: ${url}`);

        res.json({ success: true, url, key });
      } catch (error) {
        console.error("[Upload] Error during storage:", error);
        res.status(500).json({ error: "Storage failed" });
      }
    });

    req.on("error", (error) => {
      console.error("[Upload] Request error:", error);
      res.status(400).json({ error: "Request error" });
    });
  } catch (error) {
    console.error("[Upload] Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
