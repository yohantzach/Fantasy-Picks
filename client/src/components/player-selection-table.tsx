import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FPLPlayer } from "@shared/schema";
import { Info, Plus, Minus, Search } from "lucide-react";

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
  const [sortBy, setSortBy] = useState<"price" | "points" | "form">("price");
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
    switch (sortBy) {
      case "price":
        return b.now_cost - a.now_cost;
      case "points":
        return b.total_points - a.total_points;
      case "form":
        return parseFloat(b.form) - parseFloat(a.form);
      default:
        return b.now_cost - a.now_cost;
    }
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
          
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price (High to Low)</SelectItem>
              <SelectItem value="points">Points (High to Low)</SelectItem>
              <SelectItem value="form">Form (High to Low)</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter team" />
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
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Selected %</TableHead>
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
                    <TableCell>
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