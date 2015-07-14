#!/usr/bin/env node


/**
 *
 * node deploy.js repo stage --config
 *
 * repo: files based on config
 * stage: live/branch/tag of codebase
 *
 * server config: live, local, dev
 *
 */

var deploy = require('../deploy-runner');
var argv = require('minimist')(process.argv.slice(2));

var sourceId, stage;

if (argv['_'] && argv['_'][0] && argv['_'][1]) {
	sourceId = argv['_'][0];
	stage = argv['_'][1];
} else {
	process.stdout.write('ERROR: repo or stage is missing')
	process.exit(1)
}

deploy(sourceId, stage);