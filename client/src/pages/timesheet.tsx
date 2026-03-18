import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import {
  Play, Square, MapPin, Clock, ChevronLeft, ChevronRight,
  Truck, ShoppingBag, GraduationCap, Building2, Wrench, Flame,
  Fuel, Zap, Settings, Coffee, Trash2, Navigation, LogOut, Shield,
  Plus, BookMarked, X, Check, TreePalm, User
} from "lucide-react";
import { format, addDays, subDays, startOfWeek, endOfWeek } from "date-fns";
import { Link } from "wouter";
import type { TimeEntry, ActivityCategory, SavedAddress } from "@shared/schema";
import { activityCategories } from "@shared/schema";
import type { AuthUser } from "@/App";

const categoryIcons: Record<string, React.ReactNode> = {
  "Travel": <Truck className="w-4 h-4" />, "Merchant Trip": <ShoppingBag className="w-4 h-4" />,
  "Training": <GraduationCap className="w-4 h-4" />, "Office": <Building2 className="w-4 h-4" />,
  "Plumbing": <Wrench className="w-4 h-4" />, "Heating": <Flame className="w-4 h-4" />,
  "Gas Work": <Fuel className="w-4 h-4" />, "Electrical": <Zap className="w-4 h-4" />,
  "Commissioning": <Settings className="w-4 h-4" />, "Break": <Coffee className="w-4 h-4" />,
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

function formatDuration(minutes: number | null): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${m}m`;
}

function getGPS(): Promise<{ lat: string; lng: string } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }),
      () => resolve(null), { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

export default function TimesheetPage({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>("Plumbing");
  const [siteName, setSiteName] = useState("");
  const [notes, setNotes] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [newAddressName, setNewAddressName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const displayDate = format(selectedDate, "EEEE, d MMMM yyyy");
  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ["/api/entries", user.id, dateStr],
    queryFn: async () => { const r = await apiRequest("GET", `/api/entries?userId=${user.id}&date=${dateStr}`); return r.json(); },
  });

  const { data: runningEntry } = useQuery<TimeEntry | null>({
    queryKey: ["/api/entries/running", user.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/entries/running?userId=${user.id}`); return r.json(); },
    refetchInterval: 10000,
  });

  const weekStart = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data: weekEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["/api/entries/week", user.id, weekStart, weekEnd],
    queryFn: async () => { const r = await apiRequest("GET", `/api/entries/week?userId=${user.id}&startDate=${weekStart}&endDate=${weekEnd}`); return r.json(); },
  });

  // Saved addresses
  const { data: savedAddresses = [] } = useQuery<SavedAddress[]>({
    queryKey: ["/api/addresses"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/addresses"); return r.json(); },
  });

  const addAddressMutation = useMutation({
    mutationFn: async (address: string) => {
      const r = await apiRequest("POST", "/api/addresses", { name: newAddressName || address, address, addedBy: user.name });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/addresses"] });
      setNewAddressName("");
      setShowAddForm(false);
      toast({ title: "Address saved", description: "Available for all users now" });
    },
    onError: () => toast({ title: "Already saved", description: "This address is already in the address book", variant: "destructive" }),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/addresses/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/addresses"] }),
  });

  useEffect(() => {
    if (!runningEntry) { setElapsedSeconds(0); return; }
    const start = new Date(`${runningEntry.date}T${runningEntry.startTime}`);
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [runningEntry]);

  const startMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const gps = gpsEnabled ? await getGPS() : null;
      const r = await apiRequest("POST", "/api/entries", {
        userId: user.id, employeeName: user.name, date: format(now, "yyyy-MM-dd"),
        category: selectedCategory, siteName: siteName || null, notes: notes || null,
        startTime: format(now, "HH:mm"), endTime: null, durationMinutes: null, isRunning: true,
        startLat: gps?.lat || null, startLng: gps?.lng || null, endLat: null, endLng: null,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/running"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/week"] });
      setSiteName(""); setNotes("");
      toast({ title: "Timer started", description: `Tracking ${selectedCategory}` });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!runningEntry) return;
      const now = new Date();
      const start = new Date(`${runningEntry.date}T${runningEntry.startTime}`);
      const gps = gpsEnabled ? await getGPS() : null;
      const r = await apiRequest("PATCH", `/api/entries/${runningEntry.id}`, {
        endTime: format(now, "HH:mm"), durationMinutes: Math.round((now.getTime() - start.getTime()) / 60000),
        isRunning: false, endLat: gps?.lat || null, endLng: gps?.lng || null,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/running"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/week"] });
      toast({ title: "Timer stopped", description: "Entry saved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/entries/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/running"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries/week"] });
    },
  });

  const totalDayMinutes = entries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
  const totalWeekMinutes = weekEntries.reduce((s, e) => s + (e.durationMinutes || 0), 0);
  const elapsed = `${String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:${String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"><Flame className="w-4 h-4 text-primary-foreground" /></div>
            <span className="font-semibold text-sm">BG Heat</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setGpsEnabled(!gpsEnabled)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${gpsEnabled ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
              <Navigation className="w-3 h-3" /> GPS {gpsEnabled ? "On" : "Off"}
            </button>
            <Link href="/leave"><button className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary" data-testid="link-leave"><TreePalm className="w-3 h-3" /> Leave</button></Link>
            {user.role === "admin" && (
              <Link href="/admin"><button className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary" data-testid="link-admin"><Shield className="w-3 h-3" /> Admin</button></Link>
            )}
            <Link href="/settings"><button className="flex items-center gap-1 text-xs px-2 py-1 rounded-full hover:bg-muted" data-testid="link-settings"><User className="w-3 h-3" /></button></Link>
            <Button variant="ghost" size="icon" onClick={onLogout} data-testid="button-logout"><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Date Nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}><ChevronLeft className="w-5 h-5" /></Button>
          <div className="text-center"><p className="font-medium text-sm">{displayDate}</p>{isToday && <Badge variant="secondary" className="text-xs mt-1">Today</Badge>}</div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}><ChevronRight className="w-5 h-5" /></Button>
        </div>

        {/* Timer Card */}
        <Card className="p-5 space-y-4">
          {runningEntry ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-sm font-medium">Recording</span></div>
                <Badge className={categoryColors[runningEntry.category] || ""}>{categoryIcons[runningEntry.category]}<span className="ml-1">{runningEntry.category}</span></Badge>
              </div>
              <div className="text-center">
                <p className="text-4xl font-mono font-semibold tracking-tight" data-testid="text-timer">{elapsed}</p>
                {runningEntry.siteName && <p className="text-sm text-muted-foreground mt-1">{runningEntry.siteName}</p>}
                <p className="text-xs text-muted-foreground mt-1">Started at {runningEntry.startTime}{runningEntry.startLat && <span className="ml-2 inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" /> GPS logged</span>}</p>
              </div>
              <Button variant="destructive" className="w-full h-12 text-base font-semibold" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending} data-testid="button-stop">
                <Square className="w-5 h-5 mr-2" /> Stop
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Activity picker */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Activity</label>
                <div className="grid grid-cols-2 gap-2">
                  {activityCategories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${selectedCategory === cat ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-foreground"}`}
                      data-testid={`button-category-${cat.toLowerCase().replace(/\s/g, "-")}`}>
                      {categoryIcons[cat]}{cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Site / Location with address book */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Site / Location</label>
                  <button onClick={() => setShowAddressBook(!showAddressBook)}
                    className="flex items-center gap-1 text-xs text-primary hover:underline" data-testid="button-toggle-address-book">
                    <BookMarked className="w-3 h-3" /> {showAddressBook ? "Hide" : "Saved Sites"}
                  </button>
                </div>

                {/* Address Book Dropdown */}
                {showAddressBook && (
                  <div className="border rounded-lg overflow-hidden">
                    {savedAddresses.length === 0 && !showAddForm ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        No saved sites yet. Add one below.
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        {savedAddresses.map(addr => (
                          <button key={addr.id} onClick={() => { setSiteName(addr.address); setShowAddressBook(false); }}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                            data-testid={`button-address-${addr.id}`}>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{addr.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{addr.address}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); deleteAddressMutation.mutate(addr.id); }}
                              className="ml-2 text-muted-foreground hover:text-destructive shrink-0 p-1">
                              <X className="w-3 h-3" />
                            </button>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Add new address */}
                    {showAddForm ? (
                      <div className="p-3 border-t space-y-2 bg-muted/30">
                        <Input placeholder="Site name (e.g. Mrs Jones)" value={newAddressName} onChange={e => setNewAddressName(e.target.value)} className="text-sm" data-testid="input-new-address-name" />
                        <Input placeholder="Full address" value={siteName} onChange={e => setSiteName(e.target.value)} className="text-sm" data-testid="input-new-address" />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" disabled={!siteName.trim()} onClick={() => addAddressMutation.mutate(siteName)} data-testid="button-save-address">
                            <Check className="w-3 h-3 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewAddressName(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-1 px-3 py-2.5 text-sm text-primary hover:bg-muted/50 border-t" data-testid="button-add-address">
                        <Plus className="w-3 h-3" /> Add New Site
                      </button>
                    )}
                  </div>
                )}

                <Input placeholder="e.g. 42 Park Road, Cardiff" value={siteName} onChange={e => setSiteName(e.target.value)} data-testid="input-site-name" />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Input placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} data-testid="input-notes" />
              </div>

              <Button className="w-full h-12 text-base font-semibold" onClick={() => startMutation.mutate()} disabled={startMutation.isPending} data-testid="button-start">
                <Play className="w-5 h-5 mr-2" /> Start {selectedCategory}
              </Button>
            </div>
          )}
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Today</span></div><p className="text-xl font-semibold">{formatDuration(totalDayMinutes)}</p></Card>
          <Card className="p-4"><div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">This Week</span></div><p className="text-xl font-semibold">{formatDuration(totalWeekMinutes)}</p></Card>
        </div>

        {/* Entries */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Entries</h2>
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="p-4 animate-pulse"><div className="h-4 bg-muted rounded w-1/3 mb-2" /><div className="h-3 bg-muted rounded w-1/2" /></Card>)}</div>
          ) : entries.length === 0 ? (
            <Card className="p-8 text-center"><Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">No entries for this day</p></Card>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${categoryColors[entry.category] || ""}`}>{categoryIcons[entry.category]}<span className="ml-1">{entry.category}</span></Badge>
                        {entry.isRunning && <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ""}</span>
                        {entry.durationMinutes != null && <span className="font-medium text-foreground">{formatDuration(entry.durationMinutes)}</span>}
                      </div>
                      {entry.siteName && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {entry.siteName}</p>}
                      {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                      {entry.startLat && <p className="text-xs text-muted-foreground flex items-center gap-1"><Navigation className="w-3 h-3" /> GPS: {entry.startLat}, {entry.startLng}{entry.endLat && ` → ${entry.endLat}, ${entry.endLng}`}</p>}
                    </div>
                    {!entry.isRunning && <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMutation.mutate(entry.id)}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Week breakdown */}
        {weekEntries.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Week Breakdown</h2>
            <Card className="p-4 space-y-3">
              {Object.entries(weekEntries.reduce<Record<string, number>>((a, e) => { a[e.category] = (a[e.category] || 0) + (e.durationMinutes || 0); return a; }, {})).sort(([,a],[,b]) => b - a).map(([cat, mins]) => (
                <div key={cat} className="flex items-center justify-between"><div className="flex items-center gap-2">{categoryIcons[cat]}<span className="text-sm">{cat}</span></div><span className="text-sm font-medium">{formatDuration(mins)}</span></div>
              ))}
              <div className="border-t pt-3 flex items-center justify-between font-semibold"><span className="text-sm">Total</span><span className="text-sm">{formatDuration(totalWeekMinutes)}</span></div>
            </Card>
          </div>
        )}

        <PerplexityAttribution />
      </main>
    </div>
  );
}
