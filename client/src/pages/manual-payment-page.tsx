import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  CreditCard, 
  Upload, 
  CheckCircle, 
  Clock,
  AlertTriangle,
  IndianRupee,
  QrCode,
  Smartphone
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { Redirect, useLocation } from "wouter";

export default function ManualPaymentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [amount, setAmount] = useState("20");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Get URL parameters for gameweek, team number and team data
  const urlParams = new URLSearchParams(window.location.search);
  const gameweekFromUrl = urlParams.get('gameweek');
  const teamFromUrl = urlParams.get('team');
  const teamNameFromUrl = urlParams.get('teamName');
  const formationFromUrl = urlParams.get('formation');
  const playersFromUrl = urlParams.get('players');
  const captainIdFromUrl = urlParams.get('captainId');
  const viceCaptainIdFromUrl = urlParams.get('viceCaptainId');

  // Fetch current gameweek
  const { data: currentGameweek } = useQuery({
    queryKey: ["/api/gameweek/current"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/gameweek/current");
      return response;
    },
  });

  // Determine which gameweek and team we're paying for
  // Ensure we have valid numbers, fallback to defaults if needed
  const paymentGameweekId = gameweekFromUrl ? parseInt(gameweekFromUrl) : (currentGameweek?.id || 1);
  const paymentTeamNumber = teamFromUrl ? parseInt(teamFromUrl) : 1;
  
  // Additional validation to ensure we have valid numbers
  const validGameweekId = !isNaN(paymentGameweekId) ? paymentGameweekId : (currentGameweek?.id || 1);
  const validTeamNumber = !isNaN(paymentTeamNumber) ? paymentTeamNumber : 1;

  // Redirect if not logged in
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Don't redirect if already paid globally - check per gameweek instead
  // if (user.hasPaid) {
  //   return <Redirect to="/" />;
  // }

  const submitPaymentProof = useMutation({
    mutationFn: async (data: FormData) => {
      // Use raw fetch for FormData instead of apiRequest
      const res = await fetch("/api/payment/submit-proof", {
        method: "POST",
        body: data, // Don't set Content-Type, let browser set it for FormData
        credentials: "include",
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }
      
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Payment Proof Submitted",
        description: "Your payment proof has been submitted for verification. Redirecting to Create Team...",
      });
      setTransactionId("");
      setNotes("");
      setProofFile(null);
      
      // Redirect to Create Team page after a short delay to show the toast
      setTimeout(() => {
        setLocation("/create-team");
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit payment proof",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentMethod || !transactionId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!validGameweekId) {
      toast({
        title: "Error",
        description: "Unable to determine gameweek for payment",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("paymentMethod", paymentMethod);
    formData.append("transactionId", transactionId);
    formData.append("amount", amount);
    formData.append("notes", notes);
    formData.append("gameweekId", validGameweekId.toString());
    formData.append("teamNumber", validTeamNumber.toString());
    
    // Include team data if available from URL
    if (teamNameFromUrl) {
      formData.append("teamName", teamNameFromUrl);
    }
    if (formationFromUrl) {
      formData.append("formation", formationFromUrl);
    }
    if (playersFromUrl) {
      formData.append("players", playersFromUrl);
    }
    if (captainIdFromUrl) {
      formData.append("captainId", captainIdFromUrl);
    }
    if (viceCaptainIdFromUrl) {
      formData.append("viceCaptainId", viceCaptainIdFromUrl);
    }
    
    if (proofFile) {
      formData.append("proofFile", proofFile);
    }

    submitPaymentProof.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive",
        });
        return;
      }
      setProofFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              <IndianRupee className="h-10 w-10 text-fpl-green" />
              Complete Payment
            </h1>
            <p className="text-white/70 text-lg">
              Pay ₹20 for Team {validTeamNumber} in this gameweek's competition
            </p>
            {teamFromUrl && (
              <div className="mt-4 p-3 bg-fpl-green/20 border border-fpl-green/30 rounded-lg inline-block">
                <p className="text-fpl-green text-sm font-medium">
                  🏆 Payment for Team #{validTeamNumber} {teamNameFromUrl ? `"${teamNameFromUrl}"` : ''}
                </p>
                {playersFromUrl && (
                  <p className="text-fpl-green/80 text-xs mt-1">
                    Team ready to register after payment approval
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Payment Instructions */}
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-fpl-green" />
                  Payment Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-fpl-green/10 border border-fpl-green/20 rounded-lg">
                  <h3 className="text-fpl-green font-semibold mb-2">UPI Payment</h3>
                  <p className="text-white/80 text-sm mb-3">
                    Send ₹20 to our UPI ID:
                  </p>
                  <div className="bg-white/10 p-3 rounded border-l-4 border-fpl-green mb-4">
                    <code className="text-white font-mono text-lg">pbganesh1611@oksbi</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText('pbganesh1611@oksbi')}
                      className="ml-3 px-2 py-1 bg-fpl-green text-white text-xs rounded hover:bg-green-600"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-center">
                    <div className="inline-block p-4 bg-white rounded-lg">
                      <img 
                        src="/qrcodev2.jpg" 
                        alt="UPI QR Code for pbganesh1611@oksbi" 
                        className="w-48 h-48 object-contain"
                        onError={(e) => {
                          // Fallback if image doesn't load
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <p className="text-white/60 text-sm mt-2">Scan QR code with any UPI app to pay ₹20</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-orange-400 font-medium mb-1">Important</h4>
                    <p className="text-white/80 text-sm">
                      After payment, submit the transaction details below. Your account will be activated within 24 hours after verification.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Proof Form */}
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-fpl-green" />
                  Submit Payment Proof
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label className="text-white">Payment Method *</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="bg-white/20 border-white/30 text-white">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upi">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white">Transaction ID / Reference Number *</Label>
                    <Input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter transaction ID"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                    />
                  </div>

                  <div>
                    <Label className="text-white">Amount Paid</Label>
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="20"
                      type="number"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      readOnly
                    />
                  </div>

                  <div>
                    <Label className="text-white">Upload Payment Screenshot (Optional)</Label>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="bg-white/20 border-white/30 text-white file:bg-fpl-green file:text-white file:border-0 file:rounded-md file:px-3 file:py-1 file:mr-3"
                    />
                    {proofFile && (
                      <p className="text-fpl-green text-sm mt-1">
                        ✓ {proofFile.name} selected
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-white">Additional Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any additional information about your payment"
                      className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                      rows={3}
                    />
                  </div>

                  
                  <Button
                    type="submit"
                    disabled={submitPaymentProof.isPending || !paymentMethod || !transactionId}
                    className="w-full bg-fpl-green hover:bg-green-600 text-white"
                  >
                    {submitPaymentProof.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Submit Payment Proof
                      </>
                    )}
                  </Button>

                  <div className="text-center">
                    <p className="text-white/60 text-sm">
                      Your payment will be verified within 24 hours
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
