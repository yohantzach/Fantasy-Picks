import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FPLPlayer } from "@shared/schema";

interface PlayerStatsModalProps {
  player: FPLPlayer | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PlayerStatsModal({ player, isOpen, onClose }: PlayerStatsModalProps) {
  if (!player) return null;

  const getPositionName = (elementType: number) => {
    switch (elementType) {
      case 1: return "Goalkeeper";
      case 2: return "Defender";
      case 3: return "Midfielder";
      case 4: return "Forward";
      default: return "Unknown";
    }
  };

  const stats = [
    { label: "Total Points", value: player.total_points },
    { label: "Form", value: player.form },
    { label: "Goals Scored", value: player.goals_scored },
    { label: "Assists", value: player.assists },
    { label: "Clean Sheets", value: player.clean_sheets },
    { label: "Goals Conceded", value: player.goals_conceded },
    { label: "Yellow Cards", value: player.yellow_cards },
    { label: "Red Cards", value: player.red_cards },
    { label: "Saves", value: player.saves },
    { label: "Bonus Points", value: player.bonus },
    { label: "Minutes Played", value: player.minutes },
    { label: "Selected By %", value: `${player.selected_by_percent}%` },
    { label: "Expected Goals", value: player.expected_goals },
    { label: "Expected Assists", value: player.expected_assists },
    { label: "ICT Index", value: player.ict_index },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div>
              <div className="text-xl font-bold">
                {player.first_name} {player.second_name}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="secondary">{getPositionName(player.element_type)}</Badge>
                <span>£{(player.now_cost / 10).toFixed(1)}m</span>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            View detailed player statistics and performance data
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-muted/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-fpl-purple">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600">
                {player.influence}
              </div>
              <div className="text-sm text-muted-foreground">Influence</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {player.creativity}
              </div>
              <div className="text-sm text-muted-foreground">Creativity</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">
                {player.threat}
              </div>
              <div className="text-sm text-muted-foreground">Threat</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}