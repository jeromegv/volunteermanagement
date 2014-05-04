var _ = require('underscore');
var async = require('async');
var crypto = require('crypto');
var config = require('../config');
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(config.mandrill.key);
var passport = require('passport');
var User = require('../models/User');
var secrets = require('../config/secrets');

module.exports.controller = function(app) {
  /**
   * GET /login
   * Login page.
   */

  app.get('/login', function(req, res) {
    if (req.user) return res.redirect('/');
    req.session.lastUrl = req.header('Referrer');
    res.render('account/login', {
      title: 'Login'
    });
  });

  /**
   * POST /login
   * Sign in using email and password.
   * @param email
   * @param password
   */

  app.post('/login', function(req, res, next) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password cannot be blank').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/login');
    }

    passport.authenticate('local', function(err, user, info) {
      if (err) return next(err);
      if (!user) {
        req.flash('errors', { msg: info.message });
        return res.redirect('/login');
      }
      req.logIn(user, function(err) {
        if (err) return next(err);
        req.flash('success', { msg: 'Success! You are logged in.' });
        res.redirect(req.session.lastUrl || '/');
      });
    })(req, res, next);
  });

  /**
   * GET /logout
   * Log out.
   */

  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  /**
   * GET /signup
   * Signup page.
   */

  app.get('/signup', function(req, res) {
    if (req.user) return res.redirect('/');
    res.render('account/signup', {
      title: 'Create Account'
    });
  });

  /**
   * POST /signup
   * Create a new local account.
   * @param email
   * @param password
   */

  app.post('/signup',  function(req, res, next) {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password must be at least 6 characters long').len(6);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/signup');
    }

    var user = new User({
      email: req.body.email,
      password: req.body.password
    });


    user.save(function(err) {
      if (err) {
        if (err.code === 11000) {
          req.flash('errors', { msg: 'User with that email already exists.' });
        }
        return res.redirect('/signup');
      }
      req.logIn(user, function(err) {
        if (err) return next(err);
        res.redirect('/');
      });
    });
  });

  /**
   * GET /account
   * Profile page.
   */

  app.get('/account', app.locals.passportConf.isAuthenticated,  function(req, res) {
    res.render('account/profile', {
      title: 'Account Management'
    });
  });

  /**
   * POST /account/profile
   * Update profile information.
   */

  app.post('/account/profile', app.locals.passportConf.isAuthenticated, function(req, res, next) {
    User.findById(req.user.id, function(err, user) {
      if (err) return next(err);
      user.email = req.body.email || '';
      user.profile.name = req.body.name || '';
      user.profile.location = req.body.location || '';
      user.profile.website = req.body.website || '';

      user.save(function(err) {
        if (err) return next(err);
        req.flash('success', { msg: 'Profile information updated.' });
        res.redirect('/account');
      });
    });
  });

  /**
   * POST /account/password
   * Update current password.
   * @param password
   */

  app.post('/account/password', app.locals.passportConf.isAuthenticated, function(req, res, next) {
    req.assert('password', 'Password must be at least 6 characters long').len(6);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/account');
    }

    async.waterfall([
      function(done) {
        User.findById(req.user.id, function(err, user) {
          if (err) return next(err);

          user.password = req.body.password;

          user.save(function(err) {
            if (err) return next(err);
            done(err, user);
          });
        });
      }, function (user,done){
        //send email to confirm the password has been changed
        var template_name = "your-password-has-been-changed";
        var template_content = {};
        var message = {
          "to": [{
              "email": user.email,
              "name": user.profile.name,
              "type": "to"
            }],
          "merge": true,
          "global_merge_vars": [{
              "name": "USERNAME",
              "content": user.profile.name  
            },{
              "name": "USEREMAIL",
              "content": user.email  
            }],
          "tags": [
            "password_emails"
          ]
        };
        var async = false;
        var ip_pool = "Main Pool";
        var send_at = null;
        mandrill_client.messages.sendTemplate({"template_name": template_name, "template_content": template_content, "message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at},               
          function(result) {
            req.flash('success', { msg: 'Success! Your password has been changed.' });
            done(null);
          }, function(e) {
            // Mandrill returns the error as an object with name and message keys
            console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
            req.flash('errors', { msg: 'A mandrill error occurred: ' + e.name + ' - ' + e.message});
            done(e);
        });
      }
      ], function(err) {
      if (err) return next(err);
      res.redirect('/account');
    });
  });

  /**
   * POST /account/delete
   * Delete user account.
   * @param id - User ObjectId
   */

  app.post('/account/delete', app.locals.passportConf.isAuthenticated, function(req, res, next) {
    User.remove({ _id: req.user.id }, function(err) {
      if (err) return next(err);
      req.logout();
      res.redirect('/');
    });
  });

  /**
   * GET /account/unlink/:provider
   * Unlink OAuth2 provider from the current user.
   * @param provider
   * @param id - User ObjectId
   */

  app.get('/account/unlink/:provider', app.locals.passportConf.isAuthenticated, function(req, res, next) {
    var provider = req.params.provider;
    User.findById(req.user.id, function(err, user) {
      if (err) return next(err);

      user[provider] = undefined;
      user.tokens = _.reject(user.tokens, function(token) { return token.kind === provider; });

      user.save(function(err) {
        if (err) return next(err);
        req.flash('info', { msg: provider + ' account has been unlinked.' });
        res.redirect('/account');
      });
    });
  });

  /**
   * GET /reset/:token
   * Reset Password page.
   */

  app.get('/reset/:token', function(req, res) {
    if (req.isAuthenticated()) {
      return res.redirect('/');
    }

    User
      .findOne({ resetPasswordToken: req.params.token })
      .where('resetPasswordExpires').gt(Date.now())
      .exec(function(err, user) {
        if (!user) {
          req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
          return res.redirect('/forgot');
        }
        res.render('account/reset', {
          title: 'Password Reset'
        });
      });
  });

  /**
   * POST /reset/:token
   * Process the reset password request.
   */

  app.post('/reset/:token', function(req, res, next) {
    req.assert('password', 'Password must be at least 6 characters long.').len(6);
    req.assert('confirm', 'Passwords must match.').equals(req.body.password);

    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('back');
    }

    async.waterfall([
      function(done) {
        User
          .findOne({ resetPasswordToken: req.params.token })
          .where('resetPasswordExpires').gt(Date.now())
          .exec(function(err, user) {
            if (!user) {
              req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
              return res.redirect('back');
            }

            user.password = req.body.password;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              if (err) return next(err);
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          });
      },
      function(user, done) {
        //send email to confirm the password has been changed
        var template_name = "your-password-has-been-changed";
        var template_content = {};
        var message = {
          "to": [{
              "email": user.email,
              "name": user.profile.name,
              "type": "to"
            }],
          "merge": true,
          "global_merge_vars": [{
              "name": "USERNAME",
              "content": user.profile.name  
            },{
              "name": "USEREMAIL",
              "content": user.email  
            }],
          "tags": [
            "password_emails"
          ]
        };
        var async = false;
        var ip_pool = "Main Pool";
        var send_at = null;
        mandrill_client.messages.sendTemplate({"template_name": template_name, "template_content": template_content, "message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at},               
          function(result) {
            req.flash('success', { msg: 'Success! Your password has been changed.' });
            done(null);
          }, function(e) {
            // Mandrill returns the error as an object with name and message keys
            console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
            req.flash('errors', { msg: 'A mandrill error occurred: ' + e.name + ' - ' + e.message});
            done(e);
        });
      }
    ], function(err) {
      if (err) return next(err);
      res.redirect('/');
    });
  });

  /**
   * GET /forgot
   * Forgot Password page.
   */

  app.get('/forgot', function(req, res) {
    if (req.isAuthenticated()) {
      return res.redirect('/');
    }
    res.render('account/forgot', {
      title: 'Forgot Password'
    });
  });

  /**
   * POST /forgot
   * Create a random token, then the send user an email with a reset link.
   * @param email
   */

  app.post('/forgot', function(req, res, next) {
    req.assert('email', 'Please enter a valid email address.').isEmail();

    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/forgot');
    }

    async.waterfall([
      function(done) {
        crypto.randomBytes(16, function(err, buf) {
          var token = buf.toString('hex');
          done(err, token);
        });
      },
      function(token, done) {
        User.findOne({ email: req.body.email.toLowerCase() }, function(err, user) {
          if (!user) {
            //we do not want to tell if the user email exists in the database or not, so same generic message
            req.flash('info', { msg: 'An e-mail has been sent to ' + req.body.email.toLowerCase() + ' with further instructions.' });
            console.log("Someone tried to reset a password on a non existing email: "+ req.body.email.toLowerCase());
            return res.redirect('/forgot');
          }

          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          user.save(function(err) {
            done(err, token, user);
          });
        });
      },
        function(token, user, done) {
          //send email to confirm the password has been changed
          var template_name = "reset-your-password";
          var template_content = {};
          var message = {
            "to": [{
                "email": user.email,
                "name": user.profile.name,
                "type": "to"
              }],
            "merge": true,
            "global_merge_vars": [{
                "name": "USERNAME",
                "content": user.profile.name  
              },{
                "name": "USEREMAIL",
                "content": user.email  
              },{
                "name": "RESETLINK",
                "content": 'http://' + req.headers.host + '/reset/' + token
              }],
            "tags": [
              "password_emails"
            ]
          };
          var async = false;
          var ip_pool = "Main Pool";
          var send_at = null;
          mandrill_client.messages.sendTemplate({"template_name": template_name, "template_content": template_content, "message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at},               
            function(result) {
              req.flash('info', { msg: 'An e-mail has been sent to ' + user.email + ' with further instructions.' });
              done(null);
            }, function(e) {
              // Mandrill returns the error as an object with name and message keys
              console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
              req.flash('errors', { msg: 'A mandrill error occurred: ' + e.name + ' - ' + e.message});
              done(e);
          });
      }
    ], function(err) {
      if (err) return next(err);
      res.redirect('/forgot');
    });
  });
}
