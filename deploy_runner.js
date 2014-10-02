#!/usr/bin/env node

var config         = require('jms-config');
var paths          = require('./lib/paths');

var codebaseConf   = config.codebase;
var cachepurge     = require(paths.libdir + '/cachepurge');
var builder        = require(paths.libdir + '/startup/builder');

var startTime = +new Date();



/**
 *
 * @param err
 * @param source
 * @returns {*}
 */
function doneBuild (err, source) {
	var log = require(paths.libdir + '/debug/log');
	var doneTime = +new Date();

	var elapsed = Math.round((doneTime - startTime) / 1000);

	process.stdout.write(['deploy time (sec): ', elapsed ].join('') + '\n');

	if (err) {
		log.error('jms-deploy', err);
		process.exit(1);
		return;
	}

	if (source) {
		return cachepurge.deleteSource(null, source, donePurge);
	}

	log.info('jms-deploy', 'done');
	process.exit(0);
}

/**
 *
 * @param err
 */
function donePurge (err) {

	var log = require(paths.libdir + '/debug/log');

	if (err) {
		log.warn('jms-deploy', 'cache was not purged successfully');
	} else {
		log.info('jms-deploy', 'cache purged');
	}

	log.info('jms-deploy', 'done');

	process.exit(0);
}

/**
 *
 */
function deploy_runner (sourceId) {
	var log = require(paths.libdir + '/debug/log');
	var sources = Object.keys(codebaseConf.sources);


	if (sourceId && sources.indexOf(sourceId) > -1) {
		builder(sourceId, doneBuild);
		return;
	}

	var done = function done (err, source) {
		if (!sources || err) {
			sources = false;
			return doneBuild(err, source);
		}

		sources.pop();
		cachepurge.deleteSource(source, function () {});

		if (sources.length === 0) {
			doneBuild(null);
		}
	};

	// build all
	Object.keys(codebaseConf.sources).forEach(function sourceIterator (iteratedSourceId) {
		builder(iteratedSourceId, done);
	});

}

module.exports = deploy_runner;