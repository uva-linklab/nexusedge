/*
- run as a worker thread for Sensor Stream Manager
- subscribes to localhost gateway-data MQTT topic
- takes a websocket server address and opens a socket
    - it listens to messages from the other end
        - parses it in json format
            - takes a list of sensors and notifies whenever there's new data for the sensors
*/
const {
    workerData
} = require('worker_threads');
const MqttController = require('../../../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const WebSocket = require('ws');

//Ensure that we get a web socket address from parent. If not, exit.
if(!workerData.hasOwnProperty("webSocketAddress")) {
    console.error("no websocket address passed from Sensor Stream Manager");
    process.exit(1);
}

//connect to websocket
const webSocketAddress = workerData["webSocketAddress"];
const ws = new WebSocket(webSocketAddress);

ws.on('open', function open() {
    // ws.send('something');
    console.log(`opened socket at address ${webSocketAddress}`);
});

/*
Format of request that the socket server sends:
{
	"api": "receive",
	"params": {
		"sensorIds": ["s1", "s2", "s3"]
	}
}

Format of response for well-formed requests:
{
    "api": "receive",
    "sensorId": ...,
    "data": ...
}

Format of error message in case of malformed requests:
{
    "error": "invalid request"
}
 */
ws.on('message', (message) => {
    //parse JSON message to obtain a request
    const request = JSON.parse(message);

    console.log("incoming request");
    console.log(request);

    if(request.hasOwnProperty("api") && request["api"] === "receive") {
        if(request.hasOwnProperty("params")) {
            const params = request["params"];
            if(params.hasOwnProperty("sensorIds")) {
                const sensorIds = params["sensorIds"];
                console.log(`start listening for new data for ${sensorIds}`);
                notifyForSensorData(sensorIds, (sensorId, data) => {
                    //push data through socket
                    const message = {
                        "api": "receive",
                        "sensorId": sensorId,
                        "data": data
                    };
                    ws.send(JSON.stringify(message));
                });
                return;
            }
        }
    }

    console.log("Invalid request. Send error as response.");
    //send error for invalid requests
    const error = {
        "error": "invalid request"
    };
    ws.send(JSON.stringify(error));
});

/*
This function initializes MQTT and listens for the given sensorIds. If new data for a sensor is available, give a
callback.
 */
function notifyForSensorData(sensorIds, callback) {
    mqttController.subscribeToPlatformMqtt(message => {
        const data = JSON.parse(message);
        const sensorId = data._meta.device_id;

        if(sensorIds.includes(sensorId)) {
            callback(sensorId, data);
        }
    });
}