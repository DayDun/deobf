const esprima = require("esprima");

const StringArrayRotateFunction = function(stringArrayName, selfDefending) {
	let code;
	if (selfDefending) {
		code = `
			var $selfDefendingFunc = function() {
				var $object = {
					data: {
						key: "cookie",
						value: "timeout"
					},
					setCookie: function($options, $name, $value, $document) {
						$document = $document || {};
						
						var $updatedCookie = $name + "=" + $value;
						var $i = 0;
						
						for (var $i = 0, $len = $options.length; $i < $len; $i++) {
							var $propName = $options[$i];
							
							$updatedCookie += "; " + $propName;
							
							var $propValue = $options[$propName];
							
							$options.push($propValue);
							$len = $options.length;
							
							if ($propValue !== true) {
								$updatedCookie += "=" + $propValue;
							}
						}
						$document.cookie = $updatedCookie;
					},
					removeCookie: function(){return "dev";},
					getCookie: function($document2, $name2) {
						$document2 = $document2 || function($value2) { return $value2 };
						var $matches = $document2(new RegExp(
							"(?:^|; )" + $name2.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"
						));
						
						var $func = function($param1, $param2) {
							$param1(++$param2);
						};
						
						$func($whileFunction, $shift);
						
						return $matches ? decodeURIComponent($matches[1]) : undefined;
					}
				};
				
				var $test1 = function() {
					var $regExp = new RegExp("\\\\w+ *\\\\(\\\\) *{\\\\w+ *['|\\"].+['|\\"];? *}");
					
					return $regExp.test($object.removeCookie.toString());
				};
				
				$object.updateCookie = $test1;
				
				var $cookie = "";
				var $result = $object.updateCookie();
				
				if (!$result) {
					$object.setCookie(["*"], "counter", 1);
				} else if ($result) {
					$cookie = $object.getCookie(null, "counter");
				} else {
					$object.removeCookie();
				}
			};
			
			$selfDefendingFunc();
		`;
	} else {
		code = `$whileFunction(++$shift);`;
	}
	return `
		(function ($array, $shift) {
			var $whileFunction = function($times) {
				while(--$times) {
					$array.push($array.shift());
				}
			};

			${code}
		})(${stringArrayName}, $num$);
	`;
};

const StringArrayCallsWrapper = function(stringArrayName, type, selfDefending, glob) {
	let decodeCode = ``;
	let selfDefendingCode = ``;
	
	let globalVariableTemplate;
	if (glob) {
		globalVariableTemplate = `
			var $getGlobal = function() {
				var $globalObject;

				try {
					$globalObject = Function("return (function() {}.constructor(\\"return this\\")( ));")();
				} catch ($e) {
					$globalObject = window;
				}
				
				return $globalObject;
			};
			var $that = $getGlobal();
		`;
	} else {
		globalVariableTemplate = `
			var $that;

			try {
				var $getGlobal = Function("return (function() {}.constructor(\\"return this\\")( ));");
				
				$that = $getGlobal();
			} catch ($e) {
				$that = window;
			}
		`;
	}
	
	let atobPolyfill = `
		(function () {
			${globalVariableTemplate}
			
			var $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
			$that.atob || ($that.atob = function($input) {
				var $strr = String($input).replace(/=+$/, "");
				for (
					var $bc = 0, $bs, $buffer, $idx = 0, $output = "";
					$buffer = $strr.charAt($idx++);
					~$buffer && ($bs = $bc % 4 ? $bs * 64 + $buffer : $buffer,
						$bc++ % 4) ? $output += String.fromCharCode(255 & $bs >> (-2 * $bc & 6)) : 0
				) {
					$buffer = $chars.indexOf($buffer);
				}
				return $output;
			});
		})();
	`;
	
	if (selfDefending) {
		selfDefendingCode = `
			var $StatesClass = function($namen) {
				this.$rc4BytesIdentifier = $namen;
				this.$statesIdentifier = [1, 0, 0];
				this.$newStateIdentifier = function(){return "newState";};
				this.$firstStateIdentifier = "\\\\w+ *\\\\(\\\\) *{\\\\w+ *";
				this.$secondStateIdentifier = "['|\\"].+['|\\"];? *}";
			};
			
			$StatesClass.prototype.$checkStateIdentifier = function() {
				var $regExp = new RegExp(this.$firstStateIdentifier + this.$secondStateIdentifier);
				var $expression = $regExp.test(this.$newStateIdentifier.toString())
					? --this.$statesIdentifier[1]
					: --this.$statesIdentifier[0];
				
				return this.$runStateIdentifier($expression);
			};
			
			$StatesClass.prototype.$runStateIdentifier = function($stateResultIdentifier) {
				if (!Boolean(~$stateResultIdentifier)) {
					return $stateResultIdentifier;
				}
				
				return this.$getStateIdentifier(this.$rc4BytesIdentifier);
			};
			$StatesClass.prototype.$getStateIdentifier = function($callback) {
				for (var $iii = 0, $len = this.$statesIdentifier.length; $iii < $len; $iii++) {
					this.$statesIdentifier.push(Math.round(Math.random()));
					$len = this.$statesIdentifier.length;
				}
				
				return $callback(this.$statesIdentifier[0]);
			};
			new $StatesClass($name).$checkStateIdentifier();
		`;
	}
	
	if (type == "base64") {
		decodeCode = `
			if ($name.$initialized === undefined) {
				${atobPolyfill}
				
				$name.$decode = function($str) {
					var $string = atob($str);
					var $newStringChars = [];
					
					for (var $ii = 0, $length = $string.length; $ii < $length; $ii++) {
						$newStringChars += "%" + ("00" + $string.charCodeAt($ii).toString(16)).slice(-2);
					}
					
					return decodeURIComponent($newStringChars);
				};
				
				$name.$data = {};
				
				$name.$initialized = true;
			}
			
			var $cachedValue = $name.$data[$index];
			
			if ($cachedValue === undefined) {
				${selfDefendingCode}
				
				$value = $name.$decode($value);
				$name.$data[$index] = $value;
			} else {
				$value = $cachedValue;
			}
		`;
	} else if (type == "rc4") {
		let rc4Polyfill = `
			var $rc4 = function ($str, $key) {
				var $s = [], $j = 0, $x, $res = "", $newStr = "";
			   
				$str = atob($str);
					
				for (var $k = 0, $length = $str.length; $k < $length; $k++) {
					$newStr += "%" + ("00" + $str.charCodeAt($k).toString(16)).slice(-2);
				}
			
				$str = decodeURIComponent($newStr);
									
				for (var $i = 0; $i < 256; $i++) {
					$s[$i] = $i;
				}

				for ($i = 0; $i < 256; $i++) {
					$j = ($j + $s[$i] + $key.charCodeAt($i % $key.length)) % 256;
					$x = $s[$i];
					$s[$i] = $s[$j];
					$s[$j] = $x;
				}
				
				$i = 0;
				$j = 0;
				
				for (var $y = 0; $y < $str.length; $y++) {
					$i = ($i + 1) % 256;
					$j = ($j + $s[$i]) % 256;
					$x = $s[$i];
					$s[$i] = $s[$j];
					$s[$j] = $x;
					$res += String.fromCharCode($str.charCodeAt($y) ^ $s[($s[$i] + $s[$j]) % 256]);
				}
						  
				return $res;
			}
		`;
		
		decodeCode = `
			if ($name.$initializedIdentifier === undefined) {
				${atobPolyfill}
				
				${rc4Polyfill}
				$name.$rc4Identifier = $rc4;
				
				$name.$dataIdentifier = {};
				
				$name.$initializedIdentifier = true;
			}

			var $cachedValue = $name.$dataIdentifier[$index];
			if ($cachedValue === undefined) {
				if ($name.$onceIdentifier === undefined) {
					${selfDefendingCode}
					
					$name.$onceIdentifier = true;
				}
				
				$value = $name.$rc4Identifier($value, $key);
				$name.$dataIdentifier[$index] = $value;
			} else {
				$value = $cachedValue;
			}
		`;
	}
	
	return `
		var $name = function($index, $key) {
			$index = $index - 0;
			var $value = ${stringArrayName}[$index];
			
			${decodeCode}
			
			return $value;
		};
	`;
};

const SingleCallTemplate = function() {
	return `
		var $singleCall = function(){
			var $firstCall = true;
			
			return function($context, $fn) {
				var $rfn = $firstCall ? function() {
					if ($fn) {
						var $res = $fn.apply($context, $arguments);
						$fn = null;
						return $res;
					}
				} : function() {};
				
				$firstCall = false;
				
				return $rfn;
			}
		}();
	`;
};

const SelfDefendingTemplate = function(singleCallName) {
	return `
        var $selfDefendingFunctionName = ${singleCallName}(this, function () {
            var $test = function () {
                var $regExp = $test
                    .constructor('return /" + this + "/')()
                    .constructor('^([^ ]+( +[^ ]+)+)+[^ ]}');
                
                return !$regExp.test($selfDefendingFunctionName);
            };
            
            return $test();
        });
        
        $selfDefendingFunctionName();
	`;
};

module.exports = {
	StringArrayRotateFunction,
	StringArrayCallsWrapper,
	SingleCallTemplate,
	SelfDefendingTemplate
};
