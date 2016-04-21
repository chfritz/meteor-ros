/** Meteor code for the server */
  
ros = Npm.require('/home/cfritz/work/rosnodejs');

Meteor.publish('ros-topics');

class ROSHandler {

  constructor() {

    /** list of subscribes, needed to later unsubscribe again */
    this.subscribers = {};

    /** list of last messages per topic */
    this.messages = {};

    this.updaters = {};
  }

  /** regularly take last message for topic and upsert collection */
  createUpdater(topic, rate) {
    var self = this;
    this.updaters[topic] = Meteor.setInterval(function() {
      Topics.upsert(topic, self.messages[topic]);
    }, rate * 1000);
  }

  /** subscribe to the given topic of the given message type. The
      content will be made available in the Topics collection. @param
      rate: update frequency (Hz)
  */
  subscribe(topic, messageType, rate = 1) {
    const self = this;

    // create an update loop for this topic
    this.createUpdater(topic, rate);

    // subscibe
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
        self.messages[topic] = message;
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

    if (this.updaters[topic]) {
      Meteor.clearInterval(this.updaters[topic]);
      delete this.updaters[topic];
    }
  }
};

ROS = new ROSHandler();
