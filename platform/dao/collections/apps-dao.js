const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const appsCollectionName = 'apps';

/**
 * Saves the app info to DB
 * @param {string} appId application's id
 * @param {string} appPath application executable path
 * @param {string} metadataPath metadata path
 * @param {string} pid application's pid
 * @returns {Promise<status>}
 */
exports.saveAppInfo = function(appId, appPath, metadataPath, pid) {
    return mongoDbService.getCollection(appsCollectionName)
        .then(collection => {
            return collection.insertOne({
                    "_id": appId,
                    "name": appPath,
                    "pid": pid,
                    "appPath": appPath,
                    "metadataPath": metadataPath
                });
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