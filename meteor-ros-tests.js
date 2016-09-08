// Write your tests here!
// Here is an example

Tinytest.add('example', function (test) {

  let ros = ROS({
    messages: ['std_msgs/String', 'turtlesim/Pose'], 
    services: ['std_srvs/SetBool', "turtlesim/TeleportRelative"]
  });

  console.log("created");

  // /* subscribe to a topic, this will upsert the topic's document in
  //    the Topics collection at the given frequency (default 1Hz) */
  ros.sync("/turtle1/pose", "turtlesim/Pose", 2);
  console.log("subscribed");

  Meteor.setTimeout(function() {
    // doesn't work
    console.log(Topics.findOne());
    Topics.update("/turtle1/pose", {$set: {x: 4.0, _source: "us"}});
  }, 10000);

  ros.relayService("turtle1/teleport_relative", "turtlesim/TeleportRelative");
  // // now we can use:
  // // Meteor.call("turtle1/teleport_relative", { linear: 1.0, angular: 0.0});

  // console.log("relayed");

  test.equal(true, true);  

});
