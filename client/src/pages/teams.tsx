import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit3, Users, Calendar, Trophy, AlertCircle, Clock, CheckCircle, XCircle, CreditCard } from "lucide-react";
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
  
  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600">Paid & Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600">Payment Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600">Payment Rejected</Badge>;
      default:
        return <Badge variant="outline">Payment Required</Badge>;
    }
  };

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

        {/* Summary Stats */}
        {userTeams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white">{userTeams.length}</div>
                <div className="text-sm text-white/60">Total Teams</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {userTeams.filter((t: any) => t.paymentStatus === 'approved').length}
                </div>
                <div className="text-sm text-white/60">Paid & Active</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {userTeams.filter((t: any) => t.paymentStatus === 'pending').length}
                </div>
                <div className="text-sm text-white/60">Pending Payment</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {userTeams.reduce((sum: number, t: any) => sum + (t.totalPoints || 0), 0)}
                </div>
                <div className="text-sm text-white/60">Total Points</div>
              </CardContent>
            </Card>
          </div>
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

        {/* User Teams Display */}
        <Card className="bg-white/5 border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>My Teams for Gameweek {(currentGameweek as any)?.gameweekNumber}</span>
              <Badge variant="outline" className="text-white">
                {userTeams.length} team{userTeams.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userTeams.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-16 w-16 text-white/40 mx-auto mb-4" />
                <p className="text-white/60 mb-4">You haven't created any teams for this gameweek yet</p>
                <Link href="/">
                  <Button className="bg-fpl-green hover:bg-green-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Team
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {userTeams.map((team: any) => (
                  <Card key={team.id} className="bg-white/10 border-white/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-white font-semibold text-lg">
                            Team #{team.teamNumber}: {team.teamName}
                          </h3>
                          <p className="text-white/60 text-sm">
                            Created {format(new Date(team.createdAt), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPaymentStatusIcon(team.paymentStatus)}
                          {getPaymentStatusBadge(team.paymentStatus)}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-white/60 text-xs">Players</p>
                          <p className="text-white font-medium">{team.players?.length || 0}/11</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/60 text-xs">Points</p>
                          <p className="text-white font-medium">{team.totalPoints || 0}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-white/60 text-xs">Value</p>
                          <p className="text-white font-medium">£{team.totalValue?.toFixed(1) || '0.0'}m</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {team.paymentStatus === 'approved' && team.canEdit && (
                          <Link href={`/edit-team?team=${team.teamNumber}`} className="flex-1">
                            <Button variant="outline" className="w-full border-white/30 text-white hover:bg-white/10">
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit Team
                            </Button>
                          </Link>
                        )}
                        
                        {team.paymentStatus === 'not_submitted' && (
                          <Link href={`/manual-payment?gameweek=${(currentGameweek as any)?.id}&team=${team.teamNumber}`} className="flex-1">
                            <Button className="w-full bg-fpl-green hover:bg-green-600">
                              <CreditCard className="h-4 w-4 mr-2" />
                              Pay for Team
                            </Button>
                          </Link>
                        )}
                        
                        {team.paymentStatus === 'pending' && (
                          <div className="flex-1">
                            <Button disabled className="w-full" variant="outline">
                              <Clock className="h-4 w-4 mr-2" />
                              Awaiting Approval
                            </Button>
                          </div>
                        )}
                        
                        {team.paymentStatus === 'rejected' && (
                          <Link href={`/manual-payment?gameweek=${(currentGameweek as any)?.id}&team=${team.teamNumber}`} className="flex-1">
                            <Button className="w-full bg-red-600 hover:bg-red-700">
                              <XCircle className="h-4 w-4 mr-2" />
                              Retry Payment
                            </Button>
                          </Link>
                        )}
                        
                        <Link href={`/team/${team.teamNumber}`}>
                          <Button variant="ghost" className="text-white hover:bg-white/10">
                            <Users className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                      
                      {team.paymentStatus === 'pending' && (
                        <div className="mt-3 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded">
                          <p className="text-yellow-200 text-xs">
                            💡 Your payment is being reviewed. You can edit this team once approved.
                          </p>
                        </div>
                      )}
                      
                      {team.paymentStatus === 'rejected' && (
                        <div className="mt-3 p-2 bg-red-500/20 border border-red-500/30 rounded">
                          <p className="text-red-200 text-xs">
                            ❌ Payment was rejected. Please try submitting payment again.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {/* Add New Team Button */}
                {!isDeadlinePassed && (
                  <Card className="bg-white/5 border-white/20 border-dashed">
                    <CardContent className="p-6 text-center">
                      <Link href="/">
                        <Button variant="ghost" className="text-white hover:bg-white/10">
                          <Plus className="h-8 w-8 mb-2" />
                          <div>
                            <p className="font-medium">Add Another Team</p>
                            <p className="text-sm text-white/60">Create team #{userTeams.length + 1}</p>
                          </div>
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
