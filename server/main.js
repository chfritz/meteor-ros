/** Meteor code for the server */

Meteor.publish('ros-topics');

class ROSHandler {

  constructor() {

    /** list of subscribes, needed to later unsubscribe again */
    this.subscribers = {};
  };
  
  subscribe(topic, messageType) {
    const self = this;

    ros.types([
      messageType
    ], function(Type) {
      
      // Creates the topic
      var subscriber = new ros.topic({
        node        : 'listener', 
        topic       : topic,
        messageType : Type
      });

      subscriber.on('unregistered_subscriber', function() {
        console.log("unsubscribed from ", topic);
      });

      // Subscribes to the topic
      subscriber.subscribe(function(message) {
        // message.data.should.equal('howdy');
        console.log(message);
        Topics.upsert(topic, message);
      });

      self.subscribers[topic] = subscriber;

      console.log("subscribed to", topic);
    });

  }

  unsubscribe(topic) {
    const subscriber = this.subscribers[topic];
    if (subscriber) {
      subscriber.unregisterSubscriber();     
    } else {
      console.log("Not subscribed to ", topic);
    }
  }
};

ROS = new ROSHandler();
