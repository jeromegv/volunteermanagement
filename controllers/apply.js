var fs = require('fs');
var config = require('../config');
//TODO MOVE TO .ENV
var knoxclient = require('knox').createClient({
    key: config.s3.key,
    secret: config.s3.secret,
    bucket: config.s3.bucket
});


module.exports.controller = function(app) {
  /**
   * GET /apply
   * Apply Now form page.
   */

  app.get('/apply',  function(req, res) {
    res.render('apply', {
      title: 'Apply Now'
    });
  });

  /**
   * POST /apply
   * Add filled form by user to elasticsearch
   * @param email
   * @param name
   * @param resume
   */

  app.post('/apply',function(req, res) {
    req.assert('name', 'Name cannot be blank').notEmpty();
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('resume', 'Resume cannot be blank').notEmpty();
    
    var errors = req.validationErrors();

    if (errors) {
      req.flash('errors', errors);
      return res.redirect('/apply');
    }
    //TODO limit on size
    //we will read the binary file uploaded by the user with the form and add it to elasticsearch
    //Will make the content of the file searchable, with the other attributes from the form
    //TODO: save the file at proper place on HD as well so that manager can download/open the real binary, not just search it
    fs.readFile(req.files.resumefile.path, function (error, data) {
      if (error){
        console.log(error);
        req.flash('errors', { msg: 'Error occured while trying to read the file you uploaded, please consult the logs'});
        res.redirect('/apply');
      } else {

        //upload to S3
        var uploadknox = knoxclient.put('uploaded/'+req.body.email+'/'+Date.now()+req.files.resumefile.name, {
          'Content-length': data.length,
          'Content-Type': req.files.resumefile.type,
          'x-amz-acl': 'public-read'
        });
        uploadknox.on('response', function(response){
          if (200 == response.statusCode) {
            console.log('saved to %s', uploadknox.url);
          } else {
            console.log('S3 did not respond with 200, response was:'+response.statusCode);
          }
        });
        uploadknox.on('error', function(err) {
          console.error('Error uploading to s3:', err);
        });
        uploadknox.end(data);




        //mapper-attachments plugin for elasticsearch requires us to send attachment in base64
        var base64data = new Buffer(data).toString("base64");
        //create record in elasticsearch
        app.locals.elasticsearchClient.create({
          index: 'applications',
          type: 'application',
          id: req.body.position_id+'_'+req.body.email + '_' + Date.now(),
          body: {
            email: req.body.email,
            name: req.body.name,
            resume: req.body.resume,
            position_id: req.body.position_id,
            resume_attachment: base64data
          }
        }, function (error, response) {
          if (error){
            console.log(error);
            req.flash('errors', { msg: 'Error occured: ' + error.message });
            res.redirect('/apply');
          } else {
            req.flash('success', { msg: 'File has been sent successfully!' });
            res.redirect('/apply');
          }
        });


      }
    });
    
    /*fs.readFile(req.files.resumefile.path, function (err, data) {
      // ...
      var newPath = __dirname + "/uploads/uploadedFileName";
      console.log(newPath);
      fs.writeFile(newPath, data, function (err) {
        if (err){
          console.log(err);
          req.flash('error', { msg: 'Error occured' });
          res.redirect('/apply');
        } else {
          req.flash('success', { msg: 'File has been sent successfully!' });
          res.redirect('/apply');
        }
      });
    });*/
    //TODO implement email notification both to applicant and manager
    /*var from = req.body.email;
    var name = req.body.name;
    var body = req.body.resume;
    var to = 'your@email.com';
    var subject = 'API Example | Contact Form';

    var mailOptions = {
      to: to,
      from: from,
      subject: subject,
      text: body + '\n\n' + name
    };

    smtpTransport.sendMail(mailOptions, function(err) {
      if (err) {
        req.flash('errors', { msg: err.message });
        return res.redirect('/contact');
      }
      req.flash('success', { msg: 'Email has been sent successfully!' });
      res.redirect('/contact');
    });*/
  });
}