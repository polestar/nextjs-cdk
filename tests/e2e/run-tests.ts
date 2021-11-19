import 'zx/globals';

(async function () {
  await Promise.all(
    ['next-app'].map(async (appName) => {
      cd(`./tests/e2e/${appName}`);
      await $`yarn install`;
      await $`yarn test:build`;
      await $`yarn test`;
      await $`cdk synth`;
    }),
  );
})();
