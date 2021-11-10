import 'zx/globals';

void (async function () {
  cd('./tests/e2e/next-app');
  await $`yarn test:build`;
  await $`yarn test`;
  await $`cdk synth`;
})();
