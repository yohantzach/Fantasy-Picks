import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/ui/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Users, Calendar, TrendingUp } from "lucide-react";
import { EnhancedLeaderboard } from "@/components/leaderboard/enhanced-leaderboard";
import { useAuth } from '../hooks/use-auth';

type LeaderboardEntry = {
  id: number;
  userId: number;
  teamId: number;
  totalPoints: number;
  rank: number;
  userName: string;
  teamName: string;
};

type PreviousWinner = {
  id: number;
  gameweekId: number;
  userId: number;
  teamId: number;
  totalPoints: number;
  rank: number;
  userName: string;
  teamName: string;
  gameweekNumber: number;
};

export default function Leaderboard() {
  const { user } = useAuth();
  
  // For admin users, show full leaderboard; for normal users, show enhanced leaderboard
  if (user && !user.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
        <Navigation />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
              <Trophy className="h-8 w-8 text-fpl-green" />
              Leaderboard & Your Performance
            </h2>
            <p className="text-white/60">
              View the top 10 overall rankings and detailed breakdown of your teams
            </p>
          </div>
          
          {/* Enhanced Leaderboard Component for Normal Users */}
          <div className="glass-card border-white/20 p-6">
            <EnhancedLeaderboard />
          </div>
        </div>
      </div>
    );
  }
  
  // Fallback for admin users - show the full leaderboard
  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch current gameweek leaderboard
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ["/api/leaderboard", currentGameweek?.id],
    enabled: !!currentGameweek?.id,
  });

  // Fetch previous winners
  const { data: previousWinners = [] } = useQuery({
    queryKey: ["/api/leaderboard/previous-winners"],
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-400" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-orange-400" />;
      default:
        return (
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-white text-sm">
            {rank}
          </div>
        );
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400/20 to-yellow-600/20 border-yellow-400/30";
      case 2:
        return "bg-gradient-to-r from-gray-300/20 to-gray-500/20 border-gray-400/30";
      case 3:
        return "bg-gradient-to-r from-orange-400/20 to-orange-600/20 border-orange-400/30";
      default:
        return "bg-white/5 border-white/10";
    }
  };

  if (leaderboardLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
        <Navigation />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white text-xl">Loading leaderboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <Trophy className="h-8 w-8 text-fpl-green" />
            Gameweek {currentGameweek?.gameweekNumber || "21"} Leaderboard
          </h2>
          <p className="text-white/60">
            {currentGameweek?.isCompleted 
              ? "Weekly Winners - Next gameweek starts soon" 
              : "Live Rankings - Updates after matches"
            }
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass-card border-white/20">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-fpl-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{leaderboard.length}</div>
              <div className="text-white/60 text-sm">Active Managers</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-fpl-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">GW{currentGameweek?.gameweekNumber || "21"}</div>
              <div className="text-white/60 text-sm">Current Gameweek</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 text-fpl-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">
                {leaderboard.length > 0 ? leaderboard[0]?.totalPoints || "TBD" : "TBD"}
              </div>
              <div className="text-white/60 text-sm">Highest Score</div>
            </CardContent>
          </Card>
        </div>

        {/* Current Gameweek Leaderboard */}
        <Card className="glass-card border-white/20 mb-8">
          <CardContent className="p-6">
            <h3 className="text-white text-xl font-semibold mb-6 text-center flex items-center justify-center gap-2">
              <Trophy className="h-6 w-6 text-fpl-green" />
              Top 10 Managers This Week
            </h3>
            
            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((entry: LeaderboardEntry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between rounded-lg p-4 border transition-all hover:scale-[1.02] ${getRankBg(entry.rank)}`}
                  >
                    <div className="flex items-center space-x-4">
                      {getRankIcon(entry.rank)}
                      <div>
                        <div className="text-white font-semibold">{entry.userName}</div>
                        <div className="text-white/60 text-sm">{entry.teamName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-xl ${entry.rank === 1 ? 'text-fpl-green' : 'text-white'}`}>
                        {entry.totalPoints} pts
                      </div>
                      {entry.rank <= 3 && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs mt-1 ${
                            entry.rank === 1 ? 'border-yellow-400 text-yellow-400' :
                            entry.rank === 2 ? 'border-gray-400 text-gray-400' :
                            'border-orange-400 text-orange-400'
                          }`}
                        >
                          Winner
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Trophy className="h-16 w-16 text-white/30 mx-auto mb-4" />
                <div className="text-white/60 text-lg mb-2">
                  {currentGameweek?.isCompleted 
                    ? "No results available yet" 
                    : "Leaderboard will update after matches"}
                </div>
                <p className="text-white/40 text-sm">
                  Points will be calculated based on real Premier League match results
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Previous Winners */}
        {previousWinners.length > 0 && (
          <Card className="glass-card border-white/20 mb-8">
            <CardContent className="p-6">
              <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                <Medal className="h-5 w-5 text-fpl-green" />
                Previous Gameweek Winners
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {previousWinners.map((winner: PreviousWinner) => (
                  <div key={winner.id} className="bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="border-fpl-green text-fpl-green">
                        Gameweek {winner.gameweekNumber}
                      </Badge>
                      <Trophy className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div className="text-white font-semibold">{winner.userName}</div>
                    <div className="text-white/60 text-sm">{winner.teamName}</div>
                    <div className="text-fpl-green font-bold text-lg mt-1">
                      {winner.totalPoints} pts
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
