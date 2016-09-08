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
      const id = Meteor.absoluteUrl().replace(/[\/:]/g, "_");
      rosjs.initNode('/meteor-ros/' + id, options)
        .then( function(rosNode) {
          callback(null, rosNode);
        });
    })();
  }

  // ---------------------------------------------------------
  // Topics
  // ---------------------------------------------------------

  /** Sync the given topic of the given message type. The content will
      be made available in the Topics collection. Any changes to the
      respective document will be published back on the ROS topic.

      @param topic: the name of the topic

      @param messageType: the message type name; must have been
      specified in the constructor.

      @param rate: update frequency (Hz)
      
      Example:
        subscribe("/turtle1/pose", "turtlesim/Pose", 2)

      This will keep upserting the "/turtle1/pose" document in the
      Topics collection with the latest value, twice a second.
  */
  sync(topic, messageType, rate = 1) {
    const self = this;

    // subscribe to new messages on topic
    this._sub = this._rosNode.subscribe(
      topic,
      messageType,
      Meteor.bindEnvironment(
        function(data) {
          _.extend(data, {_id: topic});
          // console.log('SUB DATA ', topic, data);
          data._source = "ros";
          Topics.upsert(topic, data);
        }
      ),
      {
        queueSize: 1,
        throttleMs: 1000 / rate
      } 
    );

    // publish any changed made in meteor back to ros topic
    let publisher = this._rosNode.advertise(topic, messageType, {
      queueSize: 1,
      latching: true,
      throttleMs: 100
    });
    const parts = messageType.split("/");
    const Message = rosjs.require(parts[0]).msg[parts[1]];
    Topics.find({_id: topic, _source: {$ne: "ros"}}).observe({
      changed(document) {
        // #HERE: we never come here
        console.log("publish", document);
        const msg = new Message(document);
        console.log("publish", msg);
        publisher.publish(msg);
      }
    });
    console.log("done");
  }

  /** Unsubscribe from topic */
  unsubscribe(topic) {
    this._rosNode.unsubscribe(topic);
  }


  // ---------------------------------------------------------
  // Services
  // ---------------------------------------------------------
 
  /** Expose a ROS service as a meteor method.

      @param service: the service to call (e.g., "/set_bool")

      @param serviceType: the service type name (e.g.,
      "std_srvs/SetBool"); must have been specified in constructor.

      @param timeout (optional): timeout in milliseconds before giving
      up (default: 2000ms)

      Example:
        relayService('/set_bool','std_srvs/SetBool', 1000);

      This will create a method that takes objects as input that can
      be used as data for std_srvs/SetBool. The method calls the
      service and waits for the response.
  */
  relayService(service, serviceType, timeout = 2000) {
    console.log("relaying service", service);

    let definition = {};
    const self = this;
    
    definition[service] = Meteor.wrapAsync(
      function(requestData, callback) {
      
        service = service.replace(/^\//, ""); // trim initial "/" if any
        console.log("serviceClient", self._rosNode); // #HERE
        let serviceClient = self._rosNode.serviceClient('/'+service, serviceType);
        console.log("serviceClient", serviceClient, serviceClient.__proto__); // #HERE
        
        // get service type class
        const [serviceTypePackage, serviceTypeName] = serviceType.split('/');
        const serviceTypeClass = rosjs.require(serviceTypePackage).srv[serviceTypeName];
        console.log("serviceTypeClass", serviceTypeClass);
        const serviceTypeClassRequest = serviceTypeClass["Request"];
       
        self._rosNode.waitForService(serviceClient.getService(), timeout)
          .then( (available) => {
            if (available) {
              const request = new serviceTypeClassRequest(requestData);

              console.log("calling service", service, "with data", request, 
                          request.__proto__, request.md5sum());
              serviceClient.call(request, (resp) => {
                console.log('Service response ' + JSON.stringify(resp));
                callback(null, resp);
              });
            } else {
              callback({
                msg: "timed out",
                description: "The request to the service ("+ service +") timed out."
              });
            }
          });
      });

    Meteor.methods(definition);
  }

};

ROS = function(options) {
  return new ROSHandler(options);
};
