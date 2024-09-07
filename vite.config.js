import { defineConfig } from 'vite';
import tsConfig from './tsconfig.json';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'adax-core',
      fileName: 'index',
      formats: ['es']
    }
  },
  resolve: {
    alias: {
      '@': 'src'
    }
  }
});