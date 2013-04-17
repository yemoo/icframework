var express = require('express'),
    sanitize = icFrame.validator.sanitize;

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
        this.iconv = require('iconv').Iconv;
    },
    is_ascii: function(str) {
        return /[\x00-\x7F]/.test(str);
    },
    clean_string: function(str) {
        if (!this.is_ascii(str)) {
            str = this.iconv('UTF-8', 'UTF-8//IGNORE', str);
        }
        return str;
    }
};

var security = {
    //_csrf_hash: '',
    //_csrf_expire: 7200,
    //_csrf_token_name: 'ci_csrf_token',
    //_csrf_cookie_name: 'ci_csrf_token',
    is_secure: true,
    init: function(req, res, next) {
        var config = this.config = icFrame.config.security,
            _next = next;

        this.req = req;
        this.res = res;
        this.next = next;

        if (config.utf8_enable) {
            UTF8.init();
        }

        // basic filter and xss
        ['params', 'query', 'body', 'cookie', 'signedCookies'].forEach(function(name) {
            var params = req[name];
            if (params) {
                for (var key in params) {
                    req[name][this._clean_input_keys(key)] = this._clean_input_data(params[key]);
                }
            }
        }, this);

        if (this.is_secure) {
            // csrf
            if (config.csrf_protection) {
                token_name = config.csrf_token_name;
                next = function() {
                    res.locals['CSRF_TOKEN'] = '<input type="hidden" name="' + token_name + '" value="' + req.session._csrf + '" />';
                    _next.apply(this, arguments);
                }
                express.csrf(function(req) {
                    return (req.body && req.body[token_name]) || (req.query && req.query[token_name]) || (req.headers['x-csrf-token']);
                }).apply(express, arguments);
            } else {
                next();
            }
        }
    },
    _clean_input_keys: function(str) {
        var config = this.config,
            res = this.res;

        if (!str) return str;

        if (/^,_[a-z0-9:_\/-]+$/.test(str)) {
            str = str.replace(/,_/, "");
        }
        if (!/^[a-z0-9:_\/-]+$/i.test(str)) {
            this.is_secure = false;
            res.end('Disallowed Key Characters: ' + str);
        }

        if (config.utf8_enable) {
            str = UTF8.clean_string(str);
        }

        return str;
    },
    _clean_input_data: function(data) {
        var config = this.config;

        if (!data) return data;
        if (typeof data == 'object') {
            var newData = {};
            for (var key in data) {
                newData[this._clean_input_keys(key)] = this._clean_input_data(data[key]);
            }
            return newData;
        }

        //data = stripslashes(data);

        if (config.utf8_enable) {
            data = UTF8.clean_string(data);
        }

        // Remove control characters
        data = remove_invisible_characters(data);

        if (config.global_xss_filtering) {
            data = sanitize(data).xss();
        }

        return data;
    }
};

module.exports = security.init.bind(security);