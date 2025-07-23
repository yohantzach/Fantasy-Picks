import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Navigation from "@/components/ui/navigation";
import FormationPitch from "@/components/ui/formation-pitch";
import PlayerCard from "@/components/ui/player-card";
import DeadlineTimer from "@/components/ui/deadline-timer";
import PaymentModal from "@/components/ui/payment-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Save, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type FPLPlayer = {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  element_type: number;
  team: number;
  team_code: number;
  now_cost: number;
  total_points: number;
  form: string;
  selected_by_percent: string;
  team_name: string;
  team_short_name: string;
  position_name: string;
  price_formatted: string;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
};

type Team = {
  id: number;
  teamName: string;
  formation: string;
  totalValue: string;
  players: number[];
  captainId?: number;
  viceCaptainId?: number;
  totalPoints: number;
  isLocked: boolean;
};

const formations = ["4-4-2", "4-3-3", "3-5-2", "5-4-1", "5-3-2", "4-5-1"];

export default function TeamSelection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [currentFormation, setCurrentFormation] = useState("4-4-2");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showFixtures, setShowFixtures] = useState(false);

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch user's current team
  const { data: userTeam, isLoading: teamLoading } = useQuery({
    queryKey: ["/api/team/current"],
  });

  // Fetch FPL players
  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["/api/fpl/players"],
  });

  // Fetch FPL teams
  const { data: fplTeams = [] } = useQuery({
    queryKey: ["/api/fpl/teams"],
  });

  // Fetch fixtures for current gameweek
  const { data: fixtures = [] } = useQuery({
    queryKey: ["/api/fpl/fixtures", { gameweek: currentGameweek?.gameweekNumber }],
    enabled: !!currentGameweek?.gameweekNumber,
  });

  // Update local state when userTeam changes
  useEffect(() => {
    if (userTeam) {
      setSelectedPlayers(userTeam.players || []);
      setCurrentFormation(userTeam.formation || "4-4-2");
    }
  }, [userTeam]);

  // Save team mutation
  const saveTeamMutation = useMutation({
    mutationFn: async (teamData: any) => {
      const response = await apiRequest("POST", "/api/team", teamData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/current"] });
      toast({
        title: "Team Saved",
        description: "Your team has been saved successfully!",
      });
    },
    onError: (error: Error) => {
      if (error.message.includes("Payment required")) {
        setShowPaymentModal(true);
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  // Check if user needs to pay
  const needsPayment = !user?.isAdmin && !user?.hasPaid;

  // Filter players
  const filteredPlayers = players.filter((player: FPLPlayer) => {
    const matchesSearch = player.web_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.second_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPosition = positionFilter === "all" || player.element_type === parseInt(positionFilter);
    
    const matchesTeam = teamFilter === "all" || player.team === parseInt(teamFilter);
    
    const matchesPrice = priceFilter === "all" || 
      (priceFilter === "under5" && player.now_cost < 50) ||
      (priceFilter === "5to8" && player.now_cost >= 50 && player.now_cost < 80) ||
      (priceFilter === "8to12" && player.now_cost >= 80 && player.now_cost < 120) ||
      (priceFilter === "over12" && player.now_cost >= 120);
    
    return matchesSearch && matchesPosition && matchesTeam && matchesPrice;
  });

  // Calculate budget info
  const selectedPlayerObjects = players.filter((p: FPLPlayer) => selectedPlayers.includes(p.id));
  const totalSpent = selectedPlayerObjects.reduce((sum: number, p: FPLPlayer) => sum + p.now_cost, 0);
  const budgetRemaining = 1000 - totalSpent; // 100.0m = 1000 in API units

  // Validate team composition
  const getPositionCounts = () => {
    const counts = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
    selectedPlayerObjects.forEach(player => {
      counts[player.position_name as keyof typeof counts]++;
    });
    return counts;
  };

  const positionCounts = getPositionCounts();
  const isValidTeam = positionCounts.GKP === 1 && 
                     positionCounts.DEF >= 3 && positionCounts.DEF <= 5 &&
                     positionCounts.MID >= 2 && positionCounts.MID <= 5 &&
                     positionCounts.FWD >= 1 && positionCounts.FWD <= 3 &&
                     selectedPlayers.length === 11;

  const handlePlayerToggle = (playerId: number, isAdding: boolean) => {
    if (isAdding) {
      if (selectedPlayers.length >= 11) {
        toast({
          title: "Team Full",
          description: "You can only select 11 players",
          variant: "destructive",
        });
        return;
      }

      const player = players.find((p: FPLPlayer) => p.id === playerId);
      if (!player) return;

      if (budgetRemaining < player.now_cost) {
        toast({
          title: "Insufficient Budget",
          description: "You don't have enough budget for this player",
          variant: "destructive",
        });
        return;
      }

      // Check team constraint (max 3 players from same team)
      const sameTeamPlayers = selectedPlayerObjects.filter(p => p.team === player.team);
      if (sameTeamPlayers.length >= 3) {
        toast({
          title: "Team Limit Exceeded",
          description: "Maximum 3 players allowed from the same team",
          variant: "destructive",
        });
        return;
      }

      setSelectedPlayers([...selectedPlayers, playerId]);
    } else {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId));
    }
  };

  const handleSaveTeam = () => {
    if (needsPayment) {
      setShowPaymentModal(true);
      return;
    }

    if (!isValidTeam) {
      toast({
        title: "Invalid Team",
        description: "Please select a valid team formation with 11 players",
        variant: "destructive",
      });
      return;
    }

    const teamData = {
      teamName: userTeam?.teamName || `${user?.name}'s Team`,
      formation: currentFormation,
      players: selectedPlayers,
      captainId: userTeam?.captainId,
      viceCaptainId: userTeam?.viceCaptainId,
    };

    saveTeamMutation.mutate(teamData);
  };

  const isDeadlinePassed = currentGameweek && new Date() > new Date(currentGameweek.deadline);

  if (playersLoading || teamLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
        <Navigation />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Deadline Timer */}
        {currentGameweek && (
          <DeadlineTimer 
            deadline={currentGameweek.deadline} 
            gameweek={currentGameweek.gameweekNumber} 
          />
        )}

        {/* Budget & Team Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="glass-card border-white/20">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">Budget Remaining</div>
              <div className={`text-2xl font-bold ${budgetRemaining < 0 ? 'text-red-400' : 'text-fpl-green'}`}>
                £{(budgetRemaining / 10).toFixed(1)}m
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">Players Selected</div>
              <div className={`text-2xl font-bold ${selectedPlayers.length === 11 ? 'text-fpl-green' : 'text-white'}`}>
                {selectedPlayers.length}/11
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">Formation</div>
              <div className="text-2xl font-bold text-white">
                {currentFormation}
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4">
              <div className="text-white/60 text-sm">Gameweek</div>
              <div className="text-2xl font-bold text-fpl-green">
                {currentGameweek?.gameweekNumber || "21"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formation & Pitch */}
        <FormationPitch 
          selectedPlayers={selectedPlayerObjects}
          formation={currentFormation}
          onFormationChange={setCurrentFormation}
        />

        {/* Player Selection */}
        <Card className="glass-card border-white/20 mt-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h3 className="text-white text-lg font-semibold mb-4 sm:mb-0 flex items-center gap-2">
                <Filter className="h-5 w-5 text-fpl-green" />
                Select Players
              </h3>
              
              {/* Toggle Fixtures Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFixtures(!showFixtures)}
                className="mb-4 sm:mb-0 bg-white/20 border-white/30 text-white hover:bg-white/30"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {showFixtures ? "Hide Fixtures" : "Show Fixtures"}
              </Button>
            </div>

            {/* Fixtures Preview */}
            {showFixtures && (
              <div className="mb-6 p-4 bg-white/10 rounded-lg">
                <h4 className="text-white font-medium mb-3">Gameweek {currentGameweek?.gameweekNumber} Fixtures</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {fixtures.slice(0, 6).map((fixture: any) => (
                    <div key={fixture.id} className="bg-white/10 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white">{fixture.team_h_short}</span>
                        <span className="text-white/60">vs</span>
                        <span className="text-white">{fixture.team_a_short}</span>
                      </div>
                      <div className="flex justify-center gap-2 mt-1">
                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center text-white font-bold ${
                          fixture.team_h_difficulty <= 2 ? 'bg-green-500' : 
                          fixture.team_h_difficulty === 3 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}>
                          {fixture.team_h_difficulty}
                        </span>
                        <span className={`w-4 h-4 rounded text-xs flex items-center justify-center text-white font-bold ${
                          fixture.team_a_difficulty <= 2 ? 'bg-green-500' : 
                          fixture.team_a_difficulty === 3 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}>
                          {fixture.team_a_difficulty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  <SelectItem value="1">Goalkeepers</SelectItem>
                  <SelectItem value="2">Defenders</SelectItem>
                  <SelectItem value="3">Midfielders</SelectItem>
                  <SelectItem value="4">Forwards</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                  <SelectValue placeholder="Team" />
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
              
              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                  <SelectValue placeholder="Price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="under5">Under £5.0m</SelectItem>
                  <SelectItem value="5to8">£5.0m - £8.0m</SelectItem>
                  <SelectItem value="8to12">£8.0m - £12.0m</SelectItem>
                  <SelectItem value="over12">Over £12.0m</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60 pl-10 focus:ring-fpl-green focus:border-fpl-green"
              />
            </div>

            {/* Team Composition Status */}
            <div className="mb-6 p-4 bg-white/10 rounded-lg">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className={`flex items-center gap-2 ${positionCounts.GKP === 1 ? 'text-green-400' : 'text-red-400'}`}>
                  <Badge variant="outline" className="border-current">GKP</Badge>
                  <span>{positionCounts.GKP}/1</span>
                </div>
                <div className={`flex items-center gap-2 ${positionCounts.DEF >= 3 && positionCounts.DEF <= 5 ? 'text-green-400' : 'text-red-400'}`}>
                  <Badge variant="outline" className="border-current">DEF</Badge>
                  <span>{positionCounts.DEF}/3-5</span>
                </div>
                <div className={`flex items-center gap-2 ${positionCounts.MID >= 2 && positionCounts.MID <= 5 ? 'text-green-400' : 'text-red-400'}`}>
                  <Badge variant="outline" className="border-current">MID</Badge>
                  <span>{positionCounts.MID}/2-5</span>
                </div>
                <div className={`flex items-center gap-2 ${positionCounts.FWD >= 1 && positionCounts.FWD <= 3 ? 'text-green-400' : 'text-red-400'}`}>
                  <Badge variant="outline" className="border-current">FWD</Badge>
                  <span>{positionCounts.FWD}/1-3</span>
                </div>
              </div>
            </div>

            {/* Player Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPlayers.slice(0, 20).map((player: FPLPlayer) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  isSelected={selectedPlayers.includes(player.id)}
                  onToggle={handlePlayerToggle}
                  disabled={isDeadlinePassed || userTeam?.isLocked}
                />
              ))}
            </div>

            {/* Load More */}
            {filteredPlayers.length > 20 && (
              <div className="text-center mt-6">
                <Button variant="outline" className="bg-white/20 border-white/30 text-white hover:bg-white/30">
                  Load More Players
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Team Button */}
        <div className="text-center mt-6">
          <Button
            onClick={handleSaveTeam}
            disabled={saveTeamMutation.isPending || userTeam?.isLocked || isDeadlinePassed || !isValidTeam}
            className="bg-fpl-green hover:bg-green-600 text-white px-8 py-4 text-lg font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5 mr-2" />
            {userTeam?.isLocked ? "Team Locked" : 
             isDeadlinePassed ? "Deadline Passed" :
             "Save Team for Gameweek"}
          </Button>
          <p className="text-white/60 text-sm mt-2">
            {isValidTeam ? "Team will be locked at deadline" : 
             `Invalid team: Need ${11 - selectedPlayers.length} more players`}
          </p>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal 
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={() => {
          setShowPaymentModal(false);
          queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        }}
      />
    </div>
  );
}
