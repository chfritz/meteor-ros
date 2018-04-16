import { spawn, spawnSync } from 'child_process';
import rosnodejs from 'rosnodejs';
import { chai } from 'meteor/practicalmeteor:chai';
import { ROS, Topics } from 'meteor/chfritz:ros';

let ros = null;
let nh = null;

describe('meteor-ros', function () {
  before(function() {
    spawn('roscore');
    Meteor._sleepForMs(500);  // wait for rosmaster to start
  })

  after(function() {
    spawnSync('killall -9 roscore; killall -9 rosmaster', {shell: true});
  })

  beforeEach(function (done) {
    Topics.remove({});  // resetDatabase
    // initialize ROS
    ros = ROS();
    nh = ros._nh;
    done();
  });

  it('publishes a msg on updating a doc', function (done) {
    const topic = '/chatter';
    const msgType = 'std_msgs/String';
    const expected = 'Hello World!';

    ros.sync(topic, msgType);
    sub = nh.subscribe(
      topic,
      msgType,
      (data) => {
        chai.assert.equal(data && data.data, expected);
        done();
      },
      {
        queueSize: 1
      }
    );

    Topics.upsert(topic, {
      data: expected
    });
  })

  // TODO: investigate why it is always succeeding
  it('updates a doc on publishing a msg', function (done) {
    const topic = '/chatter';
    const msgType = 'std_msgs/String';
    const expected = 'Hello World!';

    ros.sync(topic, msgType);
    Message = rosnodejs.checkMessage(msgType);
    const pub = nh.advertise(topic, Message, {
      queueSize: 1,
      latching: true
    });

    const callback = (id, doc) => {
      chai.assert.equal(id, topic);
      chai.assert.equal(doc && doc.data, expected);
      done();
    }
    const handle = Topics.find({_id: topic}).observeChanges({
      added: callback,
      changed: callback
    });

    pub.publish({data: expected});
  })
});
