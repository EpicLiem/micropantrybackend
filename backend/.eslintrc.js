module.exports = {
  "root": true,
  "env": {
    "es6": true,
    "node": true,
  },
  "parserOptions": {
    "ecmaVersion": 2020,
  },
  "extends": [
    "eslint:recommended",
    "google",
  ],
  "rules": {
    "quotes": ["error", "double"],
    "object-curly-spacing": ["error", "never"],
    "max-len": "off",
    "no-trailing-spaces": ["error", {"ignoreComments": true}],
    "require-jsdoc": "off",
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
  },
  "overrides": [
    {
      "files": ["**/*.spec.*"],
      "env": {
        "mocha": true,
      },
      "rules": {},
    },
  ],
  "globals": {},
};
