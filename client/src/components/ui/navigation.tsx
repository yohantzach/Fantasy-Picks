import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Volleyball, User, LogOut, Menu, X, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Navigation() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch current gameweek for deadline timer
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch user teams to determine edit team link
  const { data: userTeams = [] } = useQuery({
    queryKey: ["/api/teams/user"],
    enabled: !!user,
  });

  // Find the first team with approved payment (editable team)
  const editableTeam = userTeams.find(team => team.paymentStatus === 'approved');

  const navItems = [
    { path: "/", label: "Create Team", icon: "⚽" },
    { 
      path: editableTeam ? `/edit-team?team=${editableTeam.teamNumber}` : "/edit-team", 
      label: "Edit Team", 
      icon: "✏️" 
    },
    { path: "/leaderboard", label: "Leaderboard", icon: "🏆" },
    { path: "/fixtures", label: "Fixtures", icon: "📅" },
    { path: "/rules", label: "Rules", icon: "📋" },
  ];

  const adminNavItems = [
    { path: "/admin", label: "Admin Dashboard", icon: "⚙️" },
    { path: "/admin/payments", label: "Payment Panel", icon: "💳" },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <nav className="bg-slate-900/95 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <div>
                <span className="text-white font-bold text-xl">Fantasy Picks</span>
                <div className="text-fpl-green text-xs font-medium">Weekly League</div>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-1 ml-8">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      isActive(item.path)
                        ? "bg-fpl-green/20 text-fpl-green shadow-lg"
                        : "text-white hover:bg-white/10 hover:text-fpl-green"
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Button>
                </Link>
              ))}
              
              {/* Admin Navigation Items */}
              {user?.isAdmin && adminNavItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                      isActive(item.path)
                        ? "bg-yellow-500/20 text-yellow-400 shadow-lg"
                        : "text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-400"
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Deadline Timer - Desktop */}
            {currentGameweek && (
              <div className="hidden lg:block">
                <div className="text-sm text-white/80">
                  Gameweek {(currentGameweek as any).gameweekNumber}
                </div>
              </div>
            )}

            {/* User Info */}
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-white text-sm font-medium">{(user as any)?.email}</div>
                <div className="flex items-center gap-2 text-xs">
                  {user?.isAdmin && (
                    <Badge variant="outline" className="border-yellow-400 text-yellow-400 text-xs px-1">
                      <Settings className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {!user?.isAdmin && (
                    <span className={`${user?.hasPaid ? "text-green-400" : "text-red-400"}`}>
                      {user?.hasPaid ? "✓ Paid" : "⚠ Payment Required"}
                    </span>
                  )}
                </div>
              </div>
              
              {/* User Avatar */}
              <Link href="/profile">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 p-0 bg-fpl-green rounded-full text-white hover:bg-green-600 transition-colors"
                  title="View Profile"
                >
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              
              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
                disabled={logoutMutation.isPending}
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="md:hidden text-white hover:bg-white/10"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 py-4">
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-sm font-medium ${
                      isActive(item.path)
                        ? "bg-fpl-green/20 text-fpl-green"
                        : "text-white hover:bg-white/10"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Button>
                </Link>
              ))}
              
              {/* Admin items in mobile */}
              {user?.isAdmin && adminNavItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-sm font-medium ${
                      isActive(item.path)
                        ? "bg-yellow-500/20 text-yellow-400"
                        : "text-yellow-300 hover:bg-yellow-500/10"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
            
            {/* Mobile User Info */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="px-4 py-2 bg-white/10 rounded-lg">
                <div className="text-white font-medium">{(user as any)?.email}</div>
                <div className="flex items-center gap-2 text-xs mt-1">
                  {user?.isAdmin && (
                    <Badge variant="outline" className="border-yellow-400 text-yellow-400 text-xs">
                      Admin
                    </Badge>
                  )}
                  {!user?.isAdmin && (
                    <span className={`${user?.hasPaid ? "text-green-400" : "text-red-400"}`}>
                      {user?.hasPaid ? "✓ Paid" : "⚠ Payment Required"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Mobile Gameweek Info */}
            {currentGameweek && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-sm text-white/80">
                  Gameweek {(currentGameweek as any).gameweekNumber}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
