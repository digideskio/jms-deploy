module.exports = {
	codebase: {
		source: {
			'test': {
				versions: 2,
				root: 'tests/scripts/src'
			},
			'foobar': {
				versions: 2,
				root: ''
			}
		}
	},
	network: {
		host: '127.0.0.1',
		port: 1337
	},
	api: {
		enabled: true,
		host: '127.0.0.1'
	},
	storage: {
		redis: {
			host: '127.0.0.1',
			port: 6379,
			database: 6
		}
	},
	debug: {
		loglevel: 'error'
	}
}