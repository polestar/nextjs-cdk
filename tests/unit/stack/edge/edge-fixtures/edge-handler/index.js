'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('./prerender-manifest.json');
require('./manifest.json');
require('./routes-manifest.json');
var edgeHandler = require('./edge-handler-52e54cf0.js');
require('http');
require('perf_hooks');
require('stream');
require('url');
require('punycode');
require('https');
require('zlib');
require('crypto');
require('buffer');
require('fs');
require('os');
require('path');
require('http2');
require('process');
require('child_process');



exports.AwsPlatformClient = edgeHandler.AwsPlatformClient;
exports.handler = edgeHandler.handler;
