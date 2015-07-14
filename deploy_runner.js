#!/usr/bin/env node

var config         = require('jms-config');
var paths          = require('./lib/paths');

var log            = require(paths.libdir + '/debug/log');

var codebaseConf   = config.codebase;
var builder        = require(paths.libdir + '/startup/builder');

var startTime = +new Date();


/**
 *
 * @param {Function} done
 * @param {Object} err
 * @param {String} source
 * @returns {*}
 */
function doneBuild (done, err, source, stage) {
	var doneTime = +new Date();

	var elapsed = Math.round((doneTime - startTime) / 1000);

	process.stdout.write(['deploy time (sec): ', elapsed ].join('') + '\n');

	if (err) {
		log.error('jms-deploy', err);

		if (done) {
			done(1)
		} else {
			process.exit(1);
		}
		return;
	}

	log.info('jms-deploy', 'done');

	if (done) {
		done(0)
	} else {
		process.exit(0);
	}
}

/**
 *
 * @param {String} sourceId
 * @param {Function} done
 */
function deploy_runner (sourceId, stage, done) {

	var sources = Object.keys(codebaseConf.sources);

	// deploy single source
	if (sourceId && sources.indexOf(sourceId) > -1) {
		builder(sourceId, stage, doneBuild.bind(null, done));
	} else {
		throw new Error('no such source:' + sourceId)
	}


}

module.exports = deploy_runner;