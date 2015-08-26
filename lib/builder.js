var _                      = require('lodash');
var domain                 = require('domain');
var config                 = global.jmsConfig;
var JMSstorage             = require('jms-storage').use('redis');



var contextConf            = config.context;

var log                    = require('lib/debug/log');

var versions               = require('lib/codebase/versions');

var PluginManager          = require('lib/pluginmanager/deploy');
var DependencyMapper       = require('lib/codebase/dependencymapper');
var Compressor             = require('lib/codebase/compressor');
var ModuleLoader           = require('lib/codebase/module/loader');

var TransitiveDepCollector = require('lib/codebase/transitivedeps');
var ModuleHasher           = require('lib/codebase/module/hasher');
var DependencyTimeUpdater  = require('lib/codebase/deptimeupdater');

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
 * @param source
 * @param next
 * @param stage
 */
function build (source, stage, next) {

	log.info('builder', 'starting build');

	var moduleStream = new ModuleLoader({
		objectMode: true,
		source: source,
		stage: stage
	});
	var compressor = new Compressor({
		objectMode: true,
		source: source,
		stage: stage,
		config: config
	});
	var deps = new DependencyMapper({ objectMode: true });
	var plugins = PluginManager(source);

	moduleStream.setEncoding('utf8');
	deps.setEncoding('utf8');
	plugins.setEncoding('utf8');
	compressor.setEncoding('utf8');


	var transdepcollector = new TransitiveDepCollector();
	var updatemtimes = new DependencyTimeUpdater();
	var modulehasher = new ModuleHasher({
		source: source,
		stage: stage
	});

	buildDomain.add(transdepcollector);
	buildDomain.add(modulehasher);

	var modules = [];

	// stream to collect, load, modules, register their dependencies, and run through plugins
	var stream = moduleStream
		.pipe(deps)
		.pipe(plugins)
		.pipe(compressor);

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
			save(source, stage, modules, next);
		});

		// collect -> updatemtime -> hash
		transdepcollector.run(modules, next);

	});

}

/**
 *
 * @param source
 * @param modules
 * @param next
 *
 */
function save (source, stage, modules, next) {
	if (buildDomain.collectedErrors.length > 0) {
		return next(buildDomain.collectedErrors);
	}

	log.info('builder', 'saving module data to storage');

	var saveData = {};
	var jmsClient = '';

	modules.forEach(function (module, i) {

		storage('setMap', source, stage, module.originalModule, module.module);

		versions.add(source, stage, module.originalModule, module.module);

		if (module.module == 'jmsclient') {
			jmsClient = JSON.stringify(module);
			return;
		}
		saveData[module.module] = JSON.stringify(module);
	});

	storage('setModules', saveData, function (err) {
		return finish(err, source, stage, next);
	});

}

/**
 *
 * @param err
 * @param source
 * @param stage
 * @param next
 * @return {*}
 */
function finish (err, source, stage, next) {
	log.info('builder', 'build done');

	if (err) {
		return next(err, source, stage);
	}

	versions.purge(source, stage, function () {
		next(err, source, stage);
	});
}


module.exports = function (source, stage, next) {

	log.verbose('builder', 'context is local: ' + contextConf.local);

	if (contextConf.local) {
		//TODO TODO TODO

	} else {
		build(source, stage, next);
	}
};

