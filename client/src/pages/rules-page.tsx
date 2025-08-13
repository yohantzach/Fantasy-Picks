import Navigation from "@/components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Users, 
  DollarSign, 
  Trophy, 
  Target, 
  Shield, 
  Goal, 
  HandHeart, 
  Save, 
  Award,
  AlertTriangle,
  TrendingUp
} from "lucide-react";

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
            <Award className="h-10 w-10 text-fpl-green" />
            Game Rules
          </h1>
          <p className="text-white/70 text-lg">
            Complete guide to Fantasy Picks weekly league rules and scoring system
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Team Selection Rules */}
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-fpl-green" />
                Team Selection Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-white/90">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="border-fpl-green text-fpl-green mt-1">11</Badge>
                  <span>Pick 11 players per team while adhering to:</span>
                </div>
                <div className="ml-8 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-fpl-green rounded-full"></div>
                    <span>A limit of three players from the same team</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-fpl-green rounded-full"></div>
                    <span>A budget of 100 million euros</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-fpl-green rounded-full"></div>
                    <span>One of the available formations</span>
                  </div>
                </div>
              </div>

              <Separator className="bg-white/20" />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  <span className="font-medium">Choose a captain and vice-captain</span>
                </div>
              </div>

              <Separator className="bg-white/20" />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <span className="font-medium">Save your team and make payment to be entered into the league</span>
                </div>
              </div>

              <Separator className="bg-white/20" />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="border-yellow-400 text-yellow-400 mt-1">5</Badge>
                  <div>
                    <span className="font-medium">Maximum 5 teams per person per gameweek</span>
                    <p className="text-sm text-white/70 mt-1">Each team requires a separate ₹20 payment and must be uniquely named</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Game Updates */}
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-400" />
                Game Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-white/90">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="border-blue-400 text-blue-400 mt-1">Daily</Badge>
                  <span>Player scores will be updated at the end of each day in the gameweek</span>
                </div>
              </div>

              <Separator className="bg-white/20" />

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mt-1" />
                  <span>All scores are final after the last day of the gameweek and changes in stats will no longer be reflected in points.</span>
                </div>
              </div>

              <Separator className="bg-white/20" />

              <div className="text-sm text-white/70">
                <p>Defensive Contribution Statistics and Bonus Points Statistics are updated after review leading to changes in points up to the last day of the gameweek ending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scoring System */}
        <Card className="bg-white/5 border-white/20 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-2xl">
              <Target className="h-6 w-6 text-fpl-green" />
              Scoring System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Appearance Points */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  1. Appearance Points
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Played up to 60 minutes</span>
                    <Badge className="bg-green-600">+1</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Played 60+ minutes</span>
                    <Badge className="bg-green-600">+2</Badge>
                  </div>
                </div>
              </div>

              {/* Goals Scored */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Goal className="h-4 w-4 text-red-400" />
                  2. Goals Scored
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Goalkeeper/Defender</span>
                    <Badge className="bg-green-600">+6</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Midfielder</span>
                    <Badge className="bg-green-600">+5</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Forward</span>
                    <Badge className="bg-green-600">+4</Badge>
                  </div>
                </div>
              </div>

              {/* Assists */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <HandHeart className="h-4 w-4 text-purple-400" />
                  3. Assists
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Any assist</span>
                    <Badge className="bg-green-600">+3</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-2">
                    Includes winning a penalty or free-kick that's scored, if not the taker.
                  </div>
                </div>
              </div>

              {/* Clean Sheets */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-400" />
                  4. Clean Sheets
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Goalkeeper/Defender</span>
                    <Badge className="bg-green-600">+4</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Midfielder</span>
                    <Badge className="bg-green-600">+1</Badge>
                  </div>
                  <div className="text-xs text-white/70 mt-2">
                    Awarded if player plays 60+ mins and team concedes 0 goals while on pitch.
                  </div>
                </div>
              </div>

              {/* Goalkeeper Saves */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Save className="h-4 w-4 text-orange-400" />
                  5. Goalkeeper Saves
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Every 3 saves</span>
                    <Badge className="bg-green-600">+1</Badge>
                  </div>
                </div>
              </div>

              {/* Penalties */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-yellow-400" />
                  6. Penalties
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Penalty save (GK)</span>
                    <Badge className="bg-green-600">+5</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Penalty miss</span>
                    <Badge className="bg-red-600">-2</Badge>
                  </div>
                </div>
              </div>

              {/* Bonus Points */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-gold-400" />
                  7. Bonus Points
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Top BPS in match</span>
                    <Badge className="bg-green-600">+3</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Second in BPS</span>
                    <Badge className="bg-green-600">+2</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Third in BPS</span>
                    <Badge className="bg-green-600">+1</Badge>
                  </div>
                </div>
              </div>

              {/* Cards & Own Goals */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  8. Cards & Own Goals
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Yellow card</span>
                    <Badge className="bg-red-600">-1</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Red card</span>
                    <Badge className="bg-red-600">-3</Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Own goal</span>
                    <Badge className="bg-red-600">-2</Badge>
                  </div>
                </div>
              </div>

              {/* Goals Conceded */}
              <div className="space-y-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Goal className="h-4 w-4 text-red-400" />
                  9. Goals Conceded
                </h3>
                <div className="space-y-2 text-sm text-white/90">
                  <div className="flex justify-between items-center p-2 bg-white/10 rounded">
                    <span>Every 2 goals (GK/Def)</span>
                    <Badge className="bg-red-600">-1</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {/* Player Prices */}
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                Player Prices
              </CardTitle>
            </CardHeader>
            <CardContent className="text-white/90">
              <p className="text-sm">
                Player prices change dynamically to reflect how popular of a pick they are based on a hidden algorithm.
              </p>
            </CardContent>
          </Card>

          {/* Form & ICT Index */}
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-400" />
                Form & ICT Index
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-white/90">
              <div>
                <h4 className="font-medium text-white mb-2">Form</h4>
                <p className="text-sm">
                  A player's average score per match, calculated from all matches played by his club in the last 30 days.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2">ICT Index</h4>
                <p className="text-sm">
                  A football statistical index that assesses a player as an FPL asset using Influence, Creativity and Threat scores.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bonus Points System Details */}
        <Card className="bg-white/5 border-white/20 mt-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-xl">
              <Award className="h-5 w-5 text-yellow-400" />
              Bonus Points System (BPS) Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              {/* Positive BPS Actions */}
              <div>
                <h3 className="text-white font-semibold mb-4 text-green-400">Positive BPS Actions</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { action: "Playing 1–60 minutes", points: "+3" },
                    { action: "Playing 60+ minutes", points: "+6" },
                    { action: "Goal scored (forward)", points: "+24" },
                    { action: "Goal scored (midfielder)", points: "+18" },
                    { action: "Goal scored (defender/GK)", points: "+12" },
                    { action: "Penalty goal", points: "+12" },
                    { action: "Assist", points: "+9" },
                    { action: "Clean sheet (def/GK)", points: "+12" },
                    { action: "Penalty save (GK)", points: "+8" },
                    { action: "Save inside box (GK)", points: "+3" },
                    { action: "Save outside box (GK)", points: "+2" },
                    { action: "Goal line clearance", points: "+9" },
                    { action: "Creating a big chance", points: "+3" },
                    { action: "Successful dribble", points: "+1" },
                    { action: "Tackle won", points: "+2" },
                    { action: "Winning a penalty", points: "+2" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white/5 rounded text-white/90">
                      <span className="text-xs">{item.action}</span>
                      <Badge className="bg-green-600 text-xs">{item.points}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Negative BPS Actions */}
              <div>
                <h3 className="text-white font-semibold mb-4 text-red-400">Negative BPS Actions</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { action: "Missing a penalty", points: "−6" },
                    { action: "Missing a big chance", points: "−3" },
                    { action: "Conceding a penalty", points: "−3" },
                    { action: "Conceding a goal (def/GK)", points: "−1" },
                    { action: "Yellow card", points: "−3" },
                    { action: "Red card", points: "−9" },
                    { action: "Own goal", points: "−6" },
                    { action: "Error leading to a goal", points: "−3" },
                    { action: "Error leading to a shot", points: "−1" },
                    { action: "Being tackled", points: "−1" },
                    { action: "Committing a foul", points: "−1" },
                    { action: "Offside", points: "−1" },
                    { action: "Shot off target", points: "−1" }
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-white/5 rounded text-white/90">
                      <span className="text-xs">{item.action}</span>
                      <Badge className="bg-red-600 text-xs">{item.points}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="text-yellow-400 font-medium mb-2">BPS Tie-breaking Rules</h4>
              <div className="text-sm text-white/90 space-y-1">
                <p>• Tie for 1st → All get 3 pts, next gets 1 pt</p>
                <p>• Tie for 2nd → Leader gets 3 pts, tied players get 2 pts</p>
                <p>• Tie for 3rd → Higher spots as normal, tied 3rd players get 1 pt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
