import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit3, Users, Calendar, Trophy, AlertCircle } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { Link } from "wouter";
import { format } from "date-fns";

export default function TeamsPage() {
  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch user's teams
  const { data: userTeams = [] } = useQuery({
    queryKey: ["/api/teams/user"],
  });

  const isDeadlinePassed = currentGameweek && (currentGameweek as any).deadline && new Date() > new Date((currentGameweek as any).deadline);

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-green">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Users className="h-10 w-10 text-fpl-green" />
            My Teams
          </h1>
          <p className="text-white/70 text-lg">
            Manage your fantasy teams for Gameweek {(currentGameweek as any)?.gameweekNumber || "N/A"}
          </p>
        </div>

        {/* Deadline Warning */}
        {isDeadlinePassed && (
          <Card className="bg-red-500/20 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-300">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Deadline Passed</span>
              </div>
              <p className="text-red-200 text-sm mt-1">
                The deadline for this gameweek has passed. You cannot create or edit teams.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/">
            <Card className="bg-white/5 border-white/20 hover:bg-white/10 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Plus className="h-12 w-12 text-fpl-green mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Create New Team</h3>
                <p className="text-white/70 text-sm">Start fresh with a new team selection</p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/edit-team">
            <Card className="bg-white/5 border-white/20 hover:bg-white/10 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Edit3 className="h-12 w-12 text-blue-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Edit Current Team</h3>
                <p className="text-white/70 text-sm">Make changes to your existing team</p>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/leaderboard">
            <Card className="bg-white/5 border-white/20 hover:bg-white/10 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">View Leaderboard</h3>
                <p className="text-white/70 text-sm">Check your ranking and scores</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Current Gameweek Info */}
        {currentGameweek && (
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-fpl-green" />
                Gameweek {(currentGameweek as any).gameweekNumber} Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-white/70 text-sm">Deadline</p>
                  <p className="text-white font-medium">
                    {format(new Date((currentGameweek as any).deadline), "PPP 'at' p")}
                  </p>
                </div>
                <div>
                  <p className="text-white/70 text-sm">Status</p>
                  <Badge className={isDeadlinePassed ? "bg-red-600" : "bg-fpl-green"}>
                    {isDeadlinePassed ? "Deadline Passed" : "Active"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team History/Stats Placeholder */}
        <Card className="bg-white/5 border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Team Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Users className="h-16 w-16 text-white/40 mx-auto mb-4" />
              <p className="text-white/60 mb-4">Team statistics will be available once you create your first team</p>
              <Link href="/">
                <Button className="bg-fpl-green hover:bg-green-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Team
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
