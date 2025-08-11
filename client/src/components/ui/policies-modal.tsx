import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TermsAndConditions } from "@/components/ui/terms-and-conditions";
import { PrivacyPolicy } from "@/components/ui/privacy-policy";
import { RefundPolicy } from "@/components/ui/refund-policy";
import { FileText } from "lucide-react";

interface PoliciesModalProps {
  trigger?: React.ReactNode;
  defaultTab?: "terms" | "privacy" | "refund";
}

export function PoliciesModal({ trigger, defaultTab = "terms" }: PoliciesModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="link" className="text-fpl-green hover:text-green-400 p-0 h-auto">
            <FileText className="h-4 w-4 mr-1" />
            View Policies
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-gradient-to-br from-fpl-purple via-purple-900 to-fpl-purple border-white/20">
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/10 mb-4">
            <TabsTrigger 
              value="terms" 
              className="data-[state=active]:bg-fpl-green data-[state=active]:text-white text-black"
            >
              Terms & Conditions
            </TabsTrigger>
            <TabsTrigger 
              value="privacy" 
              className="data-[state=active]:bg-fpl-green data-[state=active]:text-white text-black"
            >
              Privacy Policy
            </TabsTrigger>
            <TabsTrigger 
              value="refund" 
              className="data-[state=active]:bg-fpl-green data-[state=active]:text-white text-black"
            >
              Refund Policy
            </TabsTrigger>
          </TabsList>
          
          <div className="max-h-[70vh] overflow-y-auto">
            <TabsContent value="terms" className="mt-0">
              <TermsAndConditions />
            </TabsContent>
            
            <TabsContent value="privacy" className="mt-0">
              <PrivacyPolicy />
            </TabsContent>
            
            <TabsContent value="refund" className="mt-0">
              <RefundPolicy />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
