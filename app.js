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
app.locals.passportConf = require('./config/passport');

/**
* ElasticSearch configuration
*/
app.locals.elasticsearchClient = new elasticsearch.Client({
  host: 'localhost:9200',
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


/**
 * Mongoose configuration.
 */

mongoose.connect(secrets.db);
mongoose.connection.on('error', function() {
  console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.');
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
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public'), { maxAge: week }));
app.use(function(req, res) {
  res.status(404);
  res.render('404');
});
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
app.get('/auth/facebook/callback', passport.authenticate('facebook', { successRedirect: '/', failureRedirect: '/login' }));
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { successRedirect: '/', failureRedirect: '/login' }));
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { successRedirect: '/', failureRedirect: '/login' }));
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { successRedirect: '/', failureRedirect: '/login' }));
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { successRedirect: '/', failureRedirect: '/login' }));

/**
 * Start Express server.
 */

app.listen(app.get('port'), function() {
  console.log("✔ Express server listening on port %d in %s mode", app.get('port'), app.settings.env);
});

module.exports = app;
