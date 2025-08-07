import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FPLPlayer } from "@shared/schema";
import { Info, Plus, Minus, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface PlayerSelectionTableProps {
  players: FPLPlayer[];
  fplTeams: any[];
  elementType: number;
  selectedPlayers: number[];
  onPlayerToggle: (playerId: number, isAdding: boolean) => void;
  onPlayerStats: (player: FPLPlayer) => void;
  onClose: () => void;
}

export function PlayerSelectionTable({
  players,
  fplTeams,
  elementType,
  selectedPlayers,
  onPlayerToggle,
  onPlayerStats,
  onClose
}: PlayerSelectionTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"price" | "points" | "form" | "selected">("price");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterTeam, setFilterTeam] = useState<string>("all");

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

  const handleSort = (column: "price" | "points" | "form" | "selected") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const SortIcon = ({ column }: { column: "price" | "points" | "form" | "selected" }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3 w-3" />;
    return sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  // Filter and sort players
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

  // Sort players
  filteredPlayers.sort((a, b) => {
    let result = 0;
    switch (sortBy) {
      case "price":
        result = (a.now_cost || 0) - (b.now_cost || 0);
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
        result = (a.now_cost || 0) - (b.now_cost || 0);
    }
    return sortOrder === "asc" ? result : -result;
  });

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{getPositionName(elementType)}</CardTitle>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={sortBy === "price" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("price")}
              className={`text-black border-2 ${sortBy === "price" ? "bg-fpl-green text-white border-fpl-green hover:bg-fpl-green/80" : "bg-white border-gray-400 hover:bg-gray-100"}`}
            >
              Price
              <SortIcon column="price" />
            </Button>
            
            <Button
              variant={sortBy === "points" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("points")}
              className={`text-black border-2 ${sortBy === "points" ? "bg-fpl-green text-white border-fpl-green hover:bg-fpl-green/80" : "bg-white border-gray-400 hover:bg-gray-100"}`}
            >
              Points
              <SortIcon column="points" />
            </Button>
            
            <Button
              variant={sortBy === "form" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("form")}
              className={`text-black border-2 ${sortBy === "form" ? "bg-fpl-green text-white border-fpl-green hover:bg-fpl-green/80" : "bg-white border-gray-400 hover:bg-gray-100"}`}
            >
              Form
              <SortIcon column="form" />
            </Button>
            
            <Button
              variant={sortBy === "selected" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSort("selected")}
              className={`text-black border-2 ${sortBy === "selected" ? "bg-fpl-green text-white border-fpl-green hover:bg-fpl-green/80" : "bg-white border-gray-400 hover:bg-gray-100"}`}
            >
              Selected %
              <SortIcon column="selected" />
            </Button>
          </div>
          
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40 text-black bg-white">
              <SelectValue placeholder="Filter team" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all" className="text-black hover:bg-gray-100">All Teams</SelectItem>
              {fplTeams.map((team: any) => (
                <SelectItem key={team.id} value={team.id.toString()} className="text-black hover:bg-gray-100">
                  {team.short_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none text-center"
                  onClick={() => handleSort("price")}
                >
                  <div className="flex items-center gap-1 justify-center">
                    Price
                    <SortIcon column="price" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("points")}
                >
                  <div className="flex items-center gap-1">
                    Points
                    <SortIcon column="points" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("form")}
                >
                  <div className="flex items-center gap-1">
                    Form
                    <SortIcon column="form" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("selected")}
                >
                  <div className="flex items-center gap-1">
                    Selected %
                    <SortIcon column="selected" />
                  </div>
                </TableHead>
                <TableHead>Goals</TableHead>
                <TableHead>Assists</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => {
                const isSelected = selectedPlayers.includes(player.id);
                return (
                  <TableRow key={player.id} className={isSelected ? "bg-fpl-green/5" : ""}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{player.web_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {player.first_name} {player.second_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTeamName(player.team)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium">£{(player.now_cost / 10).toFixed(1)}m</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-fpl-purple">{player.total_points}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{player.form}</Badge>
                    </TableCell>
                    <TableCell>{player.selected_by_percent}%</TableCell>
                    <TableCell>{player.goals_scored}</TableCell>
                    <TableCell>{player.assists}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onPlayerStats(player)}
                          className="h-8 w-8 p-0"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={isSelected ? "destructive" : "default"}
                          onClick={() => onPlayerToggle(player.id, !isSelected)}
                          className="h-8 w-8 p-0"
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
        
        {filteredPlayers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No players found matching your criteria
          </div>
        )}
      </CardContent>
    </Card>
  );
}