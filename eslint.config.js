const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,

  {
    // js/ is unreferenced legacy code (no route or view loads it — see PR description).
    // Left out of linting rather than configured, since it isn't part of the running app.
    ignores: ['node_modules/**', 'js/**', 'public/js/materialize.min.js'],
  },

  // Base — applies to every JS file, including this config file itself.
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-console': 'off',
      // Flags a real-but-harmless redundant escape in User.js's email regex.
      // Left as a warning rather than fixed here, to keep this PR config-only.
      'no-useless-escape': 'warn',
    },
  },

  // Frontend — browser scripts served from public/
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
  },

  // Tests — Jest
  {
    files: ['tests/**/*.test.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
