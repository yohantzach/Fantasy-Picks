import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TooltipHover } from "@/components/ui/tooltip-hover";
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
  Zap,
  Crown,
  RefreshCw,
  X
} from "lucide-react";

interface Player {
  id: number;
  web_name: string;
  team_name: string;
  position_name: string;
  price_formatted: string;
  total_points: number;
  now_cost: number;
  element_type: number;
  team: number;
  goals_scored?: number;
  assists?: number;
  clean_sheets?: number;
  minutes?: number;
  bonus?: number;
  form?: string;
  selected_by_percent?: string;
  points_per_game?: string;
}

interface PlayerStatsModalProps {
  player: Player;
  isOpen: boolean;
  onClose: () => void;
  onReplace: (player: Player) => void;
  onMakeCaptain: (player: Player) => void;
  onMakeViceCaptain: (player: Player) => void;
  onRemoveCaptain: (player: Player) => void;
  onRemoveViceCaptain: (player: Player) => void;
  showCaptainOption: boolean;
  showViceCaptainOption: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export function PlayerStatsModal({ 
  player, 
  isOpen, 
  onClose, 
  onReplace,
  onMakeCaptain,
  onMakeViceCaptain,
  onRemoveCaptain,
  onRemoveViceCaptain,
  showCaptainOption,
  showViceCaptainOption,
  isCaptain,
  isViceCaptain
}: PlayerStatsModalProps) {
  if (!player) return null;

  const getPositionBadgeColor = (pos: string) => {
    switch (pos) {
      case 'GKP': return 'bg-yellow-500';
      case 'DEF': return 'bg-green-500';
      case 'MID': return 'bg-blue-500';
      case 'FWD': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getFormColor = (form: string) => {
    const formNum = parseFloat(form || "0");
    if (formNum >= 7) return 'text-green-400';
    if (formNum >= 5) return 'text-yellow-400';
    if (formNum >= 3) return 'text-orange-400';
    return 'text-red-400';
  };

  const statsData = [
    { label: 'Total Points', value: player.total_points, icon: Star },
    { label: 'Goals', value: player.goals_scored || 0, icon: Target },
    { label: 'Assists', value: player.assists || 0, icon: Activity },
    { label: 'Clean Sheets', value: player.clean_sheets || 0, icon: Shield },
    { label: 'Minutes', value: player.minutes || 0, icon: Clock },
    { label: 'Bonus Points', value: player.bonus || 0, icon: Zap },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 border-purple-500/30 text-white">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute -top-2 -right-2 text-white/60 hover:text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-2xl font-bold text-white">
            Player Statistics
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Player Header */}
          <div className="flex items-center space-x-4 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h3 className="text-2xl font-bold text-white">{player.web_name}</h3>
                {isCaptain && <Crown className="h-6 w-6 text-yellow-400" />}
                {isViceCaptain && <Shield className="h-6 w-6 text-gray-400" />}
              </div>
              <div className="flex items-center space-x-3 mt-2">
                <Badge className={`${getPositionBadgeColor(player.position_name)} text-white`}>
                  {player.position_name}
                </Badge>
                <span className="text-gray-300">{player.team_name}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-fpl-green">
                £{player.price_formatted}m
              </div>
              <div className="text-sm text-gray-300">Price</div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-white">{player.total_points}</div>
                <div className="text-xs text-gray-300">Total Points</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-3 text-center">
                <div className={`text-xl font-bold ${getFormColor(player.form || "0")}`}>
                  {player.form || "0.0"}
                </div>
                <div className="text-xs text-gray-300">Form</div>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-3 text-center">
                <TooltipHover content="Points Per Game">
                  <div className="cursor-help">
                    <div className="text-xl font-bold text-white">
                      {player.points_per_game || "0.0"}
                    </div>
                    <div className="text-xs text-gray-300">PPG</div>
                  </div>
                </TooltipHover>
              </CardContent>
            </Card>
            <Card className="bg-white/10 border-white/20">
              <CardContent className="p-3 text-center">
                <div className="text-xl font-bold text-white">
                  {player.selected_by_percent || "0"}%
                </div>
                <div className="text-xs text-gray-300">Selected By</div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-2 gap-4">
            {statsData.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div key={index} className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
                  <div className="p-2 bg-fpl-green/20 rounded-lg">
                    <IconComponent className="h-4 w-4 text-fpl-green" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white">{stat.value}</div>
                    <div className="text-xs text-gray-400">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="bg-white/20" />

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => onReplace(player)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Replace Player
            </Button>
            
            {showCaptainOption && (
              <Button
                onClick={() => onMakeCaptain(player)}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Crown className="h-4 w-4 mr-2" />
                Make Captain
              </Button>
            )}
            
            {showViceCaptainOption && (
              <Button
                onClick={() => onMakeViceCaptain(player)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white"
              >
                <Shield className="h-4 w-4 mr-2" />
                Make Vice Captain
              </Button>
            )}
            
            {isCaptain && (
              <Button
                onClick={() => onRemoveCaptain(player)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Captain
              </Button>
            )}
            
            {isViceCaptain && (
              <Button
                onClick={() => onRemoveViceCaptain(player)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Vice Captain
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}