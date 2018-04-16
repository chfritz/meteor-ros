Package.describe({
  name: 'chfritz:ros',
  version: '0.1.1',
  summary: 'Meteor package for ROS: sync topics with collections, relay services as methods',
  git: 'https://github.com/chfritz/meteor-ros',
  documentation: 'README.md'
});

Npm.depends({
  "rosnodejs": "2.2.0"
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1.1');
  api.use([
    'ecmascript',
    'mongo',
    'matb33:collection-hooks@0.8.1'
  ], 'server');
  api.mainModule('server/main.js', 'server');
});

Package.onTest(function(api) {
  api.use('chfritz:ros');
  api.use([
    'ecmascript',
    'cultofcoders:mocha',
  ]);
  api.mainModule('tests.js', 'server');
});
