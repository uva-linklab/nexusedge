// currently this dao is used only for startup apps (regular apps don't require persistent state info)
const DirtyDbService = require('../dirty-db-service');
const dirtyDbService = DirtyDbService.getInstance();
const appsDbName = 'apps';

class App {
    constructor(id, name, appPath, metadataPath, runtime, isStartupApp) {
        this.id = id;
        this.name = name;
        this.executablePath = appPath;
        this.metadataPath = metadataPath;
        this.runtime = runtime;
        this.isStartupApp = isStartupApp;
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
        jsObject["runtime"],
        jsObject["isStartupApp"],
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
        "runtime": app.runtime,
        "isStartupApp": app.isStartupApp
    }
}

module.exports = {
    App: App,
    addApp: addApp,
    find: find,
    fetchAll: fetchAll,
    fetchSpecific: fetchSpecific
};