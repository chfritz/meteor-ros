/** Meteor code for the server */
  
rosjs = Npm.require('rosnodejs');
Meteor.publish('ros-topics');

class ROSHandler {

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
  */
  subscribe(topic, messageType, rate = 1) {
    const self = this;

    this._sub = this._rosNode.subscribe(
      topic,
      messageType,
      // Meteor.bindEnvironment(
        function(data) {
          console.log('SUB DATA ' + data.data);
          // Topics.upsert(topic, data);
        },
      // ),
      {
        queueSize: 1,
        throttleMs: 1000,
      } 
    );
  }

  unsubscribe(topic) {
    this._rosNode.unsubscribe(topic);
  }
};

ROS = function(options) {
  return new ROSHandler(options);
};
