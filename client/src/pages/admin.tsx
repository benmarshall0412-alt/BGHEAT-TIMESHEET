import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  ChevronLeft, ChevronRight, Download, Flame, LogOut, Clock,
  Truck, ShoppingBag, GraduationCap, Building2, Wrench,
  Fuel, Zap, Settings, Coffee, MapPin, Navigation, ArrowLeft, Users, FileSpreadsheet
} from "lucide-react";
import { format, addDays, subDays, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { Link } from "wouter";
import type { TimeEntry } from "@shared/schema";
import type { AuthUser } from "@/App";

const categoryIcons: Record<string, React.ReactNode> = {
  "Travel": <Truck className="w-3.5 h-3.5" />, "Merchant Trip": <ShoppingBag className="w-3.5 h-3.5" />,
  "Training": <GraduationCap className="w-3.5 h-3.5" />, "Office": <Building2 className="w-3.5 h-3.5" />,
  "Plumbing": <Wrench className="w-3.5 h-3.5" />, "Heating": <Flame className="w-3.5 h-3.5" />,
  "Gas Work": <Fuel className="w-3.5 h-3.5" />, "Electrical": <Zap className="w-3.5 h-3.5" />,
  "Commissioning": <Settings className="w-3.5 h-3.5" />, "Break": <Coffee className="w-3.5 h-3.5" />,
};

const categoryColors: Record<string, string> = {
  "Travel": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Merchant Trip": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Training": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Office": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  "Plumbing": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Heating": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  "Gas Work": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Electrical": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "Commissioning": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Break": "bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-300",
};

function formatDuration(minutes: number): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

type UserInfo = { id: number; name: string; email: string; role: string };

export default function AdminPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const weekStartDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const startDate = viewMode === "day" ? dateStr : format(weekStartDate, "yyyy-MM-dd");
  const endDate = viewMode === "day" ? dateStr : format(weekEndDate, "yyyy-MM-dd");

  const { data: users = [] } = useQuery<UserInfo[]>({
    queryKey: ["/api/users"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/users"); return r.json(); },
  });

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/entries/range", startDate, endDate],
    queryFn: async () => { const r = await apiRequest("GET", `/api/entries/range?startDate=${startDate}&endDate=${endDate}`); return r.json(); },
  });

  // Filter entries
  const filtered = entries.filter(e => {
    if (filterEmployee !== "all" && e.userId !== Number(filterEmployee)) return false;
    if (filterCategory !== "all" && e.category !== filterCategory) return false;
    return true;
  });

  // Group by employee
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
    const url = `/api/export/csv?${params.toString()}`;

    apiRequest("GET", url).then(async (res) => {
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `timesheet-${startDate}-to-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  };

  const displayTitle = viewMode === "day"
    ? format(selectedDate, "EEEE, d MMMM yyyy")
    : `${format(weekStartDate, "d MMM")} - ${format(weekEndDate, "d MMM yyyy")}`;

  const navigateBack = () => setSelectedDate(d => viewMode === "day" ? subDays(d, 1) : subWeeks(d, 1));
  const navigateForward = () => setSelectedDate(d => viewMode === "day" ? addDays(d, 1) : addWeeks(d, 1));

  const categories = Array.from(new Set(entries.map(e => e.category))).sort();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={navigateBack}><ChevronLeft className="w-5 h-5" /></Button>
            <p className="font-medium text-sm min-w-[200px] text-center">{displayTitle}</p>
            <Button variant="ghost" size="icon" onClick={navigateForward}><ChevronRight className="w-5 h-5" /></Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week")}>
              <SelectTrigger className="w-[100px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {users.filter(u => u.role === "engineer" || entries.some(e => e.userId === u.id)).map(u => (
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
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9" data-testid="button-export-csv">
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Employees</span></div>
            <p className="text-xl font-semibold">{Object.keys(byEmployee).length}</p>
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

        {/* Category breakdown */}
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

        {/* Entries by Employee */}
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

        <PerplexityAttribution />
      </main>
    </div>
  );
}
