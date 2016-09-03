Package.describe({
  name: 'chfritz:ros',
  version: '0.1.0',
  summary: 'Meteor package for ROS: sync topics with collections, relay services as methods',
  git: 'https://github.com/chfritz/meteor-ros',
  documentation: 'README.md'
});

Npm.depends({
  // "rosnodejs": "1.0.0"
  // "es6-shim": "0.35.0",
  "rosjs": "git+https://github.com/chfritz/rosjs#support_node_4.5"
});

Package.onUse(function(api) {
  api.versionsFrom('1.4.1');
  api.use(['ecmascript', 'mongo']);
  api.addFiles(['server/main.js'], 'server');
  api.addFiles(['shared.js']);
  if (api.export) {
    api.export('rosjs', 'server');
    api.export('ROS', 'server');
    api.export('Topics');
  }
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('chfritz:ros');
  api.addFiles('meteor-ros-tests.js', 'server');
});
