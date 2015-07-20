var _                      = require('lodash');
var domain                 = require('domain');
var config                 = global.jmsConfig;
var JMSstorage             = require('jms-storage').use('redis');


var paths                  = require('../../lib/paths');
var contextConf            = config.context;

var log                    = require(paths.libdir + '/debug/log');

var versions               = require(paths.libdir + '/codebase/versions');

var PluginManager          = require(paths.libdir + '/pluginmanager/deploy');
var ModuleLoader           = require(paths.libdir + '/codebase/moduleloader');
var DependencyMapper       = require(paths.libdir + '/codebase/dependencymapper');

var TransitiveDepCollector = require(paths.libdir + '/codebase/transitivedeps');
var ModuleHasher           = require(paths.libdir + '/codebase/modulehasher');
var DependencyTimeUpdater  = require(paths.libdir + '/codebase/deptimeupdater');

var storage = JMSstorage(config.storage, log);


var buildDomain = domain.create();

buildDomain.collectedErrors = [];

buildDomain.on('error', function (data) {
	if(data.type && data.type === 'dependencyError') {
		buildDomain.collectedErrors.push(data.message);
	} else {
		console.log('builder error', data);
		process.exit(3);
	}
});

/**
 *
 * @param sourceId
 * @param next
 */
function build (sourceId, stage, next) {

	log.info('builder', 'starting build');

	var moduleStream = new ModuleLoader({ objectMode: true }, sourceId);
	var deps = new DependencyMapper({ objectMode: true });
	var plugins = PluginManager();

	moduleStream.setEncoding('utf8');
	deps.setEncoding('utf8');
	plugins.setEncoding('utf8');


	var transdepcollector = new TransitiveDepCollector();
	var updatemtimes = new DependencyTimeUpdater();
	var modulehasher = new ModuleHasher();

	buildDomain.add(transdepcollector);
	buildDomain.add(modulehasher);

	var modules = [];

	// stream to collect, load, modules, register their dependencies, and run through plugins
	var stream = moduleStream
		.pipe(deps)
		.pipe(plugins);

	stream.on('error', function (data) {
//		console.log('stream error');
	});

	stream.on('drain', function () {
//		console.log('drain' );
	});

	stream.on('data', function (data) {
		modules.push(JSON.parse(data));
	});

	stream.on('end', function() {

		// collect stream ended,
		// now these iterations need the whole loaded module stack

		transdepcollector.on('end', updatemtimes.run.bind(updatemtimes));

		updatemtimes.on('end', modulehasher.run.bind(modulehasher));

		modulehasher.on('end', function (modules, next) {

			// iterations on module stack are complete
			save(sourceId, stage, modules, next);
		});

		// collect -> updatemtime -> hash
		transdepcollector.run(modules, next);

	});

}

/**
 *
 * @param sourceId
 * @param modules
 * @param next
 *
 */
function save (sourceId, stage, modules, next) {
	if (buildDomain.collectedErrors.length > 0) {
		return next(buildDomain.collectedErrors);
	}

	log.info('builder', 'saving module data to storage');

	var saveData = {};
	var jmsClient = '';

	modules.forEach(function (module, i) {

		storage('setMap', sourceId, stage, module.originalModule, module.module);

		versions.add(sourceId, stage, module.originalModule, module.module);

		if (module.module == 'jmsclient') {
			jmsClient = JSON.stringify(module);
			return;
		}
		saveData[module.module] = JSON.stringify(module);
	});

	storage('setModules', sourceId, stage, saveData, function (err) {
		return finish(err, sourceId, stage, next);
	});

}

/**
 *
 * @param err
 * @param sourceId
 * @param stage
 * @param next
 * @return {*}
 */
function finish (err, sourceId, stage, next) {
	log.info('builder', 'build done');

	if (err) {
		return next(err, sourceId, stage);
	}

	versions.purge(sourceId, stage, function () {
		next(err, sourceId, stage);
	});
}


module.exports = function (sourceId, stage, next) {

	log.verbose('builder', 'context is local: ' + contextConf.local);

	if (contextConf.local) {
		//TODO TODO TODO
		(require(paths.libdir + '/locale/locale'))(function (locales) {
			return {}; // todo
		});

	} else {
		build(sourceId, stage, next);
	}
};

