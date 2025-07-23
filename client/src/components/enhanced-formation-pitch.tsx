import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Info, Star, Shield } from "lucide-react";

interface EnhancedFormationPitchProps {
  selectedPlayers: any[];
  onPositionClick: (position: string) => void;
  onPlayerInfo: (player: any) => void;
  onSetCaptain: (playerId: number) => void;
  onSetViceCaptain: (playerId: number) => void;
  captainId: number | null;
  viceCaptainId: number | null;
  teams: any[];
}

export function EnhancedFormationPitch({
  selectedPlayers,
  onPositionClick,
  onPlayerInfo,
  onSetCaptain,
  onSetViceCaptain,
  captainId,
  viceCaptainId,
  teams
}: EnhancedFormationPitchProps) {
  
  // Get team data for a player
  const getTeamById = (teamId: number) => {
    return teams.find(team => team.id === teamId);
  };

  // Formation structure: 4-4-2 (1 GK, 4 DEF, 4 MID, 2 FWD)
  const formation = {
    GKP: { positions: 1, players: selectedPlayers.filter(p => p.position === 'GKP') },
    DEF: { positions: 4, players: selectedPlayers.filter(p => p.position === 'DEF') },
    MID: { positions: 4, players: selectedPlayers.filter(p => p.position === 'MID') },
    FWD: { positions: 2, players: selectedPlayers.filter(p => p.position === 'FWD') }
  };

  const PlayerSlot = ({ position, index, player }: { position: string; index: number; player?: any }) => {
    const isEmpty = !player;
    const isCaptain = player?.id === captainId;
    const isViceCaptain = player?.id === viceCaptainId;
    
    const getPositionColor = (pos: string) => {
      switch (pos) {
        case 'GKP': return 'from-yellow-500 to-yellow-600 border-yellow-400';
        case 'DEF': return 'from-green-500 to-green-600 border-green-400';
        case 'MID': return 'from-blue-500 to-blue-600 border-blue-400';
        case 'FWD': return 'from-red-500 to-red-600 border-red-400';
        default: return 'from-gray-500 to-gray-600 border-gray-400';
      }
    };

    if (isEmpty) {
      return (
        <div className="flex flex-col items-center space-y-2">
          <Button
            onClick={() => onPositionClick(position)}
            variant="outline"
            className={`w-16 h-16 rounded-full border-2 border-dashed ${getPositionColor(position).split(' ')[2]} bg-white/10 hover:bg-white/20 transition-all duration-200 flex items-center justify-center group`}
          >
            <Plus className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          </Button>
          <Badge 
            variant="outline" 
            className={`${getPositionColor(position).split(' ')[2]} border-opacity-60 text-white text-xs px-2 py-1`}
          >
            {position}
          </Badge>
        </div>
      );
    }

    const team = getTeamById(player.team);

    return (
      <div className="flex flex-col items-center space-y-2 group">
        <div className="relative">
          <div 
            className={`w-16 h-16 rounded-full border-2 bg-gradient-to-br ${getPositionColor(position)} shadow-lg cursor-pointer transition-all duration-200 hover:scale-105 flex items-center justify-center`}
            onClick={() => onPlayerInfo(player)}
          >
            <span className="text-white font-bold text-lg">
              {player.web_name.charAt(0)}
            </span>
            
            {/* Captain/Vice-Captain badges */}
            {isCaptain && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-xs">C</span>
              </div>
            )}
            {isViceCaptain && (
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-xs">V</span>
              </div>
            )}
          </div>
          
          {/* Info button - appears on hover */}
          <Button
            variant="outline"
            size="sm"
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-6 h-6 p-0 bg-white/90 hover:bg-white border-gray-300"
            onClick={(e) => {
              e.stopPropagation();
              onPlayerInfo(player);
            }}
          >
            <Info className="w-3 h-3 text-gray-700" />
          </Button>
        </div>
        
        <div className="text-center">
          <div className="text-white text-xs font-medium truncate max-w-[80px]">
            {player.web_name}
          </div>
          <div className="text-white/60 text-xs">
            {team?.short_name || team?.name}
          </div>
          <div className="text-fpl-green text-xs font-bold">
            £{(player.now_cost / 10).toFixed(1)}m
          </div>
        </div>
        
        {/* Captain selection buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="outline"
            size="sm"
            className={`w-6 h-6 p-0 ${isCaptain ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white border-white/30'}`}
            onClick={() => onSetCaptain(player.id)}
            title="Set as Captain"
          >
            <span className="text-xs font-bold">C</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`w-6 h-6 p-0 ${isViceCaptain ? 'bg-gray-400 text-black' : 'bg-white/20 text-white border-white/30'}`}
            onClick={() => onSetViceCaptain(player.id)}
            title="Set as Vice-Captain"
          >
            <span className="text-xs font-bold">V</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden">
      {/* Enhanced Football Pitch Background */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-green-400 via-green-500 to-green-600"
        style={{
          backgroundImage: `
            linear-gradient(90deg, rgba(255,255,255,0.1) 50%, transparent 50%),
            linear-gradient(rgba(255,255,255,0.1) 50%, transparent 50%)
          `,
          backgroundSize: '20px 20px'
        }}
      >
        {/* Center Circle */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-white/30 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/50 rounded-full"></div>
        
        {/* Goal Areas */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-8 border-4 border-white/30 border-t-0"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-24 h-8 border-4 border-white/30 border-b-0"></div>
        
        {/* Penalty Areas */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-48 h-16 border-4 border-white/20 border-t-0"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-48 h-16 border-4 border-white/20 border-b-0"></div>
        
        {/* Halfway Line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/30"></div>
      </div>

      <CardContent className="relative z-10 p-8">
        <div className="space-y-12">
          {/* Forwards */}
          <div className="flex justify-center">
            <div className="flex space-x-12">
              {Array.from({ length: formation.FWD.positions }).map((_, index) => (
                <PlayerSlot
                  key={`FWD-${index}`}
                  position="FWD"
                  index={index}
                  player={formation.FWD.players[index]}
                />
              ))}
            </div>
          </div>

          {/* Midfielders */}
          <div className="flex justify-center">
            <div className="flex space-x-8">
              {Array.from({ length: formation.MID.positions }).map((_, index) => (
                <PlayerSlot
                  key={`MID-${index}`}
                  position="MID"
                  index={index}
                  player={formation.MID.players[index]}
                />
              ))}
            </div>
          </div>

          {/* Defenders */}
          <div className="flex justify-center">
            <div className="flex space-x-8">
              {Array.from({ length: formation.DEF.positions }).map((_, index) => (
                <PlayerSlot
                  key={`DEF-${index}`}
                  position="DEF"
                  index={index}
                  player={formation.DEF.players[index]}
                />
              ))}
            </div>
          </div>

          {/* Goalkeeper */}
          <div className="flex justify-center">
            <PlayerSlot
              position="GKP"
              index={0}
              player={formation.GKP.players[0]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}