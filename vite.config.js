import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves this project from /Pieces/.
  // Relative asset paths also keep the build portable for local preview.
  base: './'
});
