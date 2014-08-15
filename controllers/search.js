module.exports.controller = function(app) {
var moment = require('moment');
/**
 * GET /search?query=searchterm
 * Global search
 */
 //do a search across all fields but only for that same organization, return first 1000 results, order by timestamp
  app.get('/search', app.locals.passportConf.isAuthenticated, function(req, res) {
    app.locals.elasticsearchClient.search({
      index: 'applications',
      body: {
        query: {
          query_string: {
            query: 'orgid:'+req.user.orgid + ' AND ' + req.query.query
          }
        },
        highlight : {
          fields : {
              resume_attachment : {}
          }
        }
      },
      size: 1000,
      sort: '_timestamp:desc',
      fields: 'name,email,_timestamp,position_id,resume_attachment_url'
    }, function (error, response) {
      if (!error){
        console.log(response.hits.hits);
      	res.render('search', {
  				 title: 'Search',
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