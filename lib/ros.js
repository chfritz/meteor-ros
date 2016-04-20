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

ros.services = services; // DEBUG
