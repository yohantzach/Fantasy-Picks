import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Star, User, Clock, ChevronDown, ChevronUp, Target, Award, Shield, AlertTriangle } from 'lucide-react';

interface PlayerBreakdown {
  playerId: number;
  playerName: string;
  position: string;
  basePoints: number;
  captainBonus: number;
  totalPoints: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  stats?: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
  };
  pointBreakdown?: Array<{
    category: string;
    value: number;
    points: number;
    description: string;
  }>;
}

interface TeamBreakdown {
  teamId: number;
  teamName: string;
  gameweekNumber: number;
  totalPoints: number;
  captain?: PlayerBreakdown;
  viceCaptain?: PlayerBreakdown;
  players: PlayerBreakdown[];
}

interface PointsBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamBreakdown: TeamBreakdown | null;
  loading: boolean;
  userName?: string;
}

export function PointsBreakdownModal({ 
  isOpen, 
  onClose, 
  teamBreakdown, 
  loading,
  userName = "Manager"
}: PointsBreakdownModalProps) {
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);
  
  if (!teamBreakdown && !loading) return null;

  const getStatIcon = (category: string) => {
    switch (category) {
      case 'Goals scored': return <Target className="h-4 w-4 text-green-600" />;
      case 'Assists': return <Award className="h-4 w-4 text-blue-600" />;
      case 'Clean sheets': return <Shield className="h-4 w-4 text-cyan-600" />;
      case 'Bonus points': return <Star className="h-4 w-4 text-yellow-600" />;
      case 'Minutes played': return <Clock className="h-4 w-4 text-gray-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'GKP': return 'bg-yellow-500/20 text-yellow-700 border-yellow-300';
      case 'DEF': return 'bg-green-500/20 text-green-700 border-green-300';
      case 'MID': return 'bg-blue-500/20 text-blue-700 border-blue-300';
      case 'FWD': return 'bg-red-500/20 text-red-700 border-red-300';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-300';
    }
  };

  const groupedPlayers = teamBreakdown?.players.reduce((acc, player) => {
    if (!acc[player.position]) acc[player.position] = [];
    acc[player.position].push(player);
    return acc;
  }, {} as Record<string, PlayerBreakdown[]>) || {};

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Trophy className="h-5 w-5 text-fpl-green" />
            Points Breakdown - {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fpl-green"></div>
          </div>
        ) : teamBreakdown ? (
          <div className="space-y-4">
            {/* Team Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between text-gray-900 dark:text-gray-100">
                  <span>{teamBreakdown.teamName}</span>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-fpl-green">
                      {teamBreakdown.totalPoints}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      GW{teamBreakdown.gameweekNumber} Points
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4">
                  {teamBreakdown.captain && (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        <strong>Captain:</strong> {teamBreakdown.captain.playerName}
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        {teamBreakdown.captain.totalPoints}pts
                      </Badge>
                    </div>
                  )}
                  {teamBreakdown.viceCaptain && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        <strong>Vice:</strong> {teamBreakdown.viceCaptain.playerName}
                      </span>
                      <Badge variant="outline" className="ml-auto">
                        {teamBreakdown.viceCaptain.totalPoints}pts
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Players by Position */}
            {['GKP', 'DEF', 'MID', 'FWD'].map(position => {
              const positionPlayers = groupedPlayers[position] || [];
              
              return (
                <Card key={position}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-gray-900 dark:text-gray-100">
                      <Badge className={getPositionColor(position)}>
                        {position}
                      </Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        ({positionPlayers.length} players)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {positionPlayers.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No {position} players selected
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {positionPlayers.map(player => (
                          <div key={player.playerId}>
                            <div 
                              className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              onClick={() => setExpandedPlayer(expandedPlayer === player.playerId ? null : player.playerId)}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{player.playerName}</span>
                                {player.isCaptain && (
                                  <Star className="h-4 w-4 text-yellow-500" />
                                )}
                                {player.isViceCaptain && (
                                  <User className="h-4 w-4 text-blue-500" />
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-1 h-6 w-6"
                                >
                                  {expandedPlayer === player.playerId ? (
                                    <ChevronUp className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-gray-700 dark:text-gray-300" />
                                  )}
                                </Button>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-fpl-green">
                                  {player.totalPoints}pts
                                </div>
                                {player.isCaptain && player.captainBonus > 0 && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {player.basePoints} + {player.captainBonus} (C)
                                  </div>
                                )}
                                {!player.isCaptain && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400">
                                    {player.stats && player.stats.minutes === 0 ? "Not yet played" : "Base points"}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Detailed breakdown when expanded */}
                            {expandedPlayer === player.playerId && (
                              <div className="mt-2 ml-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                                <div className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                                  Points Breakdown
                                </div>
                                
                                {/* Check if player has played */}
                                {!player.stats || player.stats.minutes === 0 ? (
                                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-700 text-center">
                                    <div className="text-orange-700 dark:text-orange-300 font-medium mb-1">
                                      🚀 Not Yet Played
                                    </div>
                                    <div className="text-sm text-orange-600 dark:text-orange-400">
                                      This player's match hasn't started yet or they didn't play
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {/* Game stats summary */}
                                    <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded border">
                                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Game Stats</div>
                                      <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="text-center">
                                          <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.minutes}'</div>
                                          <div className="text-gray-500">Minutes</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.goals_scored}</div>
                                          <div className="text-gray-500">Goals</div>
                                        </div>
                                        <div className="text-center">
                                          <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.assists}</div>
                                          <div className="text-gray-500">Assists</div>
                                        </div>
                                        {player.position === 'GKP' && (
                                          <>
                                            <div className="text-center">
                                              <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.saves}</div>
                                              <div className="text-gray-500">Saves</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.penalties_saved}</div>
                                              <div className="text-gray-500">Pen Saved</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.clean_sheets}</div>
                                              <div className="text-gray-500">Clean Sheets</div>
                                            </div>
                                          </>
                                        )}
                                        {(player.position === 'DEF' || player.position === 'GKP') && (
                                          <div className="text-center">
                                            <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.goals_conceded}</div>
                                            <div className="text-gray-500">Goals Conceded</div>
                                          </div>
                                        )}
                                        {player.stats.yellow_cards > 0 && (
                                          <div className="text-center">
                                            <div className="font-semibold text-yellow-600">{player.stats.yellow_cards}</div>
                                            <div className="text-gray-500">Yellow</div>
                                          </div>
                                        )}
                                        {player.stats.red_cards > 0 && (
                                          <div className="text-center">
                                            <div className="font-semibold text-red-600">{player.stats.red_cards}</div>
                                            <div className="text-gray-500">Red</div>
                                          </div>
                                        )}
                                        <div className="text-center">
                                          <div className="font-semibold text-gray-900 dark:text-gray-100">{player.stats.bonus}</div>
                                          <div className="text-gray-500">Bonus</div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Points breakdown */}
                                    {player.pointBreakdown && player.pointBreakdown.length > 0 ? (
                                      <div className="space-y-2">
                                        {player.pointBreakdown.map((breakdown, index) => (
                                          <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                                            <div className="flex items-center gap-2">
                                              {getStatIcon(breakdown.category)}
                                              <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{breakdown.category}</div>
                                                <div className="text-xs text-gray-500">{breakdown.description}</div>
                                              </div>
                                            </div>
                                            <div className={`text-sm font-bold ${breakdown.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {breakdown.points >= 0 ? '+' : ''}{breakdown.points}
                                            </div>
                                          </div>
                                        ))}
                                        
                                        {/* Captain bonus */}
                                        {player.isCaptain && player.captainBonus > 0 && (
                                          <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-700">
                                            <div className="flex items-center gap-2">
                                              <Star className="h-4 w-4 text-yellow-600" />
                                              <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Captain Bonus</div>
                                                <div className="text-xs text-gray-500">Points doubled for captain</div>
                                              </div>
                                            </div>
                                            <div className="text-sm font-bold text-yellow-600">
                                              +{player.captainBonus}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-500 italic">
                                        No points earned this gameweek
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Last Updated Info */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Points update daily after matches</span>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            No breakdown data available
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
