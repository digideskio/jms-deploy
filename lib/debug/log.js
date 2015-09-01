var fs     = require('fs');
var npmlog = require('npmlog');

var config = global.jmsConfig;
var debug  = config.debug;

if (!debug) {
	debug = {
		loglevel: 'info'
	}
}

npmlog.level = debug.loglevel;


var padDateDoubleStr = function(i){
	return (i < 10) ? "0" + i : "" + i;
};

var sqlDateTime = function(time){
	if(time == null){ time = new Date(); }
	var dateStr =
		padDateDoubleStr(time.getFullYear()) +
			"-" + padDateDoubleStr(1 + time.getMonth()) +
			"-" + padDateDoubleStr(time.getDate()) +
			" " + padDateDoubleStr(time.getHours()) +
			":" + padDateDoubleStr(time.getMinutes()) +
			":" + padDateDoubleStr(time.getSeconds());
	return dateStr;
};


var log = function(level, module, info){

	npmlog.log(level, module, info);

}


var wrapper = function (tags, msg) {

//	console.log(tags, msg );

	if (tags.indexOf('verbose') > -1) {
		log('verbose',tags.slice(1), msg);
	} else if (tags.indexOf('info') > -1) {
		log('info', tags.slice(1), msg);
	} else if (tags.indexOf('warn') > -1) {
		log('warn', tags.slice(1), msg);
	} else if (tags.indexOf('error') > -1) {
		log('error', tags.slice(1), msg);
	}

}
module.exports = wrapper

wrapper.verbose = log.bind(log, 'verbose');
wrapper.info = log.bind(log, 'info');
wrapper.warn = log.bind(log, 'warn');
wrapper.error = log.bind(log, 'error');

