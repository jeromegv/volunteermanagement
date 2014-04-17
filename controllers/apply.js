var fs = require('fs');
var config = require('../config');
var async = require('async');
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(config.mandrill.key);

//configuring S3 access, where the resume will be stored
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
    //we  read the binary file uploaded by the user with the form and add it to elasticsearch
    //Will make the content of the file searchable, with the other attributes from the form
    fs.readFile(req.files.resumefile.path, function (error, data) {
      if (error){
        console.log(error);
        req.flash('errors', { msg: 'Error occured while trying to read the file you uploaded, please consult the logs'});
        res.redirect('/apply');
      } else {

        var base64data = new Buffer(data).toString("base64");
 
        async.waterfall([
          function(done){
            //upload to S3 if file exists
            //if upload fails, we keep going with our waterfall, we still want to save the form to elastic search in the next step
            if (req.files.resumefile.size>0){
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
                done(null,uploadknox.url);
              });
              uploadknox.on('error', function(err) {
                console.error('Error uploading to S3:', err);
                done(null,'');
              });
              uploadknox.end(data);
            } else {
              //there was no upload, we go to next step
              done(null,'');
            }
          },
          function(url,done){
            //create record of the application in elasticsearch
            //mapper-attachments plugin for elasticsearch requires us to send attachment in base64
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
                resume_attachment: base64data,
                resume_attachment_url: url
              }
            }, function (error, response) {
              
            });
            done(null,'');
          },
          function(response,done){
            //send email to org that someone applied
            var template_name = "email-to-organization-that-an-applicant-applied";
            var template_content = {};
            var message = {
              "to": [{
                  "email": 'gagnonje@gmail.com',
                  "name": 'Project Burrito',
                  "type": "to"
                }],
              "merge": true,
              "global_merge_vars": [{
                  "name": "ORGANIZATION_NAME",
                  "content": "Project Burrito"  
                },{
                  "name": "APPLICANT_CONTACT_NAME",
                  "content": req.body.name  
                },{
                  "name": "POSITION_NAME",
                  "content": req.body.position_id  
                }],
              "tags": [
                "applicant_applied"
              ]
            };
            //add attachment to the email if there was one with the application
            if (req.files.resumefile.size>0){
              message.attachments= [{
                "type": req.files.resumefile.type,
                "name": req.files.resumefile.name,
                "content": base64data
                }]; 
            }
            var async = true;
            var ip_pool = "Main Pool";
            var send_at = null;
            mandrill_client.messages.sendTemplate({"template_name": template_name, "template_content": template_content, "message": message, "async": async, "ip_pool": ip_pool, "send_at": send_at},               
              function(result) {
                  console.log(result);
              }, function(e) {
                  // Mandrill returns the error as an object with name and message keys
                  console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
              });
              //we send the email in async so we don't wait for it to be uploaded to go to next step  
              done(null,'');            
          }
          ], function (error, result) {
             if (error){
                console.log(error);
                req.flash('errors', { msg: 'Error occured: ' + error.message });
                res.redirect('/apply');
              } else {
                req.flash('success', { msg: 'Application has been sent successfully!' });
                res.redirect('/apply');
              }
          });
      }
    });
  });
}