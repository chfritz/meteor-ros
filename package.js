Package.describe({
  name: 'chfritz:ros',
  version: '0.0.1',
  summary: 'Meteor package for ROS. For now just a thin wrapper around roslibj.',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Npm.depends({
    "roslib": "0.17.0"
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.1');
  api.use('ecmascript');
  api.addFiles('meteor-ros.js');
  if (api.export) {
    api.export('ROSLIB', 'server');
  }
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('chfritz:ros');
  api.addFiles('meteor-ros-tests.js');
});
