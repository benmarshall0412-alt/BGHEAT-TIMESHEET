import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { ArrowLeft, Lock, User, Save, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import type { AuthUser } from "@/App";

export default function SettingsPage({ user, onUpdateUser }: { user: AuthUser; onUpdateUser: (u: AuthUser) => void }) {
  const { toast } = useToast();

  // Profile state
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const profileMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", "/api/auth/profile", { userId: user.id, name, email });
      return r.json();
    },
    onSuccess: (data) => {
      onUpdateUser({ ...user, name: data.name, email: data.email });
      toast({ title: "Profile updated", description: "Your details have been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update profile", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/change-password", { userId: user.id, currentPassword, newPassword });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Failed"); }
      return r.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to change password", variant: "destructive" });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return toast({ title: "Error", description: "Name and email are required", variant: "destructive" });
    profileMutation.mutate();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) return toast({ title: "Error", description: "Password must be at least 4 characters", variant: "destructive" });
    if (newPassword !== confirmPassword) return toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
    passwordMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/"><button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="w-4 h-4" /> Back</button></Link>
            <div className="h-4 w-px bg-border" />
            <span className="font-semibold text-sm">Settings</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Edit Profile */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Edit Profile</h2>
          </div>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
            </div>
            <Button type="submit" disabled={profileMutation.isPending} data-testid="button-save-profile">
              <Save className="w-4 h-4 mr-1" />
              {profileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Card>

        {/* Change Password */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Change Password</h2>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPw ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowNewPw(!showNewPw)}>
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>
            <Button type="submit" disabled={passwordMutation.isPending} data-testid="button-change-password">
              <Lock className="w-4 h-4 mr-1" />
              {passwordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </Card>

        <PerplexityAttribution />
      </main>
    </div>
  );
}
