const DirtyDbService = require('../dirty-db-service');
const dirtyDbService = DirtyDbService.getInstance();
const appsDbName = 'apps';

class App {
    constructor(id, name, appPath, metadataPath, runtime) {
        this.id = id;
        this.name = name;
        this.executablePath = appPath;
        this.metadataPath = metadataPath;
        this.runtime = runtime;
    }
}

/**
 * Adds an app to DB.
 * @param app App object to be inserted
 * @return {Promise<void>}
 */
function addApp(app) {
    return new Promise(resolve => {
        dirtyDbService.getDb(appsDbName).then(db => {
            // if already in the db, then don't add again
            if(db.get(app.id)) {
                resolve();
            } else {
                db.set(app.id, getJsObject(app), resolve());
            }
        });
    });
}

/**
 * Remove an app from the db
 * @param appId id of the app to be removed
 * @return {Promise<void>}
 */
function removeApp(appId) {
    return new Promise((resolve, reject) => {
        dirtyDbService.getDb(appsDbName).then(db => {
            // check if it's in the db first
            if(db.get(appId)) {
                db.rm(appId, resolve());
            } else {
                reject();
            }
        });
    });
}

/**
 * Finds app based on appId
 * @param {string} appId app's id
 * @returns {Promise<App | null>}
 */
function find(appId) {
    return dirtyDbService.getDb(appsDbName).then(db => {
        const appObj = db.get(appId);
        return appObj ? getApp(appObj) : null;
    });
}

/**
 * Fetches all app entries in the collection
 * @return {Promise<App[]>}
 */
function fetchAll() {
    return dirtyDbService.getDb(appsDbName).then(db => {
        const apps = [];
        db.forEach(function(appId, appObj) {
            apps.push(getApp(appObj));
        });
        return apps;
    });
}

/**
 * Fetches apps for the specified appIds
 * @param appIds
 * @return {Promise<App[]>}
 */
function fetchSpecific(appIds) {
    return dirtyDbService.getDb(appsDbName).then(db => {
        const apps = [];
        db.forEach(function(appId, appObj) {
            if(appIds.includes(appId)) {
                apps.push(getApp(appObj));
            }
        });
        return apps;
    });
}

/**
 * Convert a js object to an App object
 * @param jsObject js object
 * @return {App}
 */
function getApp(jsObject) {
    return new App(jsObject["id"],
        jsObject["name"],
        jsObject["executablePath"],
        jsObject["metadataPath"],
        jsObject["runtime"]
    );
}

/**
 * Convert an app object to a javascript object
 * @param app App object
 * @return {Object}
 */
function getJsObject(app) {
    return {
        "id": app.id,
        "name": app.name,
        "executablePath": app.executablePath,
        "metadataPath": app.metadataPath,
        "runtime": app.runtime
    }
}

module.exports = {
    App: App,
    addApp: addApp,
    removeApp: removeApp,
    find: find,
    fetchAll: fetchAll,
    fetchSpecific: fetchSpecific
};