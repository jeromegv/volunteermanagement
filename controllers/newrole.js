var multiparty = require('multiparty');
var validator = require('validator');

module.exports.controller = function(app) {
	
	/**
   * GET /newrole
   * Create a new job position
   */

	app.get('/newrole', app.locals.passportConf.isAuthenticated, function(req, res) {
		res.render('newrole', {
			title: 'Create New Role'
		});
	});

	/**
   * GET /newrole
   * Create a new job position
   */

	app.post('/newrole', app.locals.passportConf.isAuthenticated, function(req, res) {
		 var form = new multiparty.Form();

	    // parse the form
	    form.parse(req, function(err, fields, files) {
	      if (err) {
	        req.flash('errors', { msg: 'Error occured while trying to parse the form, please consult the logs'});
	        res.redirect('/apply');
	        return;
	      }

	      // server side field validation
	      // TODO add client-side field validation
	      // TODO complete validation once we have more field
	      var errorMsg;
	      if (!validator.isDate(fields.startingdate[0])){
	        errorMsg='Date is not valid';
	      }
	      
	      if (errorMsg) {
	        req.flash('errors', { msg: errorMsg});
	        res.redirect('/apply');
	        return;
	      }
		});

	});
}