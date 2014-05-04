var elasticsearch = require('elasticsearch');
var config = require('../config');

//we make sure to configure elastic search on launch if it was never configured

var elasticsearchClient;

/**
* ElasticSearch configuration
*/
elasticsearchClient = new elasticsearch.Client({
  host: {
    protocol: config.elasticsearch.protocol,
    host: config.elasticsearch.host,
    port: config.elasticsearch.port,
    auth: config.elasticsearch.user+':'+config.elasticsearch.password
  },
  //TODO figure out the trace we want here
  log: 'trace',
  apiVersion: '1.0'
});
elasticsearchClient.ping({
  // ping usually has a 100ms timeout
  requestTimeout: 5000,

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

//setup the index to host the candidates applications, if it does not exist yet
elasticsearchClient.indices.exists({
  index: 'applications'
}, function (error, response,status) {
  if (error){
    console.error(error);
    process.exit(1);
  } else {
    //the index applications is missing, create it
    if (!response){
        elasticsearchClient.indices.create({
        index: 'applications'
    }, function (error, response,status) {
        if (error){
          console.error(error);
          process.exit(1);
        } else {
          //add specific mapping to applications
          if (status==200){
            elasticsearchClient.indices.putMapping({
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

//setup the index to host the list of job description, if it does not exist yet
elasticsearchClient.indices.exists({
  index: 'jobdescriptions'
}, function (error, response,status) {
  if (error){
    console.error(error);
    process.exit(1);
  } else {
    //the index applications is missing, create it
    if (!response){
      elasticsearchClient.indices.create({
        index: 'jobdescriptions'
    }, function (error, response,status) {
        if (error){
          console.error(error);
          process.exit(1);
        } else {
          if (status==200){
            //nothing to do for now
          } else {
            console.log('Could not create the jobdescriptions index for elasticsearch');
            process.exit(1);
          }
        }
      });
    }
  }
});

module.exports = elasticsearchClient;