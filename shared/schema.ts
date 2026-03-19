import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const activityCategories = [
  "Travel",
  "Merchant Trip",
  "Training",
  "Office",
  "Plumbing",
  "Heating",
  "Gas Work",
  "Electrical",
  "Commissioning",
  "Break",
] as const;

export type ActivityCategory = (typeof activityCategories)[number];

export const userRoles = ["admin", "engineer", "subcontractor"] as const;
export type UserRole = (typeof userRoles)[number];

export const leaveTypes = [
  "Annual Leave",
  "Bank Holiday",
  "Sick Leave",
  "Unpaid Leave",
  "Other",
] as const;

export type LeaveType = (typeof leaveTypes)[number];

export const leaveStatuses = ["pending", "approved", "rejected", "cancelled"] as const;
export type LeaveStatus = (typeof leaveStatuses)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("engineer"),
  holidayAllowance: integer("holiday_allowance").default(28),
});

export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  employeeName: text("employee_name").notNull(),
  date: text("date").notNull(),
  category: text("category").notNull(),
  siteName: text("site_name"),
  notes: text("notes"),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  durationMinutes: integer("duration_minutes"),
  isRunning: boolean("is_running").default(false),
  startLat: text("start_lat"),
  startLng: text("start_lng"),
  endLat: text("end_lat"),
  endLng: text("end_lng"),
  daySessionId: integer("day_session_id"),
});

export const savedAddresses = pgTable("saved_addresses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  addedBy: text("added_by").notNull(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  employeeName: text("employee_name").notNull(),
  leaveType: text("leave_type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  totalDays: integer("total_days").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  createdAt: text("created_at").notNull(),
});

// Day sessions — the "master" tracker for a full working day
export const daySessions = pgTable("day_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  employeeName: text("employee_name").notNull(),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  totalMinutes: integer("total_minutes"),
  isActive: boolean("is_active").default(true),
  startLat: text("start_lat"),
  startLng: text("start_lng"),
  endLat: text("end_lat"),
  endLng: text("end_lng"),
});

// GPS waypoints logged during a day session
export const gpsWaypoints = pgTable("gps_waypoints", {
  id: serial("id").primaryKey(),
  daySessionId: integer("day_session_id").notNull(),
  userId: integer("user_id").notNull(),
  timestamp: text("timestamp").notNull(),
  eventType: text("event_type").notNull(), // "day_start", "day_end", "activity_start", "activity_stop", "travel_start", "travel_stop"
  label: text("label"), // e.g. "Started Plumbing at 42 Park Road"
  lat: text("lat").notNull(),
  lng: text("lng").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true });
export const insertAddressSchema = createInsertSchema(savedAddresses).omit({ id: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true });
export const insertDaySessionSchema = createInsertSchema(daySessions).omit({ id: true });
export const insertGpsWaypointSchema = createInsertSchema(gpsWaypoints).omit({ id: true });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(4),
  role: z.enum(["admin", "engineer", "subcontractor"]).default("engineer"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(4),
  newPassword: z.string().min(4),
});

export const leaveRequestSchema = z.object({
  leaveType: z.enum(["Annual Leave", "Bank Holiday", "Sick Leave", "Unpaid Leave", "Other"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertAddress = z.infer<typeof insertAddressSchema>;
export type SavedAddress = typeof savedAddresses.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertDaySession = z.infer<typeof insertDaySessionSchema>;
export type DaySession = typeof daySessions.$inferSelect;
export type InsertGpsWaypoint = z.infer<typeof insertGpsWaypointSchema>;
export type GpsWaypoint = typeof gpsWaypoints.$inferSelect;
