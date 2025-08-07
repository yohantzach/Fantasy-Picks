import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Crown, Shield, Star, Info, Plus } from "lucide-react";
import { FORMATIONS } from "./formation-selector";

interface Player {
  id: number;
  web_name: string;
  first_name?: string;
  second_name?: string;
  team_name: string;
  position_name: string;
  price_formatted: string;
  total_points: number;
  now_cost: number;
  element_type: number;
  team: number;
  next_opponent?: string;
  injury_status?: string;
  availability?: string;
}

interface FootballPitchProps {
  selectedPlayers: Player[];
  formation: string;
  captainId: number | null;
  viceCaptainId: number | null;
  onPlayerRemove: (playerId: number) => void;
  onPlayerInfo: (player: Player) => void;
  onSetCaptain: (playerId: number) => void;
  onSetViceCaptain: (playerId: number) => void;
  onPositionClick: (position: string) => void;
  disabled?: boolean;
}

export function FootballPitch({
  selectedPlayers,
  formation,
  captainId,
  viceCaptainId,
  onPlayerRemove,
  onPlayerInfo,
  onSetCaptain,
  onSetViceCaptain,
  onPositionClick,
  disabled = false,
}: FootballPitchProps) {
  const [showDropdown, setShowDropdown] = useState<number | null>(null);

  const formationConfig = FORMATIONS.find(f => f.name === formation);
  if (!formationConfig) {
    return <div className="text-white">Please select a formation first</div>;
  }

  const getPlayersByPosition = (position: string) => {
    return selectedPlayers.filter(p => p.position_name === position);
  };

  const goalkeepers = getPlayersByPosition("GKP");
  const defenders = getPlayersByPosition("DEF");
  const midfielders = getPlayersByPosition("MID");
  const forwards = getPlayersByPosition("FWD");

  const renderPositionSlots = (
    position: string,
    players: Player[],
    requiredCount: number,
    rowClass: string
  ) => {
    const slots = [];
    
    // Add existing players
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const isCaptain = captainId === player.id;
      const isViceCaptain = viceCaptainId === player.id;
      
      slots.push(
        <div key={player.id} className="relative group">
          <Card 
            className={`
              relative p-3 cursor-pointer transition-all duration-200 min-h-[80px] w-[120px] 
              bg-gradient-to-b from-white/20 to-white/10 border-white/30 
              hover:scale-105 hover:shadow-lg backdrop-blur-sm
              ${isCaptain ? 'ring-2 ring-yellow-400' : ''}
              ${isViceCaptain ? 'ring-2 ring-gray-400' : ''}
            `}
            onClick={() => onPlayerInfo(player)}
          >
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                {isCaptain && <Crown className="h-3 w-3 text-yellow-400 mr-1" />}
                {isViceCaptain && <Shield className="h-3 w-3 text-gray-400 mr-1" />}
                <span className="text-white text-xs font-bold truncate">
                  {player.web_name}
                </span>
              </div>
              <div className="text-[10px] text-gray-300 truncate mb-1">
                {player.first_name} {player.second_name}
              </div>
              <div className="text-xs text-blue-300 truncate font-medium">
                {player.team_name}
              </div>
              <div className="text-[10px] text-orange-300 truncate mb-1">
                Next: vs {player.next_opponent || 'TBD'}
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-fpl-green font-semibold">
                  £{player.price_formatted}m
                </span>
                <span className="text-white/80">
                  {player.total_points}pts
                </span>
              </div>
            </div>
            

          </Card>
        </div>
      );
    }
    
    // Add empty slots
    for (let i = players.length; i < requiredCount; i++) {
      slots.push(
        <Card 
          key={`empty-${position}-${i}`}
          className="p-3 cursor-pointer transition-all duration-200 min-h-[80px] w-[120px] 
                     bg-white/10 border-white/30 border-dashed hover:border-fpl-green 
                     hover:bg-fpl-green/20 backdrop-blur-sm flex items-center justify-center"
          onClick={() => !disabled && onPositionClick(position)}
        >
          <div className="text-center">
            <Plus className="h-6 w-6 text-white/60 mx-auto mb-1" />
            <div className="text-xs text-white/60">Add {position}</div>
          </div>
        </Card>
      );
    }
    
    return (
      <div className={`flex justify-center gap-4 ${rowClass}`}>
        {slots}
      </div>
    );
  };

  return (
    <div 
      className="relative min-h-[600px] p-6 rounded-lg shadow-2xl"
      style={{
        background: `
          radial-gradient(ellipse at center, #228B22 0%, #32CD32 30%, #228B22 60%, #006400 100%),
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 49px,
            rgba(255,255,255,0.15) 49px,
            rgba(255,255,255,0.15) 50px
          )
        `,
        backgroundSize: '100% 100%, 100% 50px',
        boxShadow: 'inset 0 0 50px rgba(0,0,0,0.3)'
      }}
      onClick={() => setShowDropdown(null)}
    >
      {/* Goal */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-2 bg-white/40 rounded-b-lg"></div>
      
      {/* Penalty Area */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -ml-16 w-32 h-12 border-2 border-white/40 border-t-0"></div>
      
      {/* Goal Area */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -ml-8 w-16 h-6 border-2 border-white/40 border-t-0"></div>
      
      {/* Center Circle */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/40 rounded-full"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/40 rounded-full"></div>
      
      {/* Half Line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-white/40"></div>
      
      {/* Players positioned according to formation */}
      <div className="relative z-10 h-full flex flex-col justify-between py-8">
        {/* Forwards */}
        {renderPositionSlots("FWD", forwards, formationConfig.forwards, "mb-8")}
        
        {/* Midfielders */}
        {renderPositionSlots("MID", midfielders, formationConfig.midfielders, "mb-8")}
        
        {/* Defenders */}
        {renderPositionSlots("DEF", defenders, formationConfig.defenders, "mb-8")}
        
        {/* Goalkeeper */}
        {renderPositionSlots("GKP", goalkeepers, 1, "")}
      </div>
      
      {/* Formation Badge */}
      <div className="absolute top-4 right-4">
        <Badge className="bg-fpl-green text-white">
          {formation}
        </Badge>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <Crown className="h-3 w-3 text-yellow-400" />
          <span className="text-white/80">Captain</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3 text-gray-400" />
          <span className="text-white/80">Vice Captain</span>
        </div>
      </div>
    </div>
  );
}