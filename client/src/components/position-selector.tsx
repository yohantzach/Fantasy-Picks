import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayerDetailsModal } from "./player-details-modal";
import { 
  Search, 
  Info, 
  Star, 
  TrendingUp, 
  DollarSign
} from "lucide-react";

interface PositionSelectorProps {
  position: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (player: any) => void;
  selectedPlayers: any[];
  budget: number;
}

export function PositionSelector({ 
  position, 
  isOpen, 
  onClose, 
  onSelectPlayer,
  selectedPlayers,
  budget 
}: PositionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
  const [sortBy, setSortBy] = useState<"points" | "price" | "form">("points");

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["/api/fpl/players"],
    enabled: isOpen,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["/api/fpl/teams"],
    enabled: isOpen,
  });

  // Filter players by position
  const getPositionType = (elementType: number) => {
    switch (elementType) {
      case 1: return "GKP";
      case 2: return "DEF";
      case 3: return "MID";
      case 4: return "FWD";
      default: return "Unknown";
    }
  };

  const positionPlayers = players.filter(player => 
    getPositionType(player.element_type) === position
  );

  // Filter and sort players
  const filteredPlayers = positionPlayers
    .filter(player => {
      const matchesSearch = player.web_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           player.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           player.second_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isAffordable = (player.now_cost / 10) <= budget;
      const isNotSelected = !selectedPlayers.some(selected => selected.id === player.id);
      
      return matchesSearch && isAffordable && isNotSelected;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "points":
          return b.total_points - a.total_points;
        case "price":
          return b.now_cost - a.now_cost;
        case "form":
          return parseFloat(b.form) - parseFloat(a.form);
        default:
          return 0;
      }
    });

  const getTeamById = (teamId: number) => {
    return teams.find(team => team.id === teamId);
  };

  const handlePlayerInfo = (player: any) => {
    setSelectedPlayer(player);
    setShowPlayerDetails(true);
  };

  const handleSelectPlayer = (player: any) => {
    onSelectPlayer({ ...player, position });
    onClose();
  };

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'GKP': return 'from-yellow-600 to-yellow-500';
      case 'DEF': return 'from-green-600 to-green-500';
      case 'MID': return 'from-blue-600 to-blue-500';
      case 'FWD': return 'from-red-600 to-red-500';
      default: return 'from-gray-600 to-gray-500';
    }
  };

  const getFormColor = (form: number) => {
    if (form >= 7) return 'text-green-400';
    if (form >= 5) return 'text-yellow-400';
    if (form >= 3) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className={`text-2xl font-bold text-white flex items-center gap-3`}>
              <div className={`w-12 h-12 bg-gradient-to-br ${getPositionColor(position)} rounded-full flex items-center justify-center`}>
                <span className="text-white font-bold text-lg">{position}</span>
              </div>
              Select {position === 'GKP' ? 'Goalkeeper' : 
                     position === 'DEF' ? 'Defender' :
                     position === 'MID' ? 'Midfielder' : 'Forward'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Filter Controls */}
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-slate-400"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={sortBy === "points" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("points")}
                  className="text-xs"
                >
                  <Star className="w-3 h-3 mr-1" />
                  Points
                </Button>
                <Button
                  variant={sortBy === "form" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("form")}
                  className="text-xs"
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Form
                </Button>
                <Button
                  variant={sortBy === "price" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortBy("price")}
                  className="text-xs"
                >
                  <DollarSign className="w-3 h-3 mr-1" />
                  Price
                </Button>
              </div>
            </div>

            {/* Available Budget */}
            <div className="flex justify-between items-center bg-slate-800/50 rounded-lg p-3">
              <span className="text-slate-300">Available Budget:</span>
              <span className="text-fpl-green font-bold text-lg">£{budget.toFixed(1)}m</span>
            </div>

            {/* Players List */}
            <ScrollArea className="h-[60vh]">
              {isLoading ? (
                <div className="text-center text-slate-400 py-8">Loading players...</div>
              ) : (
                <div className="space-y-2">
                  {filteredPlayers.map((player) => {
                    const team = getTeamById(player.team);
                    return (
                      <Card key={player.id} className="bg-slate-800/50 border-slate-700 hover:bg-slate-700/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="relative">
                                <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-500 rounded-full flex items-center justify-center">
                                  <span className="text-white font-bold">
                                    {player.web_name.charAt(0)}
                                  </span>
                                </div>
                                <Badge 
                                  className={`absolute -bottom-1 -right-1 ${getPositionColor(position).replace('from-', 'bg-').replace(' to-', '').split(' ')[0]} text-white text-xs px-1 py-0`}
                                  style={{ fontSize: '10px' }}
                                >
                                  {position}
                                </Badge>
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-white">{player.web_name}</span>
                                  <Badge variant="outline" className="border-slate-600 text-slate-300 text-xs">
                                    {team?.short_name || team?.name}
                                  </Badge>
                                </div>
                                
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-slate-400">
                                    Points: <span className="text-white font-medium">{player.total_points}</span>
                                  </span>
                                  <span className="text-slate-400">
                                    Form: <span className={`font-medium ${getFormColor(parseFloat(player.form))}`}>
                                      {player.form}
                                    </span>
                                  </span>
                                  <span className="text-slate-400">
                                    Selected: <span className="text-white font-medium">{player.selected_by_percent}%</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-fpl-green font-bold text-lg">
                                  £{(player.now_cost / 10).toFixed(1)}m
                                </div>
                                <div 
                                  className="text-slate-400 text-xs cursor-help" 
                                  title="Points Per Game"
                                >
                                  PPG: {player.points_per_game}
                                </div>
                              </div>
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePlayerInfo(player)}
                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                              >
                                <Info className="w-4 h-4" />
                              </Button>
                              
                              <Button
                                onClick={() => handleSelectPlayer(player)}
                                className="bg-fpl-green hover:bg-fpl-green/90 text-white"
                                size="sm"
                              >
                                Select
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {filteredPlayers.length === 0 && !isLoading && (
                    <div className="text-center text-slate-400 py-8">
                      No players found matching your criteria
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Details Modal */}
      <PlayerDetailsModal
        player={selectedPlayer}
        team={selectedPlayer ? getTeamById(selectedPlayer.team) : null}
        isOpen={showPlayerDetails}
        onClose={() => setShowPlayerDetails(false)}
        onSelect={handleSelectPlayer}
        showSelectButton={true}
        position={position}
      />
    </>
  );
}