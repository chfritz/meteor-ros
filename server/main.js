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

  // ---------------------------------------------------------
  // Topics
  // ---------------------------------------------------------

  /** subscribe to the given topic of the given message type. The
      content will be made available in the Topics collection. 

      @param topic: the name of the topic

      @param messageType: the message type name; must have been
      specified in the constructor.

      @param rate: update frequency (Hz)
      
      Example:
        subscribe("/turtle1/pose", "turtlesim/Pose", 2)

      This will keep upserting the "/turtle1/pose" document in the
      Topics collection with the latest value, twice a second.
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
        let serviceClient = self._rosNode.serviceClient('/'+service, serviceType);
        
        // get service type class
        const [serviceTypePackage, serviceTypeName] = serviceType.split('/');
        const serviceTypeClass = rosjs.require(serviceTypePackage).srv[serviceTypeName];
        console.log("serviceTypeClass", serviceTypeClass);
        const serviceTypeClassRequest = serviceTypeClass["Request"];
       
        self._rosNode.waitForService(serviceClient.getService(), timeout)
          .then( (available) => {
            if (available) {
              const request = new serviceTypeClassRequest(requestData);

              console.log("calling service", service, "with data", request);
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
