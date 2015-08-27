/**
 * almond 0.2.6 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
	var main, req, makeMap, handlers,
		defined = {},
		waiting = {},
		config = {},
		defining = {},
		hasOwn = Object.prototype.hasOwnProperty,
		aps = [].slice;

	function hasProp(obj, prop) {
		return hasOwn.call(obj, prop);
	}

	/**
	 * Given a relative module name, like ./something, normalize it to
	 * a real name that can be mapped to a path.
	 * @param {String} name the relative name
	 * @param {String} baseName a real name that the name arg is relative
	 * to.
	 * @returns {String} normalized name
	 */
	function normalize(name, baseName) {
		var nameParts, nameSegment, mapValue, foundMap,
			foundI, foundStarMap, starI, i, j, part,
			baseParts = baseName && baseName.split("/"),
			map = config.map,
			starMap = (map && map['*']) || {};

		//Adjust any relative paths.
		if (name && name.charAt(0) === ".") {
			//If have a base name, try to normalize against it,
			//otherwise, assume it is a top-level require that will
			//be relative to baseUrl in the end.
			if (baseName) {
				//Convert baseName to array, and lop off the last part,
				//so that . matches that "directory" and not name of the baseName's
				//module. For instance, baseName of "one/two/three", maps to
				//"one/two/three.js", but we want the directory, "one/two" for
				//this normalization.
				baseParts = baseParts.slice(0, baseParts.length - 1);

				name = baseParts.concat(name.split("/"));

				//start trimDots
				for (i = 0; i < name.length; i += 1) {
					part = name[i];
					if (part === ".") {
						name.splice(i, 1);
						i -= 1;
					} else if (part === "..") {
						if (i === 1 && (name[2] === '..' || name[0] === '..')) {
							//End of the line. Keep at least one non-dot
							//path segment at the front so it can be mapped
							//correctly to disk. Otherwise, there is likely
							//no path mapping for a path starting with '..'.
							//This can still fail, but catches the most reasonable
							//uses of ..
							break;
						} else if (i > 0) {
							name.splice(i - 1, 2);
							i -= 2;
						}
					}
				}
				//end trimDots

				name = name.join("/");
			} else if (name.indexOf('./') === 0) {
				// No baseName, so this is ID is resolved relative
				// to baseUrl, pull off the leading dot.
				name = name.substring(2);
			}
		}

		//Apply map config if available.
		if ((baseParts || starMap) && map) {
			nameParts = name.split('/');

			for (i = nameParts.length; i > 0; i -= 1) {
				nameSegment = nameParts.slice(0, i).join("/");

				if (baseParts) {
					//Find the longest baseName segment match in the config.
					//So, do joins on the biggest to smallest lengths of baseParts.
					for (j = baseParts.length; j > 0; j -= 1) {
						mapValue = map[baseParts.slice(0, j).join('/')];

						//baseName segment has  config, find if it has one for
						//this name.
						if (mapValue) {
							mapValue = mapValue[nameSegment];
							if (mapValue) {
								//Match, update name to the new value.
								foundMap = mapValue;
								foundI = i;
								break;
							}
						}
					}
				}

				if (foundMap) {
					break;
				}

				//Check for a star map match, but just hold on to it,
				//if there is a shorter segment match later in a matching
				//config, then favor over this star map.
				if (!foundStarMap && starMap && starMap[nameSegment]) {
					foundStarMap = starMap[nameSegment];
					starI = i;
				}
			}

			if (!foundMap && foundStarMap) {
				foundMap = foundStarMap;
				foundI = starI;
			}

			if (foundMap) {
				nameParts.splice(0, foundI, foundMap);
				name = nameParts.join('/');
			}
		}

		return name;
	}

	function makeRequire(relName, forceSync) {
		return function () {
			//A version of a require function that passes a moduleName
			//value for items that may need to
			//look up paths relative to the moduleName
			return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
		};
	}

	function makeNormalize(relName) {
		return function (name) {
			return normalize(name, relName);
		};
	}

	function makeLoad(depName) {
		return function (value) {
			defined[depName] = value;
		};
	}

	function callDep(name) {
		if (hasProp(waiting, name)) {
			var args = waiting[name];
			delete waiting[name];
			defining[name] = true;
			main.apply(undef, args);
		}

		if (!hasProp(defined, name) && !hasProp(defining, name)) {
			throw new Error('No ' + name);
		}
		return defined[name];
	}

	//Turns a plugin!resource to [plugin, resource]
	//with the plugin being undefined if the name
	//did not have a plugin prefix.
	function splitPrefix(name) {
		var prefix,
			index = name ? name.indexOf('!') : -1;
		if (index > -1) {
			prefix = name.substring(0, index);
			name = name.substring(index + 1, name.length);
		}
		return [prefix, name];
	}

	/**
	 * Makes a name map, normalizing the name, and using a plugin
	 * for normalization if necessary. Grabs a ref to plugin
	 * too, as an optimization.
	 */
	makeMap = function (name, relName) {
		var plugin,
			parts = splitPrefix(name),
			prefix = parts[0];

		name = parts[1];

		if (prefix) {
			prefix = normalize(prefix, relName);
			plugin = callDep(prefix);
		}

		//Normalize according
		if (prefix) {
			if (plugin && plugin.normalize) {
				name = plugin.normalize(name, makeNormalize(relName));
			} else {
				name = normalize(name, relName);
			}
		} else {
			name = normalize(name, relName);
			parts = splitPrefix(name);
			prefix = parts[0];
			name = parts[1];
			if (prefix) {
				plugin = callDep(prefix);
			}
		}

		//Using ridiculous property names for space reasons
		return {
			f: prefix ? prefix + '!' + name : name, //fullName
			n: name,
			pr: prefix,
			p: plugin
		};
	};

	function makeConfig(name) {
		return function () {
			return (config && config.config && config.config[name]) || {};
		};
	}

	handlers = {
		require: function (name) {
			return makeRequire(name);
		},
		exports: function (name) {
			var e = defined[name];
			if (typeof e !== 'undefined') {
				return e;
			} else {
				return (defined[name] = {});
			}
		},
		module: function (name) {
			return {
				id: name,
				uri: '',
				exports: defined[name],
				config: makeConfig(name)
			};
		}
	};

	main = function (name, deps, callback, relName) {
		var cjsModule, depName, ret, map, i,
			args = [],
			usingExports;

		//Use name if no relName
		relName = relName || name;

		//Call the callback to define the module, if necessary.
		if (typeof callback === 'function') {

			//Pull out the defined dependencies and pass the ordered
			//values to the callback.
			//Default to [require, exports, module] if no deps
			deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
			for (i = 0; i < deps.length; i += 1) {
				map = makeMap(deps[i], relName);
				depName = map.f;

				//Fast path CommonJS standard dependencies.
				if (depName === "require") {
					args[i] = handlers.require(name);
				} else if (depName === "exports") {
					//CommonJS module spec 1.1
					args[i] = handlers.exports(name);
					usingExports = true;
				} else if (depName === "module") {
					//CommonJS module spec 1.1
					cjsModule = args[i] = handlers.module(name);
				} else if (hasProp(defined, depName) ||
					hasProp(waiting, depName) ||
					hasProp(defining, depName)) {
					args[i] = callDep(depName);
				} else if (map.p) {
					map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
					args[i] = defined[depName];
				} else {
					window.jms(depName, arguments, main, this);
					return;
					//throw new Error(name + ' missing ' + depName);
				}
			}

			ret = callback.apply(defined[name], args);

			if (name) {
				//If setting exports via "module" is in play,
				//favor that over return value and exports. After that,
				//favor a non-undefined return value over exports use.
				if (cjsModule && cjsModule.exports !== undef &&
					cjsModule.exports !== defined[name]) {
					defined[name] = cjsModule.exports;

				} else if (ret !== undef || !usingExports) {
					//Use the return value from the function.
					defined[name] = ret;

				}
			}
		} else if (name) {
			//May just be an object definition for the module. Only
			//worry about defining if have a module name.
			defined[name] = callback;

		}
	};

	requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
		if (typeof deps === "string") {
			if (handlers[deps]) {
				//callback in this case is really relName
				return handlers[deps](callback);
			}
			//Just return the module wanted. In this scenario, the
			//deps arg is the module name, and second arg (if passed)
			//is just the relName.
			//Normalize module name, if it contains . or ..
			return callDep(makeMap(deps, callback).f);
		} else if (!deps.splice) {
			//deps is a config object, not an array.
			config = deps;
			if (callback.splice) {
				//callback is an array, which means it is a dependency list.
				//Adjust args if there are dependencies
				deps = callback;
				callback = relName;
				relName = null;
			} else {
				deps = undef;
			}
		}

		//Support require(['a'])
		callback = callback || function () {};

		//If relName is a function, it is an errback handler,
		//so remove it.
		if (typeof relName === 'function') {
			relName = forceSync;
			forceSync = alt;
		}

		//Simulate async callback;
		if (forceSync) {
			main(undef, deps, callback, relName);
		} else {
			//Using a non-zero value because of concern for what old browsers
			//do, and latest browsers "upgrade" to 4 if lower value is used:
			//http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
			//If want a value immediately, use require('id') instead -- something
			//that works in almond on the global level, but not guaranteed and
			//unlikely to work in other AMD implementations.
			setTimeout(function () {
				main(undef, deps, callback, relName);
			}, 4);
		}

		return req;
	};

	/**
	 * Just drops the config on the floor, but returns req in case
	 * the config return value is used.
	 */
	req.config = function (cfg) {
		config = cfg;
		if (config.deps) {
			req(config.deps, config.callback);
		}
		return req;
	};

	/**
	 * Expose module registry for debugging and tooling
	 */
	requirejs._defined = defined;

	define = function (name, deps, callback) {

		//This module may not have dependencies
		if (!deps.splice) {
			//deps is not an array, so probably means
			//an object literal or factory function for
			//the value. Adjust args.
			callback = deps;
			deps = [];
		}

		if (!hasProp(defined, name) && !hasProp(waiting, name)) {
			waiting[name] = [name, deps, callback];
		}
	};

	define.amd = {
		jQuery: true
	};
}());

window.jms.client = (function (window, document, undef) {

	var cfg,
		isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]', // (dull)
		head = document.getElementsByTagName('head')[0],
	//If BASE tag is in play, using appendChild is a problem for IE6.
	//When that browser dies, this can be removed. Details in this jQuery bug:
	//http://dev.jquery.com/ticket/2709
		baseElement = document.getElementsByTagName('base')[0],
		readyRegExp = /^(complete|loaded)$/,
		loaderObj,
		loadedList = [],
		callBackOrder = 0,
		orderedLoaders = {},
		lastLoaded = 1,
		errorMode = false,
		contextList = {};

	if (baseElement) {
		head = baseElement.parentNode;
	}

	if (typeof window.jms != 'undefined') {
		cfg = clone(window.jms);
	}

	if (!cfg.baseURL) {
		throw Error("Missing base url for JMS");
	}

	var pushToLoadedList = function (module) {
		if (module instanceof Array) {
			for (var m = 0; m < module.length ; m++ ) {
				loadedList.push(module[m]);
			}
		} else {
			loadedList.push(module);
		}
	}

	window.jms = function (module, actionArgs, action, actionContext) {

		var requestedModules = actionArgs[1],
			context,
			reqmodlen = requestedModules.length,
			modulesToLoad = [],
			loadingAlready;

		if (requestedModules.join(',').indexOf('.js') > -1) {
			throw new Error(requestedModules.join(',')  + " possibly refers to a file, not a module, aborting");
		}

		if (errorMode) {
			throw new Error("There was an error in a loaded module package, aborting");
		}

		callBackOrder += 1;
		context = newLoader(callBackOrder, actionArgs, action, actionContext);

		orderedLoaders['load_'+callBackOrder] = (function (context) {
			return function executor() {

				if (lastLoaded == context.callBackIndex) {
					lastLoaded++;

					var data = window['jmscb_' + context.callBackIndex]();

					try {
						data.payload.call(window);
					} catch (e) {
						errorMode = true;
						throw e;
					}

					if (window.jms.cfg.params.debug) {
						window.jms.history.data.push(JSON.parse(data.manifest));
					}

					context.passContext(data.list.split('|'));

					if (orderedLoaders['load_' + (context.callBackIndex + 1)]) {
						executeLoader('load_' + (context.callBackIndex + 1));
					}

					window['jmscb_' + context.callBackIndex] = void 0;
					orderedLoaders['load_' + context.callBackIndex] = void 0;

				}
			};
		}(context));

		debug([
			['  arguments', arguments],
			['  requested modules: ', requestedModules.join(',')],
			['  loaded list: ', loadedList]
		]);

		// is this pack is loading at the moment?
		// if it's downloaded, almond will take care of that
		for (var m = 0 ; m < reqmodlen ; m++) {
			if (!inArray(requestedModules[m], loadedList)) {
				modulesToLoad.push(requestedModules[m]);
			}
		}

		var url = [
			[
				cfg.baseURL,
				'js',
				getSourcePath(cfg),
				['+',
					modulesToLoad.join(','),
					(loadedList.length) ? '-'+loadedList.join(',') : '',
					'.js'
				].join('')
			].join('/'),
			params()
		].join('');

		// they have been loaded together
		//loadedList.push(requestedModules.join(','));
		// they have been loaded separately

		pushToLoadedList(requestedModules)

		contextList[requestedModules.join(',')] = context;

		// store data for possible lookup
		// make the load
		debug([
			['loading', url]
		]);

		load.call(this, context, module, url);
	};

	window.jms.push = pushToLoadedList;

	for (var i in cfg.pre) {
		require.apply(window, cfg.pre[i]);
	}
	cfg.pre = [];

	window.jms.cfg = cfg;

	if (cfg.params.debug) {
		window.jms.history = function () {
			window.jms.history.data.forEach(function (data, i) {
				console.group('jms call ' + i);
				console.log('requested modules');
				console.log(data.requested);
				console.log('received modules');
				console.log(data.received);
				console.groupEnd();
			});
		};
		window.jms.history.data = [];
	}

	debug([
		['  source', cfg.source],
		['  server', cfg.baseURL],
		['  configuration', cfg]
	]);


	function params () {
		var prms = [],
			paramlist = cfg.params,
			ret;

		for (var p in paramlist) {
			if (paramlist.hasOwnProperty(p)) {
				prms.push(p + '=' + paramlist[p]);
			}
		}

		prms.push('cb=jmscb_' + callBackOrder);

		ret = prms.length > 0 ? '?' + prms.join('&') : '';

		return ret;
	}

	function load (context, moduleName, url) {
		var node = document.createElement('script');
		node.type = 'text/javascript';
		node.charset = 'utf-8';
		node.async = true;
		node.setAttribute('data-requiremodule', moduleName);

		if (node.attachEvent &&
			!(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
			!isOpera) {

			node.attachEvent('onreadystatechange', context.onScriptLoad);

			//It would be great to add an error handler here to catch
			//404s in IE9+. However, onreadystatechange will fire before
			//the error handler, so that does not help. If addEvenListener
			//is used, then IE will fire error before load, but we cannot
			//use that pathway given the connect.microsoft.com issue
			//mentioned above about not doing the 'script execute,
			//then fire the script load event listener before execute
			//next script' that other browsers do.
			//Best hope: IE10 fixes the issues,
			//and then destroys all installs of IE 6-9.
			//node.attachEvent('onerror', context.onScriptError);
		} else {
			node.addEventListener('load', context.onScriptLoad, false);
			node.addEventListener('readystatechange', context.onScriptLoad, false);
			node.addEventListener('error', context.onScriptError, false);
		}

		context.packFileUrl = node.src = url;

		//For some cache cases in IE 6-8, the script executes before the end
		//of the appendChild execution, so to tie an anonymous define
		//call to the module name (which is stored on the node), hold on
		//to a reference to this node, but clear after the DOM insertion.

		//currentlyAddingScript = node;

		if (baseElement) {
			head.insertBefore(node, baseElement);
		} else {
			head.appendChild(node);
		}
		//currentlyAddingScript = null;

		return node;
	}

	function inArray(find, inArr) {
		var ret = false;
		if (Array.prototype.indexOf) {
			ret = inArr.indexOf(find) > -1;
		} else {
			var s = inArr.length;
			while (s--) {
				if (find == inArr[s]) {
					ret = true;
				}
			}
		}
		return ret;
	}

	function each(ary, func) {
		if (ary) {
			var i;
			for (i = 0; i < ary.length; i += 1) {
				if (ary[i] && func(ary[i], i, ary)) {
					break;
				}
			}
		}
	}

	function array_replace (haystack, needle, replaceTo) {
		each(haystack, function (elem, i) {
			if (elem === needle) {
				haystack[i] = replaceTo;
			}
		});

		return haystack;
	}

	function remapModules (requestArgs, moduleMap) {
		var req = requestArgs[1];

		each(req, function (module, rIndex) {
			loadedList = array_replace(loadedList, module,  moduleMap[rIndex]);
		});

		requestArgs[1] = moduleMap;

		return requestArgs;
	}

	function getSourcePath (cfg) {
		if (!cfg.localContext) {
			return '';
		}

		return [cfg.source,cfg.stage].join('/');
	}

	function newLoader (callBackOrder, actionArgs, action, actionContext) {

		var loader;

		return (loader = {
			callBackIndex: callBackOrder,
			packFileUrl: '',
			onCompleteActionArguments: [actionArgs],
			onCompleteAction: [action],
			onCompleteActionContext: [actionContext],

			/**
			 * add another dependency handler for this context
			 *
			 * @param actionArgs
			 * @param action
			 * @param actionContext
			 */
			append: function (actionArgs, action, actionContext) {
				loader.onCompleteActionArguments.push(actionArgs);
				loader.onCompleteAction.push(action);
				loader.onCompleteActionContext.push(actionContext);
			},

			onScriptLoad: function (evt) {
				//Using currentTarget instead of target for Firefox 2.0's sake. Not
				//all old browsers will be supported, but this one was easy enough
				//to support and still makes sense.
				if (evt.type === 'load' ||
					(readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
					//Reset interactive script so a script node is not held onto for
					//to long.
					//interactiveScript = null;

					//Pull out the name of the module and the context.
					var data = loader.getScriptData(evt);
					loader.completeLoad(data.id);
				}
			},

			onScriptError: function (evt) {
				var data = loader.getScriptData(evt);
				throw ('jms.js - Script error', evt, [data.id]);
			},

			getScriptData: function (evt) {
				//Using currentTarget instead of target for Firefox 2.0's sake. Not
				//all old browsers will be supported, but this one was easy enough
				//to support and still makes sense.
				var node = evt.currentTarget || evt.srcElement;

				//Remove the listeners once here.
				loader.removeListener(node, loader.onScriptLoad, 'load', 'onreadystatechange');
				loader.removeListener(node, loader.onScriptError, 'error');

				return {
					node: node,
					id: node && node.getAttribute('data-requiremodule')
				};
			},

			removeListener: function (node, func, name, ieName) {
				//Favor detachEvent because of IE9
				//issue, see attachEvent/addEventListener comment elsewhere
				//in this file.
				if (node.detachEvent && !isOpera) {
					//Probably IE. If not it will throw an error, which will be
					//useful to know.
					if (ieName) {
						node.detachEvent(ieName, func);
					}
				} else {
					node.removeEventListener(name, func, false);
				}
			},

			completeLoad: function () {
				debug([
					['completed load', loader.callBackIndex]
				]);

				executeLoader('load_'+loader.callBackIndex);

			},

			passContext: function (moduleMap) {
				var l = loader.onCompleteAction.length,
					action, context, args;

				for(var i = 0; i < l; i++) {
					action = loader.onCompleteAction[i];
					context = loader.onCompleteActionContext[i];

					args = remapModules(loader.onCompleteActionArguments[i], moduleMap);

					action.apply(context, args);
				}

				contextList[loader.packFileUrl] = null;
			}
		});
	}

	function executeLoader (id) {
		orderedLoaders[id]();
	}

	function clone(obj) {
		var target = {};
		for (var i in obj) {
			if (obj.hasOwnProperty(i)) {
				target[i] = obj[i];
			}
		}
		return target;
	}

	function debug (data) {
		if (!window.jms.cfg.params || !window.jms.cfg.params.debug) {
			return;
		}

		console.group('jms');
		for (var i in data) {
			console.log(data[i][0], data[i][1]);
		}
		console.groupEnd();
	}


})(window, document);