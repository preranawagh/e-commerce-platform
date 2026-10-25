const js = require('@eslint/js');
const globals = require('globals');

// Backend (services, shared library, database scripts, tooling) is CommonJS on Node.
// The React frontend is not linted yet; it needs JSX/React rules (roadmap Phase 3/CI).
module.exports = [
  {
    ignores: ['**/node_modules/**', '**/coverage/**', 'frontend/**', 'experiments/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^(_|req|res|next)$' }]
    }
  },
  {
    files: ['**/tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.jest }
    }
  }
];
