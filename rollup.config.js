import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import externals from 'rollup-plugin-node-externals';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import del from 'rollup-plugin-delete';

const LOCAL_EXTERNALS = [
  './manifest.json',
  './api-manifest.json',
  './routes-manifest.json',
  './prerender-manifest.json',
  './images-manifest.json',
];
const NPM_EXTERNALS = ['aws-lambda', 'aws-sdk/clients/s3'];

const generateConfig = (input) => ({
  input: `./src/handlers/lambda/${input.handler}.ts`,
  output: {
    dir: `./dist/bundles/lambda/${input.handler}/${
      input.minify ? 'minified' : 'standard'
    }`,
    entryFileNames: 'index.js',
    format: 'cjs',
  },
  plugins: [
    del({
      targets: `./dist/bundles/${input.handler}/${
        input.minify ? 'minified' : 'standard'
      }`,
    }),
    json(),
    nodeResolve({
      preferBuiltins: true,
    }),
    commonjs(),
    externals({
      exclude: ['next'],
    }),
    typescript({
      tsconfig: 'tsconfig.bundle.json',
    }),
    input.minify
      ? terser({
          compress: true,
          mangle: true,
          output: { comments: false }, // Remove all comments, which is fine as the handler code is not distributed.
        })
      : undefined,
  ],
  external: [...NPM_EXTERNALS, ...LOCAL_EXTERNALS],
});

const handlers = {
  // Must match src/common/LambdaHandlerTypes.ts
  DEFAULT: 'default-handler',
  IMAGE: 'image-handler',
  EDGE: 'edge-handler',
};

const buildList = Object.values(handlers)
  .map((handler) => {
    return [
      {
        handler,
        minify: true,
      },
      {
        handler,
        minify: false,
      },
    ];
  })
  .flat();

export default buildList.map(generateConfig);
