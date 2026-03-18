import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertTimeEntrySchema, insertAddressSchema, loginSchema, registerSchema } from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // ===== AUTH =====
  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const existing = await storage.getUserByEmail(parsed.data.email);
    if (existing) return res.status(409).json({ error: "Email already registered" });
    const user = await storage.createUser({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password, role: parsed.data.role });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const user = await storage.getUserByEmail(parsed.data.email);
    if (!user || user.password !== parsed.data.password) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  });

  // ===== USERS =====
  app.get("/api/users", async (_req, res) => {
    const users = await storage.getAllUsers();
    res.json(users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })));
  });

  // ===== SAVED ADDRESSES =====
  app.get("/api/addresses", async (_req, res) => {
    const addrs = await storage.getAllAddresses();
    res.json(addrs);
  });

  app.post("/api/addresses", async (req, res) => {
    const parsed = insertAddressSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    // Check for duplicates by address text
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
}
