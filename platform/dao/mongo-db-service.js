const MongoClient = require('mongodb').MongoClient;
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'onTheEdgeDB';

/**
 * This is a singleton class which is a wrapper to operate on mongoDB.
 * Singleton reference: https://blog.logrocket.com/design-patterns-in-node-js/
 *
 * Usage:
 * const MongoDbService = require('./mongo-db-service')
 * const mongoDBService = MongoDbService.getInstance();
 * mongoDBService.getCollection("apps");
 */

let instance = null;

class MongoDbService {

    constructor() {
        this.initialized = false;
    }

    _initialize() {
        return new Promise(resolve => {
            this._connectToDB()
                .then(connectionObj => {
                    this.db = connectionObj.db;
                    this.connection = connectionObj.connection;

                    resolve();
                    this.initialized = true;
                });
        })
    }

    static getInstance() {
        if(!instance) {
            instance = new MongoDbService();
        }
        return instance;
    }

    async _connectToDB() {
        const connection = await MongoClient.connect(mongoUrl, {useNewUrlParser: true, useUnifiedTopology: true});

        const db = await connection.db(dbName);
        return {'db': db, 'connection': connection};
    }

    /**
     * Returns the specified collection object
     * @param collection
     * @returns {collection}
     */
    async getCollection(collection) {
        if(!this.initialized) {
            await this._initialize();
        }
        return this.db.collection(collection);
    }
}

module.exports = MongoDbService;