var util        = require('util');
var events      = require('events');
var _           = require('lodash');
var crc         = require('sse4_crc32');

var esprima     = require('esprima');
var escodegen   = require('escodegen');
var traverse    = require('estraverse');


var log         = require('lib/debug/log');

var ModuleHasher = function (options) {
	events.EventEmitter.call(this);

	this.source = options.source;
	this.stage = options.stage;
}

util.inherits(ModuleHasher, events.EventEmitter);

/**
 *
 * @param source
 * @param stage
 * @param module
 *
 * @returns {*}
 */
function hashName (source, stage, module) {

	module.originalModule = module.module;
	module.module = crc.calculate(
		[module.module, module.mtime, source, stage].join('')
	).toString(16);

	log.verbose('modulehasher', module.originalModule + ' -> ' + module.module);

	return module;
}

/**
 *
 * @param modules
 * @returns {Array}
 */
function createModuleNameMap (modules) {

	var mmap = {};

	_.forEach(modules, function (module) {
		mmap[module.originalModule] = module.module;
	});

	return mmap;
}

/**
 *
 * @param item
 * @returns {*}
 */
function hashArrayItem (item) {
	return this[item];
}

/**
 *
 * @param collection
 * @param node
 */
function replaceWithHashedModule (collection, node) {
	if (!!collection[node.value] && typeof collection[node.value] === 'string') {
		node.value = collection[node.value];
		node.raw = '\'' + node.value + '\'';
	}

	return node;
}

function hashIterator  (moduleNameCollection, nodeArg) {

	if (nodeArg && nodeArg.type === 'ArrayExpression') {
		nodeArg.elements.map(function (arrayItem) {
			return replaceWithHashedModule(moduleNameCollection, arrayItem);
		});

		return nodeArg;
	}
	if (nodeArg && nodeArg.type === 'Literal') {
		return replaceWithHashedModule(moduleNameCollection, nodeArg);
	}
}

/**
 *
 * @param modules
 * @param next
 */
ModuleHasher.prototype.run = function (modules, next) {

	this.modules = _.forEach(modules, _.curry(hashName)(this.source, this.stage));

	var moduleNameCollection = createModuleNameMap(this.modules);
	var curriedHashIterator = _.curry(hashIterator)(moduleNameCollection);

	this.modules.forEach(function (module) {
		var moduleData = module;

		if (module === 'jmsclient') {
			return;
		}

		var ast = esprima.parse(moduleData.source);

		traverse.traverse(ast, {
			enter: function(node) {
				if (node.type === 'CallExpression' &&
					node.callee.name === 'define'
					) {
					node.arguments.map(curriedHashIterator);
				}

				if (node.type === 'CallExpression' &&
					node.callee.name === 'require'
					) {
					node.arguments.map(curriedHashIterator);
				}
			}
		});

		module.source = escodegen.generate(ast, {
			format: {
				compact: true
			}
		});
		module.dependencies = _.map(module.dependencies, hashArrayItem, moduleNameCollection);
		module.transitive_dependencies = _.map(module.transitive_dependencies, hashArrayItem, moduleNameCollection);
	});

	this.emit('end', this.modules, next);
}

module.exports = ModuleHasher;

