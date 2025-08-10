import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import PaymentPage from "@/pages/payment";
import TeamSelection from "@/pages/team-selection";
import EditTeam from "@/pages/edit-team";
import Leaderboard from "@/pages/leaderboard";
import Fixtures from "@/pages/fixtures";
import Teams from "@/pages/teams";
import AdminDashboard from "@/pages/admin-dashboard";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={TeamSelection} />
      <ProtectedRoute path="/edit-team" component={EditTeam} />
      <ProtectedRoute path="/teams" component={Teams} />
      <ProtectedRoute path="/leaderboard" component={Leaderboard} />
      <ProtectedRoute path="/fixtures" component={Fixtures} />
      <ProtectedRoute path="/admin" component={AdminDashboard} adminOnly />
      <Route path="/auth" component={AuthPage} />
      <Route path="/payment" component={PaymentPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
