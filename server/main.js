import rosnodejs from 'rosnodejs';
import { Topics } from '../shared';

Meteor.publish('ros_topics');

const logger = console;

class ROSHandler {

  /**
      Connect to ROS and load message and service definitions.
  */
  constructor() {
    const id = Meteor.absoluteUrl().replace(/[\/:]/g, '_');
    this._nh = Promise.await(rosnodejs.initNode(`/meteor_ros/${id}`, {onTheFly: true}));
    this._synced = {};

    // stop existing ROS publishers/subscribers/services
    _.map(_.keys(this._nh._node._publishers), (topic) => {
      this._nh.unadvertise(topic);
    });
    _.map(_.keys(this._nh._node._subscribers), (topic) => {
      this._nh.unsubscribe(topic);
    });
    _.map(_.keys(this._nh._node._services), (topic) => {
      this._nh.unadvertiseService(topic);
    });
    // remove hooks
    // NOTE: Cannot remove a particular hook using handle.remove(), see
    //   https://github.com/matb33/meteor-collection-hooks/blob/meteor-1.6.1/collection-hooks.js#L81-L83
    Topics._hookAspects.insert.after = [];
    Topics._hookAspects.update.after = [];
  }

  // ---------------------------------------------------------
  // Topics
  // ---------------------------------------------------------

  /** Sync the given topic of the given message type. The content will
      be made available in the Topics collection. Any changes to the
      respective document will be published back on the ROS topic.

      @param topic: the name of the topic

      @param msgType: the message type name; must have been
      specified in the constructor.

      @param rate: update frequency (Hz); 0 means update as soon as possible.

      Example:
        subscribe('/turtle1/pose', 'turtlesim/Pose', 2)

      This will keep upserting the '/turtle1/pose' document in the
      Topics collection with the latest value, twice a second.
  */
  sync(topic, msgType, rate = 1) {
    if (this._synced[topic]) {
      logger.warn(`${topic} is already synced; skipping.`);
      return;
    }

    logger.debug(`sync ${topic} ${msgType} ${rate}`);

    // subscribe to new messages on topic
    this._nh.subscribe(
      topic,
      msgType,
      Meteor.bindEnvironment((data) => {
        logger.debug(`sub ${topic} ${data}`);
        data._id = topic;
        data._source = 'ros';
        Topics.direct.upsert(topic, data);
        // #HERE ^ get rid of all the __proto__ fields in data
      }),
      {
        queueSize: 1,
        throttleMs: rate ? 1000 / rate : 0
      }
    );

    // publish any changed made in meteor back to ros topic
    const pub = this._nh.advertise(topic, msgType, {
      queueSize: 1,
      latching: true,
      throttleMs: rate ? 1000 / rate : 0
    });
    Message = rosnodejs.checkMessage(msgType);

    const callback = function(userId, doc, fieldNames, modifier, options) {
      console.log('topic, doc', topic, doc);
      if (doc._id !== topic) { return; }

      // reduce to just the message fields
      const fields = _.pluck(Message.fields, 'name');
      const data = _.pick(doc, fields);
      delete data.header;

      // publish message
      const msg = new Message(data);
      logger.debug('publish', msg);
      pub.publish(msg);
    }
    Topics.after.insert(callback);
    Topics.after.update(callback);
  }

  /** Unadvertise topic */
  unadvertise(topic) {
    this._nh.unadvertise(topic);
  }

  /** Unsubscribe from topic */
  unsubscribe(topic) {
    this._nh.unsubscribe(topic);
  }


  // ---------------------------------------------------------
  // Services
  // ---------------------------------------------------------

  /** Expose a ROS service as a meteor method.

      @param service: the service to call (e.g., '/set_bool')

      @param srvType: the service type name (e.g.,
      'std_srvs/SetBool'); must have been specified in constructor.

      @param timeout (optional): timeout in milliseconds before giving
      up (default: 2000ms)

      Example:
        relayService('/set_bool','std_srvs/SetBool', 1000);

      This will create a method that takes objects as input that can
      be used as data for std_srvs/SetBool. The method calls the
      service and waits for the response.
  */
  relayService(service, srvType, timeout = 2000) {
    logger.debug(`relayService ${service} ${srvType} ${timeout}`);

    delete Meteor.server.method_handlers[service];

    let definition = {};

    definition[service] = Meteor.wrapAsync((reqData, callback) => {
      logger.debug(`relaying ${service} ${reqData}`);

      service = service.replace(/^\//, '');  // trim initial '/' if any
      const serviceClient = this._nh.serviceClient('/'+service, srvType);

      // get service type class
      const Service = rosnodejs.checkService(srvType);
      const ServiceRequest = Service['Request'];
      const available = Promise.await(
        this._nh.waitForService(serviceClient.getService(), timeout)
      );
      if (available) {
        const request = new ServiceRequest(reqData);

        logger.debug(`calling ${service} with ${request} ${request.__proto__}`);
        serviceClient.call(request).then((resp) => {
          callback(null, resp);
        }).catch((err) => {
          callback(err);
        });
      } else {
        callback(new Meteor.Error(
          'timed-out',
          `The request to the service (${service}) timed out.`
        ));
      }
    });

    Meteor.methods(definition);
  }

};

const ROS = function(options) {
  return new ROSHandler(options);
};

export { Topics, ROS };
