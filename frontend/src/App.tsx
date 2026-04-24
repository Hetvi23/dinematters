import { FrappeProvider } from 'frappe-react-sdk'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { Toaster } from './components/ui/sonner'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RestaurantProvider } from './contexts/RestaurantContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import FeatureProtectedRoute from './components/FeatureProtectedRoute'
import { PageSkeleton } from './components/PageSkeleton'

// Lazy load all page components for code-splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Login = lazy(() => import('./pages/Login'))
const MyAccount = lazy(() => import('./pages/MyAccount'))
const FeatureLocked = lazy(() => import('./pages/FeatureLocked'))
const TieredSetupWizard = lazy(() => import('./pages/TieredSetupWizard'))
const ModuleDetail = lazy(() => import('./pages/ModuleDetail'))
const Orders = lazy(() => import('./pages/Orders'))
const AcceptOrders = lazy(() => import('./pages/AcceptOrders'))
const PastOrders = lazy(() => import('./pages/PastOrders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const QRCodes = lazy(() => import('./pages/QRCodes'))
const HomeFeaturesManager = lazy(() => import('./pages/HomeFeaturesManager'))
const LegacyContent = lazy(() => import('./pages/LegacyContent'))
const LegacySignatureDish = lazy(() => import('./pages/LegacySignatureDish'))
const Payment = lazy(() => import('./pages/Payment'))
const PaymentSettings = lazy(() => import('./pages/PaymentSettings'))
const OrderSettings = lazy(() => import('./pages/OrderSettings'))
const RecommendationsEngine = lazy(() => import('./pages/RecommendationsEngine'))
const Customers = lazy(() => import('./pages/Customers'))
const Bookings = lazy(() => import('./pages/Bookings'))
const Coupons = lazy(() => import('./pages/Coupons'))
const AdminRestaurantManagement = lazy(() => import('./pages/AdminRestaurantManagement'))
const AdminRestaurantDetailsPage = lazy(() => import('./pages/AdminRestaurantDetails'))
const AIEnhancementPage = lazy(() => import('./pages/AIEnhancementPage'))
const AIGalleryPage = lazy(() => import('./pages/AIGalleryPage'))
const AIMenuThemeBackgroundPage = lazy(() => import('./pages/AIMenuThemeBackgroundPage'))
const AIMenuThemeHistoryPage = lazy(() => import('./pages/AIMenuThemeHistoryPage'))
const AutopaySetupPage = lazy(() => import('./pages/AutopaySetupPage'))
const LoyaltySettings = lazy(() => import('./pages/LoyaltySettings'))
const CustomerInsights = lazy(() => import('./pages/CustomerInsights'))
const PaymentConfiguration = lazy(() => import('./pages/PaymentConfiguration'))
const POSIntegration = lazy(() => import('./pages/POSIntegration'))
const LedgerPage = lazy(() => import('./pages/LedgerPage'))
const WhatsAppOrders = lazy(() => import('./pages/WhatsAppOrders'))
const MarketingOverview = lazy(() => import('./pages/MarketingOverview'))
const MarketingCampaigns = lazy(() => import('./pages/MarketingCampaigns'))
const MarketingAutomation = lazy(() => import('./pages/MarketingAutomation'))
const MarketingSegments = lazy(() => import('./pages/MarketingSegments'))
const MarketingAnalytics = lazy(() => import('./pages/MarketingAnalytics'))
const Events = lazy(() => import('./pages/Events'))
const LogisticsHub = lazy(() => import('./pages/LogisticsHub'))
const GoogleGrowth = lazy(() => import('./pages/GoogleGrowth'))
const GoogleGrowthSync = lazy(() => import('./pages/GoogleGrowthSync'))
const GoogleGrowthReviews = lazy(() => import('./pages/GoogleGrowthReviews'))
const TeamManagement = lazy(() => import('./pages/TeamManagement'))
const MenuManagement = lazy(() => import('./pages/MenuManagement'))


function AppContent() {
	const { theme } = useTheme()
	return (
		<>
			<BrowserRouter basename="/dinematters">
				<Suspense fallback={<Layout><PageSkeleton /></Layout>}>
					<Routes>
						{/* Public routes */}
						<Route path="/login" element={<Login />} />

						{/* Protected routes */}
						<Route element={<ProtectedRoute />}>
							<Route path="/" element={<Navigate to="/dashboard" replace />} />
							<Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
							<Route path="/account" element={<Layout><MyAccount /></Layout>} />
							<Route path="/feature-locked" element={<FeatureLocked />} />
							<Route path="/setup" element={<Layout><TieredSetupWizard /></Layout>} />
							<Route path="/setup/:stepId" element={<Layout><TieredSetupWizard /></Layout>} />

							<Route path="/Home Feature" element={<Navigate to="/home-features" replace />} />
							<Route path="/Home%20Feature" element={<Navigate to="/home-features" replace />} />

							<Route path="/admin/restaurants" element={<Layout><AdminRestaurantManagement /></Layout>} />
							<Route path="/admin/restaurants/:id" element={<Layout><AdminRestaurantDetailsPage /></Layout>} />

							<Route element={<FeatureProtectedRoute feature="ordering" />}>
								<Route path="/orders" element={<Layout><Orders /></Layout>} />
								<Route path="/accept-orders" element={<Layout><AcceptOrders /></Layout>} />
								<Route path="/orders/:orderId" element={<Layout><OrderDetail /></Layout>} />
								<Route path="/past-orders" element={<Layout><PastOrders /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="coupons" />}>
								<Route path="/coupons" element={<Layout><Coupons /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="ordering" />}>
								<Route path="/pos-integration" element={<Layout><POSIntegration /></Layout>} />
								<Route path="/frontend-ordering" element={<Layout><OrderSettings /></Layout>} />
								<Route path="/order-settings" element={<Layout><OrderSettings /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="loyalty" />}>
								<Route path="/loyalty-settings" element={<Layout><LoyaltySettings /></Layout>} />
								<Route path="/loyalty-insights" element={<Layout><CustomerInsights /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="tableBooking" />}>
								<Route path="/bookings" element={<Layout><Bookings /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="events" />}>
								<Route path="/events" element={<Layout><Events /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="ordering" />}>
								<Route path="/customers" element={<Layout><Customers /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute feature="aiRecommendations" />}>
								<Route path="/recommendations-engine" element={<Layout><RecommendationsEngine /></Layout>} />
							</Route>

							<Route element={<FeatureProtectedRoute requireGold />}>
								<Route path="/whatsapp-orders" element={<Layout><WhatsAppOrders /></Layout>} />
							</Route>

							{/* Marketing Studio (DIAMOND only) */}
							<Route element={<FeatureProtectedRoute feature="marketing_studio" />}>
								<Route path="/marketing" element={<Layout><MarketingOverview /></Layout>} />
								<Route path="/marketing/campaigns" element={<Layout><MarketingCampaigns /></Layout>} />
								<Route path="/marketing/campaigns/:id" element={<Layout><MarketingCampaigns /></Layout>} />
								<Route path="/marketing/automation" element={<Layout><MarketingAutomation /></Layout>} />
								<Route path="/marketing/segments" element={<Layout><MarketingSegments /></Layout>} />
								<Route path="/marketing/analytics" element={<Layout><MarketingAnalytics /></Layout>} />
							</Route>
                            
                            {/* Google Growth (GOLD/DIAMOND) */}
                            <Route element={<FeatureProtectedRoute feature="google_growth" />}>
                                <Route path="/google-growth" element={<Layout><GoogleGrowth /></Layout>} />
                                <Route path="/google-growth/sync" element={<Layout><GoogleGrowthSync /></Layout>} />
                                <Route path="/google-growth/reviews" element={<Layout><GoogleGrowthReviews /></Layout>} />
                            </Route>

							<Route path="/billing" element={<Layout><PaymentSettings /></Layout>} />
							<Route path="/billing/configure" element={<Layout><PaymentConfiguration /></Layout>} />
							<Route path="/ledger" element={<Layout><LedgerPage /></Layout>} />
							<Route path="/autopay-setup" element={<Layout><AutopaySetupPage /></Layout>} />
							<Route path="/team" element={<Layout><TeamManagement /></Layout>} />

							<Route path="/menu" element={<Layout><MenuManagement /></Layout>} />
							<Route path="/qr-codes" element={<Layout><QRCodes /></Layout>} />

							<Route path="/home-features" element={<Layout><HomeFeaturesManager /></Layout>} />

							<Route path="/ai-enhancements" element={<Layout><AIEnhancementPage /></Layout>} />
							<Route path="/ai-gallery" element={<Layout><AIGalleryPage /></Layout>} />
							<Route path="/ai-menu-theme-background" element={<Layout><AIMenuThemeBackgroundPage /></Layout>} />
							<Route path="/ai-menu-theme-history" element={<Layout><AIMenuThemeHistoryPage /></Layout>} />

							<Route path="/Legacy Content" element={<Layout><LegacyContent /></Layout>} />
							<Route path="/Legacy Signature Dish" element={<Layout><LegacySignatureDish /></Layout>} />
							<Route path="/logistics-hub" element={<Layout><LogisticsHub /></Layout>} />
							<Route path="/restaurant/:restaurantId/payment" element={<Layout><Payment /></Layout>} />
							<Route path="/restaurant/:restaurantId/billing" element={<Layout><PaymentSettings /></Layout>} />
							<Route path="/restaurant/:restaurantId/billing/configure" element={<Layout><PaymentConfiguration /></Layout>} />
							<Route path="/:doctype/:docname" element={<Layout><ModuleDetail /></Layout>} />
						</Route>
					</Routes>
				</Suspense>
			</BrowserRouter>
			<Toaster richColors theme={theme} />
		</>
	)
}

function App() {
	return (
		<FrappeProvider
			swrConfig={{
				errorRetryCount: 2
			}}
			socketPort={import.meta.env.VITE_SOCKET_PORT || undefined}
			siteName={(window as any)?.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME}>
			<ThemeProvider>
				<RestaurantProvider>
					<AppContent />
				</RestaurantProvider>
			</ThemeProvider>
		</FrappeProvider>
	)
}

export default App
