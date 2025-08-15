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
import { Clock, Save, Users, DollarSign, Trophy, AlertCircle, Edit3, ArrowLeft, Lock, CheckCircle2, XCircle, Timer, Plus } from "lucide-react";
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
    retry: 1,
  });

  // Fetch FPL data
  const { data: players = [] } = useQuery({
    queryKey: ["/api/fpl/players"],
  });

  const { data: fplTeams = [] } = useQuery({
    queryKey: ["/api/fpl/teams"],
  });

  // Load current team data when team data changes
  useEffect(() => {
    // Reset state when switching teams
    if (currentTeamNumber && (!selectedPlayers.length || selectedPlayers.length === 0)) {
      // Load from currentTeamData (teams list) immediately if available
      if (currentTeamData && currentTeamData.players && Array.isArray(currentTeamData.players) && currentTeamData.players.length > 0 && players.length > 0) {
        const playerIds = currentTeamData.players.map((id: any) => parseInt(id.toString())).filter(id => !isNaN(id));
        const validPlayerIds = playerIds.filter((id: number) => players.some((p: any) => p.id === id));
        
        if (validPlayerIds.length > 0) {
          setSelectedPlayers(validPlayerIds);
          setTeamName(currentTeamData.teamName || "");
          setCaptainId(currentTeamData.captainId || null);
          setViceCaptainId(currentTeamData.viceCaptainId || null);
          setIsModified(false);
          
          const selectedPlayerObjs = players.filter((p: any) => validPlayerIds.includes(p.id));
          const teamValue = selectedPlayerObjs.reduce((sum: number, p: any) => sum + p.now_cost, 0);
          
          toast({
            title: "Team Loaded",
            description: `${validPlayerIds.length} players loaded • £${(teamValue / 10).toFixed(1)}m value`,
          });
        }
      }
      // Also try loading from individual team API if available
      else if (currentTeam && currentTeam.players && Array.isArray(currentTeam.players) && currentTeam.players.length > 0 && players.length > 0) {
        const playerIds = currentTeam.players.map((id: any) => parseInt(id.toString())).filter(id => !isNaN(id));
        const validPlayerIds = playerIds.filter((id: number) => players.some((p: any) => p.id === id));
        
        if (validPlayerIds.length > 0) {
          setSelectedPlayers(validPlayerIds);
          setTeamName(currentTeam.teamName || "");
          setCaptainId(currentTeam.captainId || null);
          setViceCaptainId(currentTeam.viceCaptainId || null);
          setIsModified(false);
          
          const selectedPlayerObjs = players.filter((p: any) => validPlayerIds.includes(p.id));
          const teamValue = selectedPlayerObjs.reduce((sum: number, p: any) => sum + p.now_cost, 0);
          
          toast({
            title: "Team Loaded",
            description: `${validPlayerIds.length} players loaded • £${(teamValue / 10).toFixed(1)}m value`,
          });
        }
      }
    }
  }, [currentTeamData, currentTeam, players, currentTeamNumber, toast]);

  // Track modifications
  useEffect(() => {
    if (currentTeam) {
      // Get original player IDs for comparison
      const originalPlayerIds = Array.isArray(currentTeam.players) 
        ? currentTeam.players.map(p => typeof p === 'object' ? p.fplPlayerId : p)
        : [];
        
      const hasChanges = 
        JSON.stringify(selectedPlayers.sort()) !== JSON.stringify(originalPlayerIds.sort()) ||
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
      return await apiRequest("POST", "/api/team/save", teamData);
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

    // STRICT BUDGET ENFORCEMENT - Cannot exceed £100m
    if (totalCost > 1000) {
      toast({
        title: "Budget Exceeded!",
        description: `Your team costs £${(totalCost / 10).toFixed(1)}m. You must stay within the £100.0m budget.`,
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
  
  // Update URL when switching tabs and reset selected players
  const handleTabChange = (teamNumber: string) => {
    // Reset player state when switching teams
    setSelectedPlayers([]);
    setTeamName("");
    setCaptainId(null);
    setViceCaptainId(null);
    setIsModified(false);
    
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
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-fpl-purple-light to-fpl-purple-dark">
      <Navigation />
      <div className="responsive-container space-y-6 padding-responsive">
        {/* Mobile-Optimized Header */}
        <div className="space-y-4">
          {/* Mobile Back Button */}
          <div className="flex items-center justify-between sm:hidden">
            <Link href="/">
              <Button variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </Link>
            <div className="text-center">
              <div className="text-lg font-bold text-fpl-green">
                £{(remainingBudget / 10).toFixed(1)}m
              </div>
              <p className="text-xs text-muted-foreground">Remaining</p>
            </div>
          </div>
          
          {/* Desktop Header */}
          <div className="hidden sm:flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Team
                </Button>
              </Link>
              <div className="flex items-center gap-4">
                <img 
                  src="/fantasy-picks-logo.png" 
                  alt="Fantasy Picks Logo" 
                  className="h-8 lg:h-12 w-auto"
                  onError={(e) => {
                    // Fallback to alternative logo if main logo fails
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('fantasy-picks-logo.png')) {
                      target.src = '/fantasy_logo.jpg';
                    }
                  }}
                />
                <div>
                  <h1 className="text-xl lg:text-3xl font-bold gradient-text flex items-center gap-2">
                    <Edit3 className="h-5 lg:h-8 w-5 lg:w-8 text-fpl-green" />
                    Edit Team
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {currentGameweek ? `Gameweek ${currentGameweek.gameweekNumber} • ${getGameweekStatus()}` : "Loading..."}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl lg:text-2xl font-bold text-fpl-green">
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
          
          {/* Mobile Title */}
          <div className="text-center sm:hidden">
            <h1 className="text-xl font-bold gradient-text flex items-center justify-center gap-2">
              <Edit3 className="h-5 w-5 text-fpl-green" />
              Edit Team
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {currentGameweek ? `Gameweek ${currentGameweek.gameweekNumber} • ${getGameweekStatus()}` : "Loading..."}
            </p>
            {isModified && (
              <Badge variant="secondary" className="mt-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved Changes
              </Badge>
            )}
          </div>
        </div>

        {/* Mobile-Optimized Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 lg:p-4 text-center">
              <div className="text-lg lg:text-2xl font-bold text-white">
                {selectedPlayers.length}/11
              </div>
              <div className="text-xs lg:text-sm text-white/60">Players</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 lg:p-4 text-center">
              <div className={`text-lg lg:text-2xl font-bold ${
                remainingBudget >= 0 ? 'text-fpl-green' : 'text-red-400'
              }`}>
                £{(remainingBudget / 10).toFixed(1)}m
              </div>
              <div className="text-xs lg:text-sm text-white/60">Budget</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 lg:p-4 text-center">
              <div className="text-lg lg:text-2xl font-bold text-white">
                £{(totalCost / 10).toFixed(1)}m
              </div>
              <div className="text-xs lg:text-sm text-white/60">Value</div>
            </CardContent>
          </Card>
          
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-3 lg:p-4 text-center">
              <div className={`text-xs lg:text-sm font-medium ${
                isDeadlinePassed ? 'text-red-400' : 'text-fpl-green'
              }`}>
                {getGameweekStatus()}
              </div>
              <div className="text-xs lg:text-sm text-white/60">Status</div>
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

        {/* Helpful Information Card */}
        <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Having Issues?</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              If your teams aren't loading properly or you're experiencing issues, try <strong>refreshing the page</strong>. 
              Sometimes it takes a moment for team data to sync properly after payment approval.
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline" 
                size="sm" 
                className="text-blue-600 border-blue-600 hover:bg-blue-100"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Clean Team Selection Interface */}
        {(teamsLoading || teamLoading) ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fpl-green"></div>
            <p className="text-white/70 ml-4">Loading your teams...</p>
          </div>
        ) : sortedTeams.length > 0 ? (
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-fpl-green" />
                Your Teams ({sortedTeams.length}/5)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs value={activeTeamTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-white/10 border border-white/20">
                  {[1, 2, 3, 4, 5].map(teamNum => {
                    const team = sortedTeams.find(t => t.teamNumber === teamNum);
                    const isDisabled = !team;
                    const paymentStatus = team?.paymentStatus || 'not_submitted';
                    
                    return (
                      <TabsTrigger 
                        key={teamNum} 
                        value={teamNum.toString()} 
                        disabled={isDisabled}
                        className={`relative transition-all duration-200 ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/20'
                        } data-[state=active]:bg-fpl-green data-[state=active]:text-white`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-sm">Team {teamNum}</span>
                          {team && (
                            <div className={`w-2 h-2 rounded-full ${
                              paymentStatus === 'approved' ? 'bg-green-400' :
                              paymentStatus === 'pending' ? 'bg-yellow-400' :
                              paymentStatus === 'rejected' ? 'bg-red-400' :
                              'bg-gray-400'
                            }`} />
                          )}
                        </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                
                {/* Clean Tab Content */}
                {[1, 2, 3, 4, 5].map(teamNum => {
                  const team = sortedTeams.find(t => t.teamNumber === teamNum);
                  
                  return (
                    <TabsContent key={teamNum} value={teamNum.toString()} className="mt-6">
                      {team ? (
                        <div className="space-y-4 lg:space-y-6">
                          {/* Mobile-Optimized Team Status Card */}
                          <div className={`p-4 lg:p-6 rounded-xl border-2 transition-all ${
                            team.paymentStatus === 'approved' 
                              ? 'bg-green-500/10 border-green-500/30 shadow-lg shadow-green-500/20'
                              : team.paymentStatus === 'pending'
                              ? 'bg-yellow-500/10 border-yellow-500/30 shadow-lg shadow-yellow-500/20'
                              : team.paymentStatus === 'rejected'
                              ? 'bg-red-500/10 border-red-500/30 shadow-lg shadow-red-500/20'
                              : 'bg-white/5 border-white/20'
                          }`}>
                            {/* Mobile Header */}
                            <div className="sm:hidden space-y-3">
                              <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">
                                  {team.teamName || `Team ${teamNum}`}
                                </h3>
                                {getPaymentStatusBadge(team.paymentStatus)}
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-white/5 rounded p-2">
                                  <div className="text-sm font-medium text-white">{Array.isArray(team.players) ? team.players.length : 0}/11</div>
                                  <div className="text-xs text-white/60">Players</div>
                                </div>
                                <div className="bg-white/5 rounded p-2">
                                  <div className="text-sm font-medium text-white">£{(parseFloat(team.totalValue?.toString() || '0')).toFixed(1)}m</div>
                                  <div className="text-xs text-white/60">Value</div>
                                </div>
                                <div className="bg-white/5 rounded p-2">
                                  <div className="text-sm font-medium text-white">{team.totalPoints || 0}</div>
                                  <div className="text-xs text-white/60">Points</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Desktop Header */}
                            <div className="hidden sm:flex items-center justify-between mb-4">
                              <div>
                                <h3 className="text-xl font-bold text-white mb-1">
                                  {team.teamName || `Team ${teamNum}`}
                                </h3>
                                <div className="flex items-center gap-3 text-sm text-white/70">
                                  <span>Players: {Array.isArray(team.players) ? team.players.length : 0}/11</span>
                                  <span>•</span>
                                  <span>Value: £{(parseFloat(team.totalValue?.toString() || '0')).toFixed(1)}m</span>
                                  <span>•</span>
                                  <span>Points: {team.totalPoints || 0}</span>
                                </div>
                              </div>
                              {getPaymentStatusBadge(team.paymentStatus)}
                            </div>
                            
                            {/* Status-specific content */}
                            <div className="mt-3 sm:mt-0">
                              {team.paymentStatus === 'approved' ? (
                                <div className="flex items-center gap-2 text-green-400">
                                  <CheckCircle2 className="h-4 sm:h-5 w-4 sm:w-5" />
                                  <span className="text-sm sm:text-base font-medium">Team is ready for editing</span>
                                </div>
                              ) : team.paymentStatus === 'pending' ? (
                                <div className="flex items-center gap-2 text-yellow-400">
                                  <Timer className="h-4 sm:h-5 w-4 sm:w-5" />
                                  <span className="text-sm sm:text-base font-medium">Payment pending approval</span>
                                </div>
                              ) : team.paymentStatus === 'rejected' ? (
                                <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
                                  <div className="flex items-center gap-2 text-red-400">
                                    <XCircle className="h-4 sm:h-5 w-4 sm:w-5" />
                                    <span className="text-sm sm:text-base font-medium">Payment rejected</span>
                                  </div>
                                  <Link href={`/manual-payment?gameweek=${currentGameweek?.id}&team=${teamNum}`}>
                                    <Button size="sm" className="bg-red-600 hover:bg-red-700 w-full sm:w-auto">
                                      Resubmit Payment
                                    </Button>
                                  </Link>
                                </div>
                              ) : (
                                <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
                                  <div className="flex items-center gap-2 text-orange-400">
                                    <AlertCircle className="h-4 sm:h-5 w-4 sm:w-5" />
                                    <span className="text-sm sm:text-base font-medium">Payment required</span>
                                  </div>
                                  <Link href={`/manual-payment?gameweek=${currentGameweek?.id}&team=${teamNum}`}>
                                    <Button size="sm" className="bg-fpl-green hover:bg-green-600 w-full sm:w-auto">
                                      Complete Payment
                                    </Button>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-12 bg-white/5 rounded-xl border-2 border-dashed border-white/20">
                          <Trophy className="h-16 w-16 text-white/40 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-white mb-2">
                            Team {teamNum} Available
                          </h3>
                          <p className="text-white/60 mb-6">
                            Create Team {teamNum} to expand your fantasy strategy
                          </p>
                          <Link href={`/?team=${teamNum}`}>
                            <Button className="bg-fpl-green hover:bg-green-600 px-6 py-3">
                              <Plus className="h-4 w-4 mr-2" />
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

        {/* Show editing interface for approved teams */}
        {currentTeamData && currentTeamData.paymentStatus === 'approved' && !showPlayerTable ? (
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
            {/* Formation Pitch - Full width on mobile */}
            <div className="lg:col-span-2">
              <Card className="bg-white/10 border-blue-500/30 backdrop-blur-sm">
                <CardHeader className="pb-3 lg:pb-6">
                  <CardTitle className="text-white text-lg lg:text-xl">
                    Your Team Formation - Click positions to {isLocked ? 'view' : 'edit'} players
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 sm:px-4 lg:px-6">
                  <FormationPitch
                    players={players}
                    selectedPlayers={selectedPlayers}
                    onPositionClick={handlePositionClick}
                    captainId={captainId}
                    viceCaptainId={viceCaptainId}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Team Management */}
            <div className="space-y-6">
              <Card className="bg-white/10 border-blue-500/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Team Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Team Name - Always Locked for Approved Teams */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">{currentTeam?.teamName || currentTeamData?.teamName || teamName || `Team ${currentTeamNumber}`}</h3>
                      <Badge variant="secondary" className="text-xs bg-white/10">
                        <Lock className="h-3 w-3 mr-1" />
                        Fixed
                      </Badge>
                    </div>
                    <p className="text-sm text-white/60">
                      Team name is fixed after payment approval. You can modify players, captain, and vice-captain.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-white">Your Players ({selectedPlayers.length}/11)</div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedPlayers.map((playerId) => {
                        const player = players.find(p => p.id === playerId);
                        if (!player) return null;
                        return (
                          <div key={playerId} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/10 border border-white/20">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium">{player.web_name}</span>
                              {captainId === playerId && (
                                <Badge variant="secondary" className="bg-yellow-600 text-white text-xs">C</Badge>
                              )}
                              {viceCaptainId === playerId && (
                                <Badge variant="secondary" className="bg-blue-600 text-white text-xs">VC</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-fpl-green font-semibold">£{(player.custom_price || player.now_cost / 10).toFixed(1)}m</span>
                              {!isLocked && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePlayerToggle(playerId, false)}
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
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

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-white">Captain</div>
                    <Select 
                      value={captainId?.toString() || ""} 
                      onValueChange={(value) => setCaptainId(Number(value))} 
                      disabled={isLocked}
                    >
                      <SelectTrigger className="bg-white/10 border-white/30 text-white">
                        <SelectValue placeholder="Select captain" className="text-white/80" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {selectedPlayers.map((playerId) => {
                          const player = players.find(p => p.id === playerId);
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
                    <Select 
                      value={viceCaptainId?.toString() || ""} 
                      onValueChange={(value) => setViceCaptainId(Number(value))} 
                      disabled={isLocked}
                    >
                      <SelectTrigger className="bg-white/10 border-white/30 text-white">
                        <SelectValue placeholder="Select vice captain" className="text-white/80" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {selectedPlayers.filter(id => id !== captainId).map((playerId) => {
                          const player = players.find(p => p.id === playerId);
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
                      <span className={remainingBudget >= 0 ? "text-fpl-green font-semibold" : "text-red-400 font-semibold"}>
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
