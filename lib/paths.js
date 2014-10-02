var path = require('path');
var basedir = path.normalize(path.dirname(module.filename) + '/../')

var paths = {

	basedir: basedir,

	confdir: basedir + "/conf",
	libdir: basedir + "/lib",
	pluginsdir: basedir + "/plugins",

	piddir: basedir + "/pid",
	pidfile: basedir + "/pid/cluster_pidfile",

	logdir: basedir + "/logs",
	log: basedir + "/logs/cluster.log",

}

module.exports = paths;