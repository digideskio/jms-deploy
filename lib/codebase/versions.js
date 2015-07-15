var paths        = require('../../lib/paths');
var config       = global.jmsConfig;
var codebaseConf = config.codebase;

var storage      = require(paths.libdir + '/storage');
var log          = require(paths.libdir + '/debug/log');

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

	storage.hset(['versions', sourceId, stage].join(':'), originalName, JSON.stringify(list));
}

/**
 *
 * @param sourceId
 * @param stage
 * @param originalName
 * @param hashedName
 */
function add (sourceId, stage, originalName, hashedName) {
	log.verbose('versions', 'add');
	storage.hmget(
		['versions',sourceId, stage].join(':'),
		[originalName],
		onHget.bind(null, sourceId, stage, originalName, hashedName)
	);
}

/**
 *
 * @param sourceId
 * @param stage
 * @param list
 * @param updatedList
 * @param done
 */
function purgeSource (sourceId, stage, list, updatedList, done) {
	var keys = [];
	
	console.log('purgeSource');

	Object.keys(list).forEach(function (m) {
		keys = keys.concat(list[m]);
	});

	var l = keys.length;

	keys.forEach(function (key) {
		storage.hdel(['source',sourceId, stage].join(':'), [key], function () {
			l--;
			if (l < 1) {
				updateVersions(sourceId, stage, updatedList, done);
			}
		});
	})


}

/**
 *
 * @param sourceId
 * @param stage
 * @param list
 * @param done
 */
function updateVersions (sourceId, stage, list, done) {
	storage.hmset(['versions',sourceId, stage].join(':'), list, done);
}

/**
 *
 * @param sourceId
 * @param stage
 * @param next
 */
function purge (sourceId, stage, next) {

	var versions = codebaseConf.sources[sourceId].versions;

	storage.hgetall(['versions', sourceId, stage].join(':'), function (err, result) {
		if (err) {
			return next(err);
		}

		var purgeList = {};
		var updatedList = {}

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