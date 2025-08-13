import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle, Edit3, ArrowLeft, Lock, CheckCircle2, XCircle, Timer } from "lucide-react";
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
  const [activeTeamTab, setActiveTeamTab] = useState<string>("1");

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Get team number from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const teamNumberFromUrl = urlParams.get('team');
  
  // Fetch all user's teams (up to 5)
  const { data: userTeams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["/api/teams/user"],
  });
  
  // Sort teams by team number and group by payment status
  const sortedTeams = [...userTeams].sort((a, b) => a.teamNumber - b.teamNumber);
  const approvedTeams = sortedTeams.filter(team => team.paymentStatus === 'approved');
  const pendingTeams = sortedTeams.filter(team => team.paymentStatus === 'pending');
  const rejectedTeams = sortedTeams.filter(team => team.paymentStatus === 'rejected');
  const notSubmittedTeams = sortedTeams.filter(team => team.paymentStatus === 'not_submitted');
  
  // Initialize active team tab based on URL param or first approved team
  React.useEffect(() => {
    if (teamNumberFromUrl) {
      setActiveTeamTab(teamNumberFromUrl);
    } else if (approvedTeams.length > 0) {
      setActiveTeamTab(approvedTeams[0].teamNumber.toString());
    } else if (sortedTeams.length > 0) {
      setActiveTeamTab(sortedTeams[0].teamNumber.toString());
    }
  }, [teamNumberFromUrl, approvedTeams, sortedTeams]);
  
  const currentTeamNumber = parseInt(activeTeamTab);
  const currentTeamData = sortedTeams.find(team => team.teamNumber === currentTeamNumber);
  
  // Fetch specific team data for the active tab
  const { data: currentTeam, isLoading: teamLoading } = useQuery({
    queryKey: ["/api/team", currentTeamNumber],
    queryFn: () => apiRequest("GET", `/api/team/${currentTeamNumber}`),
    enabled: !!currentTeamData && currentTeamNumber > 0,
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
    onSuccess: (data: any) => {
      if (data.requiresPayment) {
        toast({
          title: "Team Saved!",
          description: data.message || "Team saved. Redirecting to payment...",
        });
        // Redirect to payment page
        window.location.href = data.redirectTo;
      } else {
        toast({
          title: "Team Updated",
          description: "Your team changes have been saved successfully!",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team", currentTeamNumber] });
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
      teamNumber: currentTeam?.teamNumber || currentTeamNumber,
    };

    saveTeamMutation.mutate(teamData);
  };

  const isDeadlinePassed = currentGameweek?.deadline ? new Date() > new Date(currentGameweek.deadline) : false;
  const canEdit = currentTeam?.canEdit || (currentTeamData?.paymentStatus === 'approved' && !isDeadlinePassed);
  const paymentStatus = currentTeam?.paymentStatus || currentTeamData?.paymentStatus;
  const isLocked = currentTeam?.isLocked || isDeadlinePassed || !canEdit;
  
  // Check if user has access to edit teams (payment must be approved)
  const hasEditAccess = currentTeamData?.paymentStatus === 'approved' && !isDeadlinePassed;
  const teamExists = currentTeam && currentTeam.players && currentTeam.players.length > 0;
  
  // Update URL when switching tabs
  const handleTabChange = (teamNumber: string) => {
    setActiveTeamTab(teamNumber);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('team', teamNumber);
    window.history.replaceState({}, '', newUrl.toString());
  };
  
  // Get payment status badge
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><Timer className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 hover:bg-red-600"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'not_submitted':
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Payment Required</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
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

        {/* Debug Information */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="bg-yellow-500/10 border-yellow-500/20 mb-6">
            <CardContent className="p-4">
              <div className="text-yellow-300 text-sm">
                <p><strong>Debug Info:</strong></p>
                <p>User Teams Length: {userTeams.length}</p>
                <p>Sorted Teams Length: {sortedTeams.length}</p>
                <p>Current Team Number: {currentTeamNumber}</p>
                <p>Current Team Data: {currentTeamData ? 'Found' : 'Not Found'}</p>
                <p>Current Team: {currentTeam ? 'Loaded' : 'Not Loaded'}</p>
                <p>Teams Loading: {teamsLoading ? 'Yes' : 'No'}</p>
                <p>Team Loading: {teamLoading ? 'Yes' : 'No'}</p>
                {userTeams.length > 0 && (
                  <p>First Team: {JSON.stringify(userTeams[0], null, 2)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Multi-Team Tabs Interface */}
        {(teamsLoading || teamLoading) ? (
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fpl-green mx-auto mb-4"></div>
              <p className="text-white/70">Loading your teams...</p>
            </CardContent>
          </Card>
        ) : sortedTeams.length > 0 ? (
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Teams ({sortedTeams.length}/5)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTeamTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-4">
                  {[1, 2, 3, 4, 5].map(teamNum => {
                    const team = sortedTeams.find(t => t.teamNumber === teamNum);
                    const isDisabled = !team;
                    const paymentStatus = team?.paymentStatus || 'not_submitted';
                    
                    return (
                      <TabsTrigger 
                        key={teamNum} 
                        value={teamNum.toString()} 
                        disabled={isDisabled}
                        className={`flex flex-col gap-1 p-3 ${
                          isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          paymentStatus === 'approved' ? 'bg-green-500/20 border-green-500' :
                          paymentStatus === 'pending' ? 'bg-yellow-500/20 border-yellow-500' :
                          paymentStatus === 'rejected' ? 'bg-red-500/20 border-red-500' :
                          'bg-gray-500/20 border-gray-500'
                        }`}
                      >
                        <span className="font-medium">Team {teamNum}</span>
                        <div className="flex items-center gap-1">
                          {team ? getPaymentStatusBadge(paymentStatus) : (
                            <Badge variant="outline" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Not Created
                            </Badge>
                          )}
                        </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                
                {/* Tab Content for each team */}
                {[1, 2, 3, 4, 5].map(teamNum => {
                  const team = sortedTeams.find(t => t.teamNumber === teamNum);
                  const isCurrentTab = teamNum.toString() === activeTeamTab;
                  
                  return (
                    <TabsContent key={teamNum} value={teamNum.toString()} className="mt-4">
                      {team ? (
                        <div className="space-y-4">
                          {/* Team Status Info */}
                          <div className="flex items-center justify-between p-4 bg-white/10 rounded-lg">
                            <div>
                              <h3 className="font-semibold text-white">Team {teamNum}: {team.teamName || 'Unnamed Team'}</h3>
                              <p className="text-sm text-white/70">
                                Payment Status: {getPaymentStatusBadge(team.paymentStatus)}
                              </p>
                              <p className="text-xs text-white/50">
                                Players: {Array.isArray(team.players) ? team.players.length : 0}/11 • 
                                Can Edit: {team.canEdit ? 'Yes' : 'No'}
                              </p>
                            </div>
                            <div className="text-right">
                              {team.paymentStatus === 'approved' ? (
                                <Badge className="bg-green-500 hover:bg-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Editable
                                </Badge>
                              ) : team.paymentStatus === 'pending' ? (
                                <Badge className="bg-yellow-500 hover:bg-yellow-600">
                                  <Timer className="h-3 w-3 mr-1" />
                                  Awaiting Approval
                                </Badge>
                              ) : team.paymentStatus === 'rejected' ? (
                                <Badge className="bg-red-500 hover:bg-red-600">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Payment Rejected
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Payment Required
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons based on payment status */}
                          <div className="flex gap-2">
                            {team.paymentStatus === 'approved' ? (
                              <p className="text-green-400 text-sm flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                This team is ready for editing! Use the form below to make changes.
                              </p>
                            ) : team.paymentStatus === 'pending' ? (
                              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 w-full">
                                <p className="text-yellow-400 text-sm flex items-center gap-2 font-medium mb-2">
                                  <Timer className="h-4 w-4" />
                                  TEAM NOT YET APPROVED
                                </p>
                                <p className="text-yellow-300 text-sm">
                                  Your payment is pending admin approval. The team exists but cannot be edited until payment is approved.
                                </p>
                              </div>
                            ) : team.paymentStatus === 'rejected' ? (
                              <div className="flex items-center gap-2 w-full">
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex-1">
                                  <p className="text-red-400 text-sm flex items-center gap-2 font-medium mb-2">
                                    <XCircle className="h-4 w-4" />
                                    PAYMENT REJECTED
                                  </p>
                                  <p className="text-red-300 text-sm mb-2">
                                    Your payment was rejected. Please resubmit payment to make this team editable.
                                  </p>
                                  <Link href={`/manual-payment?gameweek=${currentGameweek?.id}&team=${teamNum}`}>
                                    <Button size="sm" className="bg-red-600 hover:bg-red-700">
                                      Resubmit Payment
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 w-full">
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex-1">
                                  <p className="text-orange-400 text-sm flex items-center gap-2 font-medium mb-2">
                                    <AlertCircle className="h-4 w-4" />
                                    PAYMENT REQUIRED
                                  </p>
                                  <p className="text-orange-300 text-sm mb-2">
                                    Complete payment to make this team editable.
                                  </p>
                                  <Link href={`/manual-payment?gameweek=${currentGameweek?.id}&team=${teamNum}`}>
                                    <Button size="sm" className="bg-fpl-green hover:bg-green-600">
                                      Complete Payment
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-8 bg-white/5 rounded-lg">
                          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-white mb-2">
                            Team {teamNum} Not Created
                          </h3>
                          <p className="text-white/70 mb-4">
                            Create Team {teamNum} to expand your fantasy football strategy.
                          </p>
                          <Link href={`/?team=${teamNum}`}>
                            <Button className="bg-fpl-green hover:bg-green-600">
                              <Trophy className="h-4 w-4 mr-2" />
                              Create Team {teamNum}
                            </Button>
                          </Link>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                No Teams Created
              </h3>
              <p className="text-blue-700 dark:text-blue-300 mb-4">
                You haven't created any teams yet. Start by creating your first team!
              </p>
              <Link href="/">
                <Button className="bg-fpl-green hover:bg-green-600">
                  <Trophy className="h-4 w-4 mr-2" />
                  Create Your First Team
                </Button>
              </Link>
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
