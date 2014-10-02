#!/usr/bin/env node

var deploy = require('./deploy_runner');
var argv = require('minimist')(process.argv.slice(2));

var sourceId;

if (argv['_'] && argv['_'][0]) {
	sourceId = argv['_'][0];
}

deploy(sourceId);