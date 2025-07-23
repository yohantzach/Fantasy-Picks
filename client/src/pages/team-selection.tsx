import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FPLPlayer, insertTeamSchema } from "@shared/schema";
import { Crown, DollarSign, Users, Clock, TrendingUp, Star, Zap, Info, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
import { PlayerStatsModal } from "@/components/player-stats-modal";

interface PlayerCardProps {
  player: FPLPlayer;
  isSelected: boolean;
  onToggle: (playerId: number, isAdding: boolean) => void;
  onShowStats: (player: FPLPlayer) => void;
}

function PlayerCard({ player, isSelected, onToggle, onShowStats }: PlayerCardProps) {
  return (
    <Card className={`transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-fpl-green bg-fpl-green/5' : ''}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{player.web_name}</h3>
            <p className="text-xs text-muted-foreground">{player.first_name} {player.second_name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                £{(player.now_cost / 10).toFixed(1)}m
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {player.total_points} pts
              </Badge>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-muted-foreground">Form: {player.form}</span>
              <span className="text-xs text-muted-foreground">• {player.selected_by_percent}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onShowStats(player)}
              className="h-8 w-8 p-0"
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={isSelected ? "destructive" : "default"}
              onClick={() => onToggle(player.id, !isSelected)}
              className="h-8 w-8 p-0"
            >
              {isSelected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamSelection() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [teamName, setTeamName] = useState("");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"price" | "points" | "form">("price");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<FPLPlayer | null>(null);

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch user's current team
  const { data: currentTeam } = useQuery({
    queryKey: ["/api/team/current"],
  });

  // Fetch FPL data
  const { data: players = [] } = useQuery<FPLPlayer[]>({
    queryKey: ["/api/fpl/players"],
  });

  const { data: fplTeams = [] } = useQuery({
    queryKey: ["/api/fpl/teams"],
  });

  // Load current team data when available
  useMemo(() => {
    if (currentTeam?.players) {
      setSelectedPlayers(currentTeam.players);
      setTeamName(currentTeam.teamName || "");
      setCaptainId(currentTeam.captainId || null);
      setViceCaptainId(currentTeam.viceCaptainId || null);
    }
  }, [currentTeam]);

  // Filter and sort players by position
  const getPlayersByPosition = (elementType: number) => {
    let filteredPlayers = players.filter(p => p.element_type === elementType);

    // Apply search filter
    if (searchQuery) {
      filteredPlayers = filteredPlayers.filter(p =>
        p.web_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.second_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply team filter
    if (filterTeam !== "all") {
      filteredPlayers = filteredPlayers.filter(p => p.team.toString() === filterTeam);
    }

    // Sort players
    return filteredPlayers.sort((a, b) => {
      switch (sortBy) {
        case "price":
          return b.now_cost - a.now_cost;
        case "points":
          return b.total_points - a.total_points;
        case "form":
          return parseFloat(b.form) - parseFloat(a.form);
        default:
          return b.now_cost - a.now_cost;
      }
    });
  };

  const totalCost = useMemo(() => {
    const selectedPlayerObjs = players.filter(p => selectedPlayers.includes(p.id));
    return selectedPlayerObjs.reduce((sum, p) => sum + p.now_cost, 0);
  }, [selectedPlayers, players]);

  const remainingBudget = 1000 - totalCost; // 100.0m in API units

  // Validate team constraints
  const validatePlayerSelection = (playerId: number, isAdding: boolean) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return false;

    if (isAdding) {
      // Check if already at 11 players
      if (selectedPlayers.length >= 11) {
        toast({
          title: "Team Full",
          description: "You can only select 11 players",
          variant: "destructive",
        });
        return false;
      }

      // Check budget
      if (player.now_cost > remainingBudget) {
        toast({
          title: "Insufficient Budget",
          description: `You need £${((player.now_cost - remainingBudget) / 10).toFixed(1)}m more`,
          variant: "destructive",
        });
        return false;
      }

      // Check position limits
      const currentPositionCount = selectedPlayers.filter(id => {
        const p = players.find(p => p.id === id);
        return p?.element_type === player.element_type;
      }).length;

      const maxForPosition = player.element_type === 1 ? 2 : player.element_type === 2 ? 5 : player.element_type === 3 ? 5 : 3;
      
      if (currentPositionCount >= maxForPosition) {
        const positionName = player.element_type === 1 ? "goalkeepers" : 
                           player.element_type === 2 ? "defenders" :
                           player.element_type === 3 ? "midfielders" : "forwards";
        toast({
          title: "Position Limit Reached",
          description: `You can only select ${maxForPosition} ${positionName}`,
          variant: "destructive",
        });
        return false;
      }

      // Check team limit (max 3 from same team)
      const sameTeamCount = selectedPlayers.filter(id => {
        const p = players.find(p => p.id === id);
        return p?.team === player.team;
      }).length;

      if (sameTeamCount >= 3) {
        toast({
          title: "Team Limit Reached",
          description: "You can only select 3 players from the same team",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handlePlayerToggle = (playerId: number, isAdding: boolean) => {
    if (!validatePlayerSelection(playerId, isAdding)) return;

    if (isAdding) {
      setSelectedPlayers(prev => [...prev, playerId]);
    } else {
      setSelectedPlayers(prev => prev.filter(id => id !== playerId));
      // Remove captain/vice-captain if deselected
      if (captainId === playerId) setCaptainId(null);
      if (viceCaptainId === playerId) setViceCaptainId(null);
    }
  };

  const saveTeamMutation = useMutation({
    mutationFn: async (teamData: any) => {
      const response = await apiRequest("POST", "/api/team/save", teamData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Team Saved",
        description: "Your team has been saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save team",
        variant: "destructive",
      });
    },
  });

  const handleSaveTeam = () => {
    if (selectedPlayers.length !== 11) {
      toast({
        title: "Incomplete Team",
        description: "You must select exactly 11 players",
        variant: "destructive",
      });
      return;
    }

    if (!captainId || !viceCaptainId) {
      toast({
        title: "Missing Captain",
        description: "You must select a captain and vice-captain",
        variant: "destructive",
      });
      return;
    }

    if (!teamName.trim()) {
      toast({
        title: "Team Name Required",
        description: "Please enter a team name",
        variant: "destructive",
      });
      return;
    }

    const teamData = insertTeamSchema.parse({
      teamName: teamName.trim(),
      formation: "4-4-2",
      players: selectedPlayers,
      captainId,
      viceCaptainId,
    });

    saveTeamMutation.mutate(teamData);
  };

  const getPositionName = (elementType: number) => {
    switch (elementType) {
      case 1: return "Goalkeepers";
      case 2: return "Defenders";
      case 3: return "Midfielders";
      case 4: return "Forwards";
      default: return "Unknown";
    }
  };

  const isDeadlinePassed = currentGameweek?.deadline ? new Date() > new Date(currentGameweek.deadline) : false;
  const isLocked = currentTeam?.isLocked || isDeadlinePassed;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Team Selection</h1>
          <p className="text-muted-foreground">
            {currentGameweek ? `Gameweek ${currentGameweek.gameweekNumber}` : "Loading..."}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-fpl-green">
            £{(remainingBudget / 10).toFixed(1)}m
          </div>
          <p className="text-sm text-muted-foreground">Budget Remaining</p>
        </div>
      </div>

      {/* Deadline warning */}
      {currentGameweek?.deadline && (
        <Card className={`border-l-4 ${isDeadlinePassed ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="font-medium">
                {isDeadlinePassed ? "Deadline Passed" : "Deadline"}
              </span>
              <span className="text-muted-foreground">
                {format(new Date(currentGameweek.deadline), "PPP 'at' p")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Player Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Select Players</CardTitle>
              <div className="flex gap-4 flex-wrap">
                <Input
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs"
                />
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                    <SelectItem value="form">Form</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {fplTeams.map((team: any) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.short_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="1" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="1">GK</TabsTrigger>
                  <TabsTrigger value="2">DEF</TabsTrigger>
                  <TabsTrigger value="3">MID</TabsTrigger>
                  <TabsTrigger value="4">FWD</TabsTrigger>
                </TabsList>
                
                {[1, 2, 3, 4].map((position) => (
                  <TabsContent key={position} value={position.toString()}>
                    <div className="space-y-2">
                      <h3 className="font-semibold">{getPositionName(position)}</h3>
                      <div className="grid gap-2 max-h-96 overflow-y-auto">
                        {getPlayersByPosition(position).map((player) => (
                          <PlayerCard
                            key={player.id}
                            player={player}
                            isSelected={selectedPlayers.includes(player.id)}
                            onToggle={handlePlayerToggle}
                            onShowStats={setSelectedPlayerForStats}
                          />
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Team Overview */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  placeholder="Enter team name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  disabled={isLocked}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Selected Players ({selectedPlayers.length}/11)</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {selectedPlayers.map((playerId) => {
                    const player = players.find(p => p.id === playerId);
                    if (!player) return null;
                    return (
                      <div key={playerId} className="flex justify-between items-center text-sm">
                        <span>{player.web_name}</span>
                        <div className="flex items-center gap-2">
                          <span>£{(player.now_cost / 10).toFixed(1)}m</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePlayerToggle(playerId, false)}
                            className="h-6 w-6 p-0"
                            disabled={isLocked}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Captain</div>
                <Select value={captainId?.toString() || ""} onValueChange={(value) => setCaptainId(Number(value))} disabled={isLocked}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select captain" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPlayers.map((playerId) => {
                      const player = players.find(p => p.id === playerId);
                      if (!player) return null;
                      return (
                        <SelectItem key={playerId} value={playerId.toString()}>
                          {player.web_name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Vice Captain</div>
                <Select value={viceCaptainId?.toString() || ""} onValueChange={(value) => setViceCaptainId(Number(value))} disabled={isLocked}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vice captain" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPlayers.filter(id => id !== captainId).map((playerId) => {
                      const player = players.find(p => p.id === playerId);
                      if (!player) return null;
                      return (
                        <SelectItem key={playerId} value={playerId.toString()}>
                          {player.web_name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Cost:</span>
                  <span>£{(totalCost / 10).toFixed(1)}m</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Budget Remaining:</span>
                  <span className="text-fpl-green">£{(remainingBudget / 10).toFixed(1)}m</span>
                </div>
              </div>

              {!isLocked && (
                <Button
                  onClick={handleSaveTeam}
                  className="w-full"
                  disabled={saveTeamMutation.isPending || selectedPlayers.length !== 11}
                >
                  {saveTeamMutation.isPending ? "Saving..." : "Save Team"}
                </Button>
              )}

              {isLocked && (
                <div className="text-center text-sm text-muted-foreground">
                  Team locked - deadline passed
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        player={selectedPlayerForStats}
        isOpen={!!selectedPlayerForStats}
        onClose={() => setSelectedPlayerForStats(null)}
      />
    </div>
  );
}