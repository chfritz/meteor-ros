/** Meteor code for the server */
  
rosjs = Npm.require('rosnodejs');
Meteor.publish('ros-topics');

class ROSHandler {

  /** 
      Connect to ROS and prepare usage of the message and service
      types given in the options.

      Example: 
        new ROSHandler({
          messages: ['std_msgs/String', 'turtlesim/Pose'],
          services: ['std_srvs/SetBool']
        });
  */
  constructor(options) {
    this._rosNode = Meteor.wrapAsync(function(callback) {
      rosjs.initNode('/my_node', options).then( function(rosNode) {
        callback(null, rosNode);
      });
    })();
  }

  /** subscribe to the given topic of the given message type. The
      content will be made available in the Topics collection. @param
      rate: update frequency (Hz)
      
      Example:
        subscribe("/turtle1/pose", "turtlesim/Pose", 2)
  */
  subscribe(topic, messageType, rate = 1) {
    const self = this;

    this._sub = this._rosNode.subscribe(
      topic,
      messageType,
      Meteor.bindEnvironment(
        function(data) {
          _.extend(data, {_id: topic});
          // console.log('SUB DATA ', topic, data);
          Topics.upsert(topic, data);
        }
      ),
      {
        queueSize: 1,
        throttleMs: 1000 / rate,
      } 
    );
  }

  /** Unsubscribe from topic */
  unsubscribe(topic) {
    this._rosNode.unsubscribe(topic);
  }
};

ROS = function(options) {
  return new ROSHandler(options);
};
