
var config       = global.jmsConfig;
var codebaseConf = config.codebase;
var JMSstorage   = require('jms-storage').use('redis');
var log          = require('lib/debug/log');

var storage = JMSstorage(config.storage, log);

/**
 *
 * @param sourceId
 * @param stage
 * @param originalName
 * @param hashedName
 * @param err
 * @param result
 */
function onHget (sourceId, stage, originalName, hashedName, err, result) {

	if (err) {
		return;
	}

	var list;

	if (result.indexOf(null) < 0) {
		var list = JSON.parse(result[0]);

		if (list.indexOf(hashedName) < 0) {
			list.push(hashedName);
		} else {
			return;
		}
	} else {
		list = [hashedName];
	}

	storage('setVersions', sourceId, stage, originalName, JSON.stringify(list));
}

/**
 *
 * @param sourceId
 * @param stage
 * @param originalName
 * @param hashedName
 */
function add (sourceId, stage, originalName, hashedName) {
	log.verbose('versions', 'add', originalName, hashedName);
	storage(
		'getVersions',
		sourceId,
		stage,
		originalName,
		onHget.bind(null, sourceId, stage, originalName, hashedName)
	);
}

/**
 *
 * @param sourceId
 * @param stage
 * @param purgeList
 * @param updatedList
 * @param done
 */
function purgeSource (sourceId, stage, purgeList, updatedList, done) {
	var keys = [];

	Object.keys(purgeList).forEach(function (m) {
		keys = keys.concat(purgeList[m]);
	});

	var l = keys.length;

	keys.forEach(function (key) {
		storage('removeModules', sourceId, stage, key, function (err) {
			if (err) done(err);

			l--;

			if (l < 1) {
				updateVersions(sourceId, stage, updatedList, done)
			}
		});
	})
}

/**
 *
 * @param sourceId
 * @param stage
 * @param updatedList
 * @param done
 */
function updateVersions (sourceId, stage, updatedList, done) {

	var len = Object.keys(updatedList).length;

	Object.keys(updatedList).forEach(function (key) {
		storage('setVersions', sourceId, stage, key, updatedList[key]);
		len--;

		if (len < 1) {
			done();
		}
	})
}

/**
 *
 * @param sourceId
 * @param stage
 * @param next
 */
function purge (sourceId, stage, next) {

	var versions = codebaseConf.sources[sourceId].versions;

	storage('getAllVersions', sourceId, stage, function (err, result) {
		if (err) {
			return next(err);
		}

		var purgeList = {};
		var updatedList = {};

		console.log('purge');

		Object.keys(result).filter(function (module) {
			return JSON.parse(result[module]).length > versions;
		}).forEach(function (module) {
			var m = JSON.parse(result[module]);
			purgeList[module] = m.slice(0, m.length-versions);
			updatedList[module]= JSON.stringify(m.slice(versions * -1));
		});

		if (Object.keys(purgeList) < 1) {
			return next();
		}

		log.verbose('versions', 'purge ' + JSON.stringify(purgeList));

		purgeSource(sourceId, stage, purgeList, updatedList, next);
	});
}

module.exports = {
	add: add,
	purge: purge
}