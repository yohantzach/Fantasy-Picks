import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Edit, Trash2, Plus, Eye, Users, Crown, Shield, Lock, Clock } from "lucide-react";
import { format } from "date-fns";

interface Team {
  id: number;
  teamName: string;
  formation: string;
  totalValue: number;
  players: number[];
  captainId: number;
  viceCaptainId: number;
  createdAt: string;
  isLocked: boolean;
  totalPoints?: number;
}

interface TeamManagementProps {
  onEditTeam: (teamId: number) => void;
  onCreateTeam: () => void;
}

export function TeamManagement({ onEditTeam, onCreateTeam }: TeamManagementProps) {
  const { toast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showTeamDetails, setShowTeamDetails] = useState(false);

  // Fetch user's teams
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/teams");
      return response;
    }
  });

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: number) => {
      return apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      toast({
        title: "Team Deleted",
        description: "Your team has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Team",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTeam = (teamId: number) => {
    if (confirm("Are you sure you want to delete this team?")) {
      deleteTeamMutation.mutate(teamId);
    }
  };

  const handleViewTeam = (team: Team) => {
    setSelectedTeam(team);
    setShowTeamDetails(true);
  };

  const isDeadlinePassed = currentGameweek && (currentGameweek as any).deadline && new Date() > new Date((currentGameweek as any).deadline);
  const gameweekInProgress = isDeadlinePassed && !(currentGameweek as any).isCompleted;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fpl-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">My Teams</h2>
          <p className="text-white/70">
            Manage your fantasy teams for Gameweek {(currentGameweek as any)?.gameweekNumber || "N/A"}
          </p>
        </div>
        <Button
          onClick={onCreateTeam}
          className="bg-fpl-green hover:bg-green-600 text-white"
          disabled={isDeadlinePassed}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Team
        </Button>
      </div>

      {/* Gameweek Status Message */}
      {gameweekInProgress && (
        <Card className="bg-orange-500/20 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-300">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Gameweek In Progress</span>
            </div>
            <p className="text-orange-200 text-sm mt-1">
              Teams are locked while matches are being played. Points will update live during matches.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Teams Grid */}
      {teams.length === 0 ? (
        <Card className="bg-white/5 border-white/20">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 text-white/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Teams Created</h3>
            <p className="text-white/70 mb-4">
              You haven't created any teams yet. Create your first team to get started!
            </p>
            <Button
              onClick={onCreateTeam}
              className="bg-fpl-green hover:bg-green-600 text-white"
              disabled={isDeadlinePassed}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team: Team) => (
            <Card key={team.id} className="bg-white/5 border-white/20 hover:bg-white/10 transition-colors">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white text-lg">{team.teamName}</CardTitle>
                    <p className="text-white/60 text-sm">Formation: {team.formation}</p>
                  </div>
                  <div className="flex gap-2">
                    {team.isLocked && (
                      <Badge variant="secondary" className="text-xs">
                        Locked
                      </Badge>
                    )}
                    <Badge className="bg-fpl-green text-white text-xs">
                      £{(team.totalValue || 0).toFixed(1)}m
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Team Stats */}
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-white">{team.players?.length || 0}/11</div>
                      <div className="text-xs text-white/60">Players</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{team.totalPoints || 0}</div>
                      <div className="text-xs text-white/60">Points</div>
                    </div>
                  </div>

                  {/* Captain Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Crown className="h-3 w-3 text-yellow-400" />
                      <span className="text-white/70">Captain: {team.captainId ? 'Selected' : 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-3 w-3 text-gray-400" />
                      <span className="text-white/70">Vice Captain: {team.viceCaptainId ? 'Selected' : 'Not set'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewTeam(team)}
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditTeam(team.id)}
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
                      disabled={team.isLocked || isDeadlinePassed}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteTeam(team.id)}
                      disabled={team.isLocked}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Created Date */}
                  <div className="text-xs text-white/50">
                    Created: {format(new Date(team.createdAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Team Details Modal */}
      <Dialog open={showTeamDetails} onOpenChange={setShowTeamDetails}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 border-purple-500/30 text-white">
          <DialogHeader>
            <DialogTitle>Team Details: {selectedTeam?.teamName}</DialogTitle>
          </DialogHeader>
          {selectedTeam && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-white mb-2">Team Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-white/70">Formation:</span> {selectedTeam.formation}</div>
                    <div><span className="text-white/70">Total Value:</span> £{selectedTeam.totalValue?.toFixed(1)}m</div>
                    <div><span className="text-white/70">Players:</span> {selectedTeam.players?.length || 0}/11</div>
                    <div><span className="text-white/70">Total Points:</span> {selectedTeam.totalPoints || 0}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Team Status</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-white/70">Captain:</span> {selectedTeam.captainId ? 'Selected' : 'Not set'}</div>
                    <div><span className="text-white/70">Vice Captain:</span> {selectedTeam.viceCaptainId ? 'Selected' : 'Not set'}</div>
                    <div><span className="text-white/70">Status:</span> {selectedTeam.isLocked ? 'Locked' : 'Active'}</div>
                    <div><span className="text-white/70">Created:</span> {format(new Date(selectedTeam.createdAt), 'MMM dd, yyyy HH:mm')}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    onEditTeam(selectedTeam.id);
                    setShowTeamDetails(false);
                  }}
                  className="bg-fpl-green hover:bg-green-600 text-white"
                  disabled={selectedTeam.isLocked || isDeadlinePassed}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Team
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowTeamDetails(false)}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
