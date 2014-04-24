/**
 * Module dependencies.
 */
var fs = require('fs');
var express = require('express');
var MongoStore = require('connect-mongo')(express);
//allow for flash messages (error messages only shown once)
var flash = require('express-flash');
//This module contains utilities for handling and transforming file paths.
var path = require('path');
var mongoose = require('mongoose');
var elasticsearch = require('elasticsearch');
var passport = require('passport');
//to validate user input
var expressValidator = require('express-validator');
//When working in development mode, connect-assets will load each file 
//individually, without minifying or concatenating anything. 
//When you deploy your app, it will run in production mode, 
//and so connect-assets will automatically serve a single concatenated + minified application.js.
var connectAssets = require('connect-assets');



/**
 * Create Express server.
 */

var app = express();

/**
 * API keys + Passport configuration.
 */

var secrets = require('./config/secrets');
var config = require('./config');
app.locals.passportConf = require('./config/passport');

/**
* ElasticSearch configuration
*/
app.locals.elasticsearchClient = new elasticsearch.Client({
  host: {
    protocol: config.elasticsearch.protocol,
    host: config.elasticsearch.host,
    port: config.elasticsearch.port,
    auth: config.elasticsearch.user+':'+config.elasticsearch.password
  },
  log: 'trace',
  apiVersion: '1.0'
});
app.locals.elasticsearchClient.ping({
  // ping usually has a 100ms timeout
  requestTimeout: 2000,

  // undocumented params are appended to the query string
  hello: "elasticsearch!"
}, function (error) {
  if (error) {
    console.error('✗ elasticsearch cluster is down! Make sure elasticsearch is running');
    process.exit(1);
  } else {
    console.log('✔ Confirming elasticsearch is running');
  }
});
//we make sure to configure elastic search on launch if it was never configured
//TODO move to a proper file instead of app.js
app.locals.elasticsearchClient.indices.exists({
  index: 'applications'
}, function (error, response,status) {
  if (error){
    console.error(error);
    process.exit(1);
  } else {
    //the index applications is missing, create it
    if (!response){
      app.locals.elasticsearchClient.indices.create({
        index: 'applications'
    }, function (error, response,status) {
        if (error){
          console.error(error);
          process.exit(1);
        } else {
          //add specific mapping to applications
          if (status==200){
            app.locals.elasticsearchClient.indices.putMapping({
              index: 'applications',
              type: 'application',
              body:{
                  application: {
                      _source: {
                        excludes: [
                          "resume_attachment"
                        ]
                      },
                       _timestamp : { 
                                  enabled : true,
                                  store: "yes" 
                      },
                      properties: {
                                 email: {
                                    type: "string"
                                 },
                                 name: {
                                    type: "string"
                                 },
                                 position_id: {
                                    type: "string"
                                 },
                                 resume: {
                                    type: "string"
                                 },
                                 resume_attachment: {
                                    type: "attachment",
                                    fields: {
                                      resume_attachment: {
                                        store: "yes"
                                      },
                                      author: {
                                        store : "yes"
                                      },
                                      title: {
                                        store : "yes"
                                       },
                                      name: {
                                        store : "yes"
                                       },
                                      date: {
                                        store : "yes"
                                       },
                                      keywords: {
                                         store : "yes"
                                      },
                                      content_type: {
                                          store : "yes"
                                       },
                                      content_length: {
                                          store : "yes"
                                      }
                                    }
                                 }, 
                                 resume_attachment_url: {
                                    type: "string"
                                 }
                      }
                  }
              }

            }, function (error, response,status) {
              if (error){
                console.error(error);
                process.exit(1);
              } else {
                if (status==200){
                  console.log('Mapping for elasticsearch successfully set')
                } else {
                  console.error('Could not set mapping for elasticsearch applications collection. Make sure the Mapper Attachments Type plugin is installed.');
                  process.exit(1);
                }
              }
            
            });
          } else {
            console.log('Could not create the applications index for elasticsearch');
            process.exit(1);
          }
        }
      });
    }
  }

});

/**
 * Mongoose configuration.
 */

mongoose.connect(secrets.db);
mongoose.connection.on('error', function(err) {
  console.log(err);
  console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.');
  process.exit(1);
});


/**
 * Express configuration.
 */

var hour = 3600000;
var day = (hour * 24);
var week = (day * 7);
var month = (day * 30);

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(connectAssets({
  paths: ['public/css', 'public/js'],
  helperContext: app.locals
}));
app.use(express.compress());
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.json());
app.use(express.urlencoded());
app.use(expressValidator());
app.use(express.methodOverride());
//TODO not so sure bodyparser should be used with Express 3.4.X, do research on that
app.use(express.bodyParser());
app.use(express.session({
  secret: secrets.sessionSecret,
  store: new MongoStore({
    url: secrets.db,
    auto_reconnect: true
  })
}));
app.use(express.csrf());
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req, res, next) {
  res.locals.user = req.user;
  res.locals._csrf = req.csrfToken();
  res.locals.secrets = secrets;
  next();
});
app.use(flash());
//this will cache the static content for a week
app.use(express.static(path.join(__dirname, 'public'), { maxAge: week }));
app.use(function(req, res, next) {
  // Keep track of previous URL
  if (req.method !== 'GET') return next();
    var path = req.path.split('/')[1];
    if (/(auth|login|logout|signup)$/i.test(path)) return next();
      req.session.returnTo = req.path;
      next();
    });
app.use(app.router);
app.use(function(req, res) {
  res.status(404);
  res.render('404');
});
//TODO we do not handle "file too big error" when uploading files at the moment
app.use(express.errorHandler());

//TEMP KEEP FOR DEV for non-minified markup
app.locals.pretty = true;

/**
 * Dynamically include routes (Controller)
 */

fs.readdirSync('./controllers').forEach(function (file) {
  if(file.substr(-3) == '.js') {
      route = require('./controllers/' + file);
      route.controller(app);
  }
});


/**
 * OAuth routes for sign-in.
 */

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
/**
 * Start Express server.
 */

app.listen(app.get('port'), function() {
  console.log("✔ Express server listening on port %d in %s mode", app.get('port'), app.get('env'));
});

module.exports = app;
