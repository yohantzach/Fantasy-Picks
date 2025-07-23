import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

type FPLPlayer = {
  id: number;
  web_name: string;
  position_name: string;
  price_formatted: string;
  team_short_name: string;
};

type FormationPitchProps = {
  selectedPlayers: FPLPlayer[];
  formation: string;
  onFormationChange: (formation: string) => void;
};

const formations = ["4-4-2", "4-3-3", "3-5-2", "5-4-1", "5-3-2", "4-5-1"];

const getFormationLayout = (formation: string) => {
  const [def, mid, fwd] = formation.split("-").map(Number);
  return { defenders: def, midfielders: mid, forwards: fwd };
};

const getPlayersByPosition = (players: FPLPlayer[]) => {
  return {
    goalkeepers: players.filter(p => p.position_name === "GKP"),
    defenders: players.filter(p => p.position_name === "DEF"),
    midfielders: players.filter(p => p.position_name === "MID"),
    forwards: players.filter(p => p.position_name === "FWD"),
  };
};

const PlayerSlot = ({ player, position }: { player?: FPLPlayer; position: string }) => {
  if (player) {
    return (
      <div className="w-16 h-20 bg-gradient-to-b from-fpl-green to-green-600 rounded-lg flex flex-col items-center justify-center text-xs font-bold text-white shadow-lg border-2 border-white/30">
        <div className="text-[10px] opacity-80">{player.position_name}</div>
        <div className="text-center leading-tight">{player.web_name}</div>
        <div className="text-[10px] opacity-80">£{player.price_formatted}</div>
      </div>
    );
  }

  return (
    <div className="w-16 h-20 border-2 border-dashed border-white/30 rounded-lg flex flex-col items-center justify-center text-xs text-white/50 hover:border-white/50 transition-colors cursor-pointer">
      <Plus className="h-6 w-6 mb-1" />
      <div className="text-center">Add {position}</div>
    </div>
  );
};

export default function FormationPitch({ selectedPlayers, formation, onFormationChange }: FormationPitchProps) {
  const layout = getFormationLayout(formation);
  const playersByPosition = getPlayersByPosition(selectedPlayers);

  return (
    <Card className="glass-card border-white/20">
      <CardContent className="p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Your Team Formation</h3>
        
        {/* Pitch */}
        <div className="formation-pitch rounded-lg p-8 relative h-96 bg-gradient-to-b from-green-800 via-green-700 to-green-800">
          {/* Pitch lines */}
          <div className="absolute inset-0 bg-gradient-to-b from-green-800 via-green-700 to-green-800 rounded-lg">
            <div className="absolute inset-x-0 top-0 h-px bg-white/20"></div>
            <div className="absolute inset-x-0 bottom-0 h-px bg-white/20"></div>
            <div className="absolute inset-y-0 left-0 w-px bg-white/20"></div>
            <div className="absolute inset-y-0 right-0 w-px bg-white/20"></div>
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/20"></div>
            
            {/* Center circle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-white/20 rounded-full"></div>
          </div>

          {/* Goalkeeper */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <PlayerSlot player={playersByPosition.goalkeepers[0]} position="GKP" />
          </div>

          {/* Defenders */}
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-4" 
               style={{ transform: `translateX(-${(layout.defenders * 68) / 2}px) translateY(-50px)` }}>
            {Array.from({ length: layout.defenders }).map((_, i) => (
              <div key={`def-${i}`}>
                <PlayerSlot player={playersByPosition.defenders[i]} position="DEF" />
              </div>
            ))}
          </div>

          {/* Midfielders */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-4"
               style={{ transform: `translateX(-${(layout.midfielders * 68) / 2}px) translateY(-50%)` }}>
            {Array.from({ length: layout.midfielders }).map((_, i) => (
              <div key={`mid-${i}`}>
                <PlayerSlot player={playersByPosition.midfielders[i]} position="MID" />
              </div>
            ))}
          </div>

          {/* Forwards */}
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex gap-4"
               style={{ transform: `translateX(-${(layout.forwards * 68) / 2}px) translateY(0px)` }}>
            {Array.from({ length: layout.forwards }).map((_, i) => (
              <div key={`fwd-${i}`}>
                <PlayerSlot player={playersByPosition.forwards[i]} position="FWD" />
              </div>
            ))}
          </div>
        </div>

        {/* Formation Selector */}
        <div className="mt-6">
          <h4 className="text-white text-sm font-medium mb-3">Select Formation</h4>
          <div className="flex flex-wrap gap-2">
            {formations.map((f) => (
              <Button
                key={f}
                variant={formation === f ? "default" : "outline"}
                size="sm"
                onClick={() => onFormationChange(f)}
                className={
                  formation === f
                    ? "bg-fpl-green hover:bg-green-600 text-white"
                    : "bg-white/20 border-white/30 text-white hover:bg-white/30"
                }
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        {/* Formation Stats */}
        <div className="mt-4 grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-white/60 text-xs">GKP</div>
            <div className="text-white font-semibold">{playersByPosition.goalkeepers.length}/1</div>
          </div>
          <div>
            <div className="text-white/60 text-xs">DEF</div>
            <div className="text-white font-semibold">{playersByPosition.defenders.length}/{layout.defenders}</div>
          </div>
          <div>
            <div className="text-white/60 text-xs">MID</div>
            <div className="text-white font-semibold">{playersByPosition.midfielders.length}/{layout.midfielders}</div>
          </div>
          <div>
            <div className="text-white/60 text-xs">FWD</div>
            <div className="text-white font-semibold">{playersByPosition.forwards.length}/{layout.forwards}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
