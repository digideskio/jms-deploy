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

suite('versions', function () {

	before(function(done) {
		// runs before all tests in this block
		client.select(config.storage.redis.database, done);
	});

	test('versions key exists', function (done) {

		client.keys('versions:*', function (err, result) {

			if (err) return done(err);

			assert.equal(result.length, 1, 'key length is 1');
			assert.equal(result[0], 'versions:test:master', 'key is "versions:test:master"');

			done();
		});
	});

	test('versions table correct', function (done) {
		client.hgetall('versions:test:master', function (err, result) {

			if (err) return done(err);

			assert(result.hasOwnProperty('App'));
			assert(result.hasOwnProperty('lib/util'));

			done();
		});
	});

	test('versions content valid', function (done) {

		client.hgetall('map:test:master', function (err, mapResult) {

			if (err) return done(err);

			client.hgetall('versions:test:master', function (err, result) {

				if (err) return done(err);


				assert(result.hasOwnProperty('App'));
				assert.equal(typeof result['App'], 'string');

				var appVersions = JSON.parse(result['App']);

				assert(appVersions instanceof Array);
				assert.equal(appVersions[0], mapResult['App']);

				done();
			});
		});
	});
});

