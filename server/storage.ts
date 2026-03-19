import type { TimeEntry, InsertTimeEntry, User, InsertUser, SavedAddress, InsertAddress, LeaveRequest, InsertLeaveRequest, DaySession, InsertDaySession, GpsWaypoint, InsertGpsWaypoint } from "@shared/schema";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUserPassword(id: number, newPassword: string): Promise<boolean>;
  updateUser(id: number, data: { name?: string; email?: string; role?: string; holidayAllowance?: number }): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getUserDataSummary(id: number): Promise<{ timeEntries: number; daySessions: number; leaveRequests: number }>;
  resetUserPassword(id: number, newPassword: string): Promise<boolean>;

  // Time entries
  getTimeEntries(userId: number, date: string): Promise<TimeEntry[]>;
  getAllEntriesForDate(date: string): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;
  getRunningEntry(userId: number): Promise<TimeEntry | undefined>;
  getWeekSummary(userId: number, startDate: string, endDate: string): Promise<TimeEntry[]>;
  getEntriesForExport(filters: { startDate: string; endDate: string; userId?: number }): Promise<TimeEntry[]>;

  // Addresses
  getAllAddresses(): Promise<SavedAddress[]>;
  createAddress(addr: InsertAddress): Promise<SavedAddress>;
  deleteAddress(id: number): Promise<boolean>;

  // Leave requests
  createLeaveRequest(req: InsertLeaveRequest): Promise<LeaveRequest>;
  getLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]>;
  getAllLeaveRequests(): Promise<LeaveRequest[]>;
  updateLeaveRequestStatus(id: number, status: string, reviewedBy: string): Promise<LeaveRequest | undefined>;
  cancelLeaveRequest(id: number): Promise<LeaveRequest | undefined>;
  getApprovedLeaveDays(userId: number, year: string): Promise<number>;

  // Day sessions
  createDaySession(session: InsertDaySession): Promise<DaySession>;
  getActiveDaySession(userId: number): Promise<DaySession | undefined>;
  endDaySession(id: number, endTime: string, totalMinutes: number, endLat?: string, endLng?: string): Promise<DaySession | undefined>;
  getDaySessionsByDate(userId: number, date: string): Promise<DaySession[]>;
  getDaySessionById(id: number): Promise<DaySession | undefined>;
  getAllDaySessionsForDate(date: string): Promise<DaySession[]>;

  // GPS waypoints
  createGpsWaypoint(wp: InsertGpsWaypoint): Promise<GpsWaypoint>;
  getWaypointsBySession(daySessionId: number): Promise<GpsWaypoint[]>;
  getLatestWaypointsForDate(date: string): Promise<GpsWaypoint[]>;
  getAllWaypointsForUserOnDate(userId: number, date: string): Promise<GpsWaypoint[]>;
  getDaySessionsByDateRange(userId: number, startDate: string, endDate: string): Promise<DaySession[]>;
}

/** Map a raw SQLite row (snake_case, integer booleans) to a TimeEntry */
function rowToTimeEntry(row: any): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    employeeName: row.employee_name,
    date: row.date,
    category: row.category,
    siteName: row.site_name ?? null,
    notes: row.notes ?? null,
    startTime: row.start_time,
    endTime: row.end_time ?? null,
    durationMinutes: row.duration_minutes ?? null,
    isRunning: row.is_running === 1 ? true : false,
    startLat: row.start_lat ?? null,
    startLng: row.start_lng ?? null,
    endLat: row.end_lat ?? null,
    endLng: row.end_lng ?? null,
    daySessionId: row.day_session_id ?? null,
  };
}

function rowToUser(row: any): User {
  return { id: row.id, name: row.name, email: row.email, password: row.password, role: row.role, holidayAllowance: row.holiday_allowance ?? 28 };
}

function rowToAddress(row: any): SavedAddress {
  return { id: row.id, name: row.name, address: row.address, addedBy: row.added_by };
}

function rowToLeaveRequest(row: any): LeaveRequest {
  return {
    id: row.id, userId: row.user_id, employeeName: row.employee_name,
    leaveType: row.leave_type, startDate: row.start_date, endDate: row.end_date,
    totalDays: row.total_days, reason: row.reason ?? null, status: row.status,
    reviewedBy: row.reviewed_by ?? null, createdAt: row.created_at,
  };
}

function rowToDaySession(row: any): DaySession {
  return {
    id: row.id, userId: row.user_id, employeeName: row.employee_name,
    date: row.date, startTime: row.start_time, endTime: row.end_time ?? null,
    totalMinutes: row.total_minutes ?? null, isActive: row.is_active === 1,
    startLat: row.start_lat ?? null, startLng: row.start_lng ?? null,
    endLat: row.end_lat ?? null, endLng: row.end_lng ?? null,
  };
}

function rowToGpsWaypoint(row: any): GpsWaypoint {
  return {
    id: row.id, daySessionId: row.day_session_id, userId: row.user_id,
    timestamp: row.timestamp, eventType: row.event_type, label: row.label ?? null,
    lat: row.lat, lng: row.lng,
  };
}

export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    const dbPath = path.resolve(process.cwd(), "data", "timesheet.db");
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.createTables();
    this.seedAdmin();
  }

  private createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'engineer',
        holiday_allowance INTEGER DEFAULT 28
      );

      CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        site_name TEXT,
        notes TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_minutes INTEGER,
        is_running INTEGER DEFAULT 0,
        start_lat TEXT,
        start_lng TEXT,
        end_lat TEXT,
        end_lng TEXT,
        day_session_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS saved_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        added_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leave_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        leave_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_days INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS day_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        total_minutes INTEGER,
        is_active INTEGER DEFAULT 1,
        start_lat TEXT,
        start_lng TEXT,
        end_lat TEXT,
        end_lng TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS gps_waypoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        label TEXT,
        lat TEXT NOT NULL,
        lng TEXT NOT NULL,
        FOREIGN KEY (day_session_id) REFERENCES day_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_entries_user_date ON time_entries(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_entries_date ON time_entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_running ON time_entries(user_id, is_running);
      CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
      CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_day_sessions_user ON day_sessions(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_day_sessions_active ON day_sessions(user_id, is_active);
      CREATE INDEX IF NOT EXISTS idx_gps_session ON gps_waypoints(day_session_id);
    `);

    // Migrations for existing databases
    try { this.db.prepare("SELECT holiday_allowance FROM users LIMIT 1").get(); } catch { this.db.exec("ALTER TABLE users ADD COLUMN holiday_allowance INTEGER DEFAULT 28"); }
    try { this.db.prepare("SELECT day_session_id FROM time_entries LIMIT 1").get(); } catch { this.db.exec("ALTER TABLE time_entries ADD COLUMN day_session_id INTEGER"); }
  }

  private seedAdmin() {
    const existing = this.db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get("admin@bgheat.co.uk");
    if (!existing) {
      this.db.prepare("INSERT INTO users (name, email, password, role, holiday_allowance) VALUES (?, ?, ?, ?, ?)").run("Admin", "admin@bgheat.co.uk", "admin", "admin", 28);
    }
  }

  // ===== USERS =====
  async createUser(user: InsertUser): Promise<User> {
    const ha = user.role === "subcontractor" ? 0 : (user.holidayAllowance ?? 28);
    const stmt = this.db.prepare("INSERT INTO users (name, email, password, role, holiday_allowance) VALUES (?, ?, ?, ?, ?)");
    const result = stmt.run(user.name, user.email, user.password, user.role ?? "engineer", ha);
    return { id: Number(result.lastInsertRowid), name: user.name, email: user.email, password: user.password, role: user.role ?? "engineer", holidayAllowance: ha };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email) as any;
    return row ? rowToUser(row) : undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    return row ? rowToUser(row) : undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return (this.db.prepare("SELECT * FROM users ORDER BY name").all() as any[]).map(rowToUser);
  }

  async updateUserPassword(id: number, newPassword: string): Promise<boolean> {
    const result = this.db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, id);
    return result.changes > 0;
  }

  async updateUser(id: number, data: { name?: string; email?: string; role?: string; holidayAllowance?: number }): Promise<User | undefined> {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.email !== undefined) { fields.push("email = ?"); values.push(data.email); }
    if (data.role !== undefined) { fields.push("role = ?"); values.push(data.role); }
    if (data.holidayAllowance !== undefined) { fields.push("holiday_allowance = ?"); values.push(data.holidayAllowance); }
    if (fields.length === 0) return this.getUserById(id);
    values.push(id);
    this.db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return this.getUserById(id);
  }

  async deleteUser(id: number): Promise<boolean> {
    // Delete all related data first (cascade)
    this.db.prepare("DELETE FROM gps_waypoints WHERE user_id = ?").run(id);
    this.db.prepare("DELETE FROM time_entries WHERE user_id = ?").run(id);
    this.db.prepare("DELETE FROM day_sessions WHERE user_id = ?").run(id);
    this.db.prepare("DELETE FROM leave_requests WHERE user_id = ?").run(id);
    const result = this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async getUserDataSummary(id: number): Promise<{ timeEntries: number; daySessions: number; leaveRequests: number }> {
    const te = (this.db.prepare("SELECT COUNT(*) as c FROM time_entries WHERE user_id = ?").get(id) as any)?.c || 0;
    const ds = (this.db.prepare("SELECT COUNT(*) as c FROM day_sessions WHERE user_id = ?").get(id) as any)?.c || 0;
    const lr = (this.db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE user_id = ?").get(id) as any)?.c || 0;
    return { timeEntries: te, daySessions: ds, leaveRequests: lr };
  }

  async resetUserPassword(id: number, newPassword: string): Promise<boolean> {
    return this.updateUserPassword(id, newPassword);
  }

  // ===== TIME ENTRIES =====
  async getTimeEntries(userId: number, date: string): Promise<TimeEntry[]> {
    return (this.db.prepare("SELECT * FROM time_entries WHERE user_id = ? AND date = ? ORDER BY start_time").all(userId, date) as any[]).map(rowToTimeEntry);
  }

  async getAllEntriesForDate(date: string): Promise<TimeEntry[]> {
    return (this.db.prepare("SELECT * FROM time_entries WHERE date = ? ORDER BY employee_name, start_time").all(date) as any[]).map(rowToTimeEntry);
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const stmt = this.db.prepare(`
      INSERT INTO time_entries (user_id, employee_name, date, category, site_name, notes, start_time, end_time, duration_minutes, is_running, start_lat, start_lng, end_lat, end_lng, day_session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.userId, entry.employeeName, entry.date, entry.category,
      entry.siteName ?? null, entry.notes ?? null, entry.startTime,
      entry.endTime ?? null, entry.durationMinutes ?? null,
      entry.isRunning ? 1 : 0,
      entry.startLat ?? null, entry.startLng ?? null,
      entry.endLat ?? null, entry.endLng ?? null,
      entry.daySessionId ?? null
    );
    return {
      id: Number(result.lastInsertRowid),
      userId: entry.userId, employeeName: entry.employeeName, date: entry.date,
      category: entry.category, siteName: entry.siteName ?? null, notes: entry.notes ?? null,
      startTime: entry.startTime, endTime: entry.endTime ?? null,
      durationMinutes: entry.durationMinutes ?? null, isRunning: entry.isRunning ?? false,
      startLat: entry.startLat ?? null, startLng: entry.startLng ?? null,
      endLat: entry.endLat ?? null, endLng: entry.endLng ?? null,
      daySessionId: entry.daySessionId ?? null,
    };
  }

  async updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const existing = this.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as any;
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: any[] = [];
    const fieldMap: Record<string, string> = {
      userId: "user_id", employeeName: "employee_name", date: "date", category: "category",
      siteName: "site_name", notes: "notes", startTime: "start_time", endTime: "end_time",
      durationMinutes: "duration_minutes", isRunning: "is_running",
      startLat: "start_lat", startLng: "start_lng", endLat: "end_lat", endLng: "end_lng",
      daySessionId: "day_session_id",
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (key in entry) {
        fields.push(`${col} = ?`);
        const val = (entry as any)[key];
        values.push(key === "isRunning" ? (val ? 1 : 0) : (val ?? null));
      }
    }
    if (fields.length === 0) return rowToTimeEntry(existing);

    values.push(id);
    this.db.prepare(`UPDATE time_entries SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    const updated = this.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as any;
    return rowToTimeEntry(updated);
  }

  async deleteTimeEntry(id: number): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM time_entries WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async getRunningEntry(userId: number): Promise<TimeEntry | undefined> {
    const row = this.db.prepare("SELECT * FROM time_entries WHERE user_id = ? AND is_running = 1 LIMIT 1").get(userId) as any;
    return row ? rowToTimeEntry(row) : undefined;
  }

  async getWeekSummary(userId: number, startDate: string, endDate: string): Promise<TimeEntry[]> {
    return (this.db.prepare("SELECT * FROM time_entries WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, start_time").all(userId, startDate, endDate) as any[]).map(rowToTimeEntry);
  }

  async getEntriesForExport(filters: { startDate: string; endDate: string; userId?: number }): Promise<TimeEntry[]> {
    if (filters.userId) {
      return (this.db.prepare("SELECT * FROM time_entries WHERE date >= ? AND date <= ? AND user_id = ? ORDER BY date, employee_name, start_time")
        .all(filters.startDate, filters.endDate, filters.userId) as any[]).map(rowToTimeEntry);
    }
    return (this.db.prepare("SELECT * FROM time_entries WHERE date >= ? AND date <= ? ORDER BY date, employee_name, start_time")
      .all(filters.startDate, filters.endDate) as any[]).map(rowToTimeEntry);
  }

  // ===== SAVED ADDRESSES =====
  async getAllAddresses(): Promise<SavedAddress[]> {
    return (this.db.prepare("SELECT * FROM saved_addresses ORDER BY name").all() as any[]).map(rowToAddress);
  }

  async createAddress(addr: InsertAddress): Promise<SavedAddress> {
    const stmt = this.db.prepare("INSERT INTO saved_addresses (name, address, added_by) VALUES (?, ?, ?)");
    const result = stmt.run(addr.name, addr.address, addr.addedBy);
    return { id: Number(result.lastInsertRowid), name: addr.name, address: addr.address, addedBy: addr.addedBy };
  }

  async deleteAddress(id: number): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM saved_addresses WHERE id = ?").run(id);
    return result.changes > 0;
  }

  // ===== LEAVE REQUESTS =====
  async createLeaveRequest(req: InsertLeaveRequest): Promise<LeaveRequest> {
    const stmt = this.db.prepare(`
      INSERT INTO leave_requests (user_id, employee_name, leave_type, start_date, end_date, total_days, reason, status, reviewed_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      req.userId, req.employeeName, req.leaveType, req.startDate, req.endDate,
      req.totalDays, req.reason ?? null, req.status ?? "pending", req.reviewedBy ?? null, req.createdAt
    );
    return {
      id: Number(result.lastInsertRowid),
      userId: req.userId, employeeName: req.employeeName, leaveType: req.leaveType,
      startDate: req.startDate, endDate: req.endDate, totalDays: req.totalDays,
      reason: req.reason ?? null, status: req.status ?? "pending", reviewedBy: req.reviewedBy ?? null,
      createdAt: req.createdAt,
    };
  }

  async getLeaveRequestsByUser(userId: number): Promise<LeaveRequest[]> {
    return (this.db.prepare("SELECT * FROM leave_requests WHERE user_id = ? ORDER BY created_at DESC").all(userId) as any[]).map(rowToLeaveRequest);
  }

  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    return (this.db.prepare("SELECT * FROM leave_requests ORDER BY created_at DESC").all() as any[]).map(rowToLeaveRequest);
  }

  async updateLeaveRequestStatus(id: number, status: string, reviewedBy: string): Promise<LeaveRequest | undefined> {
    const existing = this.db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
    if (!existing) return undefined;
    this.db.prepare("UPDATE leave_requests SET status = ?, reviewed_by = ? WHERE id = ?").run(status, reviewedBy, id);
    const updated = this.db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
    return rowToLeaveRequest(updated);
  }

  async cancelLeaveRequest(id: number): Promise<LeaveRequest | undefined> {
    const existing = this.db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
    if (!existing) return undefined;
    if (existing.status !== "pending") return undefined;
    this.db.prepare("UPDATE leave_requests SET status = 'cancelled' WHERE id = ?").run(id);
    const updated = this.db.prepare("SELECT * FROM leave_requests WHERE id = ?").get(id) as any;
    return rowToLeaveRequest(updated);
  }

  async getApprovedLeaveDays(userId: number, year: string): Promise<number> {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(total_days), 0) as total
      FROM leave_requests WHERE user_id = ? AND status = 'approved' AND start_date LIKE ?
    `).get(userId, `${year}%`) as any;
    return row?.total ?? 0;
  }

  // ===== DAY SESSIONS =====
  async createDaySession(session: InsertDaySession): Promise<DaySession> {
    const stmt = this.db.prepare(`
      INSERT INTO day_sessions (user_id, employee_name, date, start_time, end_time, total_minutes, is_active, start_lat, start_lng, end_lat, end_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      session.userId, session.employeeName, session.date, session.startTime,
      session.endTime ?? null, session.totalMinutes ?? null, session.isActive ? 1 : 1,
      session.startLat ?? null, session.startLng ?? null,
      session.endLat ?? null, session.endLng ?? null
    );
    return {
      id: Number(result.lastInsertRowid),
      userId: session.userId, employeeName: session.employeeName, date: session.date,
      startTime: session.startTime, endTime: session.endTime ?? null,
      totalMinutes: session.totalMinutes ?? null, isActive: true,
      startLat: session.startLat ?? null, startLng: session.startLng ?? null,
      endLat: session.endLat ?? null, endLng: session.endLng ?? null,
    };
  }

  async getActiveDaySession(userId: number): Promise<DaySession | undefined> {
    const row = this.db.prepare("SELECT * FROM day_sessions WHERE user_id = ? AND is_active = 1 LIMIT 1").get(userId) as any;
    return row ? rowToDaySession(row) : undefined;
  }

  async endDaySession(id: number, endTime: string, totalMinutes: number, endLat?: string, endLng?: string): Promise<DaySession | undefined> {
    this.db.prepare("UPDATE day_sessions SET end_time = ?, total_minutes = ?, is_active = 0, end_lat = ?, end_lng = ? WHERE id = ?")
      .run(endTime, totalMinutes, endLat ?? null, endLng ?? null, id);
    const row = this.db.prepare("SELECT * FROM day_sessions WHERE id = ?").get(id) as any;
    return row ? rowToDaySession(row) : undefined;
  }

  async getDaySessionsByDate(userId: number, date: string): Promise<DaySession[]> {
    return (this.db.prepare("SELECT * FROM day_sessions WHERE user_id = ? AND date = ? ORDER BY start_time").all(userId, date) as any[]).map(rowToDaySession);
  }

  async getDaySessionById(id: number): Promise<DaySession | undefined> {
    const row = this.db.prepare("SELECT * FROM day_sessions WHERE id = ?").get(id) as any;
    return row ? rowToDaySession(row) : undefined;
  }

  async getAllDaySessionsForDate(date: string): Promise<DaySession[]> {
    return (this.db.prepare("SELECT * FROM day_sessions WHERE date = ? ORDER BY employee_name, start_time").all(date) as any[]).map(rowToDaySession);
  }

  // ===== GPS WAYPOINTS =====
  async createGpsWaypoint(wp: InsertGpsWaypoint): Promise<GpsWaypoint> {
    const stmt = this.db.prepare(`
      INSERT INTO gps_waypoints (day_session_id, user_id, timestamp, event_type, label, lat, lng)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(wp.daySessionId, wp.userId, wp.timestamp, wp.eventType, wp.label ?? null, wp.lat, wp.lng);
    return {
      id: Number(result.lastInsertRowid),
      daySessionId: wp.daySessionId, userId: wp.userId, timestamp: wp.timestamp,
      eventType: wp.eventType, label: wp.label ?? null, lat: wp.lat, lng: wp.lng,
    };
  }

  async getWaypointsBySession(daySessionId: number): Promise<GpsWaypoint[]> {
    return (this.db.prepare("SELECT * FROM gps_waypoints WHERE day_session_id = ? ORDER BY timestamp").all(daySessionId) as any[]).map(rowToGpsWaypoint);
  }

  async getLatestWaypointsForDate(date: string): Promise<GpsWaypoint[]> {
    // Get the latest waypoint per user for all day sessions on a given date
    const rows = this.db.prepare(`
      SELECT gw.* FROM gps_waypoints gw
      INNER JOIN day_sessions ds ON gw.day_session_id = ds.id
      WHERE ds.date = ?
      AND gw.id IN (
        SELECT MAX(gw2.id) FROM gps_waypoints gw2
        INNER JOIN day_sessions ds2 ON gw2.day_session_id = ds2.id
        WHERE ds2.date = ?
        GROUP BY gw2.user_id
      )
      ORDER BY gw.timestamp DESC
    `).all(date, date) as any[];
    return rows.map(rowToGpsWaypoint);
  }

  async getAllWaypointsForUserOnDate(userId: number, date: string): Promise<GpsWaypoint[]> {
    const rows = this.db.prepare(`
      SELECT gw.* FROM gps_waypoints gw
      INNER JOIN day_sessions ds ON gw.day_session_id = ds.id
      WHERE gw.user_id = ? AND ds.date = ?
      ORDER BY gw.timestamp ASC
    `).all(userId, date) as any[];
    return rows.map(rowToGpsWaypoint);
  }

  async getDaySessionsByDateRange(userId: number, startDate: string, endDate: string): Promise<DaySession[]> {
    return (this.db.prepare(
      "SELECT * FROM day_sessions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, start_time"
    ).all(userId, startDate, endDate) as any[]).map(rowToDaySession);
  }
}

export const storage = new SqliteStorage();
