module.exports.controller = function(app) {
/**
 * GET /
 * Home page.
 */
 app.get('/', function(req, res) {
	res.render('home', {
	    title: 'Home'
	  });
  });
}