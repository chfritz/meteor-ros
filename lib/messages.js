var fs = Npm.require('fs');
var path = Npm.require('path');
var md5 = Npm.require('md5');
var async = Npm.require('async');
var _ = Npm.require('underscore');

messages = {};

var registry = {};

messages.getMessage = function(messageType, callback) {
  var packageName = getPackageNameFromMessageType(messageType);
  var messageName = getMessageNameFromMessageType(messageType);
  this.getMessageFromPackage(packageName, messageName, callback);
}

messages.getMessageFromPackage = function(packageName, messageName, callback) {
  var that = this;

  var messageType = getMessageType(packageName, messageName);
  var message = getMessageFromRegistry(messageType);
  if (message) {
    callback(null, message);
  }
  else {
    packages.findPackage(packageName, function(error, directory) {
      var filePath = path.join(directory, 'msg', messageName + '.msg');
      that.getMessageFromFile(messageType, filePath, callback);
    });
  }
};

messages.getMessageFromFile = function(messageType, filePath, callback) {
  var message = getMessageFromRegistry(messageType);
  if (message) {
    callback(null, message);
  }
  else {
    var packageName = getPackageNameFromMessageType(messageType)
      , messageName = getMessageNameFromMessageType(messageType);

    var details = {
      messageType : messageType
    , messageName : messageName
    , packageName : packageName
    };

    parseMessageFile(filePath, details, function(error, details) {
      if (error) {
        callback(error);
      }
      else {
        message = buildMessageClass(details);
        setMessageInRegistry(messageType, message);
        callback(null, message);
      }
    });
  }
};

// ---------------------------------------------------------

services = {
  registry: {
    // for caching service classes
    request: [],
    response: []
  },

  /** don't use this; use the below */
  getService: function(serviceType, request_or_response, callback) {
    var self = this;

    if (self.registry[request_or_response][serviceType]) {
      return self.registry[request_or_response][serviceType];
    } else {
      var packageName = getPackageNameFromMessageType(serviceType);
      var serviceName = getMessageNameFromMessageType(serviceType);

      packages.findPackage(packageName, function(error, directory) {
        var filePath = path.join(directory, 'srv', serviceName + '.srv');
      
        var details = {
          serviceType : serviceType
          , serviceName : serviceName
          , packageName : packageName
        };
        
        parseServiceFile(filePath, details, function(error, details) {
          console.log("parseServiceFile", details, details.request);
          if (error) {
            callback(error);
          }
          else {
            service = buildServiceClass(details[request_or_response]);
            self.registry[request_or_response][serviceType] = service;
            callback(null, service);
          }
        });
      });
    }
  },

  getServiceRequest: function(serviceType, callback) {
    this.getService(serviceType, "request", callback);
  },

  getServiceResponse: function(serviceType, callback) {
    this.getService(serviceType, "response", callback);
  }
};


// ---------------------------------------------------------

function parseMessageFile(fileName, details, callback) {
  details = details || {};
  fs.readFile(fileName, 'utf8', function(error, content) {
    if (error) {
      return callback(error);
    }
    else {
      extractFields(content, details, function(error, result) {
        if (error) {
          callback(error);
        }
        else {
          details.constants = result[0].constants;
          details.fields    = result[0].fields;
          details.md5       = calculateMD5(details);
          callback(null, details);
        }
      });
    }
  })
};

function parseServiceFile(fileName, details, callback) {
  details = details || {};
  fs.readFile(fileName, 'utf8', function(error, content) {
    if (error) {
      return callback(error);
    }
    else {
      extractFields(content, details, function(error, result) {
        if (error) {
          callback(error);
        }
        else {         
          details.request = {
            constants: result[0].constants,
            fields: result[0].fields
          };
          details.response = {
            constants: result[1].constants,
            fields: result[1].fields
          };
          details.md5 = calculateMD5(details); // TODO
          callback(null, details);
        }
      });
    }
  })
};

// ---------------------------------------------------------

/** calculate the md5 sum for the message or service type. To do that
    we need to resonstruct the definition and then compute the md5
    over that */
function calculateMD5(details) {

  function reconstructPart(part) { 
    var message = '';
    var constants = part.constants.map(function(field) {
      return field.type + ' ' + field.name + '=' + field.value;
    }).join('\n');

    var fields = part.fields.map(function(field) {
      if (field.messageType) {
        return field.messageType.md5 + ' ' + field.name;
      }
      else {
        return field.type + ' ' + field.name;
      }
    }).join('\n');

    message += constants;
    if (message.length > 0 && fields.length > 0) {
      message += "\n";
    }
    message += fields;

    return message;
  }

  // depending on whether we are processing a message type or a
  // service type reconstruct the whole definition
  var whole;
  if (details.request && details.response) {
    var request = reconstructPart(details.request);
    var response = reconstructPart(details.response);
    whole = request + "\n---\n" + response;
  } else {
    whole = reconstructPart(details);
  }

  var rtv = md5(whole);
  console.log("computed md5 from:\n", details, "for:\n", whole, rtv);
  return rtv;
}

/** extract constants and fields from a message definition file. TODO:
    generalize this to services, too, i.e., also parse response 
*/
function extractFields(content, details, callback) {

  var parseLine = function(line, callback) {
    line = line.trim();

    var lineEqualIndex   = line.indexOf('=')
      , lineCommentIndex = line.indexOf('#')
      ;
    if (lineEqualIndex === -1
      || lineCommentIndex=== -1
      || lineEqualIndex>= lineCommentIndex)
    {
      line = line.replace(/#.*/, '');
    }

    if (line === '') {
      callback(null, {});
    }
    else {
      // console.log("line:", line);
      var firstSpace = line.indexOf(' ')
        , fieldType  = line.substring(0, firstSpace)
        , field      = line.substring(firstSpace + 1)
        , equalIndex = field.indexOf('=')
        , fieldName  = field.trim()
        ;

      if (equalIndex !== -1) {
        fieldName = field.substring(0, equalIndex).trim();
        var constant = field.substring(equalIndex + 1, field.length).trim();
        var parsedConstant = fields.parsePrimitive(fieldType, constant);

        callback(null, {constant: {
          name        : fieldName
          , type        : fieldType
          , value       : parsedConstant
          , messageType : null
        }});
      }
      else {
        if (fields.isPrimitive(fieldType)) {
          callback(null, {field: {
            name        : fieldName.trim()
            , type        : fieldType
            , messageType : null
          }});
        }
        else if (fields.isArray(fieldType)) {
          var arrayType = fields.getTypeOfArray(fieldType);
          if (fields.isMessage(arrayType)) {
            fieldType = normalizeMessageType(fieldType, details.packageName);
            arrayType = normalizeMessageType(arrayType, details.packageName);
            messages.getMessage(arrayType, function(error, messageType) {
              callback(null, {field: {
                name        : fieldName.trim()
                , type        : fieldType
                , messageType : messageType
              }});
            });
          }
          else {
            callback(null, {field: {
              name        : fieldName.trim()
              , type        : fieldType
              , messageType : null
            }});
          }
        }
        else if (fields.isMessage(fieldType)) {
          // console.log("fieldType", fieldType);
          fieldType = normalizeMessageType(fieldType, details.packageName);
          messages.getMessage(fieldType, function(error, messageType) {
            // console.log("getMessage", fieldType, messageType);
            callback(null, {constants: constants, field: {
              name        : fieldName.trim()
              , type        : fieldType
              , messageType : messageType
            }});
          });
        }
      }
    }
  }

  /** this assumes parseLine is writing to local vars */
  function processPart(lines, callback) {
    console.log("extractFields - processPart", lines);
    async.map(lines, parseLine, function(error, result) {
      // result is an array of objects containing constants and fields.
      // reduce them into one
      console.log("extractFields - processPart", result);
      var rtv = result.reduce(function(memo, obj) {
        if (obj.constant) {
          memo.constants.push(obj.constant);
        } else if (obj.field) {
          memo.fields.push(obj.field);
        }
        return memo;
      }, {constants: [], fields: []});      
      console.log("extractFields - processPart", rtv);
      callback(error, rtv);
    });
  }


  // --- Function Body

  var lines = content.split('\n');

  // check whether this is a message or a service definition
  var parts = [];
  var divider = lines.indexOf("---");
  if (divider >= 0) {
    // it's a service definition file
    parts.push(lines.slice(0, divider));  // request
    parts.push(lines.slice(divider+1));   // response
  } else {
    // it's a message definition file
    parts.push(lines);
  }

  // process all parts (one in the case of messages, two in the case
  // of services)
  async.map(parts, processPart, function(error, result) {
    if (error) {
      callback(error);
    } else {
      // callback(null, result); // later
      console.log("extractFields", result);
      callback(null, result); // test backward compatibility
    }
  });

};

function camelCase(underscoreWord, lowerCaseFirstLetter) {
  var camelCaseWord = underscoreWord.split('_').map(function(word) {
    return word[0].toUpperCase() + word.slice(1);
  }).join('');

  if (lowerCaseFirstLetter) {
    camelCaseWord = camelCaseWord[0].toLowerCase() + camelCaseWord.slice(1)
  }

  return camelCaseWord;
}

function buildValidator (details) {
  function validator (candidate, strict) {
    return Object.keys(candidate).every(function(property) {
      var valid = true;
      var exists = false;

      details.constants.forEach(function(field) {
        if (field.name === property) {
          exists = true;
        }
      });
      if (!exists) {
        details.fields.forEach(function(field) {
          if (field.name === property) {
            exists = true;
          }
        });
      }

      if (strict) {
        return exists;
      }
      else {
        return valid;
      }
    });
  }

  validator.name = 'validate' + camelCase(details.messageName);
  return validator;
}

/** generate a new class for the described message type; the class has
    a constructor that sets values from a plain object */
function buildMessageClass(details) {
  function Message(values) {
    if (!(this instanceof Message)) {
      // return new Message(init); // init?
      return new Message(values);
    }

    var that = this;

    if (details.constants) {
      details.constants.forEach(function(field) {
        that[field.name] = field.value || null;
      });
    }
    if (details.fields) {
      details.fields.forEach(function(field) {
        that[field.name] = field.value || null;
      });
    }

    if (values) {
      Object.keys(values).forEach(function(name) {
        that[name] = values[name];
      });
    }
  };

  Message.messageType = Message.prototype.messageType = details.messageType;
  Message.packageName = Message.prototype.packageName = details.packageName;
  Message.messageName = Message.prototype.messageName = details.messageName;
  Message.md5         = Message.prototype.md5         = details.md5;
  Message.constants   = Message.prototype.constants   = details.constants;
  Message.fields      = Message.prototype.fields      = details.fields;
  // Message.prototype.validate    = buildValidator(details);

  return Message;
}

// ---------------------------------------------------------

// function buildServiceValidator (details) {
//   function validator (candidate, strict) {
//     return Object.keys(candidate).every(function(property) {
//       var valid = true;
//       var exists = false;

//       details.constants.forEach(function(field) {
//         if (field.name === property) {
//           exists = true;
//         }
//       });
//       if (!exists) {
//         details.fields.forEach(function(field) {
//           if (field.name === property) {
//             exists = true;
//           }
//         });
//       }

//       if (strict) {
//         return exists;
//       }
//       else {
//         return valid;
//       }
//     });
//   }

//   validator.name = 'validate' + camelCase(details.messageName);
//   return validator;
// }


function buildServiceClass(details) {
  function ServiceRequest(values) {
    if (!(this instanceof Service)) {
      return new ServiceRequest(values);
    }

    var that = this;

    if (details.request.constants) {
      details.request.constants.forEach(function(field) {
        that[field.name] = field.value || null;
      });
    }
    if (details.request.fields) {
      details.request.fields.forEach(function(field) {
        that[field.name] = field.value || null;
      });
    }

    if (values) {
      Object.keys(values).forEach(function(name) {
        that[name] = values[name];
      });
    }
  };

  function ServiceResponse(values) {
    if (!(this instanceof Service)) {
      return new ServiceResponse(values);
    }

    var that = this;

    if (details.response.constants) {
      details.response.constants.forEach(function(field) {
        that[field.name] = field.value || null;
      });
    }
    if (details.response.fields) {
      details.response.fields.forEach(function(field) {
        that[field.name] = field.value || null;
      });
    }

    if (values) {
      Object.keys(values).forEach(function(name) {
        that[name] = values[name];
      });
    }
  };

  _.each(["serviceType", "packageName", "serviceName", "md5", "constants", "fields"],
         function(member) {
           ServiceRequest[member] = ServiceRequest.prototype[member] 
             = ServiceResponse[member] = ServiceResponse.prototype[member] 
             = details[member];
         });
  // ServiceRequest.prototype.validate = buildServiceValidator(details);
  // ServiceResponse.prototype.validate = buildServiceValidator(details);

  return {
    request: ServiceRequest,
    response: ServiceResponse
  };
}


function getMessageFromRegistry(messageType) {
  return registry[messageType];
}

function setMessageInRegistry(messageType, message) {
  registry[messageType] = message;
}

function getMessageType(packageName, messageName) {
  return packageName ? packageName + '/' + messageName
    : messageName;
}

function getPackageNameFromMessageType(messageType) {
  return messageType.indexOf('/') !== -1 ? messageType.split('/')[0]
    : '';
}

var isNormalizedMessageType = /.*\/.*$/;
function normalizeMessageType(messageType, packageName) {
  var normalizedMessageType = messageType;
  if (messageType == "Header") {
    normalizedMessageType = getMessageType("std_msgs", messageType);   
    // normalizedMessageType = getMessageType(null, messageType);
  } else if (messageType.match(isNormalizedMessageType) === null) {
    normalizedMessageType = getMessageType(packageName, messageType);
  }

  return normalizedMessageType;
}

function getMessageNameFromMessageType(messageType) {
  return messageType.indexOf('/') !== -1 ? messageType.split('/')[1]
                                         : messageType;
}

