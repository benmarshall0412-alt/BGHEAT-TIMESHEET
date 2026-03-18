import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Flame, Loader2 } from "lucide-react";
import type { AuthUser } from "@/App";

export default function LoginPage({ onLogin }: { onLogin: (u: AuthUser) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: (data) => onLogin(data),
    onError: () => toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Flame className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">BG Heat</span>
          </div>
          <h1 className="text-xl font-semibold" data-testid="text-login-title">Timesheet Login</h1>
          <p className="text-sm text-muted-foreground">Sign in to start logging hours</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              data-testid="input-email"
              type="email"
              placeholder="you@bgheat.co.uk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              data-testid="input-password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button data-testid="button-login" className="w-full" type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Sign In
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Contact your admin if you need an account
        </p>
      </Card>
    </div>
  );
}
