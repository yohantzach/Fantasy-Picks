import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { api } from '@/lib/api';
import { Trophy, Users, TrendingUp, Star, BarChart3 } from 'lucide-react';
import { PointsBreakdownModal } from '../modals/points-breakdown-modal';

interface Player {
  playerId: number;
  playerName: string;
  position: string;
  points: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  actualPoints: number;
}

interface UserTeam {
  teamId: number;
  teamName: string;
  totalPoints: number;
  rank: number;
  players: Player[];
}

interface TopTeam {
  rank: number;
  teamId: number;
  teamName: string;
  userName: string;
  totalPoints: number;
}

interface EnhancedLeaderboardData {
  topTeams: TopTeam[];
  userTeams: UserTeam[];
  gameweekId: number;
  totalParticipants: number;
}

export function EnhancedLeaderboard() {
  const [data, setData] = useState<EnhancedLeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserTeam, setSelectedUserTeam] = useState<UserTeam | null>(null);
  const [gameweekId, setGameweekId] = useState<number | null>(null);
  
  // Points breakdown modal state
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [selectedTeamName, setSelectedTeamName] = useState('');

  useEffect(() => {
    fetchCurrentGameweek();
  }, []);

  useEffect(() => {
    if (gameweekId) {
      fetchLeaderboardData(gameweekId);
    }
  }, [gameweekId]);

  const fetchCurrentGameweek = async () => {
    try {
      const response = await api.get('/api/gameweek/current');
      setGameweekId(response.data.id);
    } catch (err) {
      setError('Failed to fetch current gameweek');
      setLoading(false);
    }
  };

  const fetchLeaderboardData = async (gw: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/leaderboard/enhanced/${gw}`);
      
      // Debug: Log the received data to see actual point values
      console.log('🔍 [FRONTEND] Enhanced leaderboard data received:', {
        topTeams: response.data.topTeams?.map((team: any) => ({
          teamName: team.teamName,
          userName: team.userName,
          totalPoints: team.totalPoints,
          rank: team.rank
        })),
        userTeams: response.data.userTeams?.map((team: any) => ({
          teamName: team.teamName,
          totalPoints: team.totalPoints,
          rank: team.rank
        }))
      });
      
      setData(response.data);
      
      // Auto-select first user team if available
      if (response.data.userTeams.length > 0) {
        setSelectedUserTeam(response.data.userTeams[0]);
      }
    } catch (err) {
      setError('Failed to fetch leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamBreakdown = async (teamId: number, teamName: string) => {
    try {
      setBreakdownLoading(true);
      setSelectedTeamName(teamName);
      setIsBreakdownModalOpen(true);
      
      const response = await api.get(`/api/team/${teamId}/scoring-breakdown`);
      setBreakdownData(response.data);
    } catch (err) {
      console.error('Failed to fetch team breakdown:', err);
      setBreakdownData(null);
    } finally {
      setBreakdownLoading(false);
    }
  };

  const getRankDisplay = (rank: number) => {
    if (rank <= 3) {
      const colors = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
      const icons = ['🥇', '🥈', '🥉'];
      return (
        <div className="flex items-center gap-2">
          <span className="text-xl">{icons[rank - 1]}</span>
          <span className={`font-bold ${colors[rank - 1]}`}>#{rank}</span>
        </div>
      );
    }
    return <span className="font-medium">#{rank}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">No data available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card border-white/20 hover:bg-white/15 transition-colors">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-2">
              <TrendingUp className="h-8 w-8 text-fpl-green mx-auto" />
              <div>
                <p className="text-sm text-white/60">Your Teams</p>
                <p className="text-2xl font-bold text-white">{data.userTeams.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card border-white/20 hover:bg-white/15 transition-colors">
          <CardContent className="pt-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-2">
              <Trophy className="h-8 w-8 text-fpl-green mx-auto" />
              <div>
                <p className="text-sm text-white/60">Best Rank</p>
                <p className="text-2xl font-bold text-white">
                  {data.userTeams.length > 0 
                    ? Math.min(...data.userTeams.map(t => t.rank))
                    : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Leaderboard */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Trophy className="h-5 w-5 text-fpl-green" />
              Top 10 Leaderboard
            </CardTitle>
            <CardDescription className="text-white/60">
              Best performing teams this gameweek
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topTeams.map((team) => (
                <div
                  key={team.teamId}
                  className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border transition-all hover:scale-[1.02] ${
                    team.rank <= 3 
                      ? team.rank === 1 
                        ? 'bg-gradient-to-r from-yellow-400/20 to-yellow-600/20 border-yellow-400/30'
                        : team.rank === 2
                        ? 'bg-gradient-to-r from-gray-300/20 to-gray-500/20 border-gray-400/30'
                        : 'bg-gradient-to-r from-orange-400/20 to-orange-600/20 border-orange-400/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {getRankDisplay(team.rank)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white text-sm sm:text-base truncate">{team.teamName}</p>
                      <p className="text-xs sm:text-sm text-white/60 truncate">by {team.userName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchTeamBreakdown(team.teamId, `${team.teamName} (${team.userName})`)}
                      className="text-white/70 hover:text-white hover:bg-white/10 p-2"
                      title="View detailed breakdown"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Badge variant="outline" className={`font-bold text-xs sm:text-sm flex-shrink-0 ${
                      team.rank === 1 ? 'border-fpl-green text-fpl-green bg-fpl-green/10' : 'border-white/40 text-white'
                    }`}>
                      {team.totalPoints} pts
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Teams */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Star className="h-5 w-5 text-fpl-green" />
              Your Teams
            </CardTitle>
            <CardDescription className="text-white/60">
              Your teams' performance this gameweek
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.userTeams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/60">No teams created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.userTeams.map((team) => (
                  <div
                    key={team.teamId}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedUserTeam?.teamId === team.teamId
                        ? 'bg-fpl-green/20 border-fpl-green/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedUserTeam(team)}
                      >
                        <p className="font-medium text-white">{team.teamName}</p>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <span>Rank: #{team.rank}</span>
                          <span>•</span>
                          <span>{team.totalPoints} pts</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchTeamBreakdown(team.teamId, team.teamName)}
                          className="text-white/70 hover:text-white hover:bg-white/10 p-2"
                          title="View detailed breakdown"
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Badge variant="outline" className={`${
                          team.rank <= 10 
                            ? 'border-fpl-green text-fpl-green bg-fpl-green/10'
                            : 'border-white/40 text-white'
                        }`}>
                          {team.rank <= 10 ? 'Top 10' : `#${team.rank}`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Details */}
      {selectedUserTeam && (
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="text-white">{selectedUserTeam.teamName} - Squad Breakdown</CardTitle>
            <CardDescription className="text-white/60">
              Detailed scoring for your selected team (Rank: #{selectedUserTeam.rank})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Team Summary */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-fpl-green/20 to-blue-500/20 rounded-lg border border-fpl-green/30">
                <div>
                  <p className="text-lg font-bold text-white">Total Points: {selectedUserTeam.totalPoints}</p>
                  <p className="text-sm text-white/60">
                    Rank: #{selectedUserTeam.rank} of {data.totalParticipants}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/60">
                    Top {Math.round((selectedUserTeam.rank / data.totalParticipants) * 100)}%
                  </p>
                </div>
              </div>

              {/* Players List */}
              <div className="space-y-2">
                <h4 className="font-medium text-white">Squad Performance</h4>
                {selectedUserTeam.players.map((player) => (
                  <div
                    key={player.playerId}
                    className={`flex items-center justify-between p-3 rounded border transition-colors ${
                      player.isCaptain 
                        ? 'bg-yellow-500/20 border-yellow-400/40' 
                        : player.isViceCaptain 
                        ? 'bg-blue-500/20 border-blue-400/40' 
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="text-xs border-white/40 text-white">
                        {player.position}
                      </Badge>
                      <div>
                        <p className="font-medium flex items-center gap-1 text-white">
                          {player.playerName}
                          {player.isCaptain && (
                            <Badge className="bg-yellow-500 text-black text-xs">C</Badge>
                          )}
                          {player.isViceCaptain && (
                            <Badge className="bg-blue-500 text-white text-xs">VC</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">{player.actualPoints} pts</p>
                      {player.isCaptain && player.points > 0 && (
                        <p className="text-xs text-white/60">
                          ({player.points} × 2)
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Points Breakdown Modal */}
      <PointsBreakdownModal
        isOpen={isBreakdownModalOpen}
        onClose={() => {
          setIsBreakdownModalOpen(false);
          setBreakdownData(null);
          setSelectedTeamName('');
        }}
        teamBreakdown={breakdownData}
        loading={breakdownLoading}
        userName={selectedTeamName}
      />
    </div>
  );
}
