import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RefundPolicy() {
  return (
    <Card className="w-full bg-white/95 border-white/20">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-black text-center">
          Refund and Cancellation Policy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 text-black text-sm">
            <div>
              <p className="mb-4">
                This refund and cancellation policy outlines how you can cancel or seek a refund for a product/service that you have purchased through the Platform. Under this policy:
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">1. Cancellation Policy</h3>
              <p>
                Cancellations will only be considered if the request is made within 7 days of placing the order. However, cancellation requests may not be entertained if the orders have been communicated to such sellers/merchant(s) listed on the Platform and they have initiated the process of shipping them, or the product is out for delivery. In such an event, you may choose to reject the product at the doorstep.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">2. Perishable Items</h3>
              <p>
                MR GANESH B does not accept cancellation requests for perishable items like flowers, eatables, etc. However, the refund/replacement can be made if the user establishes that the quality of the product delivered is not good.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">3. Damaged or Defective Items</h3>
              <p>
                In case of receipt of damaged or defective items, please report to our customer service team. The request would be entertained once the seller/merchant listed on the Platform, has checked and determined the same at its own end. This should be reported within 7 days of receipt of products. In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within 7 days of receiving the product.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">4. Warranty Items</h3>
              <p>
                In case of complaints regarding the products that come with a warranty from the manufacturers, please refer the issue to them.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">5. Refund Processing</h3>
              <p>
                In case of any refunds approved by MR GANESH B, it will take 7 days for the refund to be processed to you.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Fantasy Sports Specific Terms</h3>
              <div className="space-y-2">
                <p><strong>• Contest Entry:</strong> Entry fees paid for fantasy sports contests are non-refundable once the contest has started or team selection deadline has passed.</p>
                
                <p><strong>• Technical Issues:</strong> In case of technical issues preventing contest participation, refunds will be processed within 7 working days after verification.</p>
                
                <p><strong>• Cancelled Matches:</strong> If real-life matches are cancelled or postponed, contest entry fees will be refunded automatically.</p>
                
                <p><strong>• Fair Play:</strong> No refunds will be provided for contests where users have violated fair play policies or terms of service.</p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Contact for Refunds</h3>
              <div className="space-y-1">
                <p><strong>Customer Service:</strong> 7540052627</p>
                <p><strong>Email:</strong> Available through platform contact form</p>
                <p><strong>Office Hours:</strong> Monday - Friday (9:00 AM - 6:00 PM)</p>
                <p><strong>Response Time:</strong> 24-48 hours for refund requests</p>
              </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
