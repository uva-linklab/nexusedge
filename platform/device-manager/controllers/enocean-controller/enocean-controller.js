// This file is taken from the lab11/gateway repo, with some changes to work with nodejs v12.6.2
// Source: https://github.com/lab11/gateway/blob/master/software/enocean-generic-gateway/enocean-generic-gateway.js
const enocean = require('@nabeeln7/node-enocean')();
const serialPort = require('serialport');

let instance = null;

const initializeQueue = [];

const subscriberCallbackList = [];

class EnOceanController {
    constructor() {
        this._initialized = false;
        this._initializing = false;
    }

    static getInstance() {
        if(!instance) {
            instance = new EnOceanController();
        }
        return instance;
    }

    /**
     * Async function to initialize enocean controller
     * @return {Promise<void>}
     */
    initialize() {
        return new Promise((resolve, reject) => {
            // if initialized, then return immediately
            if(this._initialized) {
                resolve();
            } else if(this._initializing) { // if initialization underway, then wait in queue
                initializeQueue.push(resolve);
            } else {
                this._initializing = true;

                serialPort.list()
                    .then(ports => {
                        ports.forEach(port => {
                            if (port.pnpId && port.pnpId.indexOf('EnOcean') !== -1) {
                                console.log('Using serial port ' + port.path);
                                enocean.listen(port.path);
                                resolve();

                                this._initializing = false;
                                this._initialized = true;

                                // resolve all pending promises
                                initializeQueue.forEach(resolveFn => resolveFn());

                                this._setupEnOceanEvents();
                            }
                        })
                    })
                    .catch(err => reject(err));
            }
        })
    }

    subscribe(callback) {
        if(typeof callback === 'function') {
            subscriberCallbackList.push(callback);
        }
    }

    _setupEnOceanEvents() {
        enocean.on("ready", function () {
            console.log('Listening for EnOcean packets.');
            enocean.startLearning();
        });

        enocean.on("learned", function (data) {
            console.log('Learned about ' + data.eepType + '(' + data.id + ')');
        });

        enocean.on("known-data", function (data) {
            subscriberCallbackList.forEach(callbackFn => callbackFn(data));
        });

        enocean.on('learn-mode-stop', function (result) {
            // If for any reason learning stops, start it again!
            // Learning seems to stop for all sorts of reasons. Not good for a generic
            // gateway!
            enocean.startLearning();
        });
    }
}