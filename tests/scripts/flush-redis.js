var redis = require('redis');
var config = require('./config.js');

var client = redis.createClient(
	config.storage.redis.port,
	config.storage.redis.host,
	{
		parser: 'javascript'
	}
);

client.select(config.storage.redis.database, flush);



function flush (err) {
	if (err) throw err;

	client.flushdb(function (err) {
		if (err) throw err;

		process.exit(0)
	});
}