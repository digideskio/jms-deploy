
var config = require('./config.js');
var deploy = require('../../deploy-runner.js');



deploy('test', 'master', config, function (err) {

	if (err) {
		throw err;
	}

	process.exit(0);

})