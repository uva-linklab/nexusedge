const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const appsCollectionName = 'apps';

/**
 * Saves the app info to DB
 * @param {string} appId application's id
 * @param {string} appName application's name
 * @param {string} appPath application executable path
 * @param {string} metadataPath metadata path
 * @param {string} pid application's pid
 */
exports.saveAppInfo = function(appId, appName, appPath, metadataPath, pid) {
    mongoDbService.getCollection(appsCollectionName)
        .then(collection => {
            collection.insertOne({
                    "_id": appId,
                    "name": appName,
                    "appPath": appPath,
                    "metadataPath": metadataPath,
                    "pid": pid
                })
                .then(() => {})
                .catch(err => console.error(err.message));
        });
};

/**
 * Finds app based on appId
 * @param {string} appId application's id
 * @returns {Promise<appInfo>}
 */
exports.findAppInfo = function(appId) {
    return mongoDbService.getCollection(appsCollectionName)
        .then(collection => {
            return collection.find({"_id": appId})
                .toArray();
        });
};

/**
 * Fetches all the apps.
 * @return {Promise<apps>}
 */
exports.fetchAll = function() {
    return mongoDbService.getCollection(appsCollectionName)
        .then(collection => {
            return collection.find()
                .toArray();
        })
};

/**
 * Removes all the apps.
 * @return {Promise<void>}
 */
exports.clearAll = function() {
    return mongoDbService.getCollection(appsCollectionName)
        .then(collection => {
            return collection.drop();
        })
};