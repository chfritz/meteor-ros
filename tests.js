import { spawn, spawnSync } from 'child_process';
import rosnodejs from 'rosnodejs';
import { chai } from 'meteor/practicalmeteor:chai';

let rosNode = null;

describe('my module', function () {
  beforeEach(function (done) {
    spawn('roscore');
    Meteor._sleepForMs(500);  // wait for rosmaster to start
    rosNode = Promise.await(
      rosnodejs.initNode('/my_node', { onTheFly: true})
    );
    done();
  });

  afterEach(function() {
    const out = spawnSync('killall -9 roscore; killall -9 rosmaster', {shell: true});
    rosNode = null;
  })

  it('does something', function (done) {
    console.log('TEST HAPPENS HERE!');
    done();
  })
});
