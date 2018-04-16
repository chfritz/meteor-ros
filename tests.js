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
    if (handle) { handle.stop(); }
    Topics.remove({});  // resetDatabase
    ros = ROS();  // initialize ROS object
    nh = ros._nh;
    done();
  });

  it('publishes a msg on updating a doc', function (done) {
    const topic = '/chatter';
    const msgType = 'std_msgs/String';
    const expected = 'Message published!';

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

  it('updates a doc on publishing a msg', function (done) {
    const topic = '/chatter';
    const msgType = 'std_msgs/String';
    const expected = 'Doc updated!';

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
    // const handle = Topics.find({_id: topic}).observeChanges({
    handle = Topics.find({_id: topic}).observeChanges({
      added: callback,
      changed: callback
    });

    pub.publish({data: expected});
  })

  it('calls a ros service on a meteor call', function (done) {
    const service = '/set_bool';
    const srvType = 'std_srvs/SetBool';
    const expectedSuccess = true;
    const expectedMessage = 'Inverted!';

    const SetBool = rosnodejs.checkService(srvType);
    nh.advertiseService('/set_bool', SetBool,
      (req, resp) => {
        resp.success = !req.data;
        resp.message = expectedMessage;
        return true;
    });

    ros.relayService(service, srvType);

    Meteor.call(service, { sucess: !expectedSuccess }, (err, res) => {
      chai.assert(err === null || err === undefined);
      chai.assert.equal(res.success, expectedSuccess);
      chai.assert.equal(res.message, expectedMessage);
      done();
    });
  })
});
