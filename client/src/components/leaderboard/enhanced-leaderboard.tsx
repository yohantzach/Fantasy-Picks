import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { api } from '@/lib/api';
import { Trophy, Users, TrendingUp, Star } from 'lucide-react';

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Players</p>
                <p className="text-2xl font-bold">{data.totalParticipants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Your Teams</p>
                <p className="text-2xl font-bold">{data.userTeams.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Best Rank</p>
                <p className="text-2xl font-bold">
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Top 10 Leaderboard
            </CardTitle>
            <CardDescription>
              Best performing teams this gameweek
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topTeams.map((team) => (
                <div
                  key={team.teamId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    team.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {getRankDisplay(team.rank)}
                    <div>
                      <p className="font-medium">{team.teamName}</p>
                      <p className="text-sm text-gray-600">by {team.userName}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-bold">
                    {team.totalPoints} pts
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* User Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-blue-600" />
              Your Teams
            </CardTitle>
            <CardDescription>
              Your teams' performance this gameweek
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.userTeams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No teams created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.userTeams.map((team) => (
                  <div
                    key={team.teamId}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedUserTeam?.teamId === team.teamId
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedUserTeam(team)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{team.teamName}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>Rank: #{team.rank}</span>
                          <span>•</span>
                          <span>{team.totalPoints} pts</span>
                        </div>
                      </div>
                      <Badge variant={team.rank <= 10 ? 'default' : 'secondary'}>
                        {team.rank <= 10 ? 'Top 10' : `#${team.rank}`}
                      </Badge>
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
        <Card>
          <CardHeader>
            <CardTitle>{selectedUserTeam.teamName} - Squad Breakdown</CardTitle>
            <CardDescription>
              Detailed scoring for your selected team (Rank: #{selectedUserTeam.rank})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Team Summary */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
                <div>
                  <p className="text-lg font-bold">Total Points: {selectedUserTeam.totalPoints}</p>
                  <p className="text-sm text-gray-600">
                    Rank: #{selectedUserTeam.rank} of {data.totalParticipants}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    Top {Math.round((selectedUserTeam.rank / data.totalParticipants) * 100)}%
                  </p>
                </div>
              </div>

              {/* Players List */}
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Squad Performance</h4>
                {selectedUserTeam.players.map((player) => (
                  <div
                    key={player.playerId}
                    className={`flex items-center justify-between p-3 rounded border ${
                      player.isCaptain ? 'bg-yellow-50 border-yellow-200' :
                      player.isViceCaptain ? 'bg-blue-50 border-blue-200' :
                      'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="text-xs">
                        {player.position}
                      </Badge>
                      <div>
                        <p className="font-medium flex items-center gap-1">
                          {player.playerName}
                          {player.isCaptain && (
                            <Badge className="bg-yellow-500 text-xs">C</Badge>
                          )}
                          {player.isViceCaptain && (
                            <Badge variant="secondary" className="text-xs">VC</Badge>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{player.actualPoints} pts</p>
                      {player.isCaptain && player.points > 0 && (
                        <p className="text-xs text-gray-600">
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
    </div>
  );
}
