var Transform     = require('stream').Transform;
var PassThrough   = require('stream').PassThrough;
var streamCombine = require('stream-combiner');
var config        = global.jmsConfig;


var pluginList = config.plugins || [];

var log           = require('lib/debug/log');
var PluginRunner  = require('lib/pluginmanager/runner');

module.exports = function (sourceId) {
	var deployPlugins = streamCombine(new PassThrough({ objectMode: true }));

	pluginList.forEach(function (pluginData) {
		if (pluginData.enabled && pluginData.module) {

			var plugin = pluginData.module;

			if (plugin.deploy) {
				var pluginInstance = new plugin.deploy({ objectMode: true }, pluginData.options, sourceId, config);
				pluginInstance.setEncoding('utf8');
				deployPlugins = streamCombine(deployPlugins, pluginInstance);
			}
		}
	});

	return new PluginRunner({ objectMode: true }, deployPlugins);
};