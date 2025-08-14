import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import TeamSelection from "@/pages/team-selection";
import EditTeam from "@/pages/edit-team";
import Leaderboard from "@/pages/leaderboard";
import Fixtures from "@/pages/fixtures";
import Teams from "@/pages/teams";
import AdminDashboard from "@/pages/admin-dashboard";
import ProfilePage from "@/pages/profile-page";
import ManualPaymentPage from "@/pages/manual-payment-page";
import AdminPaymentPanel from "@/pages/admin-payment-panel";
import RulesPage from "@/pages/rules-page";
import { Redirect } from "wouter";

function AdminRedirect() {
  const { user } = useAuth();
  
  if (user?.isAdmin) {
    return <Redirect to="/admin" />;
  }
  
  return <TeamSelection />;
}

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={AdminRedirect} />
      <ProtectedRoute path="/create-team" component={TeamSelection} />
      <ProtectedRoute path="/edit-team" component={EditTeam} />
      <ProtectedRoute path="/teams" component={Teams} />
      <ProtectedRoute path="/leaderboard" component={Leaderboard} />
      <ProtectedRoute path="/fixtures" component={Fixtures} />
      <ProtectedRoute path="/rules" component={RulesPage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/admin" component={AdminDashboard} adminOnly />
      <ProtectedRoute path="/admin/payments" component={AdminPaymentPanel} adminOnly />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/manual-payment" component={ManualPaymentPage} />
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
