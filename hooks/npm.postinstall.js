

console.log('o hai!!')

console.log(__dirname);

return;

var p='../plugins',
	l='../lib',
	dl='node_modules/lib',
	dp='node_modules/plugins',
	fs=require('fs');

fs.exists(l, function(e) {
	e || fs.symlinkSync(l, dl, 'dir')
});

fs.exists(p, function(e) {
	e || fs.symlinkSync(p, dp, 'dir')
});