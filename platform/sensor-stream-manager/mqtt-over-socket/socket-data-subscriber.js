/*
- run as a worker thread for Sensor Stream Manager
- creates a socket at a port specified by SSM and listens for incoming connections
- send request to notify for new data for the sensor ids specified by SSM
- obtain sensor data and pass it on to SSM
*/
const {
    parentPort, workerData
} = require('worker_threads');
const WebSocket = require('ws');

//Ensure that we get a web socket address from parent. If not, exit.
if(!workerData.hasOwnProperty("webSocketPort") || !workerData.hasOwnProperty("sensorIds")) {
    console.error("websocket port or sensorIds not specified by Sensor Stream Manager");
    process.exit(1);
}

const port = workerData["webSocketPort"];
const sensorIds = workerData["sensorIds"];

const wss = new WebSocket.Server({ port: port });

console.log(`socket server started on port ${port}`);
wss.on('connection', (socket) => {
    console.log("connected");

    const request = {
        "api": "receive",
        "params": {
            "sensorIds": sensorIds
        }
    };
    socket.send(JSON.stringify(request));

    socket.on('message', (message) => {
        const jsonData = JSON.parse(message);

        //check if there was some error
        if(jsonData.hasOwnProperty("error")) {
            console.log("received error");
            console.log(jsonData["error"]);
        } else if(jsonData.hasOwnProperty("api") && jsonData["api"] === "receive") {
            const sensorId = jsonData["sensorId"];
            const data = jsonData["data"];

            console.log(sensorId);
            console.log(data);

            parentPort.postMessage(data);
        }
    });


});