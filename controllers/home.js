module.exports.controller = function(app) {
var moment = require('moment');
/**
 * GET /
 * Home page.
 */

  //show the 1000 most recent applicants and show them
  app.get('/', app.locals.passportConf.isAuthenticated, function(req, res) {
    app.locals.elasticsearchClient.search({
      index: 'applications',
      size: 1000,
      sort: '_timestamp:desc',
      fields: 'name,email,_timestamp,position_id,resume_attachment_url'
    }, function (error, response) {
      if (!error){
      	console.log(response.hits.hits);
      	res.render('home', {
  				 title: 'Home',
  				 results: response.hits.hits,
  				 moment: moment 
  			});
      } else {
      	console.log(error);
        req.flash('errors', error);
      }
    });
  });
}