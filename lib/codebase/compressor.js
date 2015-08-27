var Transform = require('stream').Transform;
var util      = require('util');
var uglify    = require('uglify-js');
var log       = require('lib/debug/log');

function ModuleCompressor (options) {
	Transform.call(this, options);
	this.config = options.config;
	this.sourceId = options.source;
}

util.inherits(ModuleCompressor, Transform);

ModuleCompressor.prototype._transform = function (chunk, encoding, done) {

	var err = false;
	var path = this.config.codebase.source[this.sourceId].root;
	var data = JSON.parse(chunk.toString());
	var uglifyObject;

	log.verbose('compressing ', data.module);

	data.originalSource = data.source;
	data.lines = data.source.split('\n').length;

	try {
		uglifyObject = uglify.minify(data.source, {
			fromString: true,
			mangle: true,
			compress: true,
			outSourceMap: data.module + '.js.map'
		});
		data.source = uglifyObject.code;

		var map = JSON.parse(uglifyObject.map);

		map.sources = [
			data.path.replace(path + '/', '')
		];
		data.sourceMap = JSON.stringify(map);

	} catch (e) {
		throw 'Uglify error in ' + data.module + ' at line ' + e.line + ' : ' + e.message;
	}

	this.push(JSON.stringify(data));
	done();
};

module.exports = ModuleCompressor;

