import {defineConfig, type Plugin} from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import {pxToRem} from './src/core/settings/px-to-rem'

/**
 * Pictures of saved documents are served by Go, which answers them before Vite is
 * asked. In a plain browser there is no Go, and Vite would answer every unknown
 * address with the app's page, so this says plainly that it has no such file.
 */
function leavePicturesToGo(): Plugin {
    return {
        name: 'leave-pictures-to-go',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/documents/', (_request, response) => {
                response.statusCode = 404
                response.end()
            })
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), tailwind(), leavePicturesToGo()],
    css: {
        postcss: {
            plugins: [
                {
                    postcssPlugin: 'px-to-rem',
                    Declaration(declaration) {
                        const value = pxToRem(declaration.value)

                        if (value !== declaration.value) {
                            declaration.value = value
                        }
                    },
                },
            ],
        },
    },
    // What's new reads CHANGELOG.md, which lives at the top of the repository.
    server: {fs: {allow: ['..']}},
    build: {
        rollupOptions: {
            output: {
                // The interface library is large and changes rarely. Its own chunk
                // keeps the app chunk small and cacheable.
                manualChunks: {
                    ui: ['@heroui/react', 'react-aria-components', 'lucide-react'],
                },
            },
        },
    },
})
