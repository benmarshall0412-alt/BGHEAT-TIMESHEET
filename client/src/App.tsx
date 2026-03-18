import { useState, useEffect } from "react";
import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "./pages/login";
import RegisterPage from "./pages/register";
import TimesheetPage from "./pages/timesheet";
import AdminPage from "./pages/admin";
import NotFound from "./pages/not-found";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

function AppRoutes() {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Restore from React state only (no localStorage in sandboxed iframe)
  const handleLogin = (u: AuthUser) => setUser(u);
  const handleLogout = () => {
    setUser(null);
    queryClient.clear();
  };

  if (!user) {
    return (
      <Switch>
        <Route path="/register">
          <RegisterPage onLogin={handleLogin} />
        </Route>
        <Route>
          <LoginPage onLogin={handleLogin} />
        </Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/">
        <TimesheetPage user={user} onLogout={handleLogout} />
      </Route>
      {user.role === "admin" && (
        <Route path="/admin">
          <AdminPage user={user} onLogout={handleLogout} />
        </Route>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AppRoutes />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
