import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FPLPlayer } from "@shared/schema";

interface FormationPitchProps {
  selectedPlayers: number[];
  players: FPLPlayer[];
  onPositionClick: (elementType: number) => void;
  captainId?: number | null;
  viceCaptainId?: number | null;
}

export function FormationPitch({ 
  selectedPlayers, 
  players, 
  onPositionClick, 
  captainId, 
  viceCaptainId 
}: FormationPitchProps) {
  const getPlayersByPosition = (elementType: number) => {
    return selectedPlayers
      .map(id => players.find(p => p.id === id))
      .filter(p => p && p.element_type === elementType)
      .filter(Boolean) as FPLPlayer[];
  };

  const getPositionLabel = (elementType: number) => {
    switch (elementType) {
      case 1: return "GK";
      case 2: return "DEF";
      case 3: return "MID";
      case 4: return "FWD";
      default: return "";
    }
  };

  const getPositionSlots = (elementType: number) => {
    switch (elementType) {
      case 1: return 2; // 2 GK slots
      case 2: return 5; // 5 DEF slots
      case 3: return 5; // 5 MID slots
      case 4: return 3; // 3 FWD slots
      default: return 0;
    }
  };

  const PositionRow = ({ elementType }: { elementType: number }) => {
    const positionPlayers = getPlayersByPosition(elementType);
    const totalSlots = getPositionSlots(elementType);
    const emptySlots = totalSlots - positionPlayers.length;

    return (
      <div className="flex justify-center gap-4 mb-8">
        {/* Show selected players */}
        {positionPlayers.map((player) => (
          <div key={player.id} className="relative">
            <Card 
              className="w-24 h-32 cursor-pointer hover:shadow-md transition-all bg-fpl-green/10 border-fpl-green"
              onClick={() => onPositionClick(elementType)}
            >
              <CardContent className="p-2 text-center h-full flex flex-col justify-between">
                <div>
                  <div className="text-xs font-semibold truncate">
                    {player.web_name}
                  </div>
                  <Badge variant="outline" className="text-xs mt-1">
                    £{(player.now_cost / 10).toFixed(1)}m
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {player.total_points} pts
                </div>
              </CardContent>
            </Card>
            {/* Captain/Vice-Captain indicators */}
            {captainId === player.id && (
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-1 py-0.5 rounded-full font-bold">
                C
              </div>
            )}
            {viceCaptainId === player.id && (
              <div className="absolute -top-2 -right-2 bg-gray-500 text-white text-xs px-1 py-0.5 rounded-full font-bold">
                VC
              </div>
            )}
          </div>
        ))}
        
        {/* Show empty slots */}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <Card 
            key={`empty-${elementType}-${index}`}
            className="w-24 h-32 cursor-pointer hover:shadow-md transition-all border-dashed border-2 border-gray-300 hover:border-fpl-purple"
            onClick={() => onPositionClick(elementType)}
          >
            <CardContent className="p-2 text-center h-full flex flex-col justify-center">
              <div className="text-gray-400 text-xs font-medium">
                + {getPositionLabel(elementType)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Football Pitch Background */}
      <div className="bg-gradient-to-b from-green-400 to-green-500 rounded-lg p-8 min-h-[500px] relative overflow-hidden">
        {/* Pitch lines */}
        <div className="absolute inset-4 border-2 border-white/30 rounded"></div>
        <div className="absolute left-1/2 top-4 bottom-4 w-0.5 bg-white/30 transform -translate-x-0.5"></div>
        <div className="absolute left-1/2 top-1/2 w-16 h-16 border-2 border-white/30 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        
        {/* Formation Layout */}
        <div className="relative z-10 pt-4">
          {/* Forwards */}
          <PositionRow elementType={4} />
          
          {/* Midfielders */}
          <PositionRow elementType={3} />
          
          {/* Defenders */}
          <PositionRow elementType={2} />
          
          {/* Goalkeeper */}
          <div className="flex justify-center">
            <div className="flex gap-4">
              <PositionRow elementType={1} />
            </div>
          </div>
        </div>
        
        {/* Formation Info */}
        <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-sm rounded px-2 py-1">
          <span className="text-white text-xs font-medium">
            Selected: {selectedPlayers.length}/11
          </span>
        </div>
      </div>
    </div>
  );
}