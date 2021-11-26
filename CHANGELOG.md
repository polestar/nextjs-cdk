## [1.1.4](https://github.com/polestar/nextjs-cdk/compare/v1.1.3...v1.1.4) (2021-11-26)


### Bug Fixes

* file path spelling and expose cdk at the root ([d6d551f](https://github.com/polestar/nextjs-cdk/commit/d6d551f806c1ff3906a593c0199a004bd065fa4b))

## [1.1.3](https://github.com/polestar/nextjs-cdk/compare/v1.1.2...v1.1.3) (2021-11-26)


### Bug Fixes

* **apigw,cdk:** fix to make it deployable in china ([328cc95](https://github.com/polestar/nextjs-cdk/commit/328cc95643f2eb801d5203324e35cf0a8de6ad6a))
* **apigw:** various isr fixes ([84f4041](https://github.com/polestar/nextjs-cdk/commit/84f404138a6350a46aac12400072d39514658e6b))
* wrong file name on regeneration ([9eafbbc](https://github.com/polestar/nextjs-cdk/commit/9eafbbc2c24efcec4c57345f311020ace3c76727))
* wrong path to lambda handlers ([e819392](https://github.com/polestar/nextjs-cdk/commit/e819392b53770b9f13c1e82e31c66bab84689429))

## [1.1.2](https://github.com/polestar/nextjs-cdk/compare/v1.1.1...v1.1.2) (2021-11-26)


### Bug Fixes

* removed dist from the consumer path ([ec30014](https://github.com/polestar/nextjs-cdk/commit/ec3001422e234e22295dc392bbce8c92bc29d889))

## [1.1.1](https://github.com/polestar/nextjs-cdk/compare/v1.1.0...v1.1.1) (2021-11-19)


### Bug Fixes

* **NextJSAtEdge,NextJSConstruct:** re-adds timeouts for lambdas ([a93735e](https://github.com/polestar/nextjs-cdk/commit/a93735ef83715a3824702d2d7741d72acffe5eee))

# [1.1.0](https://github.com/polestar/nextjs-cdk/compare/v1.0.1...v1.1.0) (2021-11-19)


### Bug Fixes

* **cdk:** adds default export for strategies ([9d62069](https://github.com/polestar/nextjs-cdk/commit/9d6206930194f3c94ecbd6b1b85ece895f699450))
* **src/cdk:** index reset ([8ada2eb](https://github.com/polestar/nextjs-cdk/commit/8ada2eb71910b2471ab638e5ae882d488cb4e3fb))


### Features

* **adapter:** lambda@edge ([1d3e4c8](https://github.com/polestar/nextjs-cdk/commit/1d3e4c8a9f133b0f407d428ed2266b03a2c0cb36))
* **cloudFrontAdapter:** now reads s3 bucket and region from s3-custom-origin-headers ([e251bdd](https://github.com/polestar/nextjs-cdk/commit/e251bddecc6707fada04539a125137192be6caa7))

## [1.0.1](https://github.com/polestar/nextjs-cdk/compare/v1.0.0...v1.0.1) (2021-11-16)


### Bug Fixes

* **deps:** update dependency next to v12.0.4 ([3558fe0](https://github.com/polestar/nextjs-cdk/commit/3558fe0c1d6a9e191174dcff8c95ce10fae4a18e))

# 1.0.0 (2021-11-12)


### Bug Fixes

* **lambda-builder:** removes duplicate webpack-copy ([1bdc950](https://github.com/polestar/nextjs-cdk/commit/1bdc9506cae3c7a386149fb9d511423ba65f41f0))
* missing webpack runtime files ([0e5393b](https://github.com/polestar/nextjs-cdk/commit/0e5393b04451ecfe2d91c5bdcb35918e3b8ec9cd))
* **renovate:** ignore sharp_node_modules ([fc88d99](https://github.com/polestar/nextjs-cdk/commit/fc88d9991de34b27b63186b846eaccde45c170de))
* **renovate:** ignore tests ([758da63](https://github.com/polestar/nextjs-cdk/commit/758da630f2261b92e1bc4ff36cb71b13c268416e))


### Features

* build default and image handler ([c53a048](https://github.com/polestar/nextjs-cdk/commit/c53a048421edd92d2104eeeda60f498b7d0c8d4f))
* **default-handler:** now supports /api reqs ([251dd48](https://github.com/polestar/nextjs-cdk/commit/251dd48879b8c8dcd04dc8671c3feece185b3532))
* first version of cdk construct ([d03764a](https://github.com/polestar/nextjs-cdk/commit/d03764ab4faf0290eecd783e300882f3dbd9e046))
