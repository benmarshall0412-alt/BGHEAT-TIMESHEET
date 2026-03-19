import { useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import LoginPage from "./pages/login";

import TimesheetPage from "./pages/timesheet";
import AdminPage from "./pages/admin";
import SettingsPage from "./pages/settings";
import LeavePage from "./pages/leave";
import NotFound from "./pages/not-found";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  holidayAllowance?: number;
};

function AppRoutes() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const handleLogin = (u: AuthUser) => setUser(u);
  const handleLogout = () => {
    setUser(null);
    queryClient.clear();
  };
  const handleUpdateUser = (u: AuthUser) => setUser(u);

  if (!user) {
    return (
      <Switch>
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
      <Route path="/settings">
        <SettingsPage user={user} onUpdateUser={handleUpdateUser} />
      </Route>
      {user.role !== "subcontractor" && (
        <Route path="/leave">
          <LeavePage user={user} />
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
