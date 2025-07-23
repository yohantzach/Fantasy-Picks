import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CreditCard, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
};

export default function PaymentModal({ isOpen, onClose, onPaymentSuccess }: PaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentStep, setPaymentStep] = useState<'confirm' | 'processing' | 'success'>('confirm');

  const verifyPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Payment verification failed");
      }
      return response.json();
    },
    onSuccess: () => {
      setPaymentStep('success');
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setTimeout(() => {
        onPaymentSuccess();
        onClose();
        setPaymentStep('confirm');
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setPaymentStep('confirm');
    },
  });

  const handlePayment = async () => {
    setPaymentStep('processing');
    
    // Simulate Razorpay payment process
    // In production, this would integrate with actual Razorpay SDK
    try {
      // Simulate payment gateway delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock payment ID
      const mockPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      verifyPaymentMutation.mutate(mockPaymentId);
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: "Failed to process payment. Please try again.",
        variant: "destructive",
      });
      setPaymentStep('confirm');
    }
  };

  const handleClose = () => {
    if (paymentStep === 'processing') return;
    setPaymentStep('confirm');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            {paymentStep === 'confirm' && (
              <div className="flex items-center justify-center gap-2">
                <CreditCard className="h-6 w-6 text-fpl-green" />
                Complete Payment
              </div>
            )}
            {paymentStep === 'processing' && (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 text-fpl-green animate-spin" />
                Processing Payment
              </div>
            )}
            {paymentStep === 'success' && (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Payment Successful
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {paymentStep === 'confirm' && (
            <>
              <div className="text-center">
                <p className="text-white/70 mb-4">
                  Pay ₹20 to participate in this gameweek
                </p>
              </div>

              {/* Payment Summary */}
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white">Entry Fee</span>
                      <span className="text-white font-bold">₹20.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/60">Payment Gateway Fee</span>
                      <span className="text-white/60">₹0.00</span>
                    </div>
                    <hr className="border-white/20" />
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-fpl-green font-bold text-lg">₹20.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Benefits */}
              <div className="space-y-2">
                <h4 className="text-white font-medium">What you get:</h4>
                <ul className="space-y-1 text-sm text-white/80">
                  <li>• Participate in weekly competition</li>
                  <li>• Compete for top 10 leaderboard</li>
                  <li>• Fresh 100M budget every gameweek</li>
                  <li>• Real-time scoring updates</li>
                </ul>
              </div>

              <Button
                onClick={handlePayment}
                className="w-full bg-fpl-green hover:bg-green-600 text-white py-3 text-lg font-semibold"
              >
                Pay with Razorpay
              </Button>

              <div className="text-center">
                <p className="text-white/60 text-xs">
                  Secure payment powered by Razorpay
                </p>
              </div>
            </>
          )}

          {paymentStep === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 text-fpl-green animate-spin mx-auto mb-4" />
              <p className="text-white mb-2">Processing your payment...</p>
              <p className="text-white/60 text-sm">Please do not close this window</p>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-white text-lg font-semibold mb-2">Payment Successful!</p>
              <p className="text-white/70 text-sm">You can now select your team for this gameweek</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
