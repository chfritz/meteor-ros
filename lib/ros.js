var url = Npm.require('url');

ros = {};
ros.topic = topic;

ros.types = function(types, callback) {
  var that = this;

  var Messages = [];
  types.forEach(function(type) {
    messages.getMessage(type, function(error, Message) {
      Messages.push(Message);
      if (Messages.length === types.length) {
        callback.apply(that, Messages);
      }
    });
  });
};


// DEBUG
ros.master = master;
ros.tcpros = new TCPROS({
  node        : "nodejs_service_caller"
});

// ros.messages = messages; // DEBUG

ros.call = function(serviceName, serviceType, values, callback) {
  master.lookupService("rosnodejs", serviceName, function(error, uri) { 
    var parsedUrl = url.parse(uri);
    messages.getServiceRequest(serviceType, function(error, ServiceRequest) { 
      if (error) {
        console.log(error);
        callback(error);
      } else {
        ros.tcpros.callService(parsedUrl.port, parsedUrl.hostname, serviceName,
                               new ServiceRequest(values),
                               {
                                 serviceType: serviceType,
                                 md5: ServiceRequest.md5
                               });
        // TODO:
        callback(null, "OK -- TODO");
      }
    });
  });
}
