import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { FormationPitch } from "@/components/formation-pitch";
import { EnhancedPlayerSelectionTable } from "@/components/enhanced-player-selection-table";
import { PlayerStatsModal } from "@/components/player-stats-modal";
import Navigation from "@/components/ui/navigation";
import EnhancedPaymentModal from "@/components/ui/enhanced-payment-modal";
import { Link } from "wouter";



export default function TeamSelection() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<any>(null);
  const [showPlayerTable, setShowPlayerTable] = useState<number | null>(null);
  const [formation, setFormation] = useState("4-4-2");

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
  useMemo(() => {
    if (currentTeam?.players) {
      setSelectedPlayers(currentTeam.players);
      setTeamName(currentTeam.teamName || "");
      setCaptainId(currentTeam.captainId || null);
      setViceCaptainId(currentTeam.viceCaptainId || null);
    }
  }, [currentTeam]);

  const handlePositionClick = (elementType: number) => {
    setShowPlayerTable(elementType);
  };

  const handleClosePlayerTable = () => {
    setShowPlayerTable(null);
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
      // Close the player table after adding a player
      setShowPlayerTable(null);
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

    const teamData = {
      teamName: teamName.trim(),
      formation: "4-4-2",
      players: selectedPlayers,
      captainId,
      viceCaptainId,
    };

    saveTeamMutation.mutate(teamData);
  };



  const isDeadlinePassed = currentGameweek?.deadline ? new Date() > new Date(currentGameweek.deadline) : false;
  const isLocked = currentTeam?.isLocked || isDeadlinePassed;

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-green">
      <Navigation />
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

      {!showPlayerTable ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Formation Pitch */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Formation - Click on positions to select players</CardTitle>
                  <div className="w-32">
                    <Select value={formation} onValueChange={setFormation} disabled={isLocked}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3-4-3">3-4-3</SelectItem>
                        <SelectItem value="3-5-2">3-5-2</SelectItem>
                        <SelectItem value="4-3-3">4-3-3</SelectItem>
                        <SelectItem value="4-4-2">4-4-2</SelectItem>
                        <SelectItem value="4-5-1">4-5-1</SelectItem>
                        <SelectItem value="5-4-1">5-4-1</SelectItem>
                        <SelectItem value="5-3-2">5-3-2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <FormationPitch 
                  formation={formation}
                  selectedPlayers={selectedPlayers}
                  players={players}
                  onPositionClick={handlePositionClick}
                  captainId={captainId}
                  viceCaptainId={viceCaptainId}
                />
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
                              ×
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
                    {saveTeamMutation.isPending ? (
                      <>
                        <Save className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Team
                      </>
                    )}
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
      ) : (
        /* Enhanced Player Selection Table */
        <div className="space-y-6">
          <EnhancedPlayerSelectionTable
            players={players || []}
            fplTeams={fplTeams || []}
            elementType={showPlayerTable}
            selectedPlayers={selectedPlayers}
            onPlayerToggle={handlePlayerToggle}
            onPlayerStats={setSelectedPlayerForStats}
            onClose={handleClosePlayerTable}
            currentGameweek={currentGameweek}
          />
        </div>
      )}

      {/* Player Stats Modal */}
      {selectedPlayerForStats && (
        <PlayerStatsModal
          player={selectedPlayerForStats}
          isOpen={!!selectedPlayerForStats}
          onClose={() => setSelectedPlayerForStats(null)}
          onReplace={() => console.log('Replace player')}
          onMakeCaptain={() => console.log('Make captain')}
          onMakeViceCaptain={() => console.log('Make vice captain')}
          onRemoveCaptain={() => console.log('Remove captain')}
          onRemoveViceCaptain={() => console.log('Remove vice captain')}
          showCaptainOption={true}
          showViceCaptainOption={true}
          isCaptain={captainId === selectedPlayerForStats?.id}
          isViceCaptain={viceCaptainId === selectedPlayerForStats?.id}
        />
      )}
      </div>
    </div>
  );
}