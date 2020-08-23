/**
 * This is a singleton class which is a wrapper to operate on mongoDB.
 * Singleton reference: https://blog.logrocket.com/design-patterns-in-node-js/
 *
 * Usage:
 * const DirtyDbService = require('./dirty-db-service')
 * const dirtyDbService = DirtyDbService.getInstance();
 * dirtyDbService.getDb("apps");
 */
const dirty = require('dirty');
const path = require('path');
const fs = require('fs-extra');

let instance = null;

class DirtyDbService {

    constructor() {
        this._dbCache = {};
    }

    static getInstance() {
        if(!instance) {
            instance = new DirtyDbService();
        }
        return instance;
    }

    async _loadDb(dbName) {
        return new Promise( resolve => {
            fs.ensureDirSync(path.join(__dirname, 'data'));
            const db = dirty(path.join(__dirname, 'data', dbName));
            db.on('load', function() {
                resolve(db);
            });
        })
    }

    /**
     * Returns the specified db object
     * @param dbName
     * @returns {db}
     */
    async getDb(dbName) {
        if(this._dbCache.hasOwnProperty(dbName)) {
            return this._dbCache[dbName];
        } else {
            const db = await this._loadDb(dbName);
            this._dbCache[dbName] = db;
            return db;
        }
    }
}

module.exports = DirtyDbService;