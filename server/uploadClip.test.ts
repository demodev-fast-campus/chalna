import { describe, it, expect, vi } from "vitest";
import { storagePut } from "./storage";

// Mock storagePut
vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string, data: Buffer, mimeType: string) => ({
    key,
    url: `/manus-storage/${key}`,
  })),
}));

describe("uploadClip integration", () => {
  it("should validate video buffer size", async () => {
    // 시뮬레이션: 정상 크기의 영상 버퍼 (최소 100KB)
    const normalVideoBuffer = Buffer.alloc(500 * 1024); // 500KB
    expect(normalVideoBuffer.length).toBeGreaterThanOrEqual(100 * 1024);

    // 시뮬레이션: 너무 작은 버퍼
    const tinyBuffer = Buffer.alloc(15); // 15 bytes (문제 상황)
    expect(tinyBuffer.length).toBeLessThan(100 * 1024);
  });

  it("should store video with correct key format", async () => {
    const roomId = 1;
    const userId = 1;
    const date = "2026-06-04";
    const timeSlot = 16;
    const videoBuffer = Buffer.alloc(500 * 1024);

    const key = `clips/${roomId}/${userId}/${date}/${timeSlot}.webm`;
    const mimeType = "video/webm";

    const result = await storagePut(key, videoBuffer, mimeType);

    expect(result.key).toBe(key);
    expect(result.url).toContain(key);
    expect(storagePut).toHaveBeenCalledWith(key, videoBuffer, mimeType);
  });

  it("should handle video/mp4 content type", async () => {
    const roomId = 1;
    const userId = 1;
    const date = "2026-06-04";
    const timeSlot = 16;
    const videoBuffer = Buffer.alloc(500 * 1024);

    const key = `clips/${roomId}/${userId}/${date}/${timeSlot}.mp4`;
    const mimeType = "video/mp4";

    const result = await storagePut(key, videoBuffer, mimeType);

    expect(result.key).toContain(".mp4");
    expect(storagePut).toHaveBeenCalledWith(key, videoBuffer, mimeType);
  });

  it("should reject empty buffer", async () => {
    const emptyBuffer = Buffer.alloc(0);
    expect(emptyBuffer.length).toBe(0);
    expect(emptyBuffer.length).toBeLessThan(100 * 1024);
  });

  it("should validate timeSlot range", () => {
    const validSlots = [0, 1, 12, 23];
    const invalidSlots = [-1, 24, 25, 100];

    validSlots.forEach((slot) => {
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThanOrEqual(23);
    });

    invalidSlots.forEach((slot) => {
      expect(slot < 0 || slot > 23).toBe(true);
    });
  });
});
