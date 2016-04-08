Package.describe({
  name: 'chfritz:ros',
  version: '0.0.2',
  summary: 'Meteor package for ROS. For now this only allows publishing and subscribing to topics.',
  git: 'https://github.com/chfritz/meteor-ros',
  documentation: 'README.md'
});

Npm.depends({
  "portscanner"   : "0.1.3",
  "xmlrpc"        : "1.0.2",
  "eventemitter2" : "0.4.14",
  "walker"        : "1.0.7",
  "MD5"           : "0.0.0",
  "async"         : "0.1.22"
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use('ecmascript');
  api.addFiles([
    'lib/environment.js','lib/node.js','lib/fields.js',
    'lib/master.js','lib/topic.js','lib/packages.js',
    'lib/messages.js','lib/tcpros.js','lib/ros.js']);
  if (api.export) {
    api.export('ros', 'server');
  }
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('chfritz:ros');
  api.addFiles('meteor-ros-tests.js');
});
