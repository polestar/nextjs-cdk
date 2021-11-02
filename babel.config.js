const isTest = String(process.env.NODE_ENV === 'test');

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      { targets: { node: 'current' }, modules: isTest ? 'commonjs' : false },
    ],
    '@babel/preset-typescript',
  ],
  plugins: ['@babel/plugin-proposal-class-properties'],
};
