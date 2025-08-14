import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, Plus, Minus, Search, ArrowUpDown, ArrowUp, ArrowDown, Heart, HeartOff, Activity, AlertTriangle } from "lucide-react";

interface EnhancedPlayerSelectionTableProps {
  players: any[];
  fplTeams: any[];
  elementType: number;
  selectedPlayers: number[];
  onPlayerToggle: (playerId: number, isAdding: boolean) => void;
  onPlayerStats: (player: any) => void;
  onClose: () => void;
  currentGameweek?: any;
}

type SortColumn = "price" | "points" | "form" | "selected";
type SortOrder = "asc" | "desc";

// Helper function to get the correct adjusted price from player data
const getAdjustedPrice = (player: any) => {
  // Use the custom_price if available (already calculated in queryClient), otherwise fall back to now_cost/10
  return player.custom_price || (player.now_cost / 10);
};

// Helper function to get injury status color
const getInjuryStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'injured':
      return 'text-red-500 bg-red-100 dark:bg-red-900/20';
    case 'doubtful':
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    case 'suspended':
      return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    case 'unavailable':
      return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    default:
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
  }
};

// Helper function to get injury status icon
const getInjuryStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'injured':
      return <HeartOff className="h-3 w-3" />;
    case 'doubtful':
      return <AlertTriangle className="h-3 w-3" />;
    case 'suspended':
      return <Minus className="h-3 w-3" />;
    case 'unavailable':
      return <Activity className="h-3 w-3" />;
    default:
      return <Heart className="h-3 w-3" />;
  }
};

export function EnhancedPlayerSelectionTable({
  players,
  fplTeams,
  elementType,
  selectedPlayers,
  onPlayerToggle,
  onPlayerStats,
  onClose,
  currentGameweek
}: EnhancedPlayerSelectionTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortColumn>("points");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>("all");

  const getPositionName = (elementType: number) => {
    switch (elementType) {
      case 1: return "Goalkeepers";
      case 2: return "Defenders";
      case 3: return "Midfielders";
      case 4: return "Forwards";
      default: return "Players";
    }
  };

  const getTeamName = (teamId: number) => {
    const team = fplTeams.find(t => t.id === teamId);
    return team ? team.short_name : "Unknown";
  };

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3" />;
    return sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Enhanced filtering and sorting
  const filteredAndSortedPlayers = useMemo(() => {
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

    // Apply price range filter (using adjusted prices)
    if (priceRangeFilter !== "all") {
      filteredPlayers = filteredPlayers.filter(p => {
        const adjustedPrice = getAdjustedPrice(p);
        switch (priceRangeFilter) {
          case "under4":
            return adjustedPrice < 4.0;
          case "4to5":
            return adjustedPrice >= 4.0 && adjustedPrice < 5.0;
          case "5to6":
            return adjustedPrice >= 5.0 && adjustedPrice < 6.0;
          case "6to7":
            return adjustedPrice >= 6.0 && adjustedPrice < 7.0;
          case "7to8":
            return adjustedPrice >= 7.0 && adjustedPrice < 8.0;
          case "8to10":
            return adjustedPrice >= 8.0 && adjustedPrice < 10.0;
          case "10plus":
            return adjustedPrice >= 10.0;
          default:
            return true;
        }
      });
    }

    // Sort players
    filteredPlayers.sort((a, b) => {
      let result = 0;
      switch (sortBy) {
        case "price":
          result = getAdjustedPrice(a) - getAdjustedPrice(b);
          break;
        case "points":
          result = (a.total_points || 0) - (b.total_points || 0);
          break;
        case "form":
          const formA = parseFloat(a.form || '0');
          const formB = parseFloat(b.form || '0');
          result = formA - formB;
          break;
        case "selected":
          const selectedA = parseFloat(a.selected_by_percent || '0');
          const selectedB = parseFloat(b.selected_by_percent || '0');
          result = selectedA - selectedB;
          break;
        default:
          result = (a.total_points || 0) - (b.total_points || 0);
      }
      return sortOrder === "asc" ? result : -result;
    });

    return filteredPlayers;
  }, [players, elementType, searchQuery, filterTeam, priceRangeFilter, sortBy, sortOrder]);

  return (
    <Card className="w-full max-w-7xl mx-auto bg-white/5 border-white/20">
      <CardHeader className="bg-gradient-to-r from-fpl-purple to-fpl-green">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white text-xl font-bold">
            {getPositionName(elementType)}
            {currentGameweek && (
              <span className="ml-2 text-sm font-normal text-white/80">
                • Gameweek {currentGameweek.gameweekNumber}
                {currentGameweek.deadline && new Date() > new Date(currentGameweek.deadline) && (
                  <span className="text-red-300"> • Deadline Passed</span>
                )}
              </span>
            )}
          </CardTitle>
          <Button variant="outline" onClick={onClose} className="bg-white/20 border-white/30 text-white hover:bg-white/30">
            Close
          </Button>
        </div>
        
        {/* Enhanced Filters */}
        <div className="flex flex-wrap gap-3 mt-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/20 border-white/30 text-white placeholder:text-white/60"
            />
          </div>
          
          {/* Price Range Filter */}
          <Select value={priceRangeFilter} onValueChange={setPriceRangeFilter}>
            <SelectTrigger className="w-40 bg-white/20 border-white/30 text-white">
              <SelectValue placeholder="Price Range" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-white hover:bg-slate-700">All Prices</SelectItem>
              <SelectItem value="under4" className="text-white hover:bg-slate-700">Under £4.0m</SelectItem>
              <SelectItem value="4to5" className="text-white hover:bg-slate-700">£4.0m - £5.0m</SelectItem>
              <SelectItem value="5to6" className="text-white hover:bg-slate-700">£5.0m - £6.0m</SelectItem>
              <SelectItem value="6to7" className="text-white hover:bg-slate-700">£6.0m - £7.0m</SelectItem>
              <SelectItem value="7to8" className="text-white hover:bg-slate-700">£7.0m - £8.0m</SelectItem>
              <SelectItem value="8to10" className="text-white hover:bg-slate-700">£8.0m - £10.0m</SelectItem>
              <SelectItem value="10plus" className="text-white hover:bg-slate-700">£10.0m+</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Team Filter */}
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40 bg-white/20 border-white/30 text-white">
              <SelectValue placeholder="Filter team" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 max-h-64">
              <SelectItem value="all" className="text-white hover:bg-slate-700">All Clubs</SelectItem>
              {fplTeams.map((team: any) => (
                <SelectItem key={team.id} value={team.id.toString()} className="text-white hover:bg-slate-700">
                  {team.short_name} - {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort Buttons */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            variant={sortBy === "points" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("points")}
            className={`${sortBy === "points" ? "bg-fpl-green text-white border-fpl-green" : "bg-white/20 border-white/30 text-white hover:bg-white/30"}`}
          >
            Total Points
            <SortIcon column="points" />
          </Button>
          
          <Button
            variant={sortBy === "form" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("form")}
            className={`${sortBy === "form" ? "bg-fpl-green text-white border-fpl-green" : "bg-white/20 border-white/30 text-white hover:bg-white/30"}`}
          >
            Form
            <SortIcon column="form" />
          </Button>
          
          <Button
            variant={sortBy === "price" ? "default" : "outline"}
            size="sm"
            onClick={() => handleSort("price")}
            className={`${sortBy === "price" ? "bg-fpl-green text-white border-fpl-green" : "bg-white/20 border-white/30 text-white hover:bg-white/30"}`}
          >
            Price
            <SortIcon column="price" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            className="bg-white/20 border-white/30 text-white cursor-default opacity-75"
            disabled
          >
            Selected %
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 relative">
        <div className="max-h-[600px] overflow-y-auto">
          <div className="overflow-x-auto relative">
            {/* Horizontal scroll indicator for mobile - positioned next to table headers */}
            <div className="absolute top-3 right-4 z-30 pointer-events-none md:hidden">
              <div className="flex items-center justify-center w-8 h-8 bg-fpl-green/90 border border-fpl-green rounded-full animate-pulse shadow-lg">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <div className="text-xs text-fpl-green font-medium text-center mt-1 whitespace-nowrap">
                Scroll →
              </div>
            </div>
            <Table>
            <TableHeader className="sticky top-0 bg-slate-800/90 backdrop-blur relative">
              <TableRow className="border-slate-700">
                <TableHead className="text-white">Player</TableHead>
                <TableHead className="text-white text-center">Club</TableHead>
                <TableHead className="text-white text-center">Price</TableHead>
                <TableHead className="text-white text-center">Points</TableHead>
                <TableHead className="text-white text-center">Form</TableHead>
                <TableHead className="text-white text-center">ICT Index</TableHead>
                <TableHead className="text-white text-center">Status</TableHead>
                <TableHead className="text-white text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedPlayers.map((player) => {
                const isSelected = selectedPlayers.includes(player.id);
                const injuryStatus = player.injury_status || 'available';
                const chanceOfPlaying = player.chance_of_playing;
                const adjustedPrice = getAdjustedPrice(player);
                
                return (
                  <TableRow 
                    key={player.id} 
                    className={`border-slate-700 hover:bg-white/5 ${
                      isSelected ? "bg-fpl-green/10 border-fpl-green/30" : ""
                    }`}
                  >
                    <TableCell className="text-white">
                      <div>
                        <div className="font-medium">{player.web_name}</div>
                        <div className="text-sm text-white/60">
                          {player.first_name} {player.second_name}
                        </div>
                        {player.news && (
                          <div className="text-xs text-yellow-400 mt-1 max-w-xs truncate">
                            {player.news}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {getTeamName(player.team)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-medium text-fpl-green">
                        £{adjustedPrice.toFixed(1)}m
                      </div>
                      {player.cost_change_event !== 0 && (
                        <div className={`text-xs ${
                          player.cost_change_event > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {player.cost_change_event > 0 ? '+' : ''}£{(player.cost_change_event / 10).toFixed(1)}m
                        </div>
                      )}
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="font-medium text-fpl-purple">{player.total_points}</div>
                      <div className="text-xs text-white/60">PPG: {player.points_per_game}</div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={`${
                          parseFloat(player.form) >= 6 ? 'bg-green-600' :
                          parseFloat(player.form) >= 4 ? 'bg-yellow-600' :
                          'bg-red-600'
                        } text-white`}
                      >
                        {player.form}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-center text-white">
                      <div className="font-medium">{player.ict_index || '0.0'}</div>
                      <div className="text-xs text-white/60">ICT</div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge 
                          className={`text-xs px-2 py-1 flex items-center gap-1 ${
                            getInjuryStatusColor(injuryStatus)
                          }`}
                        >
                          {getInjuryStatusIcon(injuryStatus)}
                          {injuryStatus === 'available' ? 'Available' : 
                           injuryStatus.charAt(0).toUpperCase() + injuryStatus.slice(1)}
                        </Badge>
                        {chanceOfPlaying !== null && chanceOfPlaying < 100 && (
                          <div className="text-xs text-yellow-400">
                            {chanceOfPlaying}% chance
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPlayerStats(player)}
                          className="h-8 w-8 p-0 text-white hover:bg-white/20"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={isSelected ? "destructive" : "default"}
                          onClick={() => onPlayerToggle(player.id, !isSelected)}
                          className={`h-8 w-8 p-0 ${
                            isSelected ? "bg-red-600 hover:bg-red-700" : "bg-fpl-green hover:bg-fpl-green/90"
                          }`}
                          disabled={currentGameweek?.deadline && new Date() > new Date(currentGameweek.deadline)}
                        >
                          {isSelected ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </div>
        
        {filteredAndSortedPlayers.length === 0 && (
          <div className="text-center py-12 text-white/60">
            <Search className="h-12 w-12 mx-auto mb-4 text-white/40" />
            <p className="text-lg mb-2">No players found</p>
            <p className="text-sm">Try adjusting your filters or search terms</p>
          </div>
        )}
        
        {/* Stats Summary */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <div className="flex justify-between items-center text-sm text-white/80">
            <span>Showing {filteredAndSortedPlayers.length} players</span>
            <span>Selected: {selectedPlayers.length}/11</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
