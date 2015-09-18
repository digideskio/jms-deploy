var assert = require('assert');
var config = require('../scripts/config.js');
var redis = require('redis');


var client = redis.createClient(
		config.storage.redis.port,
		config.storage.redis.host,
		{
			parser: 'javascript'
		}
);

suite('map', function () {

	before(function(done) {
		// runs before all tests in this block
		client.select(config.storage.redis.database, done);
	});

	test('hash map key exists', function (done) {

		client.keys('map:*', function (err, result) {

			if (err) return done(err);

			assert.equal(result.length, 1, 'key length is 1');
			assert.equal(result[0], 'map:test:master', 'key is "map:test:master"');

			done();
		});
	});

	test('hash map table correct', function (done) {
		client.hgetall('map:test:master', function (err, result) {

			if (err) return done(err);

			assert(result.hasOwnProperty('App'));
			assert(result.hasOwnProperty('lib/util'));

			done();
		});
	});
});
