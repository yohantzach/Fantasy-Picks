import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

const FORMATIONS = [
  { name: "3-4-3", defenders: 3, midfielders: 4, forwards: 3 },
  { name: "3-5-2", defenders: 3, midfielders: 5, forwards: 2 },
  { name: "4-3-3", defenders: 4, midfielders: 3, forwards: 3 },
  { name: "4-4-2", defenders: 4, midfielders: 4, forwards: 2 },
  { name: "4-5-1", defenders: 4, midfielders: 5, forwards: 1 },
  { name: "5-4-1", defenders: 5, midfielders: 4, forwards: 1 },
  { name: "5-3-2", defenders: 5, midfielders: 3, forwards: 2 },
];

interface FormationSelectorProps {
  selectedFormation: string;
  onFormationChange: (formation: string) => void;
  disabled?: boolean;
}

export function FormationSelector({ 
  selectedFormation, 
  onFormationChange, 
  disabled = false 
}: FormationSelectorProps) {
  return (
    <Card className="bg-white/5 border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Choose Formation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {FORMATIONS.map((formation) => (
            <Button
              key={formation.name}
              variant={selectedFormation === formation.name ? "default" : "outline"}
              className={`h-auto p-3 flex flex-col items-center space-y-1 ${
                selectedFormation === formation.name
                  ? "bg-fpl-green text-white border-fpl-green"
                  : "bg-white/10 border-white/30 text-white hover:bg-white/20"
              }`}
              onClick={() => onFormationChange(formation.name)}
              disabled={disabled}
            >
              <div className="flex items-center space-x-1">
                <span className="font-bold">{formation.name}</span>
                {selectedFormation === formation.name && (
                  <Check className="h-4 w-4" />
                )}
              </div>
              <div className="text-xs opacity-80">
                {formation.defenders}D-{formation.midfielders}M-{formation.forwards}F
              </div>
            </Button>
          ))}
        </div>
        
        {selectedFormation && (
          <div className="mt-4 p-3 bg-white/10 rounded-lg">
            <h4 className="text-white text-sm font-medium mb-2">Formation Requirements:</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-200">
                1 Goalkeeper
              </Badge>
              <Badge variant="secondary" className="bg-green-500/20 text-green-200">
                {FORMATIONS.find(f => f.name === selectedFormation)?.defenders} Defenders
              </Badge>
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-200">
                {FORMATIONS.find(f => f.name === selectedFormation)?.midfielders} Midfielders
              </Badge>
              <Badge variant="secondary" className="bg-red-500/20 text-red-200">
                {FORMATIONS.find(f => f.name === selectedFormation)?.forwards} Forwards
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { FORMATIONS };