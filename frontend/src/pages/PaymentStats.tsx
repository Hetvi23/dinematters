import React, { useEffect, useState } from 'react';
import { useFrappePostCall } from 'frappe-react-sdk';
import { useRestaurant } from '../contexts/RestaurantContext';
import Layout from '../components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  CreditCard, 
  TrendingUp, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  IndianRupee,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentStats {
  current_month: string;
  total_orders: number;
  total_revenue: number;
  platform_fee_collected: number;
  monthly_minimum: number;
  minimum_due: number;
  razorpay_customer_id?: string;
  billing_status?: string;
}

const PaymentStats: React.FC = () => {
  const { selectedRestaurant } = useRestaurant();
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);

  const { call: getPaymentStats } = useFrappePostCall<{success: boolean, data: PaymentStats}>(
    'dinematters.dinematters.api.payments.get_restaurant_payment_stats'
  );

  // Billing settings handled via Billing Settings page and SaaS tokenization

  useEffect(() => {
    if (selectedRestaurant) {
      loadPaymentStats();
    }
  }, [selectedRestaurant]);

  const loadPaymentStats = async () => {
    if (!selectedRestaurant) return;
    
    setLoading(true);
    try {
      const response = await getPaymentStats({
        restaurant_id: selectedRestaurant.name
      });
      
      if (response?.success && response.data) {
        setStats(response.data);
      } else {
        toast.error('Failed to load payment statistics');
      }
    } catch (error) {
      console.error('Failed to load payment stats:', error);
      toast.error('Failed to load payment statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRazorpayAccount = async () => {
    if (!selectedRestaurant) return;
    
    try {
      const response = await createLinkedAccount({
        restaurant_id: selectedRestaurant.name,
        email: selectedRestaurant.owner_email,
        phone: selectedRestaurant.owner_phone,
        legal_business_name: selectedRestaurant.restaurant_name,
        business_type: 'partnership',
        contact_name: selectedRestaurant.owner_name
      });
      
      if (response?.success) {
        toast.success('Razorpay account created successfully!');
        loadPaymentStats(); // Reload stats
      } else {
        toast.error('Failed to create Razorpay account');
      }
    } catch (error) {
      console.error('Failed to create Razorpay account:', error);
      toast.error('Failed to create Razorpay account');
    }
  };

  const getKycStatusBadge = (status: string) => {
    const statusConfig = {
      'under_review': { color: 'yellow', text: 'Under Review', icon: Clock },
      'needs_clarification': { color: 'orange', text: 'Needs Clarification', icon: AlertCircle },
      'activated': { color: 'green', text: 'Activated', icon: CheckCircle },
      'suspended': { color: 'red', text: 'Suspended', icon: AlertCircle },
      'rejected': { color: 'red', text: 'Rejected', icon: AlertCircle },
      '': { color: 'gray', text: 'Not Started', icon: Clock }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig[''];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.color === 'green' ? 'default' : 'secondary'} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            <p className="text-gray-600">Please wait while we load your payment statistics.</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!selectedRestaurant) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">No Restaurant Selected</h2>
            <p className="text-gray-600">Please select a restaurant to view payment statistics.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Payment Dashboard</h1>
          <p className="text-gray-600">{selectedRestaurant.restaurant_name}</p>
        </div>

        {/* Razorpay Account Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Razorpay Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!stats?.razorpay_customer_id ? (
              <div className="text-center py-6">
                <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Billing Not Configured</h3>
                <p className="text-gray-600 mb-4">
                  Please configure your billing settings to enable recurring charges.
                </p>
                <Button onClick={() => window.location.href = `/dinematters/restaurant/${selectedRestaurant.name}/billing`}>
                  Open Billing Settings
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Billing Status:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                    {stats.billing_status || 'unknown'}
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {stats && (
          <>
            {/* Current Month Statistics */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_orders}</div>
                  <p className="text-xs text-muted-foreground">
                    This month ({stats.current_month})
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{stats.total_revenue?.toFixed(2) || '0.00'}</div>
                  <p className="text-xs text-muted-foreground">
                    Gross merchandise value
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Platform Fee Collected</CardTitle>
                  <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₹{stats.platform_fee_collected?.toFixed(2) || '0.00'}</div>
                  <p className="text-xs text-muted-foreground">
                    1.5% of total revenue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Status</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.minimum_due > 0 ? (
                      <span className="text-orange-600">₹{stats.minimum_due.toFixed(2)}</span>
                    ) : (
                      <span className="text-green-600">Paid</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.minimum_due > 0 ? 'Minimum fee due' : 'Monthly minimum met'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Minimum Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Minimum Fee
                </CardTitle>
                <CardDescription>
                  Monthly minimum platform fee: ₹{stats.monthly_minimum}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      ₹{stats.monthly_minimum}
                    </div>
                    <div className="text-sm text-blue-800">Monthly Minimum</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      ₹{stats.platform_fee_collected?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-green-800">Fee Collected</div>
                  </div>
                  
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      ₹{stats.minimum_due?.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-sm text-orange-800">Amount Due</div>
                  </div>
                </div>

                {stats.minimum_due > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-orange-800 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">Monthly Minimum Due</span>
                    </div>
                    <p className="text-sm text-orange-700">
                      You have collected ₹{stats.platform_fee_collected?.toFixed(2)} in platform fees this month. 
                      The minimum monthly fee is ₹{stats.monthly_minimum}, so you owe ₹{stats.minimum_due.toFixed(2)}.
                    </p>
                    <p className="text-sm text-orange-700 mt-2">
                      A payment link will be sent to your registered email at the end of the month.
                    </p>
                  </div>
                )}

                {stats.minimum_due === 0 && stats.platform_fee_collected >= stats.monthly_minimum && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Monthly Minimum Met</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Great! You've collected ₹{stats.platform_fee_collected?.toFixed(2)} in platform fees, 
                      which exceeds the monthly minimum of ₹{stats.monthly_minimum}.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
};

export default PaymentStats;