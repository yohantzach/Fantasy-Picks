import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { FormationPitch } from "@/components/formation-pitch";
import { EnhancedPlayerSelectionTable } from "@/components/enhanced-player-selection-table";
import { PlayerStatsModal } from "@/components/player-stats-modal";
import Navigation from "@/components/ui/navigation";
import EnhancedPaymentModal from "@/components/ui/enhanced-payment-modal";
import { Link } from "wouter";
import type { FPLPlayer, FPLTeam } from "@shared/schema";

// Type definitions
type Gameweek = {
  id: number;
  gameweekNumber: number;
  deadline: string;
  isCompleted: boolean;
};

type Team = {
  id: number;
  teamName: string;
  isLocked: boolean;
  paymentStatus: 'pending' | 'approved' | 'rejected';
};



export default function TeamSelection() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<any>(null);
  const [showPlayerTable, setShowPlayerTable] = useState<number | null>(null);
  const [replacingPlayer, setReplacingPlayer] = useState<number | null>(null);
  const [formation, setFormation] = useState("4-4-2");

  // Handle formation changes with validation
  const handleFormationChange = (newFormation: string) => {
    const newLimits = getFormationLimits(newFormation);
    const currentLimits = getFormationLimits(formation);
    
    // Check if current team violates new formation constraints
    let needsAdjustment = false;
    const violations: string[] = [];
    
    for (const elementType of [2, 3, 4]) { // Check DEF, MID, FWD
      const currentCount = selectedPlayers.filter(id => {
        const p = players.find((p: FPLPlayer) => p.id === id);
        return p?.element_type === elementType;
      }).length;
      
      const newLimit = newLimits[elementType as keyof typeof newLimits];
      const positionName = elementType === 2 ? "defenders" : elementType === 3 ? "midfielders" : "forwards";
      
      if (currentCount > newLimit) {
        needsAdjustment = true;
        violations.push(`${currentCount} ${positionName} (max: ${newLimit})`);
      }
    }
    
    if (needsAdjustment) {
      toast({
        title: "Formation Change Blocked",
        description: `Current team has: ${violations.join(", ")}. Please remove excess players first.`,
        variant: "destructive",
      });
      return;
    }
    
    setFormation(newFormation);
    
    toast({
      title: "Formation Updated",
      description: `Changed to ${newFormation} formation`,
    });
  };

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery<Gameweek>({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch user's current team
  const { data: currentTeam } = useQuery<Team>({
    queryKey: ["/api/team/current"],
  });

  // Fetch FPL data
  const { data: players = [] } = useQuery<FPLPlayer[]>({
    queryKey: ["/api/fpl/players"],
  });

  const { data: fplTeams = [] } = useQuery<FPLTeam[]>({
    queryKey: ["/api/fpl/teams"],
  });

  // NOTE: Team creation should start fresh - no auto-loading of existing team data

  const handlePositionClick = (elementType: number) => {
    setShowPlayerTable(elementType);
  };

  const handleClosePlayerTable = () => {
    setShowPlayerTable(null);
  };

  const totalCost = useMemo(() => {
    const selectedPlayerObjs = players.filter((p: FPLPlayer) => selectedPlayers.includes(p.id));
    return selectedPlayerObjs.reduce((sum: number, p: FPLPlayer) => sum + p.now_cost, 0); // Use the custom pricing from queryClient
  }, [selectedPlayers, players]);

  const remainingBudget = 1000 - totalCost; // 100.0m total budget

  // Get formation-based position limits
  const getFormationLimits = (formation: string) => {
    const [def, mid, fwd] = formation.split('-').map(Number);
    return {
      1: 1,   // Always 1 GK
      2: def, // Defenders
      3: mid, // Midfielders  
      4: fwd  // Forwards
    };
  };

  const formationLimits = getFormationLimits(formation);

  // Validate team constraints
  const validatePlayerSelection = (playerId: number, isAdding: boolean, skipPositionCheck = false) => {
    const player = players.find((p: FPLPlayer) => p.id === playerId);
    if (!player) return false;

    if (isAdding) {
      // Check if already at 11 players (unless we're replacing)
      if (selectedPlayers.length >= 11 && !skipPositionCheck) {
        toast({
          title: "Team Full",
          description: "You can only select 11 players",
          variant: "destructive",
        });
        return false;
      }

      // Check budget (use custom pricing from queryClient)
      if (player.now_cost > remainingBudget) {
        toast({
          title: "Insufficient Budget",
          description: `You need £${((player.now_cost - remainingBudget) / 10).toFixed(1)}m more`,
          variant: "destructive",
        });
        return false;
      }

      // Check formation-based position limits
      if (!skipPositionCheck) {
        const currentPositionCount = selectedPlayers.filter(id => {
          const p = players.find((p: FPLPlayer) => p.id === id);
          return p?.element_type === player.element_type;
        }).length;

        const maxForPosition = formationLimits[player.element_type as keyof typeof formationLimits] || 0;
        
        if (currentPositionCount >= maxForPosition) {
          const positionName = player.element_type === 1 ? "goalkeepers" : 
                             player.element_type === 2 ? "defenders" :
                             player.element_type === 3 ? "midfielders" : "forwards";
          toast({
            title: "Position Limit Reached",
            description: `You can only select ${maxForPosition} ${positionName} in ${formation} formation`,
            variant: "destructive",
          });
          return false;
        }
      }

      // Check team limit (max 3 from same team)
      const sameTeamCount = selectedPlayers.filter(id => {
        const p = players.find((p: FPLPlayer) => p.id === id);
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
    const player = players.find((p: FPLPlayer) => p.id === playerId);
    if (!player) return;

    if (isAdding) {
      // Check current position count and formation limits
      const currentPositionPlayers = selectedPlayers.filter(id => {
        const p = players.find((p: FPLPlayer) => p.id === id);
        return p?.element_type === player.element_type;
      });
      const maxForPosition = formationLimits[player.element_type as keyof typeof formationLimits] || 0;
      
      // If position is full, replace the first player in that position
      if (currentPositionPlayers.length >= maxForPosition) {
        // Validate replacement (skip position check since we're replacing)
        if (!validatePlayerSelection(playerId, isAdding, true)) return;
        
        const playerToReplace = currentPositionPlayers[0];
        setSelectedPlayers(prev => {
          const updated = prev.filter(id => id !== playerToReplace);
          return [...updated, playerId];
        });
        // Remove captain/vice-captain if replacing
        if (captainId === playerToReplace) setCaptainId(null);
        if (viceCaptainId === playerToReplace) setViceCaptainId(null);
        
        toast({
          title: "Player Replaced",
          description: `${players.find((p: FPLPlayer) => p.id === playerToReplace)?.web_name} replaced with ${player.web_name}`,
        });
      } else {
        // Normal validation for adding new player
        if (!validatePlayerSelection(playerId, isAdding)) return;
        setSelectedPlayers(prev => [...prev, playerId]);
      }
      
      // Close the player table after adding a player
      setShowPlayerTable(null);
    } else {
      // Removing a player
      setSelectedPlayers(prev => prev.filter(id => id !== playerId));
      // Remove captain/vice-captain if deselected
      if (captainId === playerId) setCaptainId(null);
      if (viceCaptainId === playerId) setViceCaptainId(null);
    }
  };

  const saveTeamMutation = useMutation({
    mutationFn: async (teamData: any) => {
      return await apiRequest("POST", "/api/team/save", teamData);
    },
    onSuccess: (data: any) => {
      console.log("Team save response:", data);
      if (data.requiresPayment) {
        toast({
          title: "Team Validated! 🎉",
          description: "Redirecting to payment to complete your team registration...",
        });
        // Redirect to payment page with UPI details and team number
        console.log("Redirecting to:", data.redirectTo);
        
        // Add a small delay to make the toast visible
        setTimeout(() => {
          window.location.href = data.redirectTo;
        }, 1500); // 1.5 second delay
      } else {
        toast({
          title: "Team Saved Successfully! 🎉",
          description: "Your team has been registered and is ready for scoring!",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
        queryClient.invalidateQueries({ queryKey: ["/api/teams/user"] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save team",
        variant: "destructive",
      });
    },
  });

  const handlePayNow = () => {
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

    // **CRITICAL FIX: Always save team to DB first via API, then handle payment redirect**
    const teamData = {
      teamName: teamName.trim(),
      formation: "4-4-2",
      players: selectedPlayers,
      captainId,
      viceCaptainId,
    };

    saveTeamMutation.mutate(teamData);
  };

  const handleSaveTeam = () => {
    // This is only for editing existing paid teams
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
  const isGameweekInProgress = currentGameweek && !currentGameweek.isCompleted && isDeadlinePassed;
  const isLocked = currentTeam?.isLocked || isDeadlinePassed || isGameweekInProgress;

  // Show lock screen if gameweek is in progress
  if (isGameweekInProgress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-fpl-purple-light to-fpl-purple-dark">
        <Navigation />
        <div className="responsive-container padding-responsive">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-lg border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="p-8 text-center">
                <div className="mb-6">
                  <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Gameweek {currentGameweek.gameweekNumber} In Progress
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Team creation and editing is locked while matches are being played.
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    You can create/edit teams again when:
                  </p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    <li>• All matches finish</li>
                    <li>• Final scores are calculated</li>
                    <li>• Next gameweek opens</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <button 
                    onClick={() => window.location.href = '/leaderboard'}
                    className="w-full bg-fpl-green hover:bg-fpl-green/90 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    View Live Leaderboard
                  </button>
                  <button 
                    onClick={() => window.location.href = '/fixtures'}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    View Fixtures
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-fpl-purple-light to-fpl-purple-dark">
      <Navigation />
      <div className="responsive-container space-y-6 padding-responsive">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Create Team</h1>
          <p className="text-muted-foreground text-sm">
            {currentGameweek ? `Gameweek ${currentGameweek.gameweekNumber}` : "Loading..."}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-xl sm:text-2xl font-bold text-fpl-green">
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

      {/* Formation Warning Card */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Important: Formation Cannot Be Changed
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Once you create your team and complete payment, the formation will be locked and cannot be modified. 
                You can only change players, captain, and vice-captain after team creation. Choose your formation carefully!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!showPlayerTable ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Formation Pitch */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <Card className="bg-white/10 border-blue-500/30 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg sm:text-xl text-white">Your Team Formation</CardTitle>
                  <div className="w-full sm:w-32">
                    <Select value={formation} onValueChange={handleFormationChange} disabled={isLocked}>
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
          <div className="space-y-4 lg:space-y-6 order-1 lg:order-2">
            <Card className="bg-white/10 border-blue-500/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl text-white">Team Overview</CardTitle>
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

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-white">Selected Players ({selectedPlayers.length}/11)</div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedPlayers.map((playerId) => {
                      const player = players.find((p: FPLPlayer) => p.id === playerId);
                      if (!player) return null;
                      return (
                        <div key={playerId} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/10 border border-white/20">
                          <span className="text-white font-medium">{player.web_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-fpl-green font-semibold">£{(player.now_cost / 10).toFixed(1)}m</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePlayerToggle(playerId, false)}
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
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

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-white">Captain</div>
                  <Select value={captainId?.toString() || ""} onValueChange={(value) => setCaptainId(Number(value))} disabled={isLocked}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white">
                      <SelectValue placeholder="Select captain" className="text-white/80" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {selectedPlayers.map((playerId) => {
                        const player = players.find((p: FPLPlayer) => p.id === playerId);
                        if (!player) return null;
                        return (
                          <SelectItem key={playerId} value={playerId.toString()} className="text-white hover:bg-gray-700">
                            {player.web_name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-white">Vice Captain</div>
                  <Select value={viceCaptainId?.toString() || ""} onValueChange={(value) => setViceCaptainId(Number(value))} disabled={isLocked}>
                    <SelectTrigger className="bg-white/10 border-white/30 text-white">
                      <SelectValue placeholder="Select vice captain" className="text-white/80" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {selectedPlayers.filter(id => id !== captainId).map((playerId) => {
                        const player = players.find((p: FPLPlayer) => p.id === playerId);
                        if (!player) return null;
                        return (
                          <SelectItem key={playerId} value={playerId.toString()} className="text-white hover:bg-gray-700">
                            {player.web_name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-white/20 pt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/80 font-medium">Total Cost:</span>
                    <span className="text-white font-semibold">£{(totalCost / 10).toFixed(1)}m</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/80 font-medium">Budget Remaining:</span>
                    <span className="text-fpl-green font-semibold">£{(remainingBudget / 10).toFixed(1)}m</span>
                  </div>
                </div>

                {!isLocked && (
                  <>  
                    {/* Show Pay Now for new teams or teams without approved payment */}
                    {(!currentTeam || currentTeam.paymentStatus !== 'approved') ? (
                      <Button
                        onClick={handlePayNow}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={selectedPlayers.length !== 11 || !captainId || !viceCaptainId || !teamName.trim()}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Pay Now (₹20)
                      </Button>
                    ) : (
                      /* Show Save Team only for existing paid teams */
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
                    
                    {/* Show payment status for context */}
                    {currentTeam?.paymentStatus && currentTeam.paymentStatus !== 'approved' && (
                      <div className="text-center text-sm text-yellow-600 mt-2">
                        Payment Status: {currentTeam.paymentStatus === 'pending' ? 'Pending Admin Approval' : 'Payment Required'}
                      </div>
                    )}
                  </>
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
          showCaptainOption={false}
          showViceCaptainOption={false}
          isCaptain={captainId === selectedPlayerForStats?.id}
          isViceCaptain={viceCaptainId === selectedPlayerForStats?.id}
        />
      )}
      </div>
    </div>
  );
}