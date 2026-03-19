import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertTimeEntrySchema, insertAddressSchema, loginSchema, changePasswordSchema, leaveRequestSchema, insertDaySessionSchema, insertGpsWaypointSchema } from "@shared/schema";
import { z } from "zod";

// UK Bank Holidays 2026
const UK_BANK_HOLIDAYS_2026 = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-04", name: "Early May Bank Holiday" },
  { date: "2026-05-25", name: "Spring Bank Holiday" },
  { date: "2026-08-31", name: "Summer Bank Holiday" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-28", name: "Boxing Day (substitute)" },
];

function calculateWorkingDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) days++; // Exclude weekends
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // ===== AUTH =====
  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || user.password !== parsed.data.password) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, holidayAllowance: user.holidayAllowance });
  });

  // ===== CHANGE PASSWORD =====
  app.post("/api/auth/change-password", async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.password !== parsed.data.currentPassword) return res.status(401).json({ error: "Current password is incorrect" });

    await storage.updateUserPassword(userId, parsed.data.newPassword);
    res.json({ message: "Password changed successfully" });
  });

  // ===== UPDATE PROFILE =====
  app.patch("/api/auth/profile", async (req, res) => {
    const { userId, name, email } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    // Check email uniqueness if changing
    if (email) {
      const existing = await storage.getUserByEmail(email);
      if (existing && existing.id !== userId) return res.status(409).json({ error: "Email already in use" });
    }

    const updated = await storage.updateUser(userId, { name, email });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, holidayAllowance: updated.holidayAllowance });
  });

  // ===== USERS (admin) =====
  app.get("/api/users", async (_req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, holidayAllowance: u.holidayAllowance })));
  });

  // Admin: invite/create user
  app.post("/api/users", async (req, res) => {
    const { name, email, password, role, holidayAllowance } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const user = await storage.createUser({ name, email, password, role: role || "engineer", holidayAllowance: holidayAllowance ?? 28 });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, holidayAllowance: user.holidayAllowance });
  });

  // Admin: update user
  app.patch("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { name, email, role, holidayAllowance } = req.body;

    if (email) {
      const existing = await storage.getUserByEmail(email);
      if (existing && existing.id !== id) return res.status(409).json({ error: "Email already in use" });
    }

    const updated = await storage.updateUser(id, { name, email, role, holidayAllowance });
    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ id: updated.id, name: updated.name, email: updated.email, role: updated.role, holidayAllowance: updated.holidayAllowance });
  });

  // Admin: reset user password
  app.post("/api/users/:id/reset-password", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
    const success = await storage.resetUserPassword(id, newPassword);
    if (!success) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Password reset successfully" });
  });

  // Admin: delete user
  app.delete("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const deleted = await storage.deleteUser(id);
    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.status(204).send();
  });

  // ===== SAVED ADDRESSES =====
  app.get("/api/addresses", async (_req, res) => {
    const addrs = await storage.getAllAddresses();
    res.json(addrs);
  });

  app.post("/api/addresses", async (req, res) => {
    const parsed = insertAddressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const existing = await storage.getAllAddresses();
    const dupe = existing.find((a) => a.address.toLowerCase() === parsed.data.address.toLowerCase());
    if (dupe) return res.status(409).json({ error: "Address already saved" });
    const addr = await storage.createAddress(parsed.data);
    res.status(201).json(addr);
  });

  app.delete("/api/addresses/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const deleted = await storage.deleteAddress(id);
    if (!deleted) return res.status(404).json({ error: "Address not found" });
    res.status(204).send();
  });

  // ===== TIME ENTRIES =====
  app.get("/api/entries", async (req, res) => {
    const { userId, date } = req.query;
    if (!userId || !date) return res.status(400).json({ error: "userId and date required" });
    const entries = await storage.getTimeEntries(Number(userId), date as string);
    res.json(entries);
  });

  app.get("/api/entries/all", async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date required" });
    const entries = await storage.getAllEntriesForDate(date as string);
    res.json(entries);
  });

  app.get("/api/entries/range", async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate required" });
    const entries = await storage.getEntriesForExport({ startDate: startDate as string, endDate: endDate as string, userId: userId ? Number(userId) : undefined });
    res.json(entries);
  });

  app.get("/api/entries/running", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const entry = await storage.getRunningEntry(Number(userId));
    res.json(entry || null);
  });

  app.get("/api/entries/week", async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    if (!userId || !startDate || !endDate) return res.status(400).json({ error: "userId, startDate, endDate required" });
    const entries = await storage.getWeekSummary(Number(userId), startDate as string, endDate as string);
    res.json(entries);
  });

  app.post("/api/entries", async (req, res) => {
    const parsed = insertTimeEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const entry = await storage.createTimeEntry(parsed.data);
    res.status(201).json(entry);
  });

  app.patch("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const entry = await storage.updateTimeEntry(id, req.body);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.json(entry);
  });

  app.delete("/api/entries/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const deleted = await storage.deleteTimeEntry(id);
    if (!deleted) return res.status(404).json({ error: "Entry not found" });
    res.status(204).send();
  });

  // ===== CSV EXPORT =====
  app.get("/api/export/csv", async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: "startDate and endDate required" });
    const entries = await storage.getEntriesForExport({ startDate: startDate as string, endDate: endDate as string, userId: userId ? Number(userId) : undefined });
    const header = "Date,Employee,Category,Site,Notes,Start,End,Duration (mins),GPS Start,GPS End";
    const rows = entries.map((e) => [e.date, `"${e.employeeName}"`, e.category, `"${e.siteName || ""}"`, `"${(e.notes || "").replace(/"/g, '""')}"`, e.startTime, e.endTime || "", e.durationMinutes || "", e.startLat ? `${e.startLat} ${e.startLng}` : "", e.endLat ? `${e.endLat} ${e.endLng}` : ""].join(","));
    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=timesheet-${startDate}-to-${endDate}.csv`);
    res.send(csv);
  });

  // ===== LEAVE REQUESTS =====
  app.post("/api/leave", async (req, res) => {
    const { userId, employeeName, ...rest } = req.body;
    const parsed = leaveRequestSchema.safeParse(rest);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    if (!userId || !employeeName) return res.status(400).json({ error: "userId and employeeName required" });

    const totalDays = calculateWorkingDays(parsed.data.startDate, parsed.data.endDate);
    if (totalDays <= 0) return res.status(400).json({ error: "Invalid date range" });

    const leaveRequest = await storage.createLeaveRequest({
      userId,
      employeeName,
      leaveType: parsed.data.leaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      totalDays,
      reason: parsed.data.reason ?? null,
      status: "pending",
      reviewedBy: null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(leaveRequest);
  });

  // Get leave requests for a user
  app.get("/api/leave", async (req, res) => {
    const { userId } = req.query;
    if (userId) {
      const requests = await storage.getLeaveRequestsByUser(Number(userId));
      return res.json(requests);
    }
    // If no userId, return all (admin view)
    const requests = await storage.getAllLeaveRequests();
    res.json(requests);
  });

  // Admin: approve/reject leave request
  app.patch("/api/leave/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const { status, reviewedBy } = req.body;
    if (!status || !reviewedBy) return res.status(400).json({ error: "status and reviewedBy required" });
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be approved or rejected" });

    const updated = await storage.updateLeaveRequestStatus(id, status, reviewedBy);
    if (!updated) return res.status(404).json({ error: "Leave request not found" });
    res.json(updated);
  });

  // Cancel leave request (by the user)
  app.post("/api/leave/:id/cancel", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const cancelled = await storage.cancelLeaveRequest(id);
    if (!cancelled) return res.status(400).json({ error: "Can only cancel pending requests" });
    res.json(cancelled);
  });

  // Get leave summary for a user (approved days used this year)
  app.get("/api/leave/summary", async (req, res) => {
    const { userId, year } = req.query;
    if (!userId || !year) return res.status(400).json({ error: "userId and year required" });
    const usedDays = await storage.getApprovedLeaveDays(Number(userId), year as string);
    const user = await storage.getUserById(Number(userId));
    res.json({
      usedDays,
      totalAllowance: user?.holidayAllowance ?? 28,
      remainingDays: (user?.holidayAllowance ?? 28) - usedDays,
    });
  });

  // ===== BANK HOLIDAYS =====
  app.get("/api/bank-holidays", async (_req, res) => {
    res.json(UK_BANK_HOLIDAYS_2026);
  });

  // ===== DAY SESSIONS =====
  // Start a day
  app.post("/api/day-sessions", async (req, res) => {
    const { userId, employeeName, lat, lng } = req.body;
    if (!userId || !employeeName) return res.status(400).json({ error: "userId and employeeName required" });

    // Check for existing active session
    const existing = await storage.getActiveDaySession(userId);
    if (existing) return res.status(409).json({ error: "You already have an active day session. Stop it first." });

    const now = new Date();
    const session = await storage.createDaySession({
      userId,
      employeeName,
      date: format_date(now),
      startTime: format_time(now),
      endTime: null,
      totalMinutes: null,
      isActive: true,
      startLat: lat || null,
      startLng: lng || null,
      endLat: null,
      endLng: null,
    });

    // Log GPS waypoint for day start
    if (lat && lng) {
      await storage.createGpsWaypoint({
        daySessionId: session.id,
        userId,
        timestamp: now.toISOString(),
        eventType: "day_start",
        label: "Day started",
        lat,
        lng,
      });
    }

    res.status(201).json(session);
  });

  // Get active day session
  app.get("/api/day-sessions/active", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const session = await storage.getActiveDaySession(Number(userId));
    res.json(session || null);
  });

  // End a day session
  app.post("/api/day-sessions/:id/end", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const session = await storage.getDaySessionById(id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!session.isActive) return res.status(400).json({ error: "Session already ended" });

    const now = new Date();
    const startTime = new Date(`${session.date}T${session.startTime}`);
    const totalMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000);

    const { lat, lng } = req.body;
    const ended = await storage.endDaySession(id, format_time(now), totalMinutes, lat || undefined, lng || undefined);

    // Log GPS waypoint for day end
    if (lat && lng) {
      await storage.createGpsWaypoint({
        daySessionId: id,
        userId: session.userId,
        timestamp: now.toISOString(),
        eventType: "day_end",
        label: "Day ended",
        lat,
        lng,
      });
    }

    // Also stop any running time entries for this user
    const running = await storage.getRunningEntry(session.userId);
    if (running) {
      const entryStart = new Date(`${running.date}T${running.startTime}`);
      await storage.updateTimeEntry(running.id, {
        endTime: format_time(now),
        durationMinutes: Math.round((now.getTime() - entryStart.getTime()) / 60000),
        isRunning: false,
        endLat: lat || null,
        endLng: lng || null,
      });
    }

    res.json(ended);
  });

  // Get day sessions for a user in a date range (monthly timesheet)
  app.get("/api/day-sessions/range", async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    if (!userId || !startDate || !endDate) return res.status(400).json({ error: "userId, startDate, endDate required" });
    const sessions = await storage.getDaySessionsByDateRange(Number(userId), startDate as string, endDate as string);
    res.json(sessions);
  });

  // Get day sessions for all users on a date (admin view) — must come before /api/day-sessions
  app.get("/api/day-sessions/all", async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date required" });
    const sessions = await storage.getAllDaySessionsForDate(date as string);
    res.json(sessions);
  });

  // Get day sessions by date for user
  app.get("/api/day-sessions", async (req, res) => {
    const { userId, date } = req.query;
    if (!userId || !date) return res.status(400).json({ error: "userId and date required" });
    const sessions = await storage.getDaySessionsByDate(Number(userId), date as string);
    res.json(sessions);
  });

  // ===== GPS WAYPOINTS =====
  app.post("/api/gps-waypoints", async (req, res) => {
    const { daySessionId, userId, eventType, label, lat, lng } = req.body;
    if (!daySessionId || !userId || !eventType || !lat || !lng) {
      return res.status(400).json({ error: "daySessionId, userId, eventType, lat, lng required" });
    }
    const wp = await storage.createGpsWaypoint({
      daySessionId,
      userId,
      timestamp: new Date().toISOString(),
      eventType,
      label: label || null,
      lat,
      lng,
    });
    res.status(201).json(wp);
  });

  app.get("/api/gps-waypoints", async (req, res) => {
    const { daySessionId } = req.query;
    if (!daySessionId) return res.status(400).json({ error: "daySessionId required" });
    const waypoints = await storage.getWaypointsBySession(Number(daySessionId));
    res.json(waypoints);
  });

  // All GPS waypoints for a specific user on a date (for journey line)
  app.get("/api/gps-waypoints/user", async (req, res) => {
    const { userId, date } = req.query;
    if (!userId || !date) return res.status(400).json({ error: "userId and date required" });
    const waypoints = await storage.getAllWaypointsForUserOnDate(Number(userId), date as string);
    res.json(waypoints);
  });

  // Latest GPS position per user for a given date
  app.get("/api/gps-waypoints/latest", async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date required" });
    const waypoints = await storage.getLatestWaypointsForDate(date as string);
    res.json(waypoints);
  });
}

// Helper: format date as yyyy-MM-dd
function format_date(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Helper: format time as HH:mm
function format_time(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
