import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Optional features reach the shell through shell/feature.ts, so deleting one's
// folder can't break what's left.
const FEATURE_IMPORTS = {
    group: ['**/features', '**/features/*', '**/features/**'],
    message: 'Register what a feature adds in shell/feature.ts instead of importing it.',
}

export default tseslint.config(
    {
        ignores: ['dist', 'node_modules'],
    },
    {
        files: ['**/*.{ts,tsx}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'react-refresh/only-export-components': ['warn', {allowConstantExport: true}],
        },
    },
    {
        files: ['*.config.ts', 'src/tests/setup.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        // Pure code stays free of UI and desktop dependencies, so it can be tested alone.
        files: ['src/core/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['react', 'react-dom', 'zustand'],
                        message: 'Code in core/ must stay free of the interface.',
                    },
                    {
                        group: ['@wailsio/*', '**/platform/*'],
                        message: 'Code in core/ must not depend on the desktop shell.',
                    },
                    FEATURE_IMPORTS,
                ],
            }],
        },
    },
    {
        // Optional features are removed by deleting their folder, so nothing outside
        // features/ may import one. core/ has the same rule in its own block above.
        files: ['src/{app,components,platform,shell,store}/**/*.{ts,tsx}'],
        ignores: ['**/*.test.{ts,tsx}'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [FEATURE_IMPORTS],
            }],
        },
    },
)
