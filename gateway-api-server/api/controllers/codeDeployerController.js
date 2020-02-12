const codeContainer = require('../../code-container/container');

/**
 * This endpoint takes the uploaded code and metadata and executes it using the codeContainer module
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.deploy = async function(req, res) {
    console.log(req.body);
    console.log(req.files);

    const codePath = req["files"]["code"][0]["path"];
    const metadataPath = req["files"]["metadata"][0]["path"];

    codeContainer.execute(codePath, metadataPath);
    res.send();
};