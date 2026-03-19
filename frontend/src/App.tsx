import { FrappeProvider } from 'frappe-react-sdk'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RestaurantProvider } from './contexts/RestaurantContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import FeatureProtectedRoute from './components/FeatureProtectedRoute'
import FeatureLocked from './pages/FeatureLocked'
import SmartSetupWizard from './pages/SmartSetupWizard'
import LiteSetupWizard from './pages/LiteSetupWizard'
import Modules from './pages/Modules'
import ModuleList from './pages/ModuleList'
import ModuleDetail from './pages/ModuleDetail'
import Orders from './pages/Orders'
import AcceptOrders from './pages/AcceptOrders'
import PastOrders from './pages/PastOrders'
import Products from './pages/Products'
import Categories from './pages/Categories'
import OrderDetail from './pages/OrderDetail'
import ProductDetail from './pages/ProductDetail'
import ProductEdit from './pages/ProductEdit'
import ProductNew from './pages/ProductNew'
import CategoryDetail from './pages/CategoryDetail'
import CategoryEdit from './pages/CategoryEdit'
import CategoryNew from './pages/CategoryNew'
import QRCodes from './pages/QRCodes'
import HomeFeaturesManager from './pages/HomeFeaturesManager'
import LegacyContent from './pages/LegacyContent'
import LegacySignatureDish from './pages/LegacySignatureDish'
import Payment from './pages/Payment'
import PaymentSettings from './pages/PaymentSettings'
import RecommendationsEngine from './pages/RecommendationsEngine'
import Customers from './pages/Customers'
import Bookings from './pages/Bookings'
import Coupons from './pages/Coupons'
import AdminRestaurantManagement from './pages/AdminRestaurantManagement'
import AIEnhancementPage from './pages/AIEnhancementPage'
import AIGalleryPage from './pages/AIGalleryPage'
import AIMenuThemeBackgroundPage from './pages/AIMenuThemeBackgroundPage'
import AIMenuThemeHistoryPage from './pages/AIMenuThemeHistoryPage'
import AutopaySetupPage from './pages/AutopaySetupPage'

function AppContent() {
	const { theme } = useTheme()
	return (
		<>
			<BrowserRouter basename="/dinematters">
				<Routes>
					{/* Public routes */}
					<Route path="/login" element={<Login />} />

					{/* Protected routes */}
					<Route element={<ProtectedRoute />}>
						<Route path="/" element={<Navigate to="/dashboard" replace />} />
						<Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
						<Route path="/feature-locked" element={<FeatureLocked />} />
						<Route path="/setup" element={<Layout><SmartSetupWizard /></Layout>} />
						<Route path="/setup/:stepId" element={<Layout><SmartSetupWizard /></Layout>} />
						<Route path="/lite-setup" element={<Layout><LiteSetupWizard /></Layout>} />
						<Route path="/lite-setup/:stepId" element={<Layout><LiteSetupWizard /></Layout>} />
						<Route path="/modules" element={<Layout><Modules /></Layout>} />
						{/* Redirect Home Feature to dedicated page */}
						<Route path="/Home Feature" element={<Navigate to="/home-features" replace />} />
						<Route path="/Home%20Feature" element={<Navigate to="/home-features" replace />} />

						{/* Admin Route - Restaurant Management */}
						<Route path="/admin/restaurants" element={<Layout><AdminRestaurantManagement /></Layout>} />

						{/* PRO Feature: Ordering - Requires PRO plan */}
						<Route element={<FeatureProtectedRoute feature="ordering" />}>
							<Route path="/orders" element={<Layout><Orders /></Layout>} />
							<Route path="/accept-orders" element={<Layout><AcceptOrders /></Layout>} />
							<Route path="/orders/:orderId" element={<Layout><OrderDetail /></Layout>} />
							<Route path="/past-orders" element={<Layout><PastOrders /></Layout>} />
						</Route>

						{/* PRO Feature: Coupons - Requires PRO plan */}
						<Route element={<FeatureProtectedRoute feature="coupons" />}>
							<Route path="/coupons" element={<Layout><Coupons /></Layout>} />
						</Route>

						{/* PRO Feature: Table Bookings & Customers - Requires PRO plan (ordering feature) */}
						<Route element={<FeatureProtectedRoute feature="ordering" />}>
							<Route path="/bookings" element={<Layout><Bookings /></Layout>} />
							<Route path="/customers" element={<Layout><Customers /></Layout>} />
						</Route>

						{/* PRO Feature: AI Recommendations - Requires PRO plan */}
						<Route element={<FeatureProtectedRoute feature="aiRecommendations" />}>
							<Route path="/recommendations-engine" element={<Layout><RecommendationsEngine /></Layout>} />
						</Route>

						{/* Free features - Available to all plans */}
						<Route path="/products" element={<Layout><Products /></Layout>} />
						<Route path="/products/new" element={<Layout><ProductNew /></Layout>} />
						<Route path="/products/:productId/edit" element={<Layout><ProductEdit /></Layout>} />
						<Route path="/products/:productId" element={<Layout><ProductDetail /></Layout>} />
						<Route path="/categories" element={<Layout><Categories /></Layout>} />
						<Route path="/categories/new" element={<Layout><CategoryNew /></Layout>} />
						<Route path="/categories/:categoryId/edit" element={<Layout><CategoryEdit /></Layout>} />
						<Route path="/categories/:categoryId" element={<Layout><CategoryDetail /></Layout>} />
						<Route path="/qr-codes" element={<Layout><QRCodes /></Layout>} />
						<Route path="/home-features" element={<Layout><HomeFeaturesManager /></Layout>} />
						<Route path="/ai-enhancements" element={<Layout><AIEnhancementPage /></Layout>} />
						<Route path="/ai-gallery" element={<Layout><AIGalleryPage /></Layout>} />
						<Route path="/ai-menu-theme-background" element={<Layout><AIMenuThemeBackgroundPage /></Layout>} />
						<Route path="/ai-menu-theme-history" element={<Layout><AIMenuThemeHistoryPage /></Layout>} />
						<Route path="/billing" element={<Layout><PaymentSettings /></Layout>} />
						<Route path="/autopay-setup" element={<Layout><AutopaySetupPage /></Layout>} />
						<Route path="/Legacy Content" element={<Layout><LegacyContent /></Layout>} />
						<Route path="/Legacy Signature Dish" element={<Layout><LegacySignatureDish /></Layout>} />
						<Route path="/restaurant/:restaurantId/payment" element={<Layout><Payment /></Layout>} />
						<Route path="/restaurant/:restaurantId/billing" element={<Layout><PaymentSettings /></Layout>} />
						<Route path="/:doctype" element={<Layout><ModuleList /></Layout>} />
						<Route path="/:doctype/:docname" element={<Layout><ModuleDetail /></Layout>} />
					</Route>
				</Routes>
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

