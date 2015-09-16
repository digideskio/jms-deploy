#!/bin/sh

# deploy example code
# update example code to create versions
# deploy again
# tests: check redis content
# flush redis

echo "Test deploy"
node tests/scripts/test-deploy.js

sleep 1

echo "Running tests..."
mocha --ui tdd --config test tests/integration/*.js

node tests/scripts/flush-redis.js
status="$?"

if  [ "$status" != 0 ]; then
    echo "Could not flush the test redis properly"
fi

echo "Test redis cleared"