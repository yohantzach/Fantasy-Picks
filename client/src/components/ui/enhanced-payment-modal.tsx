import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle, Smartphone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: () => void;
  amount?: number;
  teamCreationFlow?: boolean;
};

type PaymentStep = 'confirm' | 'phonepe-redirect' | 'processing' | 'success' | 'failed';

export default function EnhancedPaymentModal({ 
  isOpen, 
  onClose, 
  onPaymentSuccess, 
  amount = 20,
  teamCreationFlow = false 
}: PaymentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('confirm');
  const [paymentMethod, setPaymentMethod] = useState<'phonepe' | 'upi'>('phonepe');
  const [countdown, setCountdown] = useState(300); // 5 minutes timeout
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Countdown timer for payment timeout
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (paymentStep === 'phonepe-redirect' || paymentStep === 'processing') {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setPaymentStep('failed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [paymentStep]);

  const initiatePaymentMutation = useMutation({
    mutationFn: async (paymentData: { method: string; amount: number }) => {
      const response = await fetch("/api/payment/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Payment initiation failed");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPaymentId(data.paymentId);
      if (data.redirectUrl) {
        // For PhonePe, redirect to payment page
        setPaymentStep('phonepe-redirect');
        window.open(data.redirectUrl, '_blank');
        // Start polling for payment status
        startPaymentStatusPolling(data.paymentId);
      } else {
        setPaymentStep('processing');
        // For UPI, show QR code or instructions
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Initiation Failed",
        description: error.message,
        variant: "destructive",
      });
      setPaymentStep('failed');
    },
  });

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
        resetModal();
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Verification Failed",
        description: error.message,
        variant: "destructive",
      });
      setPaymentStep('failed');
    },
  });

  const startPaymentStatusPolling = (paymentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/payment/status/${paymentId}`, {
          credentials: "include",
        });
        const data = await response.json();
        
        if (data.status === 'completed') {
          clearInterval(pollInterval);
          verifyPaymentMutation.mutate(paymentId);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setPaymentStep('failed');
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (paymentStep === 'phonepe-redirect' || paymentStep === 'processing') {
        setPaymentStep('failed');
      }
    }, 300000);
  };

  const handlePayment = () => {
    if (!paymentMethod) return;
    
    setCountdown(300); // Reset countdown
    initiatePaymentMutation.mutate({
      method: paymentMethod,
      amount: amount
    });
  };

  const handleManualVerification = () => {
    if (paymentId) {
      verifyPaymentMutation.mutate(paymentId);
    }
  };

  const resetModal = () => {
    setPaymentStep('confirm');
    setPaymentMethod('phonepe');
    setCountdown(300);
    setPaymentId(null);
  };

  const handleClose = () => {
    if (paymentStep === 'processing' || paymentStep === 'phonepe-redirect') {
      toast({
        title: "Payment in Progress",
        description: "Please complete your payment before closing",
        variant: "destructive",
      });
      return;
    }
    resetModal();
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepTitle = () => {
    switch (paymentStep) {
      case 'confirm':
        return teamCreationFlow ? 'Complete Payment to Create Team' : 'Complete Payment';
      case 'phonepe-redirect':
        return 'Complete Payment on PhonePe';
      case 'processing':
        return 'Processing Payment';
      case 'success':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
      default:
        return 'Payment';
    }
  };

  const getStepIcon = () => {
    switch (paymentStep) {
      case 'confirm':
        return <CreditCard className="h-6 w-6 text-fpl-green" />;
      case 'phonepe-redirect':
      case 'processing':
        return <Loader2 className="h-6 w-6 text-fpl-green animate-spin" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <CreditCard className="h-6 w-6 text-fpl-green" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            <div className="flex items-center justify-center gap-2">
              {getStepIcon()}
              {getStepTitle()}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {paymentStep === 'confirm' && (
            <>
              <div className="text-center">
                <p className="text-white/70 mb-4">
                  {teamCreationFlow 
                    ? `Pay ₹${amount} to create your team for this gameweek`
                    : `Pay ₹${amount} to participate in this gameweek`
                  }
                </p>
              </div>

              {/* Payment Summary */}
              <Card className="bg-white/10 border-white/20">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white">Entry Fee</span>
                      <span className="text-white font-bold">₹{amount}.00</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/60">Payment Gateway Fee</span>
                      <span className="text-white/60">₹0.00</span>
                    </div>
                    {teamCreationFlow && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Additional Team Fee</span>
                        <span className="text-white/60">₹0.00</span>
                      </div>
                    )}
                    <hr className="border-white/20" />
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold">Total</span>
                      <span className="text-fpl-green font-bold text-lg">₹{amount}.00</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method Selection */}
              <div className="space-y-3">
                <h4 className="text-white font-medium">Choose Payment Method:</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={paymentMethod === 'phonepe' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('phonepe')}
                    className={`flex items-center gap-2 h-12 ${
                      paymentMethod === 'phonepe' 
                        ? 'bg-purple-600 hover:bg-purple-700 border-purple-500' 
                        : 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                    }`}
                  >
                    <Smartphone className="h-5 w-5" />
                    PhonePe
                  </Button>
                  <Button
                    variant={paymentMethod === 'upi' ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod('upi')}
                    className={`flex items-center gap-2 h-12 ${
                      paymentMethod === 'upi' 
                        ? 'bg-orange-600 hover:bg-orange-700 border-orange-500' 
                        : 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    UPI
                  </Button>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2">
                <h4 className="text-white font-medium">What you get:</h4>
                <ul className="space-y-1 text-sm text-white/80">
                  <li>• Participate in weekly competition</li>
                  <li>• Compete for top 10 leaderboard</li>
                  <li>• Fresh ₹110M budget every gameweek</li>
                  <li>• Real-time scoring updates</li>
                  {teamCreationFlow && <li>• Create additional teams (₹20 each)</li>}
                </ul>
              </div>

              <Button
                onClick={handlePayment}
                disabled={initiatePaymentMutation.isPending}
                className="w-full bg-fpl-green hover:bg-green-600 text-white py-3 text-lg font-semibold"
              >
                {initiatePaymentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Initiating Payment...
                  </>
                ) : (
                  `Pay ₹${amount} with ${paymentMethod === 'phonepe' ? 'PhonePe' : 'UPI'}`
                )}
              </Button>

              <div className="text-center">
                <p className="text-white/60 text-xs">
                  Secure payment powered by {paymentMethod === 'phonepe' ? 'PhonePe' : 'UPI'}
                </p>
              </div>
            </>
          )}

          {paymentStep === 'phonepe-redirect' && (
            <div className="text-center py-8 space-y-4">
              <Smartphone className="h-16 w-16 text-purple-500 mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-white text-lg font-semibold">Complete payment on PhonePe</p>
                <p className="text-white/70 text-sm">A new tab has opened with PhonePe payment page</p>
                <div className="bg-white/10 rounded-lg p-3 mt-4">
                  <div className="text-sm text-white/80">Time remaining: 
                    <span className="font-mono text-yellow-400 ml-1">{formatTime(countdown)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Button 
                  onClick={handleManualVerification}
                  disabled={verifyPaymentMutation.isPending}
                  className="w-full bg-fpl-green hover:bg-green-600"
                >
                  {verifyPaymentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking Payment...
                    </>
                  ) : (
                    'I have completed the payment'
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setPaymentStep('failed')}
                  className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  Cancel Payment
                </Button>
              </div>
            </div>
          )}

          {paymentStep === 'processing' && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 text-fpl-green animate-spin mx-auto mb-4" />
              <p className="text-white mb-2">Processing your payment...</p>
              <p className="text-white/60 text-sm">Please do not close this window</p>
              <div className="bg-white/10 rounded-lg p-3 mt-4">
                <div className="text-sm text-white/80">Time remaining: 
                  <span className="font-mono text-yellow-400 ml-1">{formatTime(countdown)}</span>
                </div>
              </div>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-white text-lg font-semibold mb-2">Payment Successful!</p>
              <p className="text-white/70 text-sm mb-4">
                {teamCreationFlow 
                  ? 'Your team has been created successfully'
                  : 'You can now select your team for this gameweek'
                }
              </p>
              <Badge className="bg-green-600 text-white px-4 py-2">
                Amount Paid: ₹{amount}.00
              </Badge>
            </div>
          )}

          {paymentStep === 'failed' && (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-white text-lg font-semibold">Payment Failed</p>
                <p className="text-white/70 text-sm">
                  Your payment could not be processed. Please try again.
                </p>
              </div>
              <div className="space-y-2">
                <Button 
                  onClick={() => setPaymentStep('confirm')}
                  className="w-full bg-fpl-green hover:bg-green-600"
                >
                  Try Again
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="w-full bg-white/20 border-white/30 text-white hover:bg-white/30"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
