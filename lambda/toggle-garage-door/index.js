// Load the AWS SDK
var AWS 	= require("aws-sdk");
var http  	= require('http');
var https 	= require('https');
var aws4  	= require('aws4');

// Handler for our request
exports.handler = (event, context, callback) => {

    console.log(event);

	doSend(callback, context, "{\"status\":\"change\"}");
};

function doSend(callback, context, post) {

	// given an options object you could pass to http.request
	var opts = {
			host: '{IOT_ID}.iot.us-east-1.amazonaws.com', 
			path: '/topics/toggle-garage-door-topic?qos=1', 
			method: 'POST',
			service: 'iotdevicegateway',
			body: post
	};

	// Sign the request
	var _request = aws4.sign(opts, {
		accessKeyId: "{access-key}", 
		secretAccessKey: "{access-secret}"
	});

	request(_request, callback, context);

}

// create a utility function to pipe to stdout (with https this time)
function request(o, callback, context) { 
	https.request(o, function(res) {
		/*res.pipe(process.stdout)*/ 
		if (callback != null) { 
			context.done(null, "success"); 
		}
	}).end(o.body || '') 
}
