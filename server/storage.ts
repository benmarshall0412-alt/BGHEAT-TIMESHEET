import type { TimeEntry, InsertTimeEntry, User, InsertUser, SavedAddress, InsertAddress } from "@shared/schema";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getTimeEntries(userId: number, date: string): Promise<TimeEntry[]>;
  getAllEntriesForDate(date: string): Promise<TimeEntry[]>;
  createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<boolean>;
  getRunningEntry(userId: number): Promise<TimeEntry | undefined>;
  getWeekSummary(userId: number, startDate: string, endDate: string): Promise<TimeEntry[]>;
  getEntriesForExport(filters: { startDate: string; endDate: string; userId?: number }): Promise<TimeEntry[]>;
  getAllAddresses(): Promise<SavedAddress[]>;
  createAddress(addr: InsertAddress): Promise<SavedAddress>;
  deleteAddress(id: number): Promise<boolean>;
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
  };
}

function rowToUser(row: any): User {
  return { id: row.id, name: row.name, email: row.email, password: row.password, role: row.role };
}

function rowToAddress(row: any): SavedAddress {
  return { id: row.id, name: row.name, address: row.address, addedBy: row.added_by };
}

export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor() {
    // Store database file next to the server code so it persists across restarts
    const dbPath = path.resolve(process.cwd(), "data", "timesheet.db");

    // Ensure the data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Better concurrent performance
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
        role TEXT NOT NULL DEFAULT 'engineer'
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
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS saved_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        added_by TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entries_user_date ON time_entries(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_entries_date ON time_entries(date);
      CREATE INDEX IF NOT EXISTS idx_entries_running ON time_entries(user_id, is_running);
    `);
  }

  private seedAdmin() {
    const existing = this.db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get("admin@bgheat.co.uk");
    if (!existing) {
      this.db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run("Admin", "admin@bgheat.co.uk", "admin", "admin");
    }
  }

  // ===== USERS =====
  async createUser(user: InsertUser): Promise<User> {
    const stmt = this.db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)");
    const result = stmt.run(user.name, user.email, user.password, user.role ?? "engineer");
    return { id: Number(result.lastInsertRowid), name: user.name, email: user.email, password: user.password, role: user.role ?? "engineer" };
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

  // ===== TIME ENTRIES =====
  async getTimeEntries(userId: number, date: string): Promise<TimeEntry[]> {
    return (this.db.prepare("SELECT * FROM time_entries WHERE user_id = ? AND date = ? ORDER BY start_time").all(userId, date) as any[]).map(rowToTimeEntry);
  }

  async getAllEntriesForDate(date: string): Promise<TimeEntry[]> {
    return (this.db.prepare("SELECT * FROM time_entries WHERE date = ? ORDER BY employee_name, start_time").all(date) as any[]).map(rowToTimeEntry);
  }

  async createTimeEntry(entry: InsertTimeEntry): Promise<TimeEntry> {
    const stmt = this.db.prepare(`
      INSERT INTO time_entries (user_id, employee_name, date, category, site_name, notes, start_time, end_time, duration_minutes, is_running, start_lat, start_lng, end_lat, end_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      entry.userId, entry.employeeName, entry.date, entry.category,
      entry.siteName ?? null, entry.notes ?? null, entry.startTime,
      entry.endTime ?? null, entry.durationMinutes ?? null,
      entry.isRunning ? 1 : 0,
      entry.startLat ?? null, entry.startLng ?? null,
      entry.endLat ?? null, entry.endLng ?? null
    );
    return {
      id: Number(result.lastInsertRowid),
      userId: entry.userId, employeeName: entry.employeeName, date: entry.date,
      category: entry.category, siteName: entry.siteName ?? null, notes: entry.notes ?? null,
      startTime: entry.startTime, endTime: entry.endTime ?? null,
      durationMinutes: entry.durationMinutes ?? null, isRunning: entry.isRunning ?? false,
      startLat: entry.startLat ?? null, startLng: entry.startLng ?? null,
      endLat: entry.endLat ?? null, endLng: entry.endLng ?? null,
    };
  }

  async updateTimeEntry(id: number, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    const existing = this.db.prepare("SELECT * FROM time_entries WHERE id = ?").get(id) as any;
    if (!existing) return undefined;

    // Build dynamic SET clause from provided fields
    const fields: string[] = [];
    const values: any[] = [];
    const fieldMap: Record<string, string> = {
      userId: "user_id", employeeName: "employee_name", date: "date", category: "category",
      siteName: "site_name", notes: "notes", startTime: "start_time", endTime: "end_time",
      durationMinutes: "duration_minutes", isRunning: "is_running",
      startLat: "start_lat", startLng: "start_lng", endLat: "end_lat", endLng: "end_lng",
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
}

export const storage = new SqliteStorage();
