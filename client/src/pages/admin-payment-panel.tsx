import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye,
  Download,
  User,
  CreditCard,
  IndianRupee,
  Calendar
} from "lucide-react";
import Navigation from "@/components/ui/navigation";
import { Redirect } from "wouter";
import { format } from "date-fns";

interface PaymentProof {
  id: number;
  userId: number;
  userName: string; // Match server response field name
  email: string;
  gameweekId: number;
  teamNumber: number;
  paymentMethod: string;
  transactionId: string;
  amount: string;
  notes: string | null;
  proofFilePath: string | null;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function AdminPaymentPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  // Redirect if not admin
  if (!user || !user.isAdmin) {
    return <Redirect to="/" />;
  }

  // Fetch pending payment proofs
  const { data: pendingProofs, isLoading } = useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payment/admin/pending");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Verify payment mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async ({ proofId, action, notes }: { proofId: number; action: 'approve' | 'reject'; notes?: string }) => {
      return apiRequest("POST", `/api/payment/admin/verify/${proofId}`, { action, notes });
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Payment Verified",
        description: `Payment proof ${variables.action}d successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
      setSelectedProof(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify payment proof",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (proofId: number) => {
    verifyPaymentMutation.mutate({ 
      proofId, 
      action: 'approve', 
      notes: adminNotes 
    });
  };

  const handleReject = (proofId: number) => {
    verifyPaymentMutation.mutate({ 
      proofId, 
      action: 'reject', 
      notes: adminNotes 
    });
  };

  const handleViewFile = (proofId: number) => {
    window.open(`/api/payment/admin/file/${proofId}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Clock className="h-8 w-8 animate-spin text-fpl-green" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
              <CreditCard className="h-10 w-10 text-fpl-green" />
              Payment Verification Panel
            </h1>
            <p className="text-white/70 text-lg">
              Review and verify user payment submissions
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Payment Proofs List */}
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Pending Verifications</span>
                  <Badge variant="secondary" className="bg-orange-500 text-white">
                    {pendingProofs?.length || 0} pending
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!pendingProofs || !Array.isArray(pendingProofs) || pendingProofs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-white/70">No pending payment verifications</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {pendingProofs.map((proof: PaymentProof) => (
                        <div
                          key={proof.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedProof?.id === proof.id
                              ? 'border-fpl-green bg-fpl-green/10'
                              : 'border-white/20 bg-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => setSelectedProof(proof)}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-fpl-green" />
                              <div>
                                <p className="text-white font-medium">{proof.userName || proof.email}</p>
                                <p className="text-white/60 text-sm">{proof.email}</p>
                                <p className="text-fpl-green text-xs">GW{proof.gameweekId} Team #{proof.teamNumber}</p>
                              </div>
                            </div>
                            <Badge className="bg-orange-500 text-white">
                              ₹{proof.amount}
                            </Badge>
                          </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-white/60">Payment Method</p>
                            <p className="text-white">{proof.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-white/60">Transaction ID</p>
                            <p className="text-white font-mono text-xs">{proof.transactionId}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span className="text-white/60 text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(proof.submittedAt), 'MMM dd, yyyy HH:mm')}
                          </span>
                          {proof.proofFilePath && (
                            <Badge variant="outline" className="text-blue-400 border-blue-400">
                              Has file
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Payment Details */}
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white">
                  {selectedProof ? 'Payment Details' : 'Select Payment to Review'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedProof ? (
                  <div className="text-center py-12">
                    <Eye className="h-12 w-12 text-white/40 mx-auto mb-4" />
                    <p className="text-white/60">Select a payment proof from the list to review details</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* User Information */}
                    <div className="p-4 bg-white/5 rounded-lg">
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        User Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Name</p>
                          <p className="text-white">{selectedProof.userName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-white/60">Email</p>
                          <p className="text-white">{selectedProof.email}</p>
                        </div>
                        <div>
                          <p className="text-white/60">User ID</p>
                          <p className="text-white">#{selectedProof.userId}</p>
                        </div>
                        <div>
                          <p className="text-white/60">Submitted</p>
                          <p className="text-white">{format(new Date(selectedProof.submittedAt), 'MMM dd, yyyy HH:mm')}</p>
                        </div>
                        <div>
                          <p className="text-white/60">For Team</p>
                          <p className="text-white">GW{selectedProof.gameweekId} Team #{selectedProof.teamNumber}</p>
                        </div>
                        <div>
                          <p className="text-white/60">Status</p>
                          <p className="text-orange-400 capitalize">{selectedProof.status}</p>
                        </div>
                      </div>
                    </div>

                    {/* Payment Information */}
                    <div className="p-4 bg-white/5 rounded-lg">
                      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" />
                        Payment Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-white/60">Method</p>
                          <p className="text-white">{selectedProof.paymentMethod}</p>
                        </div>
                        <div>
                          <p className="text-white/60">Amount</p>
                          <p className="text-white font-bold">₹{selectedProof.amount}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-white/60">Transaction ID</p>
                          <p className="text-white font-mono">{selectedProof.transactionId}</p>
                        </div>
                      </div>
                    </div>

                    {/* User Notes */}
                    {selectedProof.notes && (
                      <div className="p-4 bg-white/5 rounded-lg">
                        <h3 className="text-white font-semibold mb-2">User Notes</h3>
                        <p className="text-white/80 text-sm">{selectedProof.notes}</p>
                      </div>
                    )}

                    {/* Payment Proof File */}
                    {selectedProof.proofFilePath && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <h3 className="text-blue-400 font-semibold mb-3">Payment Proof File</h3>
                        <Button
                          onClick={() => handleViewFile(selectedProof.id)}
                          variant="outline"
                          className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-white"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          View/Download File
                        </Button>
                      </div>
                    )}

                    {/* Admin Notes */}
                    <div>
                      <label className="text-white font-medium mb-2 block">Admin Notes (Optional)</label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes about this verification..."
                        className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                        rows={3}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApprove(selectedProof.id)}
                        disabled={verifyPaymentMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Payment
                      </Button>
                      <Button
                        onClick={() => handleReject(selectedProof.id)}
                        disabled={verifyPaymentMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Payment
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
