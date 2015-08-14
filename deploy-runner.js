#!/usr/bin/env node
//require('app-module-path').addPath(__dirname);




var startTime = +new Date();


/**
 *
 * @param {Function} done
 * @param {Object} err
 * @param {String} source
 * @returns {*}
 */
function doneBuild (done, err, source, stage) {

	var log = require('lib/debug/log');
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
 * @param {String} stage
 * @param {String|Object} config
 * @param {Function} done
 */
function deploy_runner (sourceId, stage, config, done) {

	if (typeof config === 'string') {
		global.jmsConfig = require('jms-config').getConfig(config);
	} else if (typeof config === 'object') {
		global.jmsConfig = config;
	} else {
		global.jmsConfig = require('jms-config');
	}

	var sources = Object.keys(global.jmsConfig.codebase.source);

	// deploy single source
	if (sourceId && sources.indexOf(sourceId) > -1) {
		require('lib/builder')(sourceId, stage, doneBuild.bind(null, done));
	} else {
		throw new Error('no such source:' + sourceId)
	}


}

module.exports = deploy_runner;