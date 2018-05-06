Package.describe({
  name: 'chfritz:ros',
  version: '0.1.2',
  summary: 'Meteor package for ROS: sync topics with collections, relay services as methods',
  git: 'https://github.com/chfritz/meteor-ros',
  documentation: 'README.md'
});

Npm.depends({
  "rosnodejs": "2.2.0"
});

Package.onUse(function(api) {
  api.versionsFrom('1.6');
  api.use([
    'ecmascript',
    'underscore',
    'mongo',
    'matb33:collection-hooks@0.8.1'
  ], 'server');
  api.mainModule('server/main.js', 'server');
});

Package.onTest(function(api) {
  api.use([
    'chfritz:ros',
    'ecmascript',
    'cultofcoders:mocha'
  ], 'server');
  api.mainModule('tests.js', 'server');
});
