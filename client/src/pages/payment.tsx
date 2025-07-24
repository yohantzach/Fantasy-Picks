import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { DollarSign, CreditCard, CheckCircle, ArrowRight } from "lucide-react";
import { Redirect } from "wouter";

export default function PaymentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  // Redirect if already paid or admin
  if (user?.hasPaid || user?.isAdmin) {
    return <Redirect to="/" />;
  }

  const paymentMutation = useMutation({
    mutationFn: async () => {
      setProcessing(true);
      // Simulate payment processing (in real app, integrate with payment gateway)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update user payment status
      return apiRequest("POST", "/api/payment/confirm", { 
        paymentId: `pay_${Date.now()}`,
        amount: 20 
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful!",
        description: "You can now create your team",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => {
      toast({
        title: "Payment Failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setProcessing(false);
    },
  });

  const handlePayment = () => {
    paymentMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple flex items-center justify-center p-8">
      <Card className="w-full max-w-md glass-card border-white/20">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <DollarSign className="h-12 w-12 text-fpl-green" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Complete Your Payment
          </CardTitle>
          <p className="text-white/70">
            Pay ₹20 to unlock team selection for this gameweek
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/10 rounded-lg p-4 border border-white/20">
            <div className="flex justify-between items-center mb-4">
              <span className="text-white">Entry Fee</span>
              <span className="text-2xl font-bold text-fpl-green">₹20</span>
            </div>
            <div className="space-y-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-fpl-green" />
                Independent weekly competition
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-fpl-green" />
                Fresh 100M budget every gameweek
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-fpl-green" />
                Compete for weekly prizes
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-fpl-green" />
                Real-time scoring & leaderboards
              </div>
            </div>
          </div>

          <Button
            onClick={handlePayment}
            disabled={processing}
            className="w-full bg-fpl-green hover:bg-green-600 text-white h-12"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Processing Payment...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay ₹20 Now
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          <p className="text-xs text-white/60 text-center">
            Your payment is secure and processed instantly
          </p>
        </CardContent>
      </Card>
    </div>
  );
}