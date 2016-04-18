var fs = Npm.require('fs');
var path = Npm.require('path');
var md5 = Npm.require('md5');
var async = Npm.require('async');
var _ = Npm.require('underscore');

messages = {};
fieldsUtil = fields;

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

function parseMessageFile(fileName, details, callback) {
  details = details || {};
  fs.readFile(fileName, 'utf8', function(error, content) {
    if (error) {
      return callback(error);
    }
    else {
      extractFields(content, details, function(error, constants, fields) {
        if (error) {
          callback(error);
        }
        else {
          details.constants = constants;
          details.fields    = fields;
          // console.log("computing md5 from", details);
          details.md5       = calculateMD5(details);
          // details.md5       = calculateMD5(content);
          callback(null, details);
        }
      });
    }
  })
};


function calculateMD5(details) {
  var message = '';

  var constants = details.constants.map(function(field) {
    return field.type + ' ' + field.name + '=' + field.value;
  }).join('\n');

  var fields = details.fields.map(function(field) {
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

  return md5(message);
}

/** extract constants and fields from a message definition file. TODO:
    #HERE generalize this to services, too, i.e., also parse response
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
        var parsedConstant = fieldsUtil.parsePrimitive(fieldType, constant);

        callback(null, {constant: {
          name        : fieldName
          , type        : fieldType
          , value       : parsedConstant
          , index       : fields.length
          , messageType : null
        }});
      }
      else {
        if (fieldsUtil.isPrimitive(fieldType)) {
          callback(null, {field: {
            name        : fieldName.trim()
            , type        : fieldType
            , index       : fields.length
            , messageType : null
          }});
        }
        else if (fieldsUtil.isArray(fieldType)) {
          var arrayType = fieldsUtil.getTypeOfArray(fieldType);
          if (fieldsUtil.isMessage(arrayType)) {
            fieldType = normalizeMessageType(fieldType, details.packageName);
            arrayType = normalizeMessageType(arrayType, details.packageName);
            messages.getMessage(arrayType, function(error, messageType) {
              callback(null, {field: {
                name        : fieldName.trim()
                , type        : fieldType
                , index       : fields.length
                , messageType : messageType
              }});
            });
          }
          else {
            callback(null, {field: {
              name        : fieldName.trim()
              , type        : fieldType
              , index       : fields.length
              , messageType : null
            }});
          }
        }
        else if (fieldsUtil.isMessage(fieldType)) {
          // console.log("fieldType", fieldType);
          fieldType = normalizeMessageType(fieldType, details.packageName);
          messages.getMessage(fieldType, function(error, messageType) {
            // console.log("getMessage", fieldType, messageType);
            callback(null, {constants: constants, field: {
              name        : fieldName.trim()
              , type        : fieldType
              , index       : fields.length
              , messageType : messageType
            }});
          });
        }
      }
    }
  }

  var lines = content.split('\n');

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
      callback(null, result[0].constants, result[0].fields); // test backward compatibility
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

function buildMessageClass(details) {
  function Message(values) {
    if (!(this instanceof Message)) {
      return new Message(init);
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
  Message.prototype.validate    = buildValidator(details);

  return Message;
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

