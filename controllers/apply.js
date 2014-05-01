var fs = require('fs');
var config = require('../config');
var async = require('async');
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(config.mandrill.key);
//to handle file attachment upload safely
var multiparty = require('multiparty');
var validator = require('validator');


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
      if (!validator.isEmail(fields.email[0])){
        errorMsg='Email is not valid';
      } else if (!fields.name[0]){
        errorMsg='You must enter your name';
      }
      
      if (errorMsg) {
        req.flash('errors', { msg: errorMsg});
        res.redirect('/apply');
        return;
      }

      file = files.resumefile[0];
      //todo look at file size before reading the file
      //we  read the binary file uploaded by the user with the form and add it to elasticsearch
      //Will make the content of the file searchable, with the other attributes from the form      
      fs.readFile(file.path, function (error, data) {
        if (error){
          console.log(error);
          req.flash('errors', { msg: 'Error occured while trying to read the file you uploaded, please consult the logs'});
          return res.redirect('/apply');
        } else {
          var base64data = new Buffer(data).toString("base64");
          async.waterfall([
            function(callback){
              if (file.size>0){
                //TODO right now it puts those files as public-read, we might want to revisit that
                var uploadknox = knoxclient.put('uploaded/'+fields.email+'/'+Date.now()+file.originalFilename, {
                  'Content-length': file.size,
                  'Content-Type': file.headers['content-type'],
                  'x-amz-acl': 'public-read'
                });
                uploadknox.on('response', function(response){
                  if (200 == response.statusCode) {
                    console.log('saved to %s', uploadknox.url);
                  } else {
                    console.log('S3 did not respond with 200, response was:'+response.statusCode);
                  }
                  callback(null,uploadknox.url);
                });
                uploadknox.on('error', function(err) {
                  console.error('Error uploading to S3:', err);
                  callback(null,'');
                });
                uploadknox.end(data);  
              } else {
                //there was no upload, we go to next step
                callback(null,'');
              }   
            },
            function(url,callback){
                //create record of the application in elasticsearch
                //mapper-attachments plugin for elasticsearch requires us to send attachment in base64
                //create record in elasticsearch
                fields['resume_attachment_url']=url;
                fields['resume_attachment']=base64data;
                app.locals.elasticsearchClient.create({
                  index: 'applications',
                  type: 'application',
                  id: fields.position_id+'_'+fields.email + '_' + Date.now(),
                  body: fields
                }, function (error, response) {
                  if (error){
                    console.log(error);
                  } 
                });
                //we do not wait for the save to elasticsearch to callback
                callback(null,'');
              },
              function(response,callback){
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
                      "content": fields.name[0]  
                    },{
                      "name": "POSITION_NAME",
                      "content": fields.position_id[0]  
                    }],
                  "tags": [
                    "applicant_applied"
                  ]
                };
                //add attachment to the email if there was one with the application
                if (file.size>0){
                  message.attachments= [{
                    "type": file.headers['content-type'],
                    "name": file.originalFilename,
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
                  callback(null,'');            
              }
            ],function (error, result) {
                //we are done with the temp files, delete them
                files.resumefile.forEach(function(file){
                  fs.unlink(file.path, function (err) {
                  if (err){
                    console.log(err);
                  }
                  });
                });
                if (error){
                  console.log(error);
                  req.flash('errors', { msg: 'Error occured: ' + error.message });
                  return res.redirect('/apply');
                } else {
                  req.flash('success', { msg: 'Application has been sent successfully!' });
                  res.redirect('/apply');
                }
            });
          }
        });
    });
  });
}