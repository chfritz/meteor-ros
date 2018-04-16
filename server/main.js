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

    // remove hooks
    // NOTE: Cannot remove a particular hook using handle.remove(), see
    //   https://github.com/matb33/meteor-collection-hooks/blob/meteor-1.6.1/collection-hooks.js#L81-L83
    Topics._hookAspects.update.insert = [];
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

      @param serviceType: the service type name (e.g.,
      'std_srvs/SetBool'); must have been specified in constructor.

      @param timeout (optional): timeout in milliseconds before giving
      up (default: 2000ms)

      Example:
        relayService('/set_bool','std_srvs/SetBool', 1000);

      This will create a method that takes objects as input that can
      be used as data for std_srvs/SetBool. The method calls the
      service and waits for the response.
  */
  relayService(service, serviceType, timeout = 2000) {
    logger.debug(`relayService ${service} ${serviceType} ${timeout}`);

    let definition = {};
    const self = this;

    definition[service] = Meteor.wrapAsync(
      function(requestData, callback) {

        service = service.replace(/^\//, ''); // trim initial '/' if any
        console.log('serviceClient', self._rosNode); // #HERE
        let serviceClient = self._rosNode.serviceClient('/'+service, serviceType);
        console.log('serviceClient', serviceClient, serviceClient.__proto__); // #HERE

        // get service type class
        const [serviceTypePackage, serviceTypeName] = serviceType.split('/');
        const serviceTypeClass = rosnodejs.require(serviceTypePackage).srv[serviceTypeName];
        console.log('serviceTypeClass', serviceTypeClass);
        const serviceTypeClassRequest = serviceTypeClass['Request'];

        self._rosNode.waitForService(serviceClient.getService(), timeout)
          .then( (available) => {
            if (available) {
              const request = new serviceTypeClassRequest(requestData);

              console.log('calling service', service, 'with data', request,
                          request.__proto__, request.md5sum());
              serviceClient.call(request, (resp) => {
                console.log('Service response ' + JSON.stringify(resp));
                callback(null, resp);
              });
            } else {
              callback({
                msg: 'timed out',
                description: 'The request to the service ('+ service +') timed out.'
              });
            }
          });
      });

    Meteor.methods(definition);
  }

};

const ROS = function(options) {
  return new ROSHandler(options);
};

export { Topics, ROS };
