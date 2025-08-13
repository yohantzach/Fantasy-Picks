import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Trophy, 
  Eye, 
  Lock, 
  Unlock, 
  Calendar, 
  Crown,
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import Navigation from "@/components/ui/navigation";

interface Team {
  id: number;
  teamName: string;
  formation: string;
  totalValue: number;
  players: number[];
  captainId: number;
  viceCaptainId: number;
  createdAt: string;
  isLocked: boolean;
  totalPoints: number;
  userId: number;
  gameweekId: number;
  userName: string;
  userEmail: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  hasPaid: boolean;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [selectedGameweek, setSelectedGameweek] = useState<string>("current");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch all teams for admin
  const { data: allTeams = [], isLoading: teamsLoading, refetch: refetchTeams } = useQuery({
    queryKey: ["/api/admin/teams", selectedGameweek],
    queryFn: async () => {
      const gameweekParam = selectedGameweek === "current" 
        ? (currentGameweek as any)?.id 
        : selectedGameweek;
      const response = await apiRequest("GET", `/api/admin/teams?gameweek=${gameweekParam}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!currentGameweek,
  });

  // Fetch all users for admin
  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/users");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  });

  // Fetch FPL players for team details
  const { data: players = [] } = useQuery({
    queryKey: ["/api/fpl/players"],
  });

  // Filter teams based on search and status
  const filteredTeams = allTeams.filter((team: Team) => {
    const matchesSearch = team.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         team.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || 
                         (filterStatus === "locked" && team.isLocked) ||
                         (filterStatus === "unlocked" && !team.isLocked) ||
                         (filterStatus === "incomplete" && team.players.length < 11);
    
    return matchesSearch && matchesStatus;
  });

  const handleViewTeam = (team: Team) => {
    setSelectedTeam(team);
    setShowTeamDetails(true);
  };

  const handleToggleLock = async (teamId: number, currentLockStatus: boolean) => {
    try {
      await apiRequest("PATCH", `/api/admin/teams/${teamId}/lock`, {
        isLocked: !currentLockStatus
      });
      
      toast({
        title: "Team Updated",
        description: `Team ${currentLockStatus ? 'unlocked' : 'locked'} successfully`,
      });
      
      refetchTeams();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update team status",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDeadlines = async () => {
    try {
      await apiRequest("POST", "/api/admin/update-deadlines");
      toast({
        title: "Deadlines Updated",
        description: "Gameweek deadlines have been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update deadlines",
        variant: "destructive",
      });
    }
  };

  const getTeamPlayers = (playerIds: number[]) => {
    return (players as any[]).filter(player => playerIds.includes(player.id));
  };

  const getCaptainName = (captainId: number) => {
    const captain = (players as any[]).find(player => player.id === captainId);
    return captain ? captain.web_name : "Unknown";
  };

  const getViceCaptainName = (viceCaptainId: number) => {
    const viceCaptain = (players as any[]).find(player => player.id === viceCaptainId);
    return viceCaptain ? viceCaptain.web_name : "Unknown";
  };

  const exportTeamsData = () => {
    const csvData = filteredTeams.map((team: Team) => ({
      teamName: team.teamName,
      userName: team.userName,
      userEmail: team.userEmail,
      formation: team.formation,
      totalValue: team.totalValue,
      totalPoints: team.totalPoints,
      isLocked: team.isLocked ? "Yes" : "No",
      playerCount: team.players.length,
      captain: getCaptainName(team.captainId),
      viceCaptain: getCaptainName(team.viceCaptainId),
      createdAt: format(new Date(team.createdAt), 'MMM dd, yyyy HH:mm')
    }));

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `teams_gameweek_${selectedGameweek}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (teamsLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fpl-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-4">Admin Dashboard</h1>
          <p className="text-white/70 text-base sm:text-lg">
            Manage teams, users, and gameweek settings
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400" />
                <div className="text-center sm:text-left">
                  <div className="text-lg sm:text-2xl font-bold text-white">
                    {new Set(allTeams.map((team: Team) => team.userId)).size}
                  </div>
                  <div className="text-xs sm:text-sm text-white/70">Unique Players</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-fpl-green" />
                <div className="text-center sm:text-left">
                  <div className="text-lg sm:text-2xl font-bold text-white">{allTeams.length}</div>
                  <div className="text-xs sm:text-sm text-white/70">Teams Created</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-red-400" />
                <div className="text-center sm:text-left">
                  <div className="text-lg sm:text-2xl font-bold text-white">
                    {allTeams.filter((team: Team) => team.isLocked).length}
                  </div>
                  <div className="text-xs sm:text-sm text-white/70">Locked Teams</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400" />
                <div className="text-center sm:text-left">
                  <div className="text-lg sm:text-2xl font-bold text-white">
                    GW {(currentGameweek as any)?.gameweekNumber || "N/A"}
                  </div>
                  <div className="text-xs sm:text-sm text-white/70">Current Gameweek</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Note */}
        <Card className="bg-blue-500/10 border-blue-500/20 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-300 mb-2">
              <Shield className="h-4 w-4" />
              <span className="font-medium">Admin Dashboard Note</span>
            </div>
            <p className="text-blue-200 text-sm">
              Team creation and editing are now handled through the user interface. 
              Users can create teams which are saved to the database before payment approval. 
              Only the first approved team per user can be edited.
            </p>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="bg-white/5 border-white/20 mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-white/70" />
                  <Input
                    placeholder="Search teams or users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 bg-white/10 border-white/20 text-white"
                  />
                </div>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48 bg-white/10 border-white/20 text-white">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    <SelectItem value="locked">Locked Teams</SelectItem>
                    <SelectItem value="unlocked">Unlocked Teams</SelectItem>
                    <SelectItem value="incomplete">Incomplete Teams</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={exportTeamsData}
                  variant="outline"
                  className="border-gray-300 bg-white text-black hover:bg-gray-100 text-sm"
                >
                  <Download className="h-4 w-4 mr-2 text-black" />
                  <span className="hidden sm:inline text-black">Export </span><span className="text-black">CSV</span>
                </Button>

                <Button
                  onClick={handleUpdateDeadlines}
                  variant="outline"
                  className="border-gray-300 bg-white text-black hover:bg-gray-100 text-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2 text-black" />
                  <span className="hidden sm:inline text-black">Update </span><span className="text-black">Deadlines</span>
                </Button>

                <Button
                  onClick={() => refetchTeams()}
                  className="bg-white hover:bg-gray-100 text-black text-sm border border-gray-300"
                >
                  <RefreshCw className="h-4 w-4 mr-2 text-black" />
                  <span className="text-black">Refresh</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Teams Table */}
        <Card className="bg-white/5 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">
              All Teams ({filteredTeams.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-4 text-white/70">Team Name</th>
                    <th className="text-left py-3 px-4 text-white/70">User</th>
                    <th className="text-left py-3 px-4 text-white/70">Formation</th>
                    <th className="text-left py-3 px-4 text-white/70">Value</th>
                    <th className="text-left py-3 px-4 text-white/70">Points</th>
                    <th className="text-left py-3 px-4 text-white/70">Players</th>
                    <th className="text-left py-3 px-4 text-white/70">Status</th>
                    <th className="text-left py-3 px-4 text-white/70">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((team: Team) => (
                    <tr key={team.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-3 px-4 text-white font-medium">{team.teamName}</td>
                      <td className="py-3 px-4">
                        <div className="text-white text-sm">{team.userName}</div>
                        <div className="text-white/60 text-xs">{team.userEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-white">{team.formation}</td>
                      <td className="py-3 px-4 text-white">£{(team.totalValue && typeof team.totalValue === 'number') ? team.totalValue.toFixed(1) : '0.0'}m</td>
                      <td className="py-3 px-4 text-white">{team.totalPoints}</td>
                      <td className="py-3 px-4">
                        <Badge className={team.players.length === 11 ? "bg-green-600" : "bg-red-600"}>
                          {team.players.length}/11
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={team.isLocked ? "bg-red-600" : "bg-green-600"}>
                          {team.isLocked ? "Locked" : "Active"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewTeam(team)}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleLock(team.id, team.isLocked)}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            {team.isLocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Team Details Modal */}
        <Dialog open={showTeamDetails} onOpenChange={setShowTeamDetails}>
          <DialogContent className="max-w-4xl bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 border-purple-500/30 text-white">
            <DialogHeader>
              <DialogTitle>Team Details: {selectedTeam?.teamName}</DialogTitle>
            </DialogHeader>
            {selectedTeam && (
              <div className="space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Team Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-white mb-3">Team Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-white/70">Owner:</span> {selectedTeam.userName}</div>
                      <div><span className="text-white/70">Email:</span> {selectedTeam.userEmail}</div>
                      <div><span className="text-white/70">Formation:</span> {selectedTeam.formation}</div>
                      <div><span className="text-white/70">Total Value:</span> £{(selectedTeam.totalValue && typeof selectedTeam.totalValue === 'number') ? selectedTeam.totalValue.toFixed(1) : '0.0'}m</div>
                      <div><span className="text-white/70">Total Points:</span> {selectedTeam.totalPoints}</div>
                      <div><span className="text-white/70">Status:</span> {selectedTeam.isLocked ? 'Locked' : 'Active'}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-3">Captain & Vice Captain</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-400" />
                        <span className="text-white/70">Captain:</span> {getCaptainName(selectedTeam.captainId)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gray-400" />
                        <span className="text-white/70">Vice Captain:</span> {getViceCaptainName(selectedTeam.viceCaptainId)}
                      </div>
                      <div><span className="text-white/70">Created:</span> {format(new Date(selectedTeam.createdAt), 'MMM dd, yyyy HH:mm')}</div>
                    </div>
                  </div>
                </div>

                {/* Players List */}
                <div>
                  <h4 className="font-semibold text-white mb-3">Squad ({selectedTeam.players.length}/11)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getTeamPlayers(selectedTeam.players).map((player: any) => (
                      <div key={player.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-white">{player.web_name}</div>
                          <div className="text-sm text-white/60">{player.team_name} - {player.position_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-medium">£{(player.now_cost / 10).toFixed(1)}m</div>
                          <div className="text-sm text-white/60">{player.total_points} pts</div>
                        </div>
                        {selectedTeam.captainId === player.id && <Crown className="h-4 w-4 text-yellow-400" />}
                        {selectedTeam.viceCaptainId === player.id && <Shield className="h-4 w-4 text-gray-400" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
