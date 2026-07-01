import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
// Dev serves at root; the production build is hosted under the GitHub Pages
// project path https://gl35.github.io/game-waterMargin3D/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/game-waterMargin3D/' : '/',
  plugins: [react()],
}))
