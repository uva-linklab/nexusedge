class SIFCloudPublisher {
    constructor() {
    }

    initialize() {
        console.log("in initialize of SCP");
    }

    onData(data) {
        console.log("received new data");
    }
}

module.exports = SIFCloudPublisher;
