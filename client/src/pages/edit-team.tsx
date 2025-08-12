import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle, Edit3, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { FormationPitch } from "@/components/formation-pitch";
import { EnhancedPlayerSelectionTable } from "@/components/enhanced-player-selection-table";
import { PlayerStatsModal } from "@/components/player-stats-modal";
import Navigation from "@/components/ui/navigation";
import { Link } from "wouter";

export default function EditTeam() {
  const { toast } = useToast();
  const [selectedPlayers, setSelectedPlayers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState("");
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<any>(null);
  const [showPlayerTable, setShowPlayerTable] = useState<number | null>(null);
  const [isModified, setIsModified] = useState(false);

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Get team number from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const teamNumberFromUrl = urlParams.get('team');
  const teamNumber = teamNumberFromUrl ? parseInt(teamNumberFromUrl) : 1;
  
  // Fetch user's teams to determine which team can be edited
  const { data: userTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["/api/teams/user"],
  });
  
  // Find the first team with approved payment (this is the only editable team)
  const editableTeam = userTeams.find(team => team.paymentStatus === 'approved');
  const requestedTeamNumber = teamNumberFromUrl ? parseInt(teamNumberFromUrl) : (editableTeam?.teamNumber || 1);
  
  // Fetch specific team only if it matches the editable team number
  const { data: currentTeam, isLoading: teamLoading } = useQuery({
    queryKey: ["/api/team", requestedTeamNumber],
    queryFn: () => apiRequest("GET", `/api/team/${requestedTeamNumber}`),
    enabled: !!editableTeam && requestedTeamNumber === editableTeam.teamNumber,
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
    if (currentTeam?.players) {
      setSelectedPlayers(currentTeam.players);
      setTeamName(currentTeam.teamName || "");
      setCaptainId(currentTeam.captainId || null);
      setViceCaptainId(currentTeam.viceCaptainId || null);
      setIsModified(false);
    }
  }, [currentTeam]);

  // Track modifications
  useEffect(() => {
    if (currentTeam) {
      const hasChanges = 
        JSON.stringify(selectedPlayers.sort()) !== JSON.stringify((currentTeam.players || []).sort()) ||
        teamName !== (currentTeam.teamName || "") ||
        captainId !== (currentTeam.captainId || null) ||
        viceCaptainId !== (currentTeam.viceCaptainId || null);
      setIsModified(hasChanges);
    }
  }, [selectedPlayers, teamName, captainId, viceCaptainId, currentTeam]);

  const handlePositionClick = (elementType: number) => {
    if (isDeadlinePassed) {
      toast({
        title: "Editing Disabled",
        description: "Cannot edit team after deadline has passed",
        variant: "destructive",
      });
      return;
    }
    setShowPlayerTable(elementType);
  };

  const handleClosePlayerTable = () => {
    setShowPlayerTable(null);
  };

  const totalCost = useMemo(() => {
    const selectedPlayerObjs = players.filter(p => selectedPlayers.includes(p.id));
    return selectedPlayerObjs.reduce((sum, p) => sum + p.now_cost, 0);
  }, [selectedPlayers, players]);

  const remainingBudget = 1000 - totalCost; // 100.0m budget in API units

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
        title: "Team Updated",
        description: "Your team changes have been saved successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team", requestedTeamNumber] });
      setIsModified(false);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save team changes",
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
      teamNumber: currentTeam?.teamNumber || requestedTeamNumber,
    };

    saveTeamMutation.mutate(teamData);
  };

  const isDeadlinePassed = currentGameweek?.deadline ? new Date() > new Date(currentGameweek.deadline) : false;
  const canEdit = currentTeam?.canEdit;
  const paymentStatus = currentTeam?.paymentStatus;
  const isLocked = currentTeam?.isLocked || isDeadlinePassed || !canEdit;
  
  // Check if user has access to edit teams (payment must be approved AND it's the first approved team)
  const hasEditAccess = editableTeam && currentTeam && 
    editableTeam.teamNumber === currentTeam.teamNumber && 
    editableTeam.paymentStatus === 'approved';
  const teamExists = currentTeam && currentTeam.players && currentTeam.players.length > 0;
  
  // Check if user is trying to edit a team they don't have access to
  const isAccessDenied = teamNumberFromUrl && 
    (!editableTeam || parseInt(teamNumberFromUrl) !== editableTeam.teamNumber);
  
  // Redirect to the correct editable team if user tries to access wrong team
  React.useEffect(() => {
    if (isAccessDenied && editableTeam && !teamsLoading) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('team', editableTeam.teamNumber.toString());
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [isAccessDenied, editableTeam, teamsLoading]);
  
  // Show gameweek status
  const getGameweekStatus = () => {
    if (!currentGameweek) return "Loading...";
    if (isDeadlinePassed) return "After Deadline";
    const now = new Date();
    const deadline = new Date(currentGameweek.deadline);
    const hoursUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hoursUntilDeadline < 24) return `${hoursUntilDeadline}h until deadline`;
    return "In Progress";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-green">
      <Navigation />
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Team
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                <Edit3 className="h-8 w-8 text-fpl-green" />
                Edit Team
              </h1>
              <p className="text-muted-foreground">
                {currentGameweek ? `Gameweek ${currentGameweek.gameweekNumber} • ${getGameweekStatus()}` : "Loading..."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-fpl-green">
              £{(remainingBudget / 10).toFixed(1)}m
            </div>
            <p className="text-sm text-muted-foreground">Budget Remaining</p>
            {isModified && (
              <Badge variant="secondary" className="mt-1">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {selectedPlayers.length}/11
              </div>
              <div className="text-sm text-white/60">Players Selected</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${
                remainingBudget >= 0 ? 'text-fpl-green' : 'text-red-400'
              }`}>
                £{(remainingBudget / 10).toFixed(1)}m
              </div>
              <div className="text-sm text-white/60">Remaining Budget</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-white">
                £{(totalCost / 10).toFixed(1)}m
              </div>
              <div className="text-sm text-white/60">Team Value</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4 text-center">
              <div className={`text-sm font-medium ${
                isDeadlinePassed ? 'text-red-400' : 'text-fpl-green'
              }`}>
                {getGameweekStatus()}
              </div>
              <div className="text-sm text-white/60">Status</div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Status Warning */}
        {paymentStatus && paymentStatus !== 'approved' && (
          <Card className="border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <span className="font-medium">
                  {paymentStatus === 'pending' && "Payment Pending - Editing Restricted"}
                  {paymentStatus === 'rejected' && "Payment Rejected - Please Pay Again"}
                  {paymentStatus === 'not_submitted' && "Payment Required - Please Complete Payment"}
                </span>
              </div>
              {paymentStatus === 'pending' && (
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                  Your team will be editable once payment is approved by admin.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Access Denied Message */}
        {(!hasEditAccess && !teamLoading && !teamsLoading) && (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                {editableTeam ? "Team Access Restricted" : "Payment Required to Edit Teams"}
              </h3>
              <p className="text-blue-700 dark:text-blue-300 mb-4">
                {editableTeam ? (
                  <>You can only edit your first approved team (Team {editableTeam.teamNumber}). Other teams cannot be edited once created and paid for.</>
                ) : (
                  <>You can only edit teams after your payment has been verified and approved by admin. 
                  {userTeams.length === 0 && "Please create and pay for a team first."}
                  {userTeams.length > 0 && userTeams[0]?.paymentStatus === 'pending' && "Your payment is currently being reviewed."}
                  {userTeams.length > 0 && userTeams[0]?.paymentStatus === 'rejected' && "Your payment was rejected. Please resubmit payment."}
                  {userTeams.length > 0 && userTeams[0]?.paymentStatus === 'not_submitted' && "Please complete payment for your team."}
                  </>
                )}
              </p>
              <div className="flex gap-2 justify-center">
                {editableTeam ? (
                  <Link href={`/edit-team?team=${editableTeam.teamNumber}`}>
                    <Button className="bg-fpl-green hover:bg-green-600">
                      Edit Team {editableTeam.teamNumber}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/">
                      <Button className="bg-fpl-green hover:bg-green-600">
                        Create New Team
                      </Button>
                    </Link>
                    {userTeams.length > 0 && userTeams[0]?.paymentStatus !== 'approved' && userTeams[0]?.paymentStatus !== 'pending' && (
                      <Link href={`/manual-payment?gameweek=${currentGameweek?.id}&team=${userTeams[0]?.teamNumber || 1}`}>
                        <Button variant="outline">
                          Complete Payment
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deadline warning */}
        {hasEditAccess && currentGameweek?.deadline && (
          <Card className={`border-l-4 ${
            isDeadlinePassed ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' : 
            'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <span className="font-medium">
                  {isDeadlinePassed ? "Deadline Passed - Editing Disabled" : "Deadline"}
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(currentGameweek.deadline), "PPP 'at' p")}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {hasEditAccess && currentTeam && !showPlayerTable ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Formation Pitch */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Your Team Formation - Click positions to {isLocked ? 'view' : 'edit'} players</CardTitle>
                </CardHeader>
                <CardContent>
                  <FormationPitch 
                    selectedPlayers={selectedPlayers}
                    players={players}
                    onPositionClick={handlePositionClick}
                    captainId={captainId}
                    viceCaptainId={viceCaptainId}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Team Management */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Details</CardTitle>
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
                    <div className="text-sm font-medium">Your Players ({selectedPlayers.length}/11)</div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {selectedPlayers.map((playerId) => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;
                        return (
                          <div key={playerId} className="flex justify-between items-center text-sm p-2 rounded bg-white/5">
                            <div className="flex items-center gap-2">
                              <span>{player.web_name}</span>
                              {captainId === playerId && (
                                <Badge variant="secondary" className="bg-yellow-600 text-white text-xs">C</Badge>
                              )}
                              {viceCaptainId === playerId && (
                                <Badge variant="secondary" className="bg-blue-600 text-white text-xs">VC</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span>£{(player.now_cost / 10).toFixed(1)}m</span>
                              {!isLocked && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePlayerToggle(playerId, false)}
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                >
                                  ×
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Captain</div>
                    <Select 
                      value={captainId?.toString() || ""} 
                      onValueChange={(value) => setCaptainId(Number(value))} 
                      disabled={isLocked}
                    >
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
                    <Select 
                      value={viceCaptainId?.toString() || ""} 
                      onValueChange={(value) => setViceCaptainId(Number(value))} 
                      disabled={isLocked}
                    >
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
                      <span className={remainingBudget >= 0 ? "text-green-400" : "text-red-400"}>
                        £{(remainingBudget / 10).toFixed(1)}m
                      </span>
                    </div>
                  </div>

                  {!isLocked && (
                    <Button
                      onClick={handleSaveTeam}
                      className="w-full"
                      disabled={saveTeamMutation.isPending || selectedPlayers.length !== 11 || !isModified}
                    >
                      {saveTeamMutation.isPending ? (
                        <>
                          <Save className="h-4 w-4 mr-2 animate-spin" />
                          Saving Changes...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {isModified ? 'Save Changes' : 'No Changes to Save'}
                        </>
                      )}
                    </Button>
                  )}

                  {isLocked && (
                    <div className="text-center text-sm text-muted-foreground bg-red-900/20 p-3 rounded">
                      <AlertCircle className="h-4 w-4 mx-auto mb-2" />
                      Team editing is locked - deadline has passed
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Player Selection Table */
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
            onMakeCaptain={() => {
              setCaptainId(selectedPlayerForStats.id);
              if (viceCaptainId === selectedPlayerForStats.id) {
                setViceCaptainId(null);
              }
              setSelectedPlayerForStats(null);
            }}
            onMakeViceCaptain={() => {
              setViceCaptainId(selectedPlayerForStats.id);
              if (captainId === selectedPlayerForStats.id) {
                setCaptainId(null);
              }
              setSelectedPlayerForStats(null);
            }}
            onRemoveCaptain={() => setCaptainId(null)}
            onRemoveViceCaptain={() => setViceCaptainId(null)}
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
