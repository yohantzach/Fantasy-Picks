import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { PositionSelector } from "@/components/position-selector";
import { PlayerStatsModal } from "@/components/player-stats-modal";
import { FormationSelector, FORMATIONS } from "@/components/formation-selector";
import { FootballPitch } from "@/components/football-pitch";
import Navigation from "@/components/ui/navigation";

interface Player {
  id: number;
  web_name: string;
  team_name: string;
  position_name: string;
  price_formatted: string;
  total_points: number;
  now_cost: number;
  element_type: number;
  team: number;
}

export default function TeamSelectionEnhanced() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [teamName, setTeamName] = useState("");
  const [formation, setFormation] = useState("4-4-2");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [positionSelectorOpen, setPositionSelectorOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<string>("");

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch user's current team
  const { data: currentTeam } = useQuery({
    queryKey: ["/api/team/current"],
  });

  // Fetch FPL data
  const { data: players = [] } = useQuery({
    queryKey: ["/api/fpl/players"],
  });

  const { data: fplTeams = [] } = useQuery({
    queryKey: ["/api/fpl/teams"],
  });

  // Load current team data when available
  useEffect(() => {
    if (currentTeam && players && Array.isArray(players) && players.length > 0) {
      const teamData = currentTeam as any;
      const teamPlayers = (players as Player[]).filter((p: Player) => 
        teamData.players?.includes(p.id)
      );
      setSelectedPlayers(teamPlayers);
      setTeamName(teamData.teamName || "");
      setFormation(teamData.formation || "4-4-2");
      setCaptainId(teamData.captainId || null);
      setViceCaptainId(teamData.viceCaptainId || null);
    }
  }, [currentTeam, players]);

  // Calculate team stats
  const teamStats = useMemo(() => {
    const totalCost = selectedPlayers.reduce((sum, player) => 
      sum + (player.now_cost / 10), 0
    );
    
    const totalPoints = selectedPlayers.reduce((sum, player) => 
      sum + player.total_points, 0
    );
    
    const positionCounts = selectedPlayers.reduce((counts, player) => {
      counts[player.position_name] = (counts[player.position_name] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const formationConfig = FORMATIONS.find(f => f.name === formation);
    const requiredCounts: Record<string, number> = formationConfig ? {
      'GKP': 1,
      'DEF': formationConfig.defenders,
      'MID': formationConfig.midfielders,
      'FWD': formationConfig.forwards
    } : { 'GKP': 1, 'DEF': 4, 'MID': 4, 'FWD': 2 };
    
    const isValidFormation = Object.keys(requiredCounts).every(
      pos => positionCounts[pos] === requiredCounts[pos]
    );
    
    return {
      totalCost,
      remainingBudget: 100 - totalCost,
      totalPlayers: selectedPlayers.length,
      totalPoints,
      positionCounts,
      isValid: selectedPlayers.length === 11 && 
               isValidFormation &&
               totalCost <= 100 &&
               captainId !== null &&
               viceCaptainId !== null
    };
  }, [selectedPlayers, formation, captainId]);

  const handlePositionClick = (position: string) => {
    setSelectedPosition(position);
    setPositionSelectorOpen(true);
  };

  const handlePlayerSelect = (player: Player) => {
    // Check if adding this player would exceed formation limits
    const formationConfig = FORMATIONS.find(f => f.name === formation);
    if (!formationConfig) return;

    const currentCounts = selectedPlayers.reduce((counts, p) => {
      counts[p.position_name] = (counts[p.position_name] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const requiredCounts: Record<string, number> = {
      'GKP': 1,
      'DEF': formationConfig.defenders,
      'MID': formationConfig.midfielders,
      'FWD': formationConfig.forwards
    };

    if (currentCounts[player.position_name] >= requiredCounts[player.position_name]) {
      toast({
        title: "Position Full",
        description: `You already have the maximum number of ${player.position_name} players for this formation`,
        variant: "destructive",
      });
      return;
    }

    // Check budget constraint
    const newTotalCost = selectedPlayers.reduce((sum, p) => sum + p.now_cost, 0) + player.now_cost;
    if (newTotalCost > 1000) { // 100.0m in API units
      toast({
        title: "Budget Exceeded",
        description: "Adding this player would exceed your budget",
        variant: "destructive",
      });
      return;
    }

    // Check team constraint (max 3 players from same team)
    const teamCount = selectedPlayers.filter(p => p.team === player.team).length;
    if (teamCount >= 3) {
      toast({
        title: "Team Limit Reached",
        description: "You can only have 3 players from the same team",
        variant: "destructive",
      });
      return;
    }

    setSelectedPlayers(prev => [...prev, player]);
    setPositionSelectorOpen(false);
  };

  const handlePlayerRemove = (playerId: number) => {
    setSelectedPlayers(prev => prev.filter(p => p.id !== playerId));
    if (captainId === playerId) setCaptainId(null);
    if (viceCaptainId === playerId) setViceCaptainId(null);
  };

  const handlePlayerInfo = (player: Player) => {
    setSelectedPlayerForStats(player);
    setShowPlayerStats(true);
  };

  const handleReplacePlayer = (player: Player) => {
    // Remove the current player and open position selector for replacement
    handlePlayerRemove(player.id);
    setSelectedPosition(player.position_name);
    setPositionSelectorOpen(true);
    setShowPlayerStats(false);
  };

  const handleMakeCaptainFromModal = (player: Player) => {
    handleSetCaptain(player.id);
    setShowPlayerStats(false);
  };

  const handleMakeViceCaptainFromModal = (player: Player) => {
    handleSetViceCaptain(player.id);
    setShowPlayerStats(false);
  };

  const handleRemoveCaptainFromModal = (player: Player) => {
    setCaptainId(null);
    setShowPlayerStats(false);
  };

  const handleRemoveViceCaptainFromModal = (player: Player) => {
    setViceCaptainId(null);
    setShowPlayerStats(false);
  };

  const handleSetCaptain = (playerId: number) => {
    setCaptainId(playerId);
    if (viceCaptainId === playerId) {
      setViceCaptainId(null);
    }
  };

  const handleSetViceCaptain = (playerId: number) => {
    setViceCaptainId(playerId);
    if (captainId === playerId) {
      setCaptainId(null);
    }
  };

  // Save team mutation
  const saveTeamMutation = useMutation({
    mutationFn: async () => {
      if (!teamStats.isValid) {
        throw new Error("Team is not valid");
      }

      if (!teamName.trim()) {
        throw new Error("Please enter a team name");
      }

      return apiRequest("POST", "/api/team", {
        teamName: teamName.trim(),
        formation,
        players: selectedPlayers.map(p => p.id),
        captainId,
        viceCaptainId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Team Saved Successfully!",
        description: "Your team has been saved for this gameweek",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Team",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSaveTeam = () => {
    saveTeamMutation.mutate();
  };

  const isDeadlinePassed = currentGameweek && (currentGameweek as any).deadline && new Date() > new Date((currentGameweek as any).deadline);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Team Selection</h1>
          {currentGameweek && (
            <div className="flex items-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Gameweek {(currentGameweek as any).gameweekNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span>
                  Deadline: {format(new Date((currentGameweek as any).deadline), "MMM dd, HH:mm")}
                </span>
              </div>
              {isDeadlinePassed && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Deadline Passed
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Formation and Pitch */}
          <div className="lg:col-span-2 space-y-6">
            {/* Formation Selector */}
            <FormationSelector
              selectedFormation={formation}
              onFormationChange={setFormation}
              disabled={isDeadlinePassed}
            />

            {/* Football Pitch */}
            <Card className="bg-white/5 border-white/20 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-white">Your Team</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <FootballPitch
                  selectedPlayers={selectedPlayers}
                  formation={formation}
                  captainId={captainId}
                  viceCaptainId={viceCaptainId}
                  onPlayerRemove={handlePlayerRemove}
                  onPlayerInfo={handlePlayerInfo}
                  onSetCaptain={handleSetCaptain}
                  onSetViceCaptain={handleSetViceCaptain}
                  onPositionClick={handlePositionClick}
                  disabled={isDeadlinePassed}
                />
              </CardContent>
            </Card>
          </div>

          {/* Team Stats and Controls */}
          <div className="space-y-6">
            {/* Team Name */}
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Team Name</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name"
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  disabled={isDeadlinePassed}
                />
              </CardContent>
            </Card>

            {/* Team Stats */}
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Budget & Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-fpl-green">
                      £{teamStats.totalCost.toFixed(1)}m
                    </div>
                    <div className="text-xs text-white/70">Total Cost</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      teamStats.remainingBudget >= 0 ? 'text-fpl-green' : 'text-red-400'
                    }`}>
                      £{teamStats.remainingBudget.toFixed(1)}m
                    </div>
                    <div className="text-xs text-white/70">Remaining</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {teamStats.totalPlayers}/11
                    </div>
                    <div className="text-xs text-white/70">Players</div>
                  </div>

                </div>

                {/* Position breakdown */}
                <div className="space-y-2">
                  <div className="text-sm text-white/70">Positions:</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(teamStats.positionCounts).map(([pos, count]) => (
                      <Badge key={pos} variant="secondary" className="text-xs">
                        {pos}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Captain/Vice Captain */}
                <div className="space-y-2">
                  <div className="text-sm text-white/70">Captain:</div>
                  <div className="text-sm text-white">
                    {captainId ? 
                      selectedPlayers.find(p => p.id === captainId)?.web_name || "Unknown" : 
                      "Not selected"
                    }
                  </div>
                  <div className="text-sm text-white/70">Vice Captain:</div>
                  <div className="text-sm text-white">
                    {viceCaptainId ? 
                      selectedPlayers.find(p => p.id === viceCaptainId)?.web_name || "Unknown" : 
                      "Not selected"
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSaveTeam}
              disabled={!teamStats.isValid || saveTeamMutation.isPending || isDeadlinePassed}
              className="w-full bg-fpl-green hover:bg-green-600 text-white h-12"
            >
              {saveTeamMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Team
                </>
              )}
            </Button>

            {!teamStats.isValid && (
              <div className="text-red-400 text-sm text-center">
                {teamStats.totalPlayers !== 11 && "Select 11 players. "}
                {teamStats.remainingBudget < 0 && "Reduce team cost. "}
                {!captainId && "Choose a captain. "}
                {!viceCaptainId && "Choose a vice captain. "}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Position Selector Modal */}
      {positionSelectorOpen && (
        <PositionSelector
          position={selectedPosition}
          isOpen={positionSelectorOpen}
          onClose={() => setPositionSelectorOpen(false)}
          onSelectPlayer={handlePlayerSelect}
          selectedPlayers={selectedPlayers}
          budget={teamStats.remainingBudget}
        />
      )}

      {/* Player Stats Modal */}
      {showPlayerStats && selectedPlayerForStats && (
        <PlayerStatsModal
          player={selectedPlayerForStats}
          isOpen={showPlayerStats}
          onClose={() => setShowPlayerStats(false)}
          onReplace={handleReplacePlayer}
          onMakeCaptain={handleMakeCaptainFromModal}
          onMakeViceCaptain={handleMakeViceCaptainFromModal}
          onRemoveCaptain={handleRemoveCaptainFromModal}
          onRemoveViceCaptain={handleRemoveViceCaptainFromModal}
          showCaptainOption={captainId === null || captainId === selectedPlayerForStats.id}
          showViceCaptainOption={viceCaptainId === null || viceCaptainId === selectedPlayerForStats.id}
          isCaptain={captainId === selectedPlayerForStats.id}
          isViceCaptain={viceCaptainId === selectedPlayerForStats.id}
        />
      )}
    </div>
  );
}