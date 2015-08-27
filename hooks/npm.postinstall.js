var path=require('path');

var k = path.normalize(__dirname + '/../..');

if ('node_modules' !== k.split(path.sep).pop()) return;

var l='../lib',
	dl='node_modules/lib',
	fs=require('fs');

fs.exists(l, function(e) {
	e || fs.symlinkSync(l, dl, 'dir')
});