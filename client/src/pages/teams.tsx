import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamManagement } from "@/components/team-management";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle } from "lucide-react";
import Navigation from "@/components/ui/navigation";
import TeamSelectionEnhanced from "./team-selection-enhanced";

type View = "list" | "create" | "edit";

export default function TeamsPage() {
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<View>("list");
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  const handleCreateTeam = () => {
    setEditingTeamId(null);
    setCurrentView("create");
  };

  const handleEditTeam = (teamId: number) => {
    setEditingTeamId(teamId);
    setCurrentView("edit");
  };

  const handleBackToList = () => {
    setCurrentView("list");
    setEditingTeamId(null);
  };

  const isDeadlinePassed = currentGameweek && (currentGameweek as any).deadline && new Date() > new Date((currentGameweek as any).deadline);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        {currentView === "list" && (
          <>
            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="text-4xl font-bold text-white mb-4">
                Team Management
              </h1>
              <p className="text-white/70 text-lg">
                Create and manage your fantasy teams for Gameweek {(currentGameweek as any)?.gameweekNumber || "N/A"}
              </p>
            </div>

            {/* Deadline Warning */}
            {isDeadlinePassed && (
              <Card className="mb-6 bg-red-500/20 border-red-500/30">
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

            {/* Team Management Component */}
            <TeamManagement 
              onEditTeam={handleEditTeam}
              onCreateTeam={handleCreateTeam}
            />
          </>
        )}

        {(currentView === "create" || currentView === "edit") && (
          <>
            {/* Back Button */}
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={handleBackToList}
                className="text-white border-white/20 hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Team Management
              </Button>
            </div>

            {/* Team Creation/Edit Form */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-4">
                {currentView === "create" ? "Create New Team" : "Edit Team"}
              </h2>
              <p className="text-white/70 text-lg">
                {currentView === "create" 
                  ? "Select 11 players within your budget and formation"
                  : "Make changes to your existing team"
                }
              </p>
            </div>

            {/* Team Selection Component */}
            <TeamSelectionEnhanced 
              editingTeamId={editingTeamId} 
              onSaveComplete={handleBackToList}
            />
          </>
        )}
      </div>
    </div>
  );
}
