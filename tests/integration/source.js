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

suite('source', function () {

	before(function(done) {
		// runs before all tests in this block
		client.select(config.storage.redis.database, done);
	});

	test('source key exists', function (done) {

		client.keys('source', function (err, result) {

			if (err) return done(err);

			assert.equal(result.length, 1, 'key length is 1');
			assert.equal(result[0], 'source', 'key is "source"');

			done();
		});
	});

	test('source list correct', function (done) {

		client.hgetall('map:test:master', function (err, mapResult) {

			if (err) return done(err);

			client.hgetall('source', function (err, result) {

				if (err) return done(err);

				assert(result.hasOwnProperty(mapResult['lib/util']));
				assert(result.hasOwnProperty(mapResult['App']));

				done();
			});
		});
	});

	test('source content valid', function (done) {

		client.hgetall('map:test:master', function (err, mapResult) {

			if (err) return done(err);

			client.hgetall('source', function (err, result) {

				if (err) return done(err);

				var src = JSON.parse(result[mapResult['lib/util']]);

				assert.equal(src['sourceId'], 'test');
				assert.equal(src['stage'], 'master');
				assert.equal(src['module'], mapResult['lib/util']);
				assert(src.hasOwnProperty('mtime'));
				assert.equal(src['path'], 'tests/scripts/src/lib/util.js');
				assert(src.hasOwnProperty('source'));
				assert(src.hasOwnProperty('dependencies'));
				assert(src.hasOwnProperty('transitive_dependencies'));
				assert(src.hasOwnProperty('originalSource'));
				assert.equal(src['originalModule'], 'lib/util');

				done();
			});
		});
	});
});