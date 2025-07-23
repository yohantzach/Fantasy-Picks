import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { PositionSelector } from "@/components/position-selector";
import { PlayerDetailsModal } from "@/components/player-details-modal";
import { EnhancedFormationPitch } from "@/components/enhanced-formation-pitch";
import Navigation from "@/components/ui/navigation";

export default function TeamSelection() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [selectedPlayerForDetails, setSelectedPlayerForDetails] = useState<any>(null);
  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
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

  // Calculate team stats
  const teamStats = useMemo(() => {
    const totalCost = selectedPlayers.reduce((sum, player) => 
      sum + (player.now_cost / 10), 0
    );
    
    const totalPoints = selectedPlayers.reduce((sum, player) => 
      sum + player.total_points, 0
    );
    
    const positionCounts = selectedPlayers.reduce((counts, player) => {
      counts[player.position] = (counts[player.position] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    return {
      totalCost,
      remainingBudget: 100 - totalCost,
      totalPlayers: selectedPlayers.length,
      totalPoints,
      positionCounts,
      isValid: selectedPlayers.length === 11 && 
               positionCounts['GKP'] === 1 &&
               positionCounts['DEF'] === 4 &&
               positionCounts['MID'] === 4 &&
               positionCounts['FWD'] === 2 &&
               totalCost <= 100
    };
  }, [selectedPlayers]);

  const handlePositionClick = (position: string) => {
    setSelectedPosition(position);
    setPositionSelectorOpen(true);
  };

  const handlePlayerSelect = (player: any) => {
    // Add position information to player
    const playerWithPosition = { ...player, position: selectedPosition };
    setSelectedPlayers(prev => [...prev, playerWithPosition]);
    setPositionSelectorOpen(false);
  };

  const handlePlayerInfo = (player: any) => {
    setSelectedPlayerForDetails(player);
    setShowPlayerDetails(true);
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

  const getTeamById = (teamId: number) => {
    return fplTeams.find((team: any) => team.id === teamId);
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

      if (!captainId) {
        throw new Error("Please select a captain");
      }

      const teamData = {
        teamName,
        players: selectedPlayers.map(player => ({
          fplPlayerId: player.id,
          position: player.position,
          isCaptain: player.id === captainId,
          isViceCaptain: player.id === viceCaptainId,
        })),
        totalCost: teamStats.totalCost,
        captainId,
        viceCaptainId,
      };

      return await apiRequest("POST", "/api/team", teamData);
    },
    onSuccess: () => {
      toast({
        title: "Team Saved!",
        description: "Your team has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deadlineDate = currentGameweek?.deadline ? new Date(currentGameweek.deadline) : null;
  const isDeadlinePassed = deadlineDate ? new Date() > deadlineDate : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-green">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Users className="h-8 w-8 text-fpl-green" />
            Team Selection - Gameweek {currentGameweek?.gameweekNumber || "21"}
          </h2>
          {deadlineDate && (
            <div className={`flex items-center justify-center gap-2 text-sm ${
              isDeadlinePassed ? 'text-red-400' : 'text-white/60'
            }`}>
              <Clock className="h-4 w-4" />
              {isDeadlinePassed ? (
                "Deadline has passed"
              ) : (
                `Deadline: ${format(deadlineDate, "PPp")}`
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Stats */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="glass-card border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-fpl-green" />
                  Team Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-white/80 text-sm">Team Name</label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name..."
                    className="bg-white/10 border-white/20 text-white placeholder-white/50"
                  />
                </div>

                <Separator className="bg-white/20" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {teamStats.totalPlayers}/11
                    </div>
                    <div className="text-white/60 text-sm">Players</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-fpl-green">
                      £{teamStats.remainingBudget.toFixed(1)}m
                    </div>
                    <div className="text-white/60 text-sm">Remaining</div>
                  </div>
                </div>

                <Separator className="bg-white/20" />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/80">Goalkeepers</span>
                    <span className="text-white">{teamStats.positionCounts['GKP'] || 0}/1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Defenders</span>
                    <span className="text-white">{teamStats.positionCounts['DEF'] || 0}/4</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Midfielders</span>
                    <span className="text-white">{teamStats.positionCounts['MID'] || 0}/4</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/80">Forwards</span>
                    <span className="text-white">{teamStats.positionCounts['FWD'] || 0}/2</span>
                  </div>
                </div>

                {!teamStats.isValid && teamStats.totalPlayers > 0 && (
                  <div className="flex items-center gap-2 text-yellow-400 text-sm bg-yellow-400/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    Complete your team to save
                  </div>
                )}

                <Button
                  onClick={() => saveTeamMutation.mutate()}
                  disabled={!teamStats.isValid || !teamName.trim() || !captainId || saveTeamMutation.isPending}
                  className="w-full bg-fpl-green hover:bg-fpl-green/90 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveTeamMutation.isPending ? "Saving..." : "Save Team"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Formation Pitch */}
          <div className="lg:col-span-2">
            <EnhancedFormationPitch
              selectedPlayers={selectedPlayers}
              onPositionClick={handlePositionClick}
              onPlayerInfo={handlePlayerInfo}
              onSetCaptain={handleSetCaptain}
              onSetViceCaptain={handleSetViceCaptain}
              captainId={captainId}
              viceCaptainId={viceCaptainId}
              teams={fplTeams}
            />
          </div>
        </div>
      </div>

      {/* Position Selector Modal */}
      <PositionSelector
        position={selectedPosition}
        isOpen={positionSelectorOpen}
        onClose={() => setPositionSelectorOpen(false)}
        onSelectPlayer={handlePlayerSelect}
        selectedPlayers={selectedPlayers}
        budget={teamStats.remainingBudget}
      />

      {/* Player Details Modal */}
      <PlayerDetailsModal
        player={selectedPlayerForDetails}
        team={selectedPlayerForDetails ? getTeamById(selectedPlayerForDetails.team) : null}
        isOpen={showPlayerDetails}
        onClose={() => setShowPlayerDetails(false)}
        position={selectedPlayerForDetails?.position || ""}
      />
    </div>
  );
}