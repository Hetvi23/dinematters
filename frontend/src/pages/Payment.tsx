import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useFrappeGetDoc, useFrappePostCall } from 'frappe-react-sdk';
import Layout from '../components/Layout';
import RazorpayCheckout from '../components/RazorpayCheckout';
import { OTPVerification } from '../components/OTPVerification';
import { useRestaurant } from '../contexts/RestaurantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { ArrowLeft, ShoppingCart, User, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getStoredVerifiedPhone, setVerifiedPhone, normalizePhone, isVerifiedExpired } from '../utils/otpStorage';

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface CartItem {
  product: string;
  product_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

const Payment: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get table number from URL params
  const tableNumber = searchParams.get('table') ? parseInt(searchParams.get('table')!) : undefined;
  
  // Customer details state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Order state
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showPayment, setShowPayment] = useState(false);
  const [showOTPStep, setShowOTPStep] = useState(false);

  const { restaurantConfig } = useRestaurant();
  const verifyMyUser = restaurantConfig?.settings?.verifyMyUser === true;

  // API calls
  const { data: restaurant } = useFrappeGetDoc('Restaurant', restaurantId);
  
  const { call: getCartItems } = useFrappePostCall<{success: boolean, data: CartItem[]}>(
    'dinematters.dinematters.api.cart.get_cart'
  );
  const { call: checkVerified } = useFrappePostCall<{success: boolean, verified: boolean}>(
    'dinematters.dinematters.api.otp.check_verified'
  );

  // Load cart items on component mount
  useEffect(() => {
    if (restaurantId) {
      loadCartItems();
    }
  }, [restaurantId]);

  const loadCartItems = async () => {
    try {
      const response = await getCartItems({ restaurant_id: restaurantId });
      
      if (response?.success && response.data) {
        const items: OrderItem[] = response.data.map(item => ({
          product_id: item.product,
          product_name: item.product_name,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount
        }));
        
        setOrderItems(items);
        setTotalAmount(items.reduce((sum, item) => sum + item.amount, 0));
      } else {
        toast.error('Failed to load cart items');
      }
    } catch (error) {
      console.error('Failed to load cart:', error);
      toast.error('Failed to load cart items');
    }
  };

  const handleCustomerDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!customerPhone.trim()) {
      toast.error('Please enter your phone number');
      return;
    }

    if (verifyMyUser) {
      const normalized = normalizePhone(customerPhone);
      const stored = getStoredVerifiedPhone();
      if (stored === normalized && !isVerifiedExpired()) {
        try {
          const res = await checkVerified({ phone: customerPhone });
          if (res?.success && res.verified) {
            setShowPayment(true);
            return;
          }
        } catch {
          // fall through to OTP step
        }
      }
      setShowOTPStep(true);
    } else {
      setShowPayment(true);
    }
  };

  const handleOTPVerified = () => {
    setVerifiedPhone(customerPhone);
    setShowOTPStep(false);
    setShowPayment(true);
  };

  const handlePaymentSuccess = (orderId: string, paymentId: string) => {
    toast.success('Payment successful!');
    
    // Navigate to order confirmation page
    navigate(`/restaurant/${restaurantId}/order/${orderId}`, {
      state: { paymentId, success: true }
    });
  };

  const handlePaymentFailure = (error: any) => {
    console.error('Payment failed:', error);
    toast.error('Payment failed. Please try again.');
    setShowPayment(false);
  };

  const goBack = () => {
    if (showPayment) {
      setShowPayment(false);
    } else if (showOTPStep) {
      setShowOTPStep(false);
    } else {
      navigate(`/restaurant/${restaurantId}/menu`);
    }
  };

  if (!restaurant) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <p className="text-gray-600">Please wait while we load the restaurant details.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (orderItems.length === 0) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <ShoppingCart className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <CardTitle>Your cart is empty</CardTitle>
              <CardDescription>
                Add some items to your cart before proceeding to payment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate(`/restaurant/${restaurantId}/menu`)}
                className="w-full"
              >
                Browse Menu
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Checkout</h1>
            <p className="text-gray-600">{restaurant.restaurant_name}</p>
            {tableNumber && (
              <p className="text-sm text-blue-600">Table {tableNumber}</p>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column - Order Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{item.product_name}</h4>
                      <p className="text-sm text-gray-600">
                        ₹{item.rate.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <div className="font-medium">
                      ₹{item.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
                
                <Separator />
                
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span>₹{totalAmount.toFixed(2)}</span>
                </div>
                
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  <p>• Platform fee (1.5%): ₹{(totalAmount * 0.015).toFixed(2)}</p>
                  <p>• Restaurant receives: ₹{(totalAmount * 0.985).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Customer Details, OTP, or Payment */}
          <div>
            {showOTPStep ? (
              <Card>
                <CardHeader>
                  <CardTitle>Verify Your Phone</CardTitle>
                  <CardDescription>
                    Enter the 4-digit OTP sent to {customerPhone}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <OTPVerification
                    restaurantId={restaurantId!}
                    restaurantName={restaurant.restaurant_name}
                    phone={customerPhone}
                    name={customerName}
                    email={customerEmail}
                    onVerified={handleOTPVerified}
                  />
                </CardContent>
              </Card>
            ) : !showPayment ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Customer Details
                  </CardTitle>
                  <CardDescription>
                    Please provide your details to proceed with payment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCustomerDetailsSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Name *</Label>
                      <Input
                        id="customerName"
                        type="text"
                        placeholder="Enter your full name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Phone Number *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="customerPhone"
                          type="tel"
                          placeholder="Enter your phone number"
                          className="pl-10"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="customerEmail">Email (Optional)</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="customerEmail"
                          type="email"
                          placeholder="Enter your email address"
                          className="pl-10"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full" size="lg">
                      Proceed to Payment
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <RazorpayCheckout
                restaurantId={restaurantId!}
                orderItems={orderItems}
                totalAmount={totalAmount}
                customerName={customerName}
                customerEmail={customerEmail}
                customerPhone={customerPhone}
                tableNumber={tableNumber}
                onSuccess={handlePaymentSuccess}
                onFailure={handlePaymentFailure}
              />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Payment;