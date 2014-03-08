/**
 * Module dependencies.
 What is cluster_app.js?

From the Node.js Documentation:

A single instance of Node runs in a single thread. To take advantage of multi-core systems the user will sometimes want to launch a cluster of Node processes to handle the load. The cluster module allows you to easily create child processes that all share server ports.

From: https://github.com/sahat/hackathon-starter
cluster_app.js allows you to take advantage of this feature by forking a process of app.js for each CPU detected. For the majority of applications serving HTTP requests, this is a resounding boon. However, the cluster module is still in experimental stage, therefore it should only be used after understanding its purpose and behavior. To use it, simply run node cluster_app.js. Its use is entirely optional and app.js is not tied in any way to it. As a reminder, if you plan to use cluster_app.js instead of app.js, be sure to indicate that in package.json when you are ready to deploy your app.
 */

var os = require('os');
var cluster = require('cluster');

/**
 * Cluster setup.
 */

// Setup the cluster to use app.js
cluster.setupMaster({
  exec: 'app.js'
});

// Listen for dying workers
cluster.on('exit', function(worker) {
  console.log('Worker ' + worker.id + ' died');
  // Replace the dead worker
  cluster.fork();
});

// Fork a worker for each available CPU
for (var i = 0; i < os.cpus().length; i++) {
  cluster.fork();
}
