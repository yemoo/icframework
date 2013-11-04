module.exports = function(req, res, next) {
	var ctrlUtil = req.ctrlUtil;
	ctrlUtil.bigpipe = function(obj, next) {
		if (next === true) {
			next = function() {
				res.end();
			}
		} else if (typeof next != 'function') {
			next = function() {};
		}

		if (obj.tpl) {
			ctrlUtil.set('chunked', true);
			res.render(obj.tpl, obj.data, function(err, html) {
				if (!err) {
					delete obj.data;
					delete obj.tpl;
					obj.html = html;
					res.write("<script>bigpipe.onPageletArrive(" + JSON.stringify(obj) + ");</script>");
					next();
				} else {
					next(err);
				}
			});
		} else {
			res.write("<script>bigpipe.onPageletArrive(" + JSON.stringify(obj) + ");</script>");
			next();
		}
	};
	next();
};