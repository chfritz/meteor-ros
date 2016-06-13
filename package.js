Package.describe({
  name: 'chfritz:ros',
  version: '0.0.3',
  summary: 'Meteor package for ROS. For now this only allows publishing and subscribing to topics.',
  git: 'https://github.com/chfritz/meteor-ros',
  documentation: 'README.md'
});

Npm.depends({
  // "rosnodejs": "1.0.0"
  // "es6-shim": "0.35.0",
  "rosjs": "git+https://github.com/chfritz/rosjs#fix_service_md5sums"
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.2.4');
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
  api.addFiles('meteor-ros-tests.js');
});
