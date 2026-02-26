import { FrappeProvider } from 'frappe-react-sdk'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RestaurantProvider } from './contexts/RestaurantContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import SetupWizard from './pages/SetupWizard'
import Modules from './pages/Modules'
import ModuleList from './pages/ModuleList'
import ModuleDetail from './pages/ModuleDetail'
import Orders from './pages/Orders'
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
import Payment from './pages/Payment'
import PaymentStats from './pages/PaymentStats'
import PaymentSettings from './pages/PaymentSettings'
import RecommendationsEngine from './pages/RecommendationsEngine'

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
						<Route path="/setup" element={<Layout><SetupWizard /></Layout>} />
						<Route path="/setup/:stepId" element={<Layout><SetupWizard /></Layout>} />
						<Route path="/modules" element={<Layout><Modules /></Layout>} />
						{/* Redirect Home Feature to dedicated page */}
						<Route path="/Home Feature" element={<Navigate to="/home-features" replace />} />
						<Route path="/Home%20Feature" element={<Navigate to="/home-features" replace />} />
						<Route path="/:doctype" element={<Layout><ModuleList /></Layout>} />
						<Route path="/:doctype/:docname" element={<Layout><ModuleDetail /></Layout>} />
						{/* Legacy routes for backward compatibility */}
						<Route path="/orders" element={<Layout><Orders /></Layout>} />
						<Route path="/orders/:orderId" element={<Layout><OrderDetail /></Layout>} />
						<Route path="/past-orders" element={<Layout><PastOrders /></Layout>} />
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
						<Route path="/payment-stats" element={<Layout><PaymentStats /></Layout>} />
						<Route path="/restaurant/:restaurantId/payment" element={<Layout><Payment /></Layout>} />
						<Route path="/restaurant/:restaurantId/billing" element={<Layout><PaymentSettings /></Layout>} />
						<Route path="/recommendations-engine" element={<Layout><RecommendationsEngine /></Layout>} />
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

