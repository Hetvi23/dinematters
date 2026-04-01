import React, { useState } from 'react';
import { useFrappeGetDoc, useFrappeUpdateDoc } from 'frappe-react-sdk';
import { useRestaurant } from '../contexts/RestaurantContext';
import { 
  RefreshCcw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Save,
  ShieldCheck,
  Zap,
  Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from '../components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useFrappePostCall } from '@/lib/frappe';

export default function POSIntegration() {
  const { selectedRestaurant } = useRestaurant();
  const { data: restaurant, mutate } = useFrappeGetDoc('Restaurant', selectedRestaurant || '');
  const { updateDoc, loading: updating } = useFrappeUpdateDoc();
  const { call: syncMenu, loading: syncing } = useFrappePostCall('dinematters.dinematters.api.pos.sync_menu');

  const [provider, setProvider] = useState<string>(restaurant?.pos_provider || 'Petpooja');
  const [enabled, setEnabled] = useState<boolean>(!!restaurant?.pos_enabled);
  const [appKey, setAppKey] = useState<string>(restaurant?.pos_app_key || '');
  const [appSecret, setAppSecret] = useState<string>(''); 
  const [accessToken, setAccessToken] = useState<string>('');
  const [merchantId, setMerchantId] = useState<string>(restaurant?.pos_merchant_id || '');

  // Synchronize local state with fetched data when it arrives
  React.useEffect(() => {
    if (restaurant) {
      setProvider(restaurant.pos_provider || 'Petpooja');
      setEnabled(!!restaurant.pos_enabled);
      setAppKey(restaurant.pos_app_key || '');
      setMerchantId(restaurant.pos_merchant_id || '');
    }
  }, [restaurant]);

  const handleSave = async () => {
    if (!selectedRestaurant) return;
    try {
      const updateData: any = {
        pos_provider: provider,
        pos_enabled: enabled ? 1 : 0,
        pos_app_key: appKey,
        pos_merchant_id: merchantId,
      };

      if (appSecret) {
        updateData.pos_app_secret = appSecret;
      }

      if (accessToken) {
        updateData.pos_access_token = accessToken;
      }

      await updateDoc('Restaurant', selectedRestaurant, updateData);
      toast.success('POS Settings updated successfully');
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update settings');
    }
  };

  const handleSyncMenu = async () => {
    if (!enabled) {
      toast.error('Please enable POS integration first');
      return;
    }
    
    if (!selectedRestaurant) return;

    try {
      await syncMenu({
        restaurant_id: selectedRestaurant
      });
      toast.success('Menu sync initiated');
      mutate();
    } catch (error: any) {
      toast.error(error.message || 'Sync failed');
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex items-center gap-3">
            <Zap className="h-8 w-8 text-primary" />
            POS Integration
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Connect your restaurant's POS to automate menu sync and order management.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Pro Feature</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Select your provider and enter your API credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Integration</Label>
                  <p className="text-sm text-muted-foreground">Activate real-time connection with PETPOOJA</p>
                </div>
                <Checkbox 
                  checked={enabled}
                  onCheckedChange={(checked) => setEnabled(!!checked)}
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label>POS Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger className="bg-background/50 border-muted">
                      <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Petpooja">Petpooja (Official Partner)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>App Key</Label>
                    <Input 
                      placeholder="Enter App Key" 
                      value={appKey}
                      onChange={(e) => setAppKey(e.target.value)}
                      className="bg-background/50 border-muted focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>App Secret</Label>
                    <Input 
                      type="password" 
                      placeholder="••••••••••••" 
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      className="bg-background/50 border-muted focus:ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token (2026 Required)</Label>
                    <Input 
                      type="password" 
                      placeholder="••••••••••••" 
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="bg-background/50 border-muted focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Merchant ID / Restaurant ID</Label>
                  <Input 
                    placeholder="e.g. 12345" 
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    className="bg-background/50 border-muted focus:ring-primary/20"
                  />
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" />
                    For Petpooja, this is your unique Restaurant ID provided in the dev portal.
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t border-muted/50 py-4 flex justify-end">
              <Button 
                onClick={handleSave} 
                disabled={updating}
                className="gap-2 px-6 shadow-lg shadow-primary/20"
              >
                {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {updating ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-xl bg-card/40 backdrop-blur-lg">
            <CardHeader>
              <CardTitle className="text-xl">Menu Synchronization</CardTitle>
              <CardDescription>
                Fetch the latest categories, products, and prices from your POS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6 p-6 border-2 border-dashed border-muted/50 rounded-2xl bg-muted/5">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-lg font-semibold">Current Status</Label>
                    <div className="px-2 py-0.5 rounded-md bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
                      CONNECTED
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last synced: <span className="text-foreground font-medium">{restaurant?.pos_last_sync_at ? new Date(restaurant.pos_last_sync_at).toLocaleString() : 'Never'}</span>
                  </p>
                  {restaurant?.pos_sync_status && (
                    <p className="text-xs font-mono bg-muted p-2 rounded border border-muted-foreground/10 text-muted-foreground overflow-auto max-h-24">
                      {restaurant.pos_sync_status}
                    </p>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="gap-2 border-primary/20 hover:bg-primary/5 transition-all"
                  onClick={handleSyncMenu}
                  disabled={syncing || !enabled}
                >
                  <RefreshCcw className={cn("h-4 w-4 text-primary", syncing && "animate-spin")} />
                  {syncing ? 'Syncing...' : 'Sync Menu Now'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-gradient-to-br from-primary/10 to-primary/5 border-primary/10 overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary/10 rounded-full blur-3xl" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Integration Benefits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {[
                  'Automated Menu Sync (Categories, Items, Prices)',
                  'One-click Order Push to KOT',
                  'Inventory Sync (Coming Soon)',
                  'Real-time Status Updates',
                  'Reduced Manual Data Entry'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-tight text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Our team can help you set up your Petpooja integration in less than 5 minutes.
              </p>
              <Button variant="secondary" className="w-full gap-2 text-primary" asChild>
                <a href="https://petpooja.com/developers" target="_blank" rel="noreferrer">
                  Developer Documentation
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
