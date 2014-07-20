jms-deploy
==================

JMS deploy for Ustream


## How To:

1. checkout repo
2. run `npm install`
3. update configs
4. run `grunt release`
5. done



#### 'grunt release' does:

* bump the version in your package.json file.
* stage the package.json file's change.
* commit that change with a message like "release 0.6.22".
* create a new git tag for the release.
* push the changes out to git.
* also push the new tag out to git.
* publish the new version to npm.