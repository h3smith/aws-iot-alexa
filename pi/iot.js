// IoT Imports
var awsIot = require('aws-iot-device-sdk');

// Web Server Imports
var gpio = require("rpi-gpio");
var sleep = require('sleep');

var pin_location = 11;
var door_pin = 16;
var _last_state = null;
var _minute_force_update = 5;
var _second_force_update = 5;

// Time it takes to open or close the door
var _time_up = 18;
var _time_down = 16;

// States we push to the pins for up and down
var _closed_state = 1;
var _open_state = 0;

// Pin for opening a closing the door
gpio.setup(door_pin, gpio.DIR_OUT, outputSetup);

// Setup our door check pin
gpio.setup(pin_location, gpio.DIR_IN, gpio.EDGE_RISING);

gpio.on('change', function (channel, value) {
//    console.log('Channel ' + channel + ' value is now ' + value);
});

// Setup as high
function outputSetup() {
    gpio.write(door_pin, _closed_state);
}

var _changeStatusTopic = "toggle-garage-door-topic";
var myThingName = 'pi-garage';


var thingShadows = awsIot.thingShadow({
    keyPath: '{local-private-key-name}',
    certPath: '{local-cert-name}',
    caPath: '{local-root-ca-name}',
    clientId: myThingName,
    region: '{aws-region}'
});

mythingstate = {
    "state": {
        "reported": {
            "ip": "unknown"
        }
    }
}

thingShadows.register(myThingName, {
    persistentSubscribe: true
});

var networkInterfaces = require('os').networkInterfaces();
mythingstate["state"]["reported"]["ip"] = networkInterfaces['wlan0'][0]['address'];


// Toggles the state of the door
function changeDoorStatus(status) {
    console.log("changing door state");

        // Grab the current status...
        gpio.read(pin_location, function (err, value) {
            if (err)
                throw err;

		// Is the door closed?
		var isClosed = value;

		var shouldToggle = false;

		if (status == "change") {
			shouldToggle = true;
		}
		else if (status == "open" && isClosed) {                        
                        shouldToggle = true;
		}
                else if (status == "close" && !isClosed) {
                        shouldToggle = true;
                }

console.log("state ->");
console.log(status);

		if (!shouldToggle) {
			console.log("state hasn't changed, so ignoring request");
			return;
		}
		
		console.log("state has changed, so performing change");

    		// Write the pin to down
    		gpio.write(door_pin, _closed_state);
		// Write the pin to up
		setTimeout(function () { gpio.write(door_pin, _open_state); }, 500);

        });

}

thingShadows.on('connect', function () {
    console.log("Connected...");
    console.log("Registering...");
    thingShadows.register(myThingName);

    // An update right away causes a timeout error, so we wait about 2 seconds
    setTimeout(function () {
        console.log("Updating my IP address...");
        clientTokenIP = thingShadows.update(myThingName, mythingstate);
        console.log("Update:" + clientTokenIP);
        thingShadows.subscribe(_changeStatusTopic, { qos: 0 }, function (err, granted) { });
    }, 2500);

    // Code below just logs messages for info/debugging
    thingShadows.on('status',
      function (thingName, stat, clientToken, stateObject) {
          console.log('received ' + stat + ' on ' + thingName + ': ' +
                      JSON.stringify(stateObject));
      });

    thingShadows.on('update',
        function (thingName, stateObject) {
            console.log('received update ' + ' on ' + thingName + ': ' +
                        JSON.stringify(stateObject));
        });

    thingShadows.on('delta',
        function (thingName, stateObject) {
            console.log('received delta ' + ' on ' + thingName + ': ' + JSON.stringify(stateObject));
        });

    function getMessageJson(stateObject) {
try {
        var _bufferData = JSON.stringify(stateObject);
        var _buffer = new Buffer(JSON.parse(_bufferData).data).toString();
        var _parsed = JSON.parse(_buffer);
        return _parsed;
} catch (ex) { return null; }
    }

    thingShadows.on('message',
        function (thingName, stateObject) {
            if (thingName == _changeStatusTopic) {
                // Grab the state
                var _json = getMessageJson(stateObject);
if (_json == null) { return; }

console.log(_json);
console.log(JSON.stringify(_json));

                console.log(_json.status);
                // Toggle the door state
                changeDoorStatus(_json.status);
                console.log("state change");
            }
            else {
                console.log('received message ' + ' on ' + thingName + ': ' +
                            JSON.stringify(stateObject));
            }

        });

    thingShadows.on('timeout',
        function (thingName, clientToken) {
            console.log('received timeout for ' + clientToken)
        });

    thingShadows
      .on('close', function () {
          console.log('close');
      });
    thingShadows
      .on('reconnect', function () {
          console.log('reconnect');
      });
    thingShadows
      .on('offline', function () {
          console.log('offline');
      });
    thingShadows
      .on('error', function (error) {
          console.log('error', error);
      });

});

    function postStatus() {
        // Grab the current status...
        gpio.read(pin_location, function (err, value) {
            if (err)
                throw err;
//                console.log("post status called");
                var shouldPost = false;
                if (_last_state == null) {
//console.log("new status");
			_last_state = value;
                        shouldPost = true;
                }
                else if (_last_state != value) {
//console.log("status changed");
                        _last_state = value;
                        shouldPost = true;
                }

		var _status = { "state": { "reported": { "door-closed":  value ? "closed" : "open" } } };

            // Output the status
                if (shouldPost) {
                        console.log("posting update to server");
//console.log(JSON.stringify(_status));
                        thingShadows.update(myThingName,_status);
                }
                else {
//                        console.log("state hasn't changed");
                }
        });

    }


function recursiveCall(the_interval, fn) {
	setInterval(fn, the_interval);
}


// Force update every X seconds
recursiveCall(_second_force_update * 1000, function() { 
	// Make sure we are in the low state
	gpio.write(door_pin, _closed_state);
	postStatus(); 
});

// here is where we do our 5 minute call
recursiveCall(_minute_force_update * 60 * 1000, function() { _last_state = null; postStatus(); });
