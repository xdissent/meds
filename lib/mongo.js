
var MongoClient = require('mongodb').MongoClient;

module.exports = {
  MongoClient: MongoClient,
  MongoCollection: MongoCollection,
};

MongoClient.prototype.collection = function(name){
  return new MongoCollection(this, name);
};

function MongoCollection(client, name){
  this.client = client;
  this.name = name;
};

MongoCollection.prototype.insert = function(){
  return this._defer('insert', arguments);
};

MongoCollection.prototype.remove = function(){
  return this._defer('remove', arguments);
};

MongoCollection.prototype.find = function(){
  return this._defer('find', arguments);
};

MongoCollection.prototype.aggregate = function(){
  return this._defer('aggregate', arguments);
};

MongoCollection.prototype._defer = function(method, args){
  var name = this.name,
    callback = args[args.length - 1],
    self = this;

  this._connect(function(err, db){
    if (err) return callback(err);
    self._index(db, function(err){
      if (err) return callback(err);
      var collection = db.collection(name);
      collection[method].apply(collection, args);
    });
  });
};

MongoCollection.prototype._index = function(db, callback){
  if (this._indexed) return callback();
  var name = this.name,
    client = this.client,
    index = {word: true, doc: true},
    options = {unique: true},
    self = this;
  if (!client._indexed) client._indexed = [];
  if (client._indexed.indexOf(name) !== -1) {
    this._indexed = true;
    return callback();
  }
  db.ensureIndex(name, index, options, function(err, res){
    if (err) return callback(err);
    self._indexed = true;
    client._indexed.push(name);
    callback();
  });
};

MongoCollection.prototype._connect = function(callback){
  var client = this.client;
  if (client._db) return callback(null, client._db);
  if (client._connecting) return client.once('open', callback);
  client._connecting = true;
  client.connect(process.env.MONGO_URL, function(err, db){
    if (!err) db.once('close', function(){
      client._db = null;
    });
    client._connecting = false;
    callback(err, db);
  });
};
