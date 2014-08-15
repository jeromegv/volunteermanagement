/**
 * Module dependencies.
 */
 //read filesystem
var fs = require('fs');
var express = require('express');
//to use mongo as a session store for express
var MongoStore = require('connect-mongo')(express);
//allow for flash messages (error messages only shown once)
var flash = require('express-flash');
//This module contains utilities for handling and transforming file paths.
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
//to validate user input
var expressValidator = require('express-validator');
//When working in development mode, connect-assets will load each file 
//individually, without minifying or concatenating anything. 
//When you deploy your app, it will run in production mode, 
//and so connect-assets will automatically serve a single concatenated + minified application.js.
//TODO figure out how to define that it is prouction for connectAssets
var connectAssets = require('connect-assets');



/**
 * Create Express server.
 */

var app = express();

/**
 * API keys + Passport configuration.
 */
//TODO merge config and secrets in the same config file
var secrets = require('./config/secrets');
var config = require('./config');
app.locals.passportConf = require('./config/passport');

//Set configuration for elasticsearch in app.locals to make it accessible everywhere
app.locals.elasticsearchClient = require('./config/elasticsearch');


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
//TODO need to figure out if we want to change the logger config for prod
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.json());
app.use(express.urlencoded());

app.use(expressValidator());
app.use(express.methodOverride());
//this will cache the static content for a week
app.use(express.static(path.join(__dirname, 'public'), { maxAge: week }));

app.use(express.session({
  secret: secrets.sessionSecret,
  store: new MongoStore({
    url: secrets.db,
    auto_reconnect: true
  })
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.csrf());
app.use(function(req, res, next) {
  res.locals.user = req.user;
  res.locals._csrf = req.csrfToken();
  res.locals.secrets = secrets;
  next();
});
app.use(flash());
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

//Only keep for DEV to have non-minified markup
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
