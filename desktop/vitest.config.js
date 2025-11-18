import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/renderer/src/tests/setup.js'],
        include: ['src/renderer/**/*.{test,spec}.{js,jsx,ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'src/renderer/src/tests/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/mockData/**',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer/src'),
        },
    },
});