#!/usr/bin/env node

var mongoose = require('mongoose')
	, http = require('http')
	, static = require('node-static')
	, config = require('./config')
	, logly = require('logly')
	, os = require( 'os' )
	, socketio = require('socket.io')
	, S = require('string') // http://stringjs.com/
	, Schema = mongoose.Schema;


/**
*
* Set up the application.
*
*/   
// Setting up logging.
logly.name('Powerboard');
logly.mode('debug');
logly.color(true);
// logly.date(true);

// Setting up a static server
var file = new(static.Server)('./public');

// Creating and launching the HTTP server on port $port.
var server = http.createServer(function(req, res){
	file.serve(req, res);
}).listen(config.app.port, function() {
     logly.log("Server successfuly started at http://" + os.hostname() + ":"+ server.address().port);
});





// Setting up the socket IO server.
var io = socketio.listen(server);
io.set('log level', 1)

// Setting up a local eventPool. I think maxListeners doesn't work
//var eventEmitter = new events.EventEmitter();
// eventEmitter.setMaxListeners(0);

// Setting up Mongoose
var nodejitsu = "mongodb://username:password@hostname:27017/dbname";
var localhost = "mongodb://" + config.mongodb.host + "/" + config.mongodb.dbname;
var db = mongoose.connect(nodejitsu, function(err) {
  if (err) { throw err; }
});

// Creating a schema for mesValue (Schema types : http://mongoosejs.com/docs/schematypes.html
var MesValue = new Schema({
	_id: Schema.Types.ObjectId,
	value: String,
	timestamp: Date,
	channel: {
		name: String,
		powerplant: {
			name: String
		}
	}
});
var MesValueModel = mongoose.model('MesValue', MesValue, 'mesValue');


// When the user is connected to socket.io
io.sockets.on('connection', function (socket) {

	// We automatically send the list of channel name
	MesValueModel.collection.distinct("channel.name", function(error, results) {
		socket.emit('channelList', results);
	});

	// When the user ask for values, we catch the event and request all the values for this channel
	socket.on('getValues', function(channelName) {
        logly.log("Receiving from the client a 'getValues' event with channelName : " + channelName);

		MesValueModel.find({"channel.name":channelName}, 'value timestamp', function(err, results) {
			var resultFormatedForHighCharts = [];
			var array_duplicates = [];
	        for (var i = results.length - 1; i >= 0; i--) {
	        	var value = parseInt(S(results[i].value).replaceAll(',','.').s);
	        	var timestamp = results[i].timestamp.getTime();
	        	if (!array_duplicates.contains(timestamp)) {
	        		array_duplicates.push(timestamp);
	        		resultFormatedForHighCharts.push([timestamp,value]);
	        	}
	        };
			socket.emit('mesValues', resultFormatedForHighCharts.reverse());
		});
     });
});

// Utility Method to add contains to the Array object
Array.prototype.contains = function(obj) {
	var i = this.length;
	while (i--) {
		if (this[i] === obj) {
		    return true;
		}
	}
	return false;
}