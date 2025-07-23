import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Check } from "lucide-react";

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
};

type PlayerCardProps = {
  player: FPLPlayer;
  isSelected: boolean;
  onToggle: (playerId: number, isAdding: boolean) => void;
};

const getPositionColor = (position: string) => {
  switch (position) {
    case "GKP":
      return "bg-yellow-500";
    case "DEF":
      return "bg-green-500";
    case "MID":
      return "bg-blue-500";
    case "FWD":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

const getTeamBadgeColor = (teamName: string) => {
  // Simple hash-based color assignment for consistency
  const colors = [
    "bg-red-600", "bg-blue-600", "bg-green-600", "bg-purple-600",
    "bg-yellow-600", "bg-pink-600", "bg-indigo-600", "bg-orange-600"
  ];
  const hash = teamName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function PlayerCard({ player, isSelected, onToggle }: PlayerCardProps) {
  const handleToggle = () => {
    onToggle(player.id, !isSelected);
  };

  return (
    <Card className="player-card glass-card border-white/20 transition-all duration-200 hover:transform hover:-translate-y-1 hover:shadow-lg hover:shadow-fpl-green/20 cursor-pointer">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2">
            {/* Team Badge */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${getTeamBadgeColor(player.team_name)}`}>
              {player.team_short_name}
            </div>
            <div className="flex-1">
              <div className="text-white font-medium text-sm leading-tight">
                {player.web_name}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge 
                  variant="outline" 
                  className={`text-xs px-1 py-0 ${getPositionColor(player.position_name)} border-0 text-white`}
                >
                  {player.position_name}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-fpl-green font-bold text-sm">
            £{player.price_formatted}m
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div className="text-center">
            <div className="text-white/60">Form</div>
            <div className="text-white font-semibold">
              {parseFloat(player.form).toFixed(1)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Points</div>
            <div className="text-white font-semibold">
              {player.total_points}
            </div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Own%</div>
            <div className="text-white font-semibold">
              {parseFloat(player.selected_by_percent).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleToggle}
            className={
              isSelected
                ? "bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm"
                : "bg-fpl-green hover:bg-green-600 text-white px-4 py-2 text-sm"
            }
          >
            {isSelected ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Selected
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
