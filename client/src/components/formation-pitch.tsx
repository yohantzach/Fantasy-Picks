import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FPLPlayer } from "@shared/schema";

interface FormationPitchProps {
  selectedPlayers: number[];
  players: FPLPlayer[];
  onPositionClick: (elementType: number) => void;
  onPlayerClick?: (playerId: number, elementType: number) => void;
  captainId?: number | null;
  viceCaptainId?: number | null;
  fplTeams?: any[];
  formation?: string;
}

export function FormationPitch({ 
  selectedPlayers, 
  players, 
  onPositionClick, 
  captainId, 
  viceCaptainId,
  formation = "4-4-2" 
}: FormationPitchProps) {
  
  const getPlayersByPosition = (elementType: number) => {
    const mappedPlayers = selectedPlayers.map(id => {
      const found = players.find(p => p.id === id);
      return found;
    });
    
    const filteredByPosition = mappedPlayers
      .filter(p => p && p.element_type === elementType)
      .filter(Boolean) as FPLPlayer[];
    
    // Additional safeguard: Never return more players than formation allows
    const maxAllowed = getPositionSlots(elementType);
    if (filteredByPosition.length > maxAllowed) {
      console.warn(`Formation violation detected: ${filteredByPosition.length} players in position ${elementType}, max allowed: ${maxAllowed}`);
      return filteredByPosition.slice(0, maxAllowed);
    }
    
    return filteredByPosition;
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

  const getFormationSlots = (formation: string) => {
    const [def, mid, fwd] = formation.split('-').map(Number);
    return {
      1: 1,   // Always 1 GK
      2: def, // Defenders
      3: mid, // Midfielders  
      4: fwd  // Forwards
    };
  };

  const formationSlots = getFormationSlots(formation);

  const getPositionSlots = (elementType: number) => {
    return formationSlots[elementType as keyof typeof formationSlots] || 0;
  };

  const PositionRow = ({ elementType }: { elementType: number }) => {
    const positionPlayers = getPlayersByPosition(elementType);
    const totalSlots = getPositionSlots(elementType);
    const emptySlots = Math.max(0, totalSlots - positionPlayers.length);

    return (
      <div className="flex justify-center gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6 lg:mb-8">
        {/* Show selected players */}
        {positionPlayers.map((player) => (
          <div key={player.id} className="relative">
            <Card 
              className="player-card-responsive interactive focus-ring"
              onClick={() => onPositionClick(elementType)}
            >
              <CardContent className="p-0.5 sm:p-1 text-center h-full flex flex-col justify-between">
                {/* Price on top */}
                <div className="text-xs font-bold text-fpl-green">
                  £{(player.custom_price || player.now_cost / 10).toFixed(1)}m
                </div>
                
                {/* Player name in middle */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-xs font-semibold text-white truncate px-0.5 leading-tight">
                    {player.web_name}
                  </div>
                </div>
                
                {/* Fixture at bottom */}
                <div className="text-xs text-gray-300 font-medium">
                  {player.next_opponent || 'TBD'}
                </div>
              </CardContent>
            </Card>
            {/* Captain/Vice-Captain indicators */}
            {captainId === player.id && (
              <div className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs w-5 h-5 rounded-full font-bold flex items-center justify-center">
                C
              </div>
            )}
            {viceCaptainId === player.id && (
              <div className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs w-5 h-5 rounded-full font-bold flex items-center justify-center">
                VC
              </div>
            )}
          </div>
        ))}
        
        {/* Show empty slots */}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <Card 
            key={`empty-${elementType}-${index}`}
            className="player-card-responsive border-dashed border-2 border-gray-500 hover:border-fpl-green bg-gray-800/50 interactive focus-ring"
            onClick={() => onPositionClick(elementType)}
          >
            <CardContent className="p-0.5 sm:p-1 text-center h-full flex flex-col justify-center">
              <div className="text-gray-300 text-xs font-medium">
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
      {/* Mobile-Optimized Green Pitch Background */}
      <div className="bg-gradient-to-b from-green-500 to-green-600 rounded-lg p-3 sm:p-6 lg:p-8 min-h-[400px] sm:min-h-[450px] lg:min-h-[500px] relative overflow-hidden">
        
        {/* Formation Layout */}
        <div className="relative z-10 pt-2 sm:pt-3 lg:pt-4">
          {/* Forwards */}
          <PositionRow elementType={4} />
          
          {/* Midfielders */}
          <PositionRow elementType={3} />
          
          {/* Defenders */}
          <PositionRow elementType={2} />
          
          {/* Goalkeeper */}
          <div className="flex justify-center">
            <div className="flex gap-2 sm:gap-3 lg:gap-4">
              <PositionRow elementType={1} />
            </div>
          </div>
        </div>
        
        {/* Mobile-Optimized Formation Info */}
        <div className="absolute top-2 left-2 bg-fpl-green/80 backdrop-blur-sm rounded px-2 py-1 text-white shadow-sm">
          <span className="text-xs font-medium">
            Selected: {selectedPlayers.length}/11
          </span>
        </div>
      </div>
    </div>
  );
}