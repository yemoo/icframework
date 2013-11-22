var express = require('express'),
    xss = require('xss');

// [ref]: validator source code
var non_displayables = [
    /%0[0-8bcef]/g, // url encoded 00-08, 11, 12, 14, 15
    /%1[0-9a-f]/g, // url encoded 16-31
    /[\x00-\x08]/g, // 00-08
    /\x0b/g, /\x0c/g, // 11,12
    /[\x0e-\x1f]/g // 14-31
];

function remove_invisible_characters(str) {
    if (!str) return str;
    for (var i in non_displayables) {
        str = str.replace(non_displayables[i], '');
    }
    return str;
}

function stripslashes(str) {
    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   improved by: Ates Goral (http://magnetiq.com)
    // +      fixed by: Mick@el
    // +   improved by: marrtins
    // +   bugfixed by: Onno Marsman
    // +   improved by: rezna
    // +   input by: Rick Waldron
    // +   reimplemented by: Brett Zamir (http://brett-zamir.me)
    // +   input by: Brant Messenger (http://www.brantmessenger.com/)
    // +   bugfixed by: Brett Zamir (http://brett-zamir.me)
    // *     example 1: stripslashes('Kevin\'s code');
    // *     returns 1: "Kevin's code"
    // *     example 2: stripslashes('Kevin\\\'s code');
    // *     returns 2: "Kevin\'s code"
    return (str + '').replace(/\\(.?)/g, function(s, n1) {
        switch (n1) {
            case '\\':
                return '\\';
            case '0':
                return '\u0000';
            case '':
                return '';
            default:
                return n1;
        }
    });
}

var UTF8 = {
    init: function() {
        var Iconv = require('iconv').Iconv;
        this.iconv = new Iconv('UTF-8', 'UTF-8//IGNORE');
    },
    is_ascii: function(str) {
        return /[\x00-\x7F]/.test(str);
    },
    clean_string: function(str) {
        if (!this.is_ascii(str)) {
            str = this.iconv.convert(str).toString();
        }
        return str;
    }
}, config;

function clean_input_keys(str) {
    var isSecure = true,
        errInfo = '';

    if (!str) return str;

    if (/^,_[a-z0-9:_\/-]+$/.test(str)) {
        str = str.replace(/,_/, "");
    }
    str = str.trim();
    if (!/^[a-z0-9:_\/-]+$/i.test(str)) {
        isSecure = false;
        errInfo = 'Disallowed Key Characters: ' + str;
    } else {
        if (config.utf8_enable) {
            str = UTF8.clean_string(str);
        }
    }

    return {
        is_secure: isSecure,
        errInfo: errInfo,
        value: str
    };
}

function clean_input_data(data, next) {

    if (data) {
        if (typeof data == 'object') {
            data = (iter(data, next) !== false) && data;
        } else {
            data = stripslashes(data);

            if (config.utf8_enable) {
                data = UTF8.clean_string(data);
            }

            // Remove control characters
            data = remove_invisible_characters(data);

            if (config.global_xss_filtering) {
                data = xss(data);
            }
        }
    }

    return (data !== false) && {
        value: data
    };
}

function iter(params, next) {
    return params ? Object.keys(params).every(function(key) {
        var keyInfo = clean_input_keys(key),
            valueInfo;

        if (keyInfo.is_secure === false) {
            next(new Error(keyInfo.errInfo || 'Security Error!'));
            return false;
        } else {
            valueInfo = clean_input_data(params[key], next);
            if (valueInfo !== false) {
                params[keyInfo.value] = valueInfo.value;
            }
            return valueInfo !== false;
        }
    }) : true;
}

module.exports = function(req, res, next) {
    var is_secure;

    if (!config) {
        config = icFrame.config.security;
    }

    if (config.utf8_enable) {
        UTF8.init();
    }
    // basic filter and xss
    is_secure = ['params', 'query', 'body', 'cookie', 'signedCookies'].every(function(name) {
        return iter(req[name], next);
    });

    if (is_secure) {
        // csrf
        if (config.csrf_protection) {
            token_name = config.csrf_token_name;
            res.locals['CSRF_TOKEN'] = '<input type="hidden" name="' + token_name + '" value="' + req.session._csrf + '" />';
            express.csrf(function(req) {
                return (req.body && req.body[token_name]) || (req.query && req.query[token_name]) || (req.headers['x-csrf-token']);
            }).apply(express, arguments);
        } else {
            next();
        }
    }
};