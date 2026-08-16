import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Response: 'readonly',
        WebSocketPair: 'readonly',
        URL: 'readonly',
        Date: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        Buffer: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
];
