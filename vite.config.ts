import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'

export default defineConfig(({ mode }) => {
    const isCapacitorBuild = process.env.CAPACITOR_BUILD === 'true'
    const isTossBuild = process.env.VITE_PLATFORM === 'toss'
    const isDebugBuild = mode === 'development'

    return {
        define: {
            __APP_VERSION__: JSON.stringify(packageJson.version),
            __DEV_BUILD__: JSON.stringify(isDebugBuild),
            __PLATFORM__: JSON.stringify(isTossBuild ? 'toss' : 'default'),
        },
        plugins: [react()],
        base: isCapacitorBuild ? './' : '/',
        build: {
            outDir: 'dist',
            minify: isDebugBuild ? false : 'esbuild',
            sourcemap: isDebugBuild,
        },
    }
})
