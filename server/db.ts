import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { clips, InsertUser, roomMembers, rooms, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── User helpers ──────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Room helpers ──────────────────────────────────────────────────────────────

export async function createRoom(name: string, inviteCode: string, createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(rooms).values({ name, inviteCode, createdBy });
  const insertId = (result as any).insertId as number;
  // Add creator as first member
  await db.insert(roomMembers).values({ roomId: insertId, userId: createdBy });
  const room = await db.select().from(rooms).where(eq(rooms.id, insertId)).limit(1);
  return room[0];
}

export async function getRoomByInviteCode(inviteCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(rooms).where(eq(rooms.inviteCode, inviteCode)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getRoomById(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserRooms(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get all room IDs the user is a member of
  const memberRows = await db.select().from(roomMembers).where(eq(roomMembers.userId, userId));
  if (memberRows.length === 0) return [];
  const roomIds = memberRows.map(m => m.roomId);
  // Fetch rooms
  const result = [];
  for (const roomId of roomIds) {
    const room = await getRoomById(roomId);
    if (room) {
      const members = await getRoomMembers(roomId);
      result.push({ ...room, memberCount: members.length });
    }
  }
  return result;
}

export async function getRoomMembers(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: roomMembers.id,
      roomId: roomMembers.roomId,
      userId: roomMembers.userId,
      joinedAt: roomMembers.joinedAt,
      userName: users.name,
      userOpenId: users.openId,
    })
    .from(roomMembers)
    .innerJoin(users, eq(roomMembers.userId, users.id))
    .where(eq(roomMembers.roomId, roomId));
  return rows;
}

export async function isRoomMember(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1);
  return result.length > 0;
}

export async function joinRoom(roomId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check member count
  const members = await getRoomMembers(roomId);
  if (members.length >= 4) throw new Error("Room is full (max 4 members)");
  // Check already member
  const already = await isRoomMember(roomId, userId);
  if (already) return { alreadyMember: true };
  await db.insert(roomMembers).values({ roomId, userId });
  return { alreadyMember: false };
}

// ── Clip helpers ──────────────────────────────────────────────────────────────

export async function upsertClip(
  roomId: number,
  userId: number,
  date: string,
  timeSlot: number,
  storageKey: string,
  storageUrl: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if clip exists for this room/user/date/timeSlot
  const existing = await db
    .select()
    .from(clips)
    .where(
      and(
        eq(clips.roomId, roomId),
        eq(clips.userId, userId),
        eq(clips.date, date),
        eq(clips.timeSlot, timeSlot)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(clips)
      .set({ storageKey, storageUrl, updatedAt: new Date() })
      .where(eq(clips.id, existing[0].id));
    return { ...existing[0], storageKey, storageUrl };
  } else {
    // Insert new
    const [result] = await db.insert(clips).values({ roomId, userId, date, timeSlot, storageKey, storageUrl });
    const insertId = (result as any).insertId as number;
    const newClip = await db.select().from(clips).where(eq(clips.id, insertId)).limit(1);
    return newClip[0];
  }
}

export async function getClipsForSlot(roomId: number, date: string, timeSlot: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: clips.id,
      roomId: clips.roomId,
      userId: clips.userId,
      date: clips.date,
      timeSlot: clips.timeSlot,
      storageKey: clips.storageKey,
      storageUrl: clips.storageUrl,
      createdAt: clips.createdAt,
      updatedAt: clips.updatedAt,
      userName: users.name,
      userOpenId: users.openId,
    })
    .from(clips)
    .innerJoin(users, eq(clips.userId, users.id))
    .where(
      and(
        eq(clips.roomId, roomId),
        eq(clips.date, date),
        eq(clips.timeSlot, timeSlot)
      )
    );
  return rows;
}

export async function getAvailableSlots(roomId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get distinct date+timeSlot combos that have at least one clip
  const rows = await db
    .selectDistinct({ date: clips.date, timeSlot: clips.timeSlot })
    .from(clips)
    .where(eq(clips.roomId, roomId));
  return rows;
}
