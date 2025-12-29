import { FrappeProvider } from 'frappe-react-sdk'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from './components/ui/sonner'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { RestaurantProvider } from './contexts/RestaurantContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SetupWizard from './pages/SetupWizard'
import Modules from './pages/Modules'
import ModuleList from './pages/ModuleList'
import ModuleDetail from './pages/ModuleDetail'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Categories from './pages/Categories'
import OrderDetail from './pages/OrderDetail'
import ProductDetail from './pages/ProductDetail'
import ProductEdit from './pages/ProductEdit'
import ProductNew from './pages/ProductNew'
import CategoryDetail from './pages/CategoryDetail'
import CategoryEdit from './pages/CategoryEdit'
import CategoryNew from './pages/CategoryNew'

function AppContent() {
	const { theme } = useTheme()
	
	return (
		<>
			<BrowserRouter basename="/dinematters">
				<Layout>
					<Routes>
						<Route path="/" element={<Navigate to="/dashboard" replace />} />
						<Route path="/dashboard" element={<Dashboard />} />
						<Route path="/setup" element={<SetupWizard />} />
						<Route path="/setup/:restaurantName" element={<SetupWizard />} />
						<Route path="/modules" element={<Modules />} />
						<Route path="/:doctype" element={<ModuleList />} />
						<Route path="/:doctype/:docname" element={<ModuleDetail />} />
						{/* Legacy routes for backward compatibility */}
						<Route path="/orders" element={<Orders />} />
						<Route path="/orders/:orderId" element={<OrderDetail />} />
						<Route path="/products" element={<Products />} />
						<Route path="/products/new" element={<ProductNew />} />
						<Route path="/products/:productId/edit" element={<ProductEdit />} />
						<Route path="/products/:productId" element={<ProductDetail />} />
						<Route path="/categories" element={<Categories />} />
						<Route path="/categories/new" element={<CategoryNew />} />
						<Route path="/categories/:categoryId/edit" element={<CategoryEdit />} />
						<Route path="/categories/:categoryId" element={<CategoryDetail />} />
					</Routes>
				</Layout>
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
			socketPort={import.meta.env.VITE_SOCKET_PORT}
			siteName={window.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME}>
			<ThemeProvider>
				<RestaurantProvider>
					<AppContent />
				</RestaurantProvider>
			</ThemeProvider>
		</FrappeProvider>
	)
}

export default App

