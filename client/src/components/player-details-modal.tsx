import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Star, 
  TrendingUp, 
  Clock, 
  Target, 
  Activity, 
  DollarSign,
  Shield,
  Calendar,
  BarChart3,
  Zap
} from "lucide-react";

interface PlayerDetailsModalProps {
  player: any;
  team: any;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (player: any) => void;
  showSelectButton?: boolean;
  position: string;
}

export function PlayerDetailsModal({ 
  player, 
  team, 
  isOpen, 
  onClose, 
  onSelect,
  showSelectButton = false,
  position 
}: PlayerDetailsModalProps) {
  if (!player || !team) return null;

  const handleSelect = () => {
    if (onSelect) {
      onSelect(player);
    }
    onClose();
  };

  const getPositionBadgeColor = (pos: string) => {
    switch (pos) {
      case 'GKP': return 'bg-yellow-500';
      case 'DEF': return 'bg-green-500';
      case 'MID': return 'bg-blue-500';
      case 'FWD': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getFormColor = (form: number) => {
    if (form >= 7) return 'text-green-400';
    if (form >= 5) return 'text-yellow-400';
    if (form >= 3) return 'text-orange-400';
    return 'text-red-400';
  };

  const statsData = [
    { label: 'Total Points', value: player.total_points, icon: Star },
    { label: 'Goals', value: player.goals_scored, icon: Target },
    { label: 'Assists', value: player.assists, icon: Activity },
    { label: 'Clean Sheets', value: player.clean_sheets, icon: Shield },
    { label: 'Minutes', value: player.minutes, icon: Clock },
    { label: 'Bonus Points', value: player.bonus, icon: Zap },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-600 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {player.web_name.charAt(0)}
                  </span>
                </div>
                <Badge 
                  className={`absolute -bottom-1 -right-1 ${getPositionBadgeColor(position)} text-white text-xs px-2 py-1`}
                >
                  {position}
                </Badge>
              </div>
              <div>
                <div className="text-xl">{player.web_name}</div>
                <div className="text-base text-slate-300 font-normal">
                  {player.first_name} {player.second_name}
                </div>
              </div>
            </DialogTitle>
            <div className="text-right">
              <div className="text-2xl font-bold text-fpl-green">
                £{(player.now_cost / 10).toFixed(1)}m
              </div>
              <div className="text-sm text-slate-400">
                Selected: {player.selected_by_percent}%
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              <Calendar className="w-4 h-4 mr-1" />
              {team.name}
            </Badge>
            <Badge 
              variant="outline" 
              className={`border-slate-600 ${getFormColor(parseFloat(player.form))}`}
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              Form: {player.form}
            </Badge>
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              <DollarSign className="w-4 h-4 mr-1" />
              PPG: {player.points_per_game}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Key Stats Grid */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-fpl-green" />
              Season Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {statsData.map((stat, index) => (
                <Card key={index} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className="w-4 h-4 text-fpl-green" />
                      <span className="text-xs text-slate-400">{stat.label}</span>
                    </div>
                    <div className="text-xl font-bold text-white">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Performance Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Performance Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">ICT Index</span>
                <span className="text-white font-semibold">{player.ict_index}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Influence</span>
                <span className="text-white font-semibold">{player.influence}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Creativity</span>
                <span className="text-white font-semibold">{player.creativity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Threat</span>
                <span className="text-white font-semibold">{player.threat}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Expected Goals (xG)</span>
                <span className="text-white font-semibold">{player.expected_goals}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Expected Assists (xA)</span>
                <span className="text-white font-semibold">{player.expected_assists}</span>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Additional Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Additional Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 text-sm">Transfers In GW</span>
                <div className="text-white font-semibold">{player.transfers_in_event}</div>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Transfers Out GW</span>
                <div className="text-white font-semibold">{player.transfers_out_event}</div>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Dreamteam Count</span>
                <div className="text-white font-semibold">{player.dreamteam_count}</div>
              </div>
              <div>
                <span className="text-slate-400 text-sm">Value Season</span>
                <div className="text-white font-semibold">{player.value_season}</div>
              </div>
            </div>
          </div>

          {showSelectButton && (
            <div className="pt-4">
              <Button 
                onClick={handleSelect}
                className="w-full bg-fpl-green hover:bg-fpl-green/90 text-white font-semibold py-3"
                size="lg"
              >
                Select {player.web_name} for {position}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}