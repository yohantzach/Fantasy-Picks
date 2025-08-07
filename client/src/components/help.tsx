import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Mail, Phone, MessageCircle } from "lucide-react";

export function Help() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="text-fpl-green hover:text-green-400 p-0 text-xs">
          Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Help & Support</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Contact Information */}
            <div className="bg-fpl-green/10 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-3">Contact Support</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-fpl-green" />
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-sm text-gray-600">fantasypicks09@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-fpl-green" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-sm text-gray-600">+91-8000-123-456</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-fpl-green" />
                  <div>
                    <p className="font-medium">Chat Support</p>
                    <p className="text-sm text-gray-600">Available 24/7</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div>
              <h3 className="font-bold text-lg mb-4">Frequently Asked Questions</h3>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger>How do I create a team?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <p>To create a team:</p>
                      <ol className="list-decimal pl-6 space-y-1">
                        <li>Select your formation (e.g., 4-4-2, 3-5-2)</li>
                        <li>Choose 11 players within the ₹100 million budget</li>
                        <li>Select a captain (2x points) and vice-captain (1.5x points)</li>
                        <li>Save your team before the deadline</li>
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                  <AccordionTrigger>What is the scoring system?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <p><strong>Goalkeepers & Defenders:</strong></p>
                      <ul className="list-disc pl-6 text-sm">
                        <li>Playing 60+ minutes: +2 points</li>
                        <li>Clean sheet: +4 points</li>
                        <li>Goal: +6 points</li>
                        <li>Assist: +3 points</li>
                        <li>Every 3 saves: +1 point</li>
                      </ul>
                      <p><strong>Midfielders:</strong></p>
                      <ul className="list-disc pl-6 text-sm">
                        <li>Playing 60+ minutes: +2 points</li>
                        <li>Goal: +5 points</li>
                        <li>Assist: +3 points</li>
                        <li>Clean sheet: +1 point</li>
                      </ul>
                      <p><strong>Forwards:</strong></p>
                      <ul className="list-disc pl-6 text-sm">
                        <li>Playing 60+ minutes: +2 points</li>
                        <li>Goal: +4 points</li>
                        <li>Assist: +3 points</li>
                      </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                  <AccordionTrigger>When can I make changes to my team?</AccordionTrigger>
                  <AccordionContent>
                    You can make unlimited changes to your team until the deadline. The deadline is typically 30 minutes before the first match kicks off. After the deadline, no changes are allowed.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                  <AccordionTrigger>How do payments work?</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <p><strong>Entry Fees:</strong> ₹20 per gameweek</p>
                      <p><strong>Payment Methods:</strong> UPI, Credit/Debit Card, Net Banking</p>
                      <p><strong>Withdrawals:</strong> Minimum ₹200, processed in 3-7 business days</p>
                      <p><strong>KYC:</strong> Required for withdrawals above ₹10,000</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5">
                  <AccordionTrigger>Can I create multiple teams?</AccordionTrigger>
                  <AccordionContent>
                    Yes, you can create multiple teams for each gameweek. Each team requires a separate entry fee of ₹20. This allows you to try different strategies and formations.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-6">
                  <AccordionTrigger>What happens if a match is cancelled?</AccordionTrigger>
                  <AccordionContent>
                    If a match is cancelled or postponed, points from that match will not count towards your total. If the entire gameweek is affected, contests may be cancelled and entry fees refunded.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-7">
                  <AccordionTrigger>How are rankings calculated?</AccordionTrigger>
                  <AccordionContent>
                    Rankings are based on total points scored by your team. In case of a tie, the following tiebreakers are used in order:
                    <ol className="list-decimal pl-6 mt-2">
                      <li>Higher captain points</li>
                      <li>Higher vice-captain points</li>
                      <li>Earlier team submission time</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-8">
                  <AccordionTrigger>Is my data safe?</AccordionTrigger>
                  <AccordionContent>
                    Yes, we use industry-standard encryption and security measures to protect your personal and financial information. We do not share your data with third parties without your consent.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-9">
                  <AccordionTrigger>What if I face technical issues?</AccordionTrigger>
                  <AccordionContent>
                    If you encounter technical issues:
                    <ul className="list-disc pl-6 mt-2">
                      <li>Try refreshing the page or app</li>
                      <li>Clear your browser cache</li>
                      <li>Contact support at fantasypicks09@gmail.com</li>
                      <li>Include screenshots and error details for faster resolution</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-10">
                  <AccordionTrigger>Age and location restrictions?</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-6">
                      <li>Must be 18+ years old</li>
                      <li>Available only for Indian residents</li>
                      <li>Residents of Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, and Telangana cannot participate in paid contests</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Quick Tips */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-3">Quick Tips for Success</h3>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Research player form and fixture difficulty</li>
                <li>Consider players from teams with good fixtures</li>
                <li>Balance your team with both premium and budget players</li>
                <li>Captain players likely to score or assist</li>
                <li>Monitor injury news and team rotations</li>
                <li>Don't chase last week's points - think ahead</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
