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
      className="relative min-h-[600px] p-6 rounded-lg shadow-2xl bg-gradient-to-b from-green-400 to-green-600"
      onClick={() => setShowDropdown(null)}
    >
      {/* Simple green pitch background with subtle grass pattern */}
      <div className="absolute inset-0 rounded-lg opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 30px,
            rgba(255,255,255,0.1) 30px,
            rgba(255,255,255,0.1) 32px
          )`
        }}></div>
      </div>
      
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
        <Badge className="bg-white/20 text-white border-white/30">
          {formation}
        </Badge>
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 text-xs">
        <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded">
          <Crown className="h-3 w-3 text-yellow-400" />
          <span className="text-white/90">Captain</span>
        </div>
        <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded">
          <Shield className="h-3 w-3 text-gray-400" />
          <span className="text-white/90">Vice Captain</span>
        </div>
      </div>
    </div>
  );
}