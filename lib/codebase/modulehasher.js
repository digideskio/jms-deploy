var util        = require('util');
var events      = require('events');
var _           = require('lodash');
var crc         = require("sse4_crc32");

var esprima     = require('esprima');
var escodegen   = require('escodegen');
var traverse    = require("estraverse");

var paths       = require('../../lib/paths');
var log         = require(paths.libdir + '/debug/log');

var ModuleHasher = function (options) {
	events.EventEmitter.call(this);
}

util.inherits(ModuleHasher, events.EventEmitter);

/**
 *
 * @param module
 * @returns {Object}
 */
function hashName (module) {
	module.originalModule = module.module;
	module.module = crc.calculate(
		[module.module, module.mtime].join('')
	).toString(16);

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
		node.raw = '\'' + collection[node.value] + '\'';
	}

	return node;
}

/**
 *
 * @param modules
 * @param next
 */
ModuleHasher.prototype.run = function (modules, next) {

	this.modules = _.forEach(modules, hashName);

	var moduleNameCollection = createModuleNameMap(this.modules);

	this.modules.forEach(function (module) {
		var moduleData = module;

		if (module === 'jmsclient') {
			return;
		}

		var ast = esprima.parse(moduleData.source);

		traverse.traverse(ast, {
			enter: function(node) {

				if (node.type === "CallExpression" &&
					node.callee.name === 'require'
				) {
					var nodeArg = node.arguments;

					if (nodeArg && nodeArg[0].type === 'ArrayExpression') {
						nodeArg[0].elements.map(function (arrayItem) {
							return replaceWithHashedModule(moduleNameCollection, arrayItem);
						});

					} else if (nodeArg && nodeArg[0].type === 'Literal') {
						nodeArg[0] = replaceWithHashedModule(moduleNameCollection, nodeArg[0]);
					}
				}
			}
		});

		module.source = escodegen.generate(ast);
		module.dependencies = _.map(module.dependencies, hashArrayItem, moduleNameCollection);
		module.transitive_dependencies = _.map(module.transitive_dependencies, hashArrayItem, moduleNameCollection);

	});

	this.emit('end', this.modules, next);
}

module.exports = ModuleHasher;

