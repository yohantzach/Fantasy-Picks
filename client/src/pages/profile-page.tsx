import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Trophy, 
  Calendar, 
  CreditCard, 
  Trash2, 
  Shield, 
  History,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  X
} from "lucide-react";
import { format } from "date-fns";
import Navigation from "@/components/ui/navigation";
import { Redirect } from "wouter";

interface GameweekHistory {
  id: number;
  gameweekNumber: number;
  teamName: string;
  points: number;
  rank: number;
  totalParticipants: number;
  hasPaid: boolean;
  createdAt: string;
}

interface PaymentHistory {
  id: number;
  gameweekNumber: number;
  amount: number;
  status: string;
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: "", phone: "" });
  
  // Initialize edit data when user data is available
  React.useEffect(() => {
    if (user) {
      setEditData({
        name: user.name || "",
        phone: user.phone || ""
      });
    }
  }, [user]);

  // Redirect if not logged in
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Fetch user's gameweek history
  const { data: gameweekHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["/api/user/gameweek-history"],
    queryFn: async () => {
      try {
        const result = await apiRequest("GET", "/api/user/gameweek-history");
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error("Failed to fetch gameweek history:", error);
        return [];
      }
    }
  });

  // Fetch user's payment history
  const { data: paymentHistory = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/user/payment-history"],
    queryFn: async () => {
      try {
        const result = await apiRequest("GET", "/api/user/payment-history");
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error("Failed to fetch payment history:", error);
        return [];
      }
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string }) => {
      return apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/user/account");
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });
      logoutMutation.mutate();
    },
    onError: (error: any) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete account",
        variant: "destructive",
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate(editData);
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmation.toLowerCase() === "delete my account") {
      deleteAccountMutation.mutate();
      setShowDeleteDialog(false);
    } else {
      toast({
        title: "Confirmation Required",
        description: "Please type exactly 'delete my account' to confirm",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-600"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRankBadge = (rank: number, total: number) => {
    const percentage = (rank / total) * 100;
    if (percentage <= 10) {
      return <Badge className="bg-yellow-500">🥇 Top 10%</Badge>;
    } else if (percentage <= 25) {
      return <Badge className="bg-gray-400">🥈 Top 25%</Badge>;
    } else if (percentage <= 50) {
      return <Badge className="bg-amber-600">🥉 Top 50%</Badge>;
    } else {
      return <Badge variant="outline">{rank}/{total}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Navigation />
      
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <img 
              src="/fantasy_logo.jpg" 
              alt="Fantasy Picks Logo" 
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover"
            />
            <span>My Profile</span>
          </h1>
          <p className="text-white/70 text-base sm:text-lg">
            Manage your account, view your fantasy football journey
          </p>
        </div>

        {/* Profile Summary Card */}
        <Card className="bg-white/5 border-white/20 mb-6 sm:mb-8">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-fpl-green rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">{user.name}</h2>
                    <p className="text-white/70 text-sm sm:text-base">{user.email}</p>
                    <p className="text-white/70 text-sm sm:text-base">{user.phone || 'No phone number'}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {user.isAdmin && (
                    <Badge className="bg-yellow-500">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {user.hasPaid ? (
                    <Badge className="bg-green-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Paid Member
                    </Badge>
                  ) : (
                    <Badge className="bg-red-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Payment Required
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-white/30 text-white">
                    Member since {user.createdAt ? format(new Date(user.createdAt), 'MMM yyyy') : 'Unknown'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/10 mb-4 sm:mb-6 h-auto">
            <TabsTrigger 
              value="history" 
              className="data-[state=active]:bg-fpl-green data-[state=active]:text-white text-white/70 text-xs sm:text-sm py-2 sm:py-3"
            >
              <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Gameweek </span>History
            </TabsTrigger>
            <TabsTrigger 
              value="payments" 
              className="data-[state=active]:bg-fpl-green data-[state=active]:text-white text-white/70 text-xs sm:text-sm py-2 sm:py-3"
            >
              <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-fpl-green data-[state=active]:text-white text-white/70 text-xs sm:text-sm py-2 sm:py-3"
            >
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Account </span>Settings
            </TabsTrigger>
          </TabsList>

          {/* Gameweek History Tab */}
          <TabsContent value="history">
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-fpl-green" />
                  Your Fantasy Journey
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fpl-green"></div>
                  </div>
                ) : !Array.isArray(gameweekHistory) || gameweekHistory.length === 0 ? (
                  <div className="text-center py-8 text-white/70">
                    <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>No gameweek history yet</p>
                    <p className="text-sm">Your participation history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(gameweekHistory) && gameweekHistory.map((gw: GameweekHistory) => (
                      <div
                        key={gw.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 rounded-lg border border-white/10"
                      >
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="text-center sm:text-left">
                              <div className="text-lg sm:text-2xl font-bold text-fpl-green">GW{gw.gameweekNumber}</div>
                              <div className="text-xs text-white/60">
                                {format(new Date(gw.createdAt), 'MMM dd')}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-medium text-sm sm:text-base">{gw.teamName}</h4>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                                <span className="text-white/70 text-xs sm:text-sm">{gw.points} points</span>
                                {getRankBadge(gw.rank, gw.totalParticipants)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-center sm:text-right">
                          {getStatusBadge(gw.hasPaid ? "success" : "pending")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="payments">
            <Card className="bg-white/5 border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-fpl-green" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fpl-green"></div>
                  </div>
                ) : !Array.isArray(paymentHistory) || paymentHistory.length === 0 ? (
                  <div className="text-center py-8 text-white/70">
                    <CreditCard className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>No payment history yet</p>
                    <p className="text-sm">Your payment transactions will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(paymentHistory) && paymentHistory.map((payment: PaymentHistory) => (
                      <div
                        key={payment.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-white/5 rounded-lg border border-white/10"
                      >
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div className="text-center sm:text-left">
                              <div className="text-lg font-bold text-fpl-green">₹{payment.amount}</div>
                              <div className="text-xs text-white/60">
                                GW{payment.gameweekNumber}
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-white font-medium text-sm sm:text-base">{payment.paymentMethod}</h4>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                                <span className="text-white/70 text-xs sm:text-sm">
                                  {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                                </span>
                                {payment.transactionId && (
                                  <span className="text-white/50 text-xs">
                                    ID: {payment.transactionId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-center sm:text-right">
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Settings Tab */}
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Account Actions */}
              <Card className="bg-white/5 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-fpl-green" />
                    Account Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-400 mt-1" />
                      <div className="flex-1">
                        <h4 className="text-red-400 font-medium mb-2">Danger Zone</h4>
                        <p className="text-white/80 text-sm mb-4">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                        <Button
                          variant="destructive"
                          onClick={() => setShowDeleteDialog(true)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Account Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple border-red-500/30">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Delete Account
              </DialogTitle>
              <DialogDescription className="text-white/70">
                This action is permanent and cannot be undone. All your data including:
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <ul className="text-white/70 text-sm space-y-1 ml-4">
                <li>• Your profile information</li>
                <li>• All gameweek history and team data</li>
                <li>• Payment records</li>
                <li>• Account preferences</li>
              </ul>
              
              <div className="space-y-2">
                <Label className="text-white">
                  Type "delete my account" to confirm:
                </Label>
                <Input
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="delete my account"
                  className="bg-white/20 border-white/30 text-white"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={
                    deleteConfirmation.toLowerCase() !== "delete my account" || 
                    deleteAccountMutation.isPending
                  }
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteAccountMutation.isPending ? "Deleting..." : "Delete Forever"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeleteConfirmation("");
                  }}
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
