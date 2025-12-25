import path from 'path';
import { defineConfig } from 'vite';
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import proxyOptions from './proxyOptions';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
	const isDev = command === 'serve';
	
	return {
	plugins: [react(), tailwindcss()],
		// Use /dinematters/ for dev, /assets/dinematters/dinematters/ for build
		base: isDev ? '/dinematters/' : '/assets/dinematters/dinematters/',
	server: {
		port: 8081,
		host: '0.0.0.0',
			proxy: proxyOptions,
			hmr: {
				port: 8081,
			},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src')
		}
	},
	build: {
		outDir: '../dinematters/public/dinematters',
		emptyOutDir: true,
		target: 'es2015',
	},
	};
});












