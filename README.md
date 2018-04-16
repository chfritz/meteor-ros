# Meteor ROS

Meteor package for ROS (http://www.ros.org/).

For now, all you can do is publish and subscribe to topics and calling services but that's actually already very useful.

## Example

### Synchronize a ROS topic and a doc in a collection

```js
import { ROS, Topics } from 'meteor/chfritz:ros';

// Initialize meteor-ros
const ros = ROS();

// Synchronize /chatter topic
const topic = '/chatter';
const msgType = 'std_msgs/String';
ros.sync(topic, msgType);

// Now run: rostopic echo /chatter
//   You should see "Published!"
Topics.upsert(topic, {
  data: "Published!"
});


// Now run: rostopic pub /chatter std_msgs/String "Updated!"
//   You should see "Updated!" in your terminal tab running the Meteor app
Topics.find({_id: topic}).observeChanges({
  added: (id, doc) => { console.log(doc); },
  changed: (id, doc) => { console.log(doc); }
});
```

### Expose a ROS service as a Meteor method

Start the `add_two_ints_server` node in the [rospy_tutorials](http://wiki.ros.org/rospy_tutorials?distro=lunar) pkg by
```
rosrun rospy_tutorials add_two_ints_server
```

```js
import { ROS, Topics } from 'meteor/chfritz:ros';

// Initialize meteor-ros
const ros = ROS();

// Expose a ROS service as a Meteor method
ros.relayService('/add_two_ints', 'rospy_tutorials/AddTwoInts');

// You should see "3" in your terminal tab running the Meteor app
Meteor.call('/add_two_ints' {a: 1, b: 2}, (err, res) => {
  console.log(res.sum);
});
```
