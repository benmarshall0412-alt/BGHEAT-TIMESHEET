import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  ChevronLeft, ChevronRight, Download, Flame, LogOut, Clock,
  ClipboardCheck, HardHat, Wrench, Settings, Phone, PhoneOff,
  Truck, ShoppingBag, MapPin, ArrowLeft, Users, FileSpreadsheet, GraduationCap,
  UserPlus, Trash2, KeyRound, CheckCircle2, XCircle, TreePalm, Edit, Save, X,
  Activity, Eye, PlayCircle, StopCircle, Navigation, Map as MapIcon, FileText, CalendarDays, Printer
} from "lucide-react";
import { format, addDays, subDays, startOfWeek, endOfWeek, subWeeks, addWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { Link } from "wouter";
import type { TimeEntry, LeaveRequest, DaySession, GpsWaypoint } from "@shared/schema";
import type { AuthUser } from "@/App";

const categoryIcons: Record<string, React.ReactNode> = {
  "Free Survey / Meeting": <ClipboardCheck className="w-3.5 h-3.5" />,
  "Installation": <HardHat className="w-3.5 h-3.5" />,
  "Repair / Maintenance": <Wrench className="w-3.5 h-3.5" />,
  "Service": <Settings className="w-3.5 h-3.5" />,
  "Call Out": <Phone className="w-3.5 h-3.5" />,
  "Out of Hours Call Out": <PhoneOff className="w-3.5 h-3.5" />,
  "Travel Time": <Truck className="w-3.5 h-3.5" />,
  "At the Merchants": <ShoppingBag className="w-3.5 h-3.5" />,
  "Training": <GraduationCap className="w-3.5 h-3.5" />,
};

const categoryColors: Record<string, string> = {
  "Free Survey / Meeting": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Installation": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Repair / Maintenance": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Service": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  "Call Out": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Out of Hours Call Out": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "Travel Time": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "At the Merchants": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Training": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
};

function formatDuration(minutes: number): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

type UserInfo = { id: number; name: string; email: string; role: string; holidayAllowance: number };

export default function AdminPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState("live");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/"><button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Timesheet</button></Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"><Flame className="w-4 h-4 text-primary-foreground" /></div>
              <span className="font-semibold text-sm">Admin Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
            <Button variant="ghost" size="icon" onClick={onLogout}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="live" data-testid="tab-live"><Activity className="w-4 h-4 mr-1" /> Live</TabsTrigger>
            <TabsTrigger value="timesheets" data-testid="tab-timesheets"><FileSpreadsheet className="w-4 h-4 mr-1" /> Timesheets</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users"><Users className="w-4 h-4 mr-1" /> Users</TabsTrigger>
            <TabsTrigger value="leave" data-testid="tab-leave"><TreePalm className="w-4 h-4 mr-1" /> Leave</TabsTrigger>
          </TabsList>

          <TabsContent value="live"><LiveTab user={user} /></TabsContent>
          <TabsContent value="timesheets"><TimesheetsTab user={user} /></TabsContent>
          <TabsContent value="users"><UsersTab user={user} /></TabsContent>
          <TabsContent value="leave"><LeaveTab user={user} /></TabsContent>
        </Tabs>

        <div className="mt-8">
          <PerplexityAttribution />
        </div>
      </main>
    </div>
  );
}

// ===== TEAM MAP COMPONENT =====
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function TeamMap({ users, latestWaypoints, todaySessions, filterUserId, onSelectUser }: {
  users: UserInfo[];
  latestWaypoints: GpsWaypoint[];
  todaySessions: DaySession[];
  filterUserId: string;
  onSelectUser: (id: string) => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Fetch all waypoints for a single user (journey line mode)
  const { data: userJourneyWaypoints = [] } = useQuery<GpsWaypoint[]>({
    queryKey: ["/api/gps-waypoints/user", filterUserId, today],
    queryFn: async () => {
      if (filterUserId === "all") return [];
      const r = await apiRequest("GET", `/api/gps-waypoints/user?userId=${filterUserId}&date=${today}`);
      return r.json();
    },
    enabled: filterUserId !== "all",
    refetchInterval: 30000,
  });

  // Load Leaflet
  useEffect(() => {
    if (document.querySelector('link[href*="leaflet"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = LEAFLET_CSS;
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;
    const initMap = () => {
      const L = (window as any).L;
      if (!L || mapInstance.current) return;
      mapInstance.current = L.map(mapRef.current, {
        center: [51.48, -3.18], // Cardiff default
        zoom: 12,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(mapInstance.current);
      setMapReady(true);
    };
    if ((window as any).L) { initMap(); }
    else {
      const check = setInterval(() => { if ((window as any).L) { clearInterval(check); initMap(); } }, 200);
      return () => clearInterval(check);
    }
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, []);

  // Clear map layers helper
  const clearMap = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
  };

  // Update markers — ALL USERS mode (pins only)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !mapReady) return;
    if (filterUserId !== "all") return; // handled by journey effect

    clearMap();

    if (latestWaypoints.length === 0) return;

    const bounds: [number, number][] = [];

    latestWaypoints.forEach(wp => {
      const lat = parseFloat(wp.lat);
      const lng = parseFloat(wp.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      const empUser = users.find(u => u.id === wp.userId);
      const empSession = todaySessions.find(s => s.userId === wp.userId);
      const name = empUser?.name || "Unknown";
      const initials = name.charAt(0).toUpperCase();
      const isActive = empSession?.isActive;

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width:36px;height:36px;border-radius:50%;background:${isActive ? "#16a34a" : "#64748b"};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">${initials}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const time = wp.timestamp ? new Date(wp.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
      const marker = L.marker([lat, lng], { icon }).addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:sans-serif;"><strong>${name}</strong><br/><span style="color:#666;font-size:12px;">${wp.label || wp.eventType.replace(/_/g, " ")}</span><br/><span style="color:#999;font-size:11px;">${time}</span></div>`);

      markersRef.current.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length === 1) {
      mapInstance.current.setView(bounds[0], 14);
    } else if (bounds.length > 1) {
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [latestWaypoints, filterUserId, users, todaySessions, mapReady]);

  // Update markers — SINGLE USER mode (journey line + numbered pins)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !mapReady) return;
    if (filterUserId === "all") return; // handled by all-users effect

    clearMap();

    if (userJourneyWaypoints.length === 0) return;

    const empUser = users.find(u => u.id === Number(filterUserId));
    const name = empUser?.name || "Unknown";
    const bounds: [number, number][] = [];
    const lineCoords: [number, number][] = [];

    userJourneyWaypoints.forEach((wp, idx) => {
      const lat = parseFloat(wp.lat);
      const lng = parseFloat(wp.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      lineCoords.push([lat, lng]);
      bounds.push([lat, lng]);

      const isFirst = idx === 0;
      const isLast = idx === userJourneyWaypoints.length - 1;
      const stepNum = idx + 1;

      // Green for first (start), red for last if day ended, blue for stops in between
      const bgColor = isFirst ? "#16a34a" : isLast && wp.eventType === "day_end" ? "#dc2626" : "#2563eb";
      const size = (isFirst || isLast) ? 34 : 28;
      const fontSize = (isFirst || isLast) ? 13 : 11;

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bgColor};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fontSize}px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${stepNum}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const time = wp.timestamp ? new Date(wp.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
      const eventLabel = wp.label || wp.eventType.replace(/_/g, " ");
      const marker = L.marker([lat, lng], { icon }).addTo(mapInstance.current)
        .bindPopup(`<div style="font-family:sans-serif;"><strong>${name}</strong><br/><span style="font-size:12px;font-weight:600;color:${bgColor};">#${stepNum}</span> <span style="color:#666;font-size:12px;">${eventLabel}</span><br/><span style="color:#999;font-size:11px;">${time}</span></div>`);

      markersRef.current.push(marker);
    });

    // Draw journey polyline
    if (lineCoords.length >= 2) {
      polylineRef.current = L.polyline(lineCoords, {
        color: "#2563eb",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 6",
      }).addTo(mapInstance.current);
    }

    if (bounds.length === 1) {
      mapInstance.current.setView(bounds[0], 15);
    } else if (bounds.length > 1) {
      mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [userJourneyWaypoints, filterUserId, users, mapReady]);

  const wpCount = filterUserId === "all"
    ? latestWaypoints.length
    : userJourneyWaypoints.length;

  return (
    <Card className="overflow-hidden relative" data-testid="card-team-map">
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{filterUserId === "all" ? "Team Map" : `${users.find(u => u.id === Number(filterUserId))?.name || "User"}'s Journey`}</h3>
          <Badge variant="secondary" className="text-xs">{wpCount} {filterUserId === "all" ? "location" : "stop"}{wpCount !== 1 ? "s" : ""}</Badge>
        </div>
        <Select value={filterUserId} onValueChange={onSelectUser}>
          <SelectTrigger className="w-[180px] h-8 text-sm" data-testid="select-map-user">
            <SelectValue placeholder="Filter user" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.filter(u => u.role !== "admin").map(u => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div ref={mapRef} style={{ height: 350, width: "100%" }} data-testid="map-container" />
      {wpCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: 60 }}>
          <div className="bg-background/80 backdrop-blur rounded-lg px-4 py-3 text-center">
            <Navigation className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">No GPS data yet today</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ===== LIVE TAB — See all employees' current status =====
function LiveTab({ user }: { user: AuthUser }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [mapSession, setMapSession] = useState<number | null>(null);
  const [mapFilterUser, setMapFilterUser] = useState("all");

  const { data: users = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/users"); return r.json(); },
  });

  const { data: todayEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/entries/range", today, today],
    queryFn: async () => { const r = await apiRequest("GET", `/api/entries/range?startDate=${today}&endDate=${today}`); return r.json(); },
    refetchInterval: 15000,
  });

  const { data: todaySessions = [] } = useQuery<DaySession[]>({
    queryKey: ["/api/day-sessions/all", today],
    queryFn: async () => { const r = await apiRequest("GET", `/api/day-sessions/all?date=${today}`); return r.json(); },
    refetchInterval: 15000,
  });

  const { data: latestWaypoints = [] } = useQuery<GpsWaypoint[]>({
    queryKey: ["/api/gps-waypoints/latest", today],
    queryFn: async () => { const r = await apiRequest("GET", `/api/gps-waypoints/latest?date=${today}`); return r.json(); },
    refetchInterval: 30000,
  });

  const { data: waypoints = [] } = useQuery<GpsWaypoint[]>({
    queryKey: ["/api/gps-waypoints", mapSession],
    queryFn: async () => {
      if (!mapSession) return [];
      const r = await apiRequest("GET", `/api/gps-waypoints?daySessionId=${mapSession}`);
      return r.json();
    },
    enabled: !!mapSession,
  });

  const nonAdminUsers = users.filter(u => u.role !== "admin");
  const activeTimers = todayEntries.filter(e => e.isRunning);
  const activeDaySessions = todaySessions.filter(s => s.isActive);
  const totalTodayMinutes = todayEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Team Map */}
      <TeamMap
        users={users}
        latestWaypoints={latestWaypoints}
        todaySessions={todaySessions}
        filterUserId={mapFilterUser}
        onSelectUser={setMapFilterUser}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Team</span></div>
          <p className="text-xl font-semibold">{nonAdminUsers.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs text-muted-foreground font-medium">Day Started</span></div>
          <p className="text-xl font-semibold">{activeDaySessions.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><PlayCircle className="w-4 h-4 text-green-500" /><span className="text-xs text-muted-foreground font-medium">Active Timers</span></div>
          <p className="text-xl font-semibold">{activeTimers.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Total Today</span></div>
          <p className="text-xl font-semibold">{formatDuration(totalTodayMinutes)}</p>
        </Card>
      </div>

      {/* Employee status list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Team Status — {format(new Date(), "EEEE, d MMMM")}</h2>

        {nonAdminUsers.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No engineers or subcontractors yet. Add users from the Users tab.</p>
          </Card>
        ) : (
          nonAdminUsers.map(emp => {
            const empEntries = todayEntries.filter(e => e.userId === emp.id);
            const empSession = todaySessions.find(s => s.userId === emp.id);
            const runningEntry = empEntries.find(e => e.isRunning);
            const empTotal = empEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
            const isExpanded = expandedUser === emp.id;

            let statusLabel = "Not started";
            let statusColor = "bg-slate-100 text-slate-600";
            if (empSession?.isActive && runningEntry) {
              statusLabel = `Working — ${runningEntry.category}`;
              statusColor = "bg-green-100 text-green-700";
            } else if (empSession?.isActive) {
              statusLabel = "Day started (idle)";
              statusColor = "bg-amber-100 text-amber-700";
            } else if (empSession && !empSession.isActive) {
              statusLabel = "Day ended";
              statusColor = "bg-blue-100 text-blue-700";
            } else if (empEntries.length > 0 && !runningEntry) {
              statusLabel = "Has entries (no day tracker)";
              statusColor = "bg-slate-100 text-slate-700";
            } else if (runningEntry) {
              statusLabel = `Working — ${runningEntry.category}`;
              statusColor = "bg-green-100 text-green-700";
            }

            return (
              <Card key={emp.id} className="overflow-hidden" data-testid={`card-live-${emp.id}`}>
                <button
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedUser(isExpanded ? null : emp.id)}
                  data-testid={`button-expand-${emp.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      {(empSession?.isActive || runningEntry) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-background" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{emp.name}</p>
                        <Badge variant="secondary" className="text-xs">{emp.role}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
                        {empSession?.isActive && empSession.startTime && (
                          <span className="text-xs text-muted-foreground">since {empSession.startTime}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatDuration(empTotal)}</p>
                    <p className="text-xs text-muted-foreground">{empEntries.length} entries</p>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
                    {/* Day session info */}
                    {empSession && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Day:</span>
                        <span>{empSession.startTime}</span>
                        {empSession.endTime ? (
                          <><span>—</span><span>{empSession.endTime}</span><span className="text-muted-foreground">({formatDuration(empSession.totalMinutes || 0)})</span></>
                        ) : (
                          <span className="text-green-600 font-medium">Active</span>
                        )}
                        {empSession.startLat && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setMapSession(mapSession === empSession.id ? null : empSession.id); }}
                            className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid={`button-map-${emp.id}`}
                          >
                            <MapIcon className="w-3 h-3" /> View Journey
                          </button>
                        )}
                      </div>
                    )}

                    {/* Journey Map */}
                    {mapSession === empSession?.id && waypoints.length > 0 && (
                      <Card className="p-3 bg-background">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> Journey Waypoints
                        </h4>
                        <div className="space-y-2">
                          {waypoints.map((wp, i) => (
                            <div key={wp.id} className="flex items-start gap-3">
                              <div className="flex flex-col items-center">
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${wp.eventType === "day_start" ? "bg-green-500" : wp.eventType === "day_end" ? "bg-red-500" : "bg-primary"}`} />
                                {i < waypoints.length - 1 && <div className="w-px h-6 bg-border" />}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{wp.label || wp.eventType.replace(/_/g, " ")}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(wp.timestamp), "HH:mm")} — {wp.lat}, {wp.lng}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Today's entries */}
                    {empEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No time entries today</p>
                    ) : (
                      <div className="space-y-1.5">
                        {empEntries.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(entry => (
                          <div key={entry.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-b-0">
                            <Badge className={`text-xs shrink-0 ${categoryColors[entry.category] || ""}`}>
                              {categoryIcons[entry.category]}<span className="ml-1">{entry.category}</span>
                            </Badge>
                            <span className="text-muted-foreground text-xs">{entry.startTime}{entry.endTime ? `-${entry.endTime}` : ""}</span>
                            {entry.durationMinutes != null && <span className="text-xs font-medium">{formatDuration(entry.durationMinutes)}</span>}
                            {entry.siteName && <span className="text-xs text-muted-foreground truncate flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" />{entry.siteName}</span>}
                            {entry.isRunning && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
                            {entry.startLat && <Navigation className="w-3 h-3 text-muted-foreground shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ===== TIMESHEETS TAB =====
// PDF generation for monthly timesheet
function generateMonthlyPDF(employeeName: string, monthLabel: string, entries: TimeEntry[], daySessions: DaySession[]) {
  const days = entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    acc[e.date] = acc[e.date] || [];
    acc[e.date].push(e);
    return acc;
  }, {});

  const sortedDates = Object.keys(days).sort();
  const grandTotal = entries.reduce((s, e) => s + (e.durationMinutes || 0), 0);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Timesheet - ${employeeName} - ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a2e; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1e5a8a; }
    .header h1 { font-size: 18px; color: #1e5a8a; font-weight: 700; }
    .header p { font-size: 11px; color: #666; margin-top: 2px; }
    .summary { display: flex; gap: 24px; margin-bottom: 16px; padding: 10px 14px; background: #f0f6ff; border-radius: 6px; }
    .summary div { text-align: center; }
    .summary .label { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
    .summary .value { font-size: 16px; font-weight: 700; color: #1e5a8a; }
    .day-section { margin-bottom: 12px; page-break-inside: avoid; }
    .day-header { background: #1e5a8a; color: white; padding: 6px 10px; font-weight: 600; font-size: 11px; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; }
    .day-header.weekend { background: #94a3b8; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #e8f0fe; padding: 5px 8px; text-align: left; font-size: 9px; text-transform: uppercase; color: #555; font-weight: 600; letter-spacing: 0.3px; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
    tr:last-child td { border-bottom: none; }
    .cat-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; background: #e0edff; color: #1e5a8a; }
    .running { color: #16a34a; font-weight: 600; }
    .day-total { text-align: right; font-weight: 700; color: #1e5a8a; }
    .grand-total { margin-top: 16px; padding: 12px 14px; background: #1e5a8a; color: white; border-radius: 6px; display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
    .no-entries { padding: 6px 10px; color: #999; font-style: italic; font-size: 10px; border: 1px solid #eee; border-top: none; border-radius: 0 0 4px 4px; }
    .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #999; }
    @media print { body { padding: 12px; } .day-section { page-break-inside: avoid; } }
  </style></head><body>`;

  html += `<div class="header"><div><h1>BG Heat Limited</h1><p>Monthly Timesheet</p></div><div style="text-align:right;"><p style="font-size:14px;font-weight:700;">${employeeName}</p><p>${monthLabel}</p></div></div>`;

  const workingDays = sortedDates.length;
  const totalEntries = entries.length;
  const hrs = Math.floor(grandTotal / 60);
  const mins = grandTotal % 60;
  html += `<div class="summary"><div><div class="label">Working Days</div><div class="value">${workingDays}</div></div><div><div class="label">Total Entries</div><div class="value">${totalEntries}</div></div><div><div class="label">Total Hours</div><div class="value">${hrs}h ${mins}m</div></div></div>`;

  sortedDates.forEach(date => {
    const dayEntries = days[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const dayTotal = dayEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
    const dateObj = parseISO(date);
    const dayLabel = format(dateObj, "EEEE, d MMMM yyyy");
    const weekend = isWeekend(dateObj);
    const daySession = daySessions.find(s => s.date === date);

    html += `<div class="day-section">`;
    html += `<div class="day-header${weekend ? " weekend" : ""}">`;
    html += `<span>${dayLabel}${daySession ? " — Day: " + daySession.startTime + (daySession.endTime ? " to " + daySession.endTime : " (ongoing)") : ""}</span>`;
    html += `<span>${Math.floor(dayTotal / 60)}h ${dayTotal % 60}m</span></div>`;
    html += `<table><thead><tr><th>Time</th><th>Duration</th><th>Activity</th><th>Site / Location</th><th>Notes</th></tr></thead><tbody>`;

    dayEntries.forEach(e => {
      const dur = e.durationMinutes != null ? `${Math.floor(e.durationMinutes / 60)}h ${e.durationMinutes % 60}m` : '<span class="running">Running</span>';
      html += `<tr><td>${e.startTime}${e.endTime ? " - " + e.endTime : ""}</td><td>${dur}</td><td><span class="cat-badge">${e.category}</span></td><td>${e.siteName || "—"}</td><td>${e.notes || "—"}</td></tr>`;
    });

    html += `</tbody></table></div>`;
  });

  html += `<div class="grand-total"><span>Month Total</span><span>${hrs}h ${mins}m</span></div>`;
  html += `<div class="footer">Generated ${format(new Date(), "d MMM yyyy, HH:mm")} — BG Heat Limited</div>`;
  html += `</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

function TimesheetsTab({ user }: { user: AuthUser }) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [monthEmployee, setMonthEmployee] = useState<string>("");

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStartDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const monthStartDate = startOfMonth(selectedDate);
  const monthEndDate = endOfMonth(selectedDate);
  const startDate = viewMode === "day" ? dateStr : viewMode === "week" ? format(weekStartDate, "yyyy-MM-dd") : format(monthStartDate, "yyyy-MM-dd");
  const endDate = viewMode === "day" ? dateStr : viewMode === "week" ? format(weekEndDate, "yyyy-MM-dd") : format(monthEndDate, "yyyy-MM-dd");

  const { data: users = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/users"); return r.json(); },
  });

  // Auto-select first non-admin user for month view
  useEffect(() => {
    if (viewMode === "month" && !monthEmployee && users.length > 0) {
      const nonAdmin = users.find(u => u.role !== "admin");
      setMonthEmployee(nonAdmin ? String(nonAdmin.id) : String(users[0].id));
    }
  }, [viewMode, users, monthEmployee]);

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/entries/range", startDate, endDate, viewMode === "month" ? monthEmployee : undefined],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (viewMode === "month" && monthEmployee) params.set("userId", monthEmployee);
      const r = await apiRequest("GET", `/api/entries/range?${params.toString()}`);
      return r.json();
    },
  });

  // Day sessions for month view (for PDF and on-screen day session info)
  const { data: monthDaySessions = [] } = useQuery<DaySession[]>({
    queryKey: ["/api/day-sessions/range", monthEmployee, startDate, endDate],
    queryFn: async () => {
      if (!monthEmployee) return [];
      const r = await apiRequest("GET", `/api/day-sessions/range?userId=${monthEmployee}&startDate=${startDate}&endDate=${endDate}`);
      return r.json();
    },
    enabled: viewMode === "month" && !!monthEmployee,
  });

  const filtered = entries.filter(e => {
    if (viewMode !== "month" && filterEmployee !== "all" && e.userId !== Number(filterEmployee)) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  const byEmployee = filtered.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    acc[e.employeeName] = acc[e.employeeName] || [];
    acc[e.employeeName].push(e);
    return acc;
  }, {});

  const totalMinutes = filtered.reduce((s, e) => s + (e.durationMinutes || 0), 0);
  const totalEntries = filtered.length;
  const activeNow = filtered.filter(e => e.isRunning).length;

  const handleExportCSV = () => {
    const params = new URLSearchParams({ startDate, endDate });
    if (filterEmployee !== "all") params.set("userId", filterEmployee);
    apiRequest("GET", `/api/export/csv?${params.toString()}`).then(async (res) => {
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `timesheet-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  const handleDownloadPDF = () => {
    const emp = users.find(u => String(u.id) === monthEmployee);
    if (!emp) return;
    const monthLabel = format(monthStartDate, "MMMM yyyy");
    generateMonthlyPDF(emp.name, monthLabel, filtered, monthDaySessions);
  };

  const displayTitle = viewMode === "day"
    ? format(selectedDate, "EEEE, d MMMM yyyy")
    : viewMode === "week"
    ? `${format(weekStartDate, "d MMM")} - ${format(weekEndDate, "d MMM yyyy")}`
    : format(monthStartDate, "MMMM yyyy");

  const navigateBack = () => setSelectedDate(d => viewMode === "day" ? subDays(d, 1) : viewMode === "week" ? subWeeks(d, 1) : subMonths(d, 1));
  const navigateForward = () => setSelectedDate(d => viewMode === "day" ? addDays(d, 1) : viewMode === "week" ? addWeeks(d, 1) : addMonths(d, 1));
  const categories = Array.from(new Set(entries.map(e => e.category))).sort();

  // Group entries by date for month view
  const entriesByDate = filtered.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    acc[e.date] = acc[e.date] || [];
    acc[e.date].push(e);
    return acc;
  }, {});
  const allMonthDates = viewMode === "month" ? eachDayOfInterval({ start: monthStartDate, end: monthEndDate }) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={navigateBack} data-testid="button-nav-back"><ChevronLeft className="w-5 h-5" /></Button>
          <p className="font-medium text-sm min-w-[200px] text-center" data-testid="text-display-title">{displayTitle}</p>
          <Button variant="ghost" size="icon" onClick={navigateForward} data-testid="button-nav-forward"><ChevronRight className="w-5 h-5" /></Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week" | "month")} data-testid="select-view-mode">
            <SelectTrigger className="w-[100px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month" data-testid="option-month">Month</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === "month" ? (
            <Select value={monthEmployee} onValueChange={setMonthEmployee}>
              <SelectTrigger className="w-[180px] h-9 text-sm" data-testid="select-month-employee"><SelectValue placeholder="Select Employee" /></SelectTrigger>
              <SelectContent>
                {users.filter(u => u.role !== "admin").map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="All Employees" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="All Activities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
          {viewMode !== "month" && (
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9" data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          )}
          {viewMode === "month" && (
            <Button variant="default" size="sm" onClick={handleDownloadPDF} className="h-9" data-testid="button-download-pdf">
              <Printer className="w-4 h-4 mr-1" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">{viewMode === "month" ? "Days Worked" : "Employees"}</span></div>
          <p className="text-xl font-semibold">{viewMode === "month" ? Object.keys(entriesByDate).length : Object.keys(byEmployee).length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><FileSpreadsheet className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Entries</span></div>
          <p className="text-xl font-semibold">{totalEntries}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Total Hours</span></div>
          <p className="text-xl font-semibold">{formatDuration(totalMinutes)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs text-muted-foreground font-medium">Active Now</span></div>
          <p className="text-xl font-semibold">{activeNow}</p>
        </Card>
      </div>

      {filtered.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activity Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(filtered.reduce<Record<string, number>>((a, e) => { a[e.category] = (a[e.category] || 0) + (e.durationMinutes || 0); return a; }, {}))
              .sort(([,a],[,b]) => b - a)
              .map(([cat, mins]) => (
                <div key={cat} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  {categoryIcons[cat]}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{cat}</p>
                    <p className="text-sm font-semibold">{formatDuration(mins)}</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Month view: entries grouped by day */}
      {viewMode === "month" ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Daily Breakdown</h2>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="p-4 animate-pulse"><div className="h-4 bg-muted rounded w-1/3 mb-2" /><div className="h-3 bg-muted rounded w-1/2" /></Card>)}</div>
          ) : (
            allMonthDates.map(dateObj => {
              const dStr = format(dateObj, "yyyy-MM-dd");
              const dayEntries = (entriesByDate[dStr] || []).sort((a, b) => a.startTime.localeCompare(b.startTime));
              const dayTotal = dayEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
              const weekend = isWeekend(dateObj);
              const daySession = monthDaySessions.find(s => s.date === dStr);
              const hasData = dayEntries.length > 0 || daySession;

              if (!hasData && weekend) return null; // skip empty weekends

              return (
                <Card key={dStr} className={`overflow-hidden ${!hasData ? "opacity-50" : ""}`}>
                  <div className={`flex items-center justify-between px-4 py-2 ${weekend ? "bg-muted/50" : "bg-primary/10"}`}>
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{format(dateObj, "EEEE, d MMMM")}</span>
                      {weekend && <Badge variant="secondary" className="text-xs">Weekend</Badge>}
                      {daySession && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Day: {daySession.startTime}{daySession.endTime ? ` - ${daySession.endTime}` : " (ongoing)"}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-semibold">{dayTotal > 0 ? formatDuration(dayTotal) : ""}</span>
                  </div>
                  {dayEntries.length > 0 ? (
                    <div className="divide-y">
                      {dayEntries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 text-sm" data-testid={`month-entry-${entry.id}`}>
                          <span className="text-muted-foreground text-xs font-mono w-[90px] shrink-0">
                            {entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ""}
                          </span>
                          <Badge className={`text-xs shrink-0 ${categoryColors[entry.category] || ""}`}>
                            {categoryIcons[entry.category]}<span className="ml-1">{entry.category}</span>
                          </Badge>
                          {entry.durationMinutes != null && <span className="text-xs font-medium shrink-0">{formatDuration(entry.durationMinutes)}</span>}
                          {entry.siteName && (
                            <span className="text-xs text-muted-foreground truncate flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />{entry.siteName}
                            </span>
                          )}
                          {entry.notes && <span className="text-xs text-muted-foreground truncate italic">{entry.notes}</span>}
                          {entry.isRunning && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic">No entries</div>
                  )}
                </Card>
              );
            })
          )}
          {/* Grand total bar */}
          {filtered.length > 0 && (
            <Card className="bg-primary text-primary-foreground">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold">Month Total</span>
                <span className="font-bold text-lg">{formatDuration(totalMinutes)}</span>
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* Day / Week view: entries by employee */
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Entries by Employee</h2>
          {isLoading ? (
            <div className="space-y-3">{[1,2].map(i => <Card key={i} className="p-4 animate-pulse"><div className="h-4 bg-muted rounded w-1/3 mb-2" /><div className="h-3 bg-muted rounded w-1/2" /></Card>)}</div>
          ) : Object.keys(byEmployee).length === 0 ? (
            <Card className="p-8 text-center"><Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No entries for this period</p></Card>
          ) : (
            Object.entries(byEmployee).sort(([a],[b]) => a.localeCompare(b)).map(([name, empEntries]) => {
              const empTotal = empEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
              const isActive = empEntries.some(e => e.isRunning);
              return (
                <Card key={name} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{name}</h3>
                      {isActive && <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />On site</span>}
                    </div>
                    <span className="text-sm font-semibold">{formatDuration(empTotal)}</span>
                  </div>
                  <div className="space-y-1.5">
                    {empEntries.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)).map(entry => (
                      <div key={entry.id} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-b-0">
                        {viewMode === "week" && <span className="text-xs text-muted-foreground w-16 shrink-0">{format(new Date(entry.date + "T00:00"), "EEE d")}</span>}
                        <Badge className={`text-xs shrink-0 ${categoryColors[entry.category] || ""}`}>{categoryIcons[entry.category]}<span className="ml-1">{entry.category}</span></Badge>
                        <span className="text-muted-foreground text-xs">{entry.startTime}{entry.endTime ? `-${entry.endTime}` : ""}</span>
                        {entry.durationMinutes != null && <span className="text-xs font-medium">{formatDuration(entry.durationMinutes)}</span>}
                        {entry.siteName && <span className="text-xs text-muted-foreground truncate flex items-center gap-0.5"><MapPin className="w-3 h-3 shrink-0" />{entry.siteName}</span>}
                        {entry.isRunning && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ===== USERS TAB =====
function UsersTab({ user }: { user: AuthUser }) {
  const { toast } = useToast();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("engineer");
  const [inviteHoliday, setInviteHoliday] = useState("28");

  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editHoliday, setEditHoliday] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; summary: { timeEntries: number; daySessions: number; leaveRequests: number } | null } | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [resetPwUser, setResetPwUser] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");

  const { data: users = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/users"); return r.json(); },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/users", {
        name: inviteName, email: inviteEmail, password: invitePassword,
        role: inviteRole, holidayAllowance: parseInt(inviteHoliday) || 28,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowInviteForm(false);
      setInviteName(""); setInviteEmail(""); setInvitePassword(""); setInviteRole("engineer"); setInviteHoliday("28");
      toast({ title: "User created", description: "New user has been added." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("PATCH", `/api/users/${id}`, {
        name: editName, email: editEmail, role: editRole,
        holidayAllowance: parseInt(editHoliday) || 28,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      toast({ title: "User updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetPwMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/users/${id}/reset-password`, { newPassword: resetPwValue });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      setResetPwUser(null);
      setResetPwValue("");
      toast({ title: "Password reset", description: "User's password has been reset." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/users/${id}`);
      if (!r.ok) { const e = await r.json().catch(() => ({ error: "Failed" })); throw new Error(e.error || "Failed"); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteConfirm(null);
      toast({ title: "User deleted", description: "User and all their data has been removed." });
    },
    onError: (err: any) => { setDeleteConfirm(null); toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const handleDeleteClick = async (u: UserInfo) => {
    setLoadingSummary(true);
    setDeleteConfirm({ id: u.id, name: u.name, summary: null });
    try {
      const r = await apiRequest("GET", `/api/users/${u.id}/data-summary`);
      const summary = await r.json();
      setDeleteConfirm({ id: u.id, name: u.name, summary });
    } catch {
      setDeleteConfirm({ id: u.id, name: u.name, summary: { timeEntries: 0, daySessions: 0, leaveRequests: 0 } });
    }
    setLoadingSummary(false);
  };

  const startEdit = (u: UserInfo) => {
    setEditingUser(u.id);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditHoliday(String(u.holidayAllowance));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Team Members ({users.length})</h2>
        <Button size="sm" onClick={() => setShowInviteForm(!showInviteForm)} data-testid="button-invite-user">
          {showInviteForm ? <X className="w-4 h-4 mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
          {showInviteForm ? "Cancel" : "Add User"}
        </Button>
      </div>

      {showInviteForm && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" /> Add New User</h3>
          <form onSubmit={(e) => { e.preventDefault(); inviteMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="John Smith" data-testid="input-invite-name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="john@bgheat.co.uk" data-testid="input-invite-email" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="Initial password" data-testid="input-invite-password" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => { setInviteRole(v); if (v === "subcontractor") setInviteHoliday("0"); else if (inviteHoliday === "0") setInviteHoliday("28"); }}>
                  <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineer">Engineer</SelectItem>
                    <SelectItem value="apprentice">Apprentice</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Holiday Days</Label>
                <Input type="number" value={inviteHoliday} onChange={e => setInviteHoliday(e.target.value)} data-testid="input-invite-holiday" />
              </div>
            </div>
            <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-submit-invite">
              {inviteMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </form>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDeleteConfirm(null)}>
          <Card className="w-[90%] max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} data-testid="dialog-delete-confirm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold">Delete {deleteConfirm.name}?</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            {deleteConfirm.summary ? (
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">The following data will also be deleted:</p>
                <ul className="text-sm text-red-700 dark:text-red-400 space-y-0.5 ml-4 list-disc">
                  <li>{deleteConfirm.summary.timeEntries} time {deleteConfirm.summary.timeEntries === 1 ? "entry" : "entries"}</li>
                  <li>{deleteConfirm.summary.daySessions} day {deleteConfirm.summary.daySessions === 1 ? "session" : "sessions"}</li>
                  <li>{deleteConfirm.summary.leaveRequests} leave {deleteConfirm.summary.leaveRequests === 1 ? "request" : "requests"}</li>
                </ul>
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center"><span className="text-sm text-muted-foreground">Loading data summary...</span></div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">
                Cancel
              </Button>
              <Button
                variant="destructive" size="sm"
                disabled={!deleteConfirm.summary || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete User & Data"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <Card key={u.id} className="p-4" data-testid={`card-user-${u.id}`}>
            {editingUser === u.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Name" data-testid="input-edit-name" />
                  <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" data-testid="input-edit-email" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={editRole} onValueChange={(v) => { setEditRole(v); if (v === "subcontractor") setEditHoliday("0"); else if (editHoliday === "0") setEditHoliday("28"); }}>
                    <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineer">Engineer</SelectItem>
                      <SelectItem value="apprentice">Apprentice</SelectItem>
                      <SelectItem value="subcontractor">Subcontractor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs whitespace-nowrap">Holiday days:</Label>
                    <Input type="number" value={editHoliday} onChange={e => setEditHoliday(e.target.value)} className="w-20" data-testid="input-edit-holiday" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMutation.mutate(u.id)} disabled={updateMutation.isPending} data-testid="button-save-edit">
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)} data-testid="button-cancel-edit">
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : resetPwUser === u.id ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Reset password for {u.name}</p>
                <div className="flex gap-2">
                  <Input value={resetPwValue} onChange={e => setResetPwValue(e.target.value)} placeholder="New password (min 4 chars)" data-testid="input-reset-password" />
                  <Button size="sm" onClick={() => resetPwMutation.mutate(u.id)} disabled={resetPwMutation.isPending} data-testid="button-confirm-reset">
                    <Save className="w-4 h-4 mr-1" /> Reset
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setResetPwUser(null); setResetPwValue(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{u.name}</p>
                      <Badge variant={u.role === "admin" ? "default" : u.role === "subcontractor" ? "outline" : "secondary"} className={`text-xs ${u.role === "apprentice" ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" : ""}`}>{u.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    {u.role !== "subcontractor" && <p className="text-xs text-muted-foreground">{u.holidayAllowance} days holiday/year</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(u)} data-testid={`button-edit-${u.id}`}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetPwUser(u.id)} data-testid={`button-reset-pw-${u.id}`}>
                    <KeyRound className="w-3.5 h-3.5" />
                  </Button>
                  {u.id !== user.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(u)} data-testid={`button-delete-${u.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ===== LEAVE TAB =====
function LeaveTab({ user }: { user: AuthUser }) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("pending");

  const { data: allRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/leave"); return r.json(); },
  });

  const { data: bankHolidays = [] } = useQuery<{ date: string; name: string }[]>({
    queryKey: ["/api/bank-holidays"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/bank-holidays"); return r.json(); },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await apiRequest("PATCH", `/api/leave/${id}`, { status, reviewedBy: user.name });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      toast({ title: vars.status === "approved" ? "Leave approved" : "Leave rejected" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = filterStatus === "all"
    ? allRequests
    : allRequests.filter(r => r.status === filterStatus);

  const pendingCount = allRequests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Leave Requests</h2>
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800">{pendingCount} pending</Badge>
          )}
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-9 text-sm" data-testid="select-leave-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <TreePalm className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {filterStatus !== "all" ? filterStatus : ""} leave requests</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card key={req.id} className="p-4" data-testid={`card-admin-leave-${req.id}`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                      {req.employeeName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{req.employeeName}</span>
                    <Badge className={statusStyles[req.status]}>
                      <span className="capitalize">{req.status}</span>
                    </Badge>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{req.leaveType}</span>
                    <span className="text-muted-foreground"> — </span>
                    {format(new Date(req.startDate + "T00:00"), "d MMM")} to {format(new Date(req.endDate + "T00:00"), "d MMM yyyy")}
                    <span className="ml-2 text-muted-foreground">({req.totalDays} day{req.totalDays !== 1 ? "s" : ""})</span>
                  </p>
                  {req.reason && <p className="text-xs text-muted-foreground">{req.reason}</p>}
                  {req.reviewedBy && <p className="text-xs text-muted-foreground">Reviewed by: {req.reviewedBy}</p>}
                  <p className="text-xs text-muted-foreground">Requested: {format(new Date(req.createdAt), "d MMM yyyy, HH:mm")}</p>
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => approveMutation.mutate({ id: req.id, status: "approved" })}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${req.id}`}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => approveMutation.mutate({ id: req.id, status: "rejected" })}
                      disabled={approveMutation.isPending}
                      data-testid={`button-reject-${req.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Bank Holidays Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">UK Bank Holidays 2026</h2>
        <Card className="divide-y">
          {bankHolidays.map(bh => (
            <div key={bh.date} className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium">{bh.name}</span>
              <span className="text-sm text-muted-foreground">{format(new Date(bh.date + "T00:00"), "EEEE, d MMMM")}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
