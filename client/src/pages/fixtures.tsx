import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/ui/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type Fixture = {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string;
  finished: boolean;
  finished_provisional: boolean;
  team_h_name: string;
  team_a_name: string;
  team_h_short: string;
  team_a_short: string;
};

export default function Fixtures() {
  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
  });

  // Fetch fixtures for current gameweek
  const { data: fixtures = [], isLoading } = useQuery({
    queryKey: ["/api/fpl/fixtures", { gameweek: currentGameweek?.gameweekNumber }],
    enabled: !!currentGameweek?.gameweekNumber,
  });

  const getDifficultyColor = (difficulty: number) => {
    switch (difficulty) {
      case 1:
      case 2:
        return "bg-green-500";
      case 3:
        return "bg-yellow-500";
      case 4:
      case 5:
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getDifficultyText = (difficulty: number) => {
    switch (difficulty) {
      case 1:
        return "Very Easy";
      case 2:
        return "Easy";
      case 3:
        return "Average";
      case 4:
        return "Hard";
      case 5:
        return "Very Hard";
      default:
        return "Unknown";
    }
  };

  const formatKickoffTime = (kickoffTime: string) => {
    try {
      const date = new Date(kickoffTime);
      return {
        date: format(date, "EEE dd MMM"),
        time: format(date, "HH:mm"),
        fullDate: format(date, "dd/MM/yyyy"),
      };
    } catch {
      return { date: "TBD", time: "TBD", fullDate: "TBD" };
    }
  };

  // Group fixtures by date
  const groupFixturesByDate = (fixtures: Fixture[]) => {
    const grouped = fixtures.reduce((acc: { [key: string]: Fixture[] }, fixture) => {
      const kickoff = formatKickoffTime(fixture.kickoff_time);
      const dateKey = kickoff.fullDate;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(fixture);
      return acc;
    }, {});

    return Object.entries(grouped).sort(([a], [b]) => {
      return new Date(a.split('/').reverse().join('-')).getTime() - 
             new Date(b.split('/').reverse().join('-')).getTime();
    });
  };

  const groupedFixtures = groupFixturesByDate(fixtures);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple">
        <Navigation />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-white text-xl">Loading fixtures...</div>
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
            <Calendar className="h-8 w-8 text-fpl-green" />
            Gameweek {currentGameweek?.gameweekNumber || "21"} Fixtures
          </h2>
          <p className="text-white/60">
            Plan your team selection based on fixture difficulty ratings
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass-card border-white/20">
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 text-fpl-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">{fixtures.length}</div>
              <div className="text-white/60 text-sm">Total Fixtures</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 text-fpl-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">
                {fixtures.filter(f => f.finished).length}
              </div>
              <div className="text-white/60 text-sm">Completed</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/20">
            <CardContent className="p-4 text-center">
              <Clock className="h-8 w-8 text-fpl-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">
                {fixtures.filter(f => !f.finished).length}
              </div>
              <div className="text-white/60 text-sm">Upcoming</div>
            </CardContent>
          </Card>
        </div>

        {/* Fixtures by Date */}
        {groupedFixtures.length > 0 ? (
          <div className="space-y-6">
            {groupedFixtures.map(([date, dayFixtures]) => (
              <Card key={date} className="glass-card border-white/20">
                <CardContent className="p-6">
                  <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-fpl-green" />
                    {format(new Date(date.split('/').reverse().join('-')), "EEEE, dd MMMM")}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dayFixtures.map((fixture: Fixture) => {
                      const kickoff = formatKickoffTime(fixture.kickoff_time);
                      
                      return (
                        <Card key={fixture.id} className="bg-white/10 border-white/20 hover:bg-white/15 transition-colors">
                          <CardContent className="p-4">
                            {/* Match Header */}
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-white/60" />
                                <span className="text-white/60 text-sm">{kickoff.time}</span>
                              </div>
                              {fixture.finished ? (
                                <Badge variant="outline" className="border-green-500 text-green-400">
                                  Finished
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-blue-500 text-blue-400">
                                  Upcoming
                                </Badge>
                              )}
                            </div>

                            {/* Teams */}
                            <div className="space-y-3">
                              {/* Home Team */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {fixture.team_h_short}
                                  </div>
                                  <div>
                                    <div className="text-white font-medium text-sm">
                                      {fixture.team_h_name}
                                    </div>
                                    <div className="text-white/60 text-xs">Home</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded text-xs flex items-center justify-center text-white font-bold ${getDifficultyColor(fixture.team_h_difficulty)}`}
                                    title={`Difficulty: ${getDifficultyText(fixture.team_h_difficulty)}`}
                                  >
                                    {fixture.team_h_difficulty}
                                  </div>
                                </div>
                              </div>

                              {/* VS Divider */}
                              <div className="text-center text-white/40 text-xs font-medium">
                                VS
                              </div>

                              {/* Away Team */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {fixture.team_a_short}
                                  </div>
                                  <div>
                                    <div className="text-white font-medium text-sm">
                                      {fixture.team_a_name}
                                    </div>
                                    <div className="text-white/60 text-xs">Away</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-6 h-6 rounded text-xs flex items-center justify-center text-white font-bold ${getDifficultyColor(fixture.team_a_difficulty)}`}
                                    title={`Difficulty: ${getDifficultyText(fixture.team_a_difficulty)}`}
                                  >
                                    {fixture.team_a_difficulty}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-card border-white/20">
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-16 w-16 text-white/30 mx-auto mb-4" />
              <div className="text-white/60 text-lg mb-2">No fixtures available</div>
              <p className="text-white/40 text-sm">
                Fixtures will be loaded from the FPL API when available
              </p>
            </CardContent>
          </Card>
        )}

        {/* Fixture Difficulty Legend */}
        <Card className="glass-card border-white/20 mt-8">
          <CardContent className="p-6">
            <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-fpl-green" />
              Fixture Difficulty Rating (FDR) Guide
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              {[
                { rating: 1, label: "Very Easy", color: "bg-green-500" },
                { rating: 2, label: "Easy", color: "bg-green-500" },
                { rating: 3, label: "Average", color: "bg-yellow-500" },
                { rating: 4, label: "Hard", color: "bg-red-500" },
                { rating: 5, label: "Very Hard", color: "bg-red-500" },
              ].map((item) => (
                <div key={item.rating} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ${item.color}`}
                  >
                    {item.rating}
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{item.label}</div>
                    <div className="text-white/60 text-xs">FDR {item.rating}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <h4 className="text-blue-200 font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                How to Use FDR
              </h4>
              <div className="text-blue-200/80 text-sm space-y-1">
                <p>• Lower ratings (1-2) indicate easier fixtures for attacking returns</p>
                <p>• Higher ratings (4-5) suggest difficult matches but potential for defensive points</p>
                <p>• Consider FDR when selecting players, especially for captaincy decisions</p>
                <p>• FDR is based on team form, home/away record, and opponent strength</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
