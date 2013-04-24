// config before/after filter functions
// just like write controller.action
module.exports = {
	before: {
		// for controller level template variables
		'LOCALS': function(req, res){
			var locals = this._LOCALS;
			if(typeof locals == 'object'){
				Object.keys(locals).forEach(function(key){
					res.locals[key] = locals[key];
				});
			}
		}
	},
	after: {}
}