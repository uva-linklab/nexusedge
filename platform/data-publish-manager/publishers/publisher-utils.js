const path = require('path');
const fs = require('fs-extra');

/**
 * Loads publishers for data-publish-manager (dpm).
 * Any directory under dpm/publishers/ is considered to be a publisher.
 * The configuration file for publishers is dpm/publishers/publishers.json.
 * @return {Promise<[module]|null>} a list of publishers if loading was successful, otherwise returns null.
 */
async function loadPublishers() {
    const publisherDetails = await getPublishersDetails();
    if(publisherDetails == null) {
        return null;
    }

    // ensure that the publishers listed in publishers.json are all in place
    const publisherNames = Object.keys(publisherDetails);

    // ensure that the 'main' script listed for each publisher exists
    const mainScriptPaths =
        Object.entries(publisherDetails).map(entry => path.join(__dirname, entry[0], entry[1]['main']));

    // create a map of publisherName -> publisherObj
    try {
        // for each publisher name, load its node.js module
        return Promise.all(publisherNames.map((publisherName, index) =>
            getPublisherModule(publisherName, mainScriptPaths[index])));
    } catch(err) {
        return null;
    }
}

/**
 * Get the publishers in publishers.json
 * @return {Promise<null|{}>}
 */
async function getPublishersDetails() {
    const publishersJsonPath = path.join(__dirname, "publishers.json");

    const exists = await fs.pathExists(publishersJsonPath);
    if(!exists) {
        console.error(`Please ensure that the publishers directory contains a valid publishers.json config file.`);
        return null;
    }

    // ensure that the config file is well-formed
    try {
        return await fs.readJson(publishersJsonPath);
    } catch (e) {
        // if there's a JSON parse error, throw an error message
        if(e instanceof SyntaxError) {
            console.error("publishers.json is not well-formed.");
            return null;
        }
    }
}

/**
 * Load the nodejs module for a given publisher
 * @param publisherName The name of the publisher
 * @param publisherScriptPath The publisher's main script path
 * @return {Promise<module>}
 */
async function getPublisherModule(publisherName, publisherScriptPath) {
    return new Promise((resolve, reject) => {
        try {
            const PublisherClass = require(publisherScriptPath);
            const publisherModule = new PublisherClass();
            resolve(publisherModule);
        } catch (err) {
            if(err.code === 'MODULE_NOT_FOUND') {
                console.error('Dependencies for some of the publishers not installed. ' +
                    'Please run data-publish-manager/publishers/install-publishers.js before starting the platform.');
                console.error(err.message);
                reject(err);
            }
        }
    });
}

module.exports = {
    loadPublishers: loadPublishers,
};