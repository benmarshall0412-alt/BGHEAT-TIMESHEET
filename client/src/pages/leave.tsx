import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { ArrowLeft, CalendarDays, Plus, X, TreePalm, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import type { AuthUser } from "@/App";
import type { LeaveRequest } from "@shared/schema";

type BankHoliday = { date: string; name: string };

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle2 className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
  cancelled: <AlertCircle className="w-3.5 h-3.5" />,
};

export default function LeavePage({ user }: { user: AuthUser }) {
  const { toast } = useToast();
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [leaveType, setLeaveType] = useState("Annual Leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const currentYear = new Date().getFullYear().toString();

  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave", user.id],
    queryFn: async () => { const r = await apiRequest("GET", `/api/leave?userId=${user.id}`); return r.json(); },
  });

  const { data: leaveSummary } = useQuery<{ usedDays: number; totalAllowance: number; remainingDays: number }>({
    queryKey: ["/api/leave/summary", user.id, currentYear],
    queryFn: async () => { const r = await apiRequest("GET", `/api/leave/summary?userId=${user.id}&year=${currentYear}`); return r.json(); },
  });

  const { data: bankHolidays = [] } = useQuery<BankHoliday[]>({
    queryKey: ["/api/bank-holidays"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/bank-holidays"); return r.json(); },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/leave", {
        userId: user.id,
        employeeName: user.name,
        leaveType,
        startDate,
        endDate,
        reason: reason || undefined,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/summary"] });
      setShowRequestForm(false);
      setStartDate("");
      setEndDate("");
      setReason("");
      toast({ title: "Leave requested", description: "Your request has been submitted for approval." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/leave/${id}/cancel`, {});
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave/summary"] });
      toast({ title: "Cancelled", description: "Leave request has been cancelled." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return toast({ title: "Error", description: "Please select start and end dates", variant: "destructive" });
    if (endDate < startDate) return toast({ title: "Error", description: "End date must be after start date", variant: "destructive" });
    requestMutation.mutate();
  };

  const pendingRequests = leaveRequests.filter(r => r.status === "pending");
  const pastRequests = leaveRequests.filter(r => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/"><button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="w-4 h-4" /> Back</button></Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <TreePalm className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Leave & Holidays</span>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowRequestForm(!showRequestForm)} data-testid="button-new-request">
            {showRequestForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showRequestForm ? "Cancel" : "Request Leave"}
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Allowance Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-medium mb-1">Allowance</p>
            <p className="text-xl font-bold text-primary" data-testid="text-total-allowance">{leaveSummary?.totalAllowance ?? 28}</p>
            <p className="text-xs text-muted-foreground">days/year</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-medium mb-1">Used</p>
            <p className="text-xl font-bold text-amber-600" data-testid="text-used-days">{leaveSummary?.usedDays ?? 0}</p>
            <p className="text-xs text-muted-foreground">days taken</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-medium mb-1">Remaining</p>
            <p className="text-xl font-bold text-green-600" data-testid="text-remaining-days">{leaveSummary?.remainingDays ?? 28}</p>
            <p className="text-xs text-muted-foreground">days left</p>
          </Card>
        </div>

        {/* Request Form */}
        {showRequestForm && (
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" /> New Leave Request
            </h2>
            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger data-testid="select-leave-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                    <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                    <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-start-date" />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-end-date" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Family holiday" data-testid="input-reason" />
              </div>
              <Button type="submit" disabled={requestMutation.isPending} className="w-full" data-testid="button-submit-leave">
                {requestMutation.isPending ? "Submitting..." : "Submit Request"}
              </Button>
            </form>
          </Card>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pending Requests</h2>
            {pendingRequests.map(req => (
              <Card key={req.id} className="p-4" data-testid={`card-leave-${req.id}`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={statusStyles[req.status]}>{statusIcons[req.status]}<span className="ml-1 capitalize">{req.status}</span></Badge>
                      <span className="text-sm font-medium">{req.leaveType}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(req.startDate + "T00:00"), "d MMM yyyy")} — {format(new Date(req.endDate + "T00:00"), "d MMM yyyy")}
                      <span className="ml-2 font-medium">({req.totalDays} day{req.totalDays !== 1 ? "s" : ""})</span>
                    </p>
                    {req.reason && <p className="text-xs text-muted-foreground">{req.reason}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => cancelMutation.mutate(req.id)}
                    disabled={cancelMutation.isPending}
                    data-testid={`button-cancel-${req.id}`}
                  >
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Past Requests */}
        {pastRequests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past Requests</h2>
            {pastRequests.map(req => (
              <Card key={req.id} className="p-4" data-testid={`card-leave-${req.id}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={statusStyles[req.status]}>{statusIcons[req.status]}<span className="ml-1 capitalize">{req.status}</span></Badge>
                    <span className="text-sm font-medium">{req.leaveType}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(req.startDate + "T00:00"), "d MMM yyyy")} — {format(new Date(req.endDate + "T00:00"), "d MMM yyyy")}
                    <span className="ml-2 font-medium">({req.totalDays} day{req.totalDays !== 1 ? "s" : ""})</span>
                  </p>
                  {req.reason && <p className="text-xs text-muted-foreground">{req.reason}</p>}
                  {req.reviewedBy && <p className="text-xs text-muted-foreground">Reviewed by: {req.reviewedBy}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {leaveRequests.length === 0 && !showRequestForm && (
          <Card className="p-8 text-center">
            <TreePalm className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No leave requests yet</p>
            <p className="text-xs text-muted-foreground mt-1">Tap "Request Leave" to submit your first request</p>
          </Card>
        )}

        {/* Bank Holidays */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">UK Bank Holidays 2026</h2>
          <Card className="divide-y">
            {bankHolidays.map(bh => (
              <div key={bh.date} className="px-4 py-3 flex items-center justify-between" data-testid={`bank-holiday-${bh.date}`}>
                <span className="text-sm font-medium">{bh.name}</span>
                <span className="text-sm text-muted-foreground">{format(new Date(bh.date + "T00:00"), "EEEE, d MMMM")}</span>
              </div>
            ))}
          </Card>
        </div>

        <PerplexityAttribution />
      </main>
    </div>
  );
}
