Package.describe({
  name: 'chfritz:ros',
  version: '0.1.1',
  summary: 'Meteor package for ROS: sync topics with collections, relay services as methods',
  git: 'https://github.com/chfritz/meteor-ros',
  documentation: 'README.md'
});

Npm.depends({
  // "rosnodejs": "1.0.0"
  // "es6-shim": "0.35.0",
  "rosnodejs": "git+https://github.com/chfritz/rosjs#with_dist"
});

Package.onUse(function(api) {
  api.versionsFrom('1.4.1');
  api.use(['ecmascript', 'mongo', 'underscore']);
  api.use('matb33:collection-hooks@0.8.1');
  api.mainModule('client/main.js', 'client');
  api.mainModule('server/main.js', 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('chfritz:ros');
  api.addFiles('meteor-ros-tests.js', 'server');
});
