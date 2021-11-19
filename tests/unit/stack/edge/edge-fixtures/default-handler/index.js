'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('./prerender-manifest.json');
require('./manifest.json');
require('./routes-manifest.json');
var defaultHandler = require('./default-handler-8b02ba34.js');
require('http');
require('stream');
require('perf_hooks');
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
require('querystring');



exports.AwsPlatformClient = defaultHandler.AwsPlatformClient;
exports.handleRegeneration = defaultHandler.handleRegeneration;
exports.handleRequest = defaultHandler.handleRequest;
exports.handler = defaultHandler.handler;
