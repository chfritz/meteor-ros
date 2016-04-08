Meteor package for ROS (http://www.ros.org/).

For now, all you can do is publish and subscribe to topics, but that's
actually already very useful.

## Example code:

```js
import { Meteor } from 'meteor/meteor';

function done() {
  console.log("done");
}

/** an example of how to publish to a topic */
function pub() {
  ros.types([
    'std_msgs/String'
  ], function(String) {

    // Creates the topic 'publish_example'
    var publisher = new ros.topic({
      node        : 'talker'
      , topic       : 'publish_example'
      , messageType : String
    });

    publisher.on('unregistered_publisher', done);

    // Sends a std_msgs/String message over the 'publish_example'
    // topic.
    var message = new String({ data: 'howdy' });
    publisher.publish(message);

    // Unregister as a publisher for test clean up
    setTimeout(function() {
      publisher.unregisterPublisher();
    }, 1000);
  });
}

/** an example of how to subscribe to a topic */
function sub() {
  ros.types([
    'std_msgs/String'
  ], function(String) {
    
    // Creates the topic 'subscribe_example'
    var subscriber = new ros.topic({
      node        : 'listener'
      , topic       : 'subscribe_example'
      , messageType : String
    });

    subscriber.on('unregistered_subscriber', done);

    // Subscribes to the 'subscribe_example' topic
    subscriber.subscribe(function(message) {
      // message.data.should.equal('howdy');
      console.log(message);

      // Unregister as a subscriber for test cleanup
      subscriber.unregisterSubscriber();
    });

  });
}



Meteor.startup(() => {

  // console.log("now do: rostopic echo /publish_example");
  // pub();
  
  console.log("now do: rostopic pub /subscribe_example std_msgs/String \"test\"");
  sub();

});
```