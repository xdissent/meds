
/*!
 * reds
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var natural = require('natural');
var metaphone = natural.Metaphone.process;
var stem = natural.PorterStemmer.stem;
var stopwords = natural.stopwords;
var MongoClient = require('./mongo.js').MongoClient;
function noop(){};

/**
 * Library version.
 */

exports.version = '0.1.4';

/**
 * Expose `Search`.
 */

exports.Search = Search;

/**
 * Expose `Query`.
 */

exports.Query = Query;

/**
 * Search types.
 */

var types = {
  intersect: 'zinterstore',
  union: 'zunionstore',
  and: 'zinterstore',
  or: 'zunionstore'
};

/**
 * Create a redis client, override to
 * provide your own behaviour.
 *
 * @return {RedisClient}
 * @api public
 */

exports.createClient = function(){
  return exports.client
    || (exports.client = new MongoClient());
};

/**
 * Return a new reds `Search` with the given `key`.
 *
 * @param {String} key
 * @return {Search}
 * @api public
 */

exports.createSearch = function(key){
  if (!key) throw new Error('createSearch() requires a mongo key for namespacing');
  return new Search(key);
};

/**
 * Return the words in `str`.
 *
 * @param {String} str
 * @return {Array}
 * @api private
 */

exports.words = function(str){
  return String(str).match(/\w+/g);
};

/**
 * Stem the given `words`.
 *
 * @param {Array} words
 * @return {Array}
 * @api private
 */

exports.stem = function(words){
  var ret = [];
  if (!words) return ret;
  for (var i = 0, len = words.length; i < len; ++i) {
    ret.push(stem(words[i]));
  }
  return ret;
};

/**
 * Strip stop words in `words`.
 *
 * @param {Array} words
 * @return {Array}
 * @api private
 */

exports.stripStopWords = function(words){
  var ret = [];
  if (!words) return ret;
  for (var i = 0, len = words.length; i < len; ++i) {
    if (~stopwords.indexOf(words[i])) continue;
    ret.push(words[i]);
  }
  return ret;
};

/**
 * Returns an object mapping each word in a Array
 * to the number of times it occurs in the Array.
 *
 * @param {Array} words
 * @return {Object}
 * @api private
 */

exports.countWords = function(words){
  var obj = {};
  if (!words) return obj;
  for (var i = 0, len = words.length; i < len; ++i) {
    obj[words[i]] = (obj[words[i]] || 0) + 1;
  }
  return obj;
};

/**
 * Return the given `words` mapped to the metaphone constant.
 *
 * Examples:
 *
 *    metaphone(['tobi', 'wants', '4', 'dollars'])
 *    // => { '4': '4', tobi: 'TB', wants: 'WNTS', dollars: 'TLRS' }
 *
 * @param {Array} words
 * @return {Object}
 * @api private
 */

exports.metaphoneMap = function(words){
  var obj = {};
  if (!words) return obj;
  for (var i = 0, len = words.length; i < len; ++i) {
    obj[words[i]] = metaphone(words[i]);
  }
  return obj;
};

/**
 * Return an array of metaphone constants in `words`.
 *
 * Examples:
 *
 *    metaphone(['tobi', 'wants', '4', 'dollars'])
 *    // => ['4', 'TB', 'WNTS', 'TLRS']
 *
 * @param {Array} words
 * @return {Array}
 * @api private
 */

exports.metaphoneArray = function(words, duplicates){
  var arr = [];
  var constant;

  if (!words) return arr;
  
  for (var i = 0, len = words.length; i < len; ++i) {
    constant = metaphone(words[i]);
    if (duplicates || !~arr.indexOf(constant)) arr.push(constant);
  }
  
  return arr;
};

/**
 * Return a map of metaphone constant redis keys for `words`
 * and the given `key`.
 *
 * @param {String} key
 * @param {Array} words
 * @return {Array}
 * @api private
 */

exports.metaphoneKeys = function(key, words){
  return exports.metaphoneArray(words).map(function(c){
    return key + ':word:' + c;
  });
};

/**
 * Initialize a new `Query` with the given `str`
 * and `search` instance.
 *
 * @param {String} str
 * @param {Search} search
 * @api public
 */

function Query(str, search) {
  this.str = str;
  this.type('and');
  this.search = search;
}

/**
 * Set `type` to "union" or "intersect", aliased as
 * "or" and "and".
 *
 * @param {String} type
 * @return {Query} for chaining
 * @api public
 */

Query.prototype.type = function(type){
  this._type = types[type];
  return this;
};

/**
 * Limit search to the specified range of elements.
 *
 * @param {String} start
 * @param {String} stop
 * @return {Query} for chaining
 * @api public
 */
Query.prototype.between = function(start, stop){
  this._start = start;
  this._stop = stop;
  return this;
};

/**
 * Perform the query and callback `fn(err, ids)`.
 *
 * @param {Function} fn
 * @return {Query} for chaining
 * @api public
 */

Query.prototype.end = function(fn){
  return this._search(function(err, res){
    fn(err, res && res.map(function(r){
      return r._id;
    }));
  });
};

/**
 * Perform the query callback `fn(err, docs)`.
 *
 * @param {Function} fn
 * @param {Number|String|null} optional id
 * @param {Boolean} optionally include scores
 * @return {Query} for chaining
 * @api public
 */

Query.prototype._search = function(fn, id, score){
  var key = this.search.key;
  var db = this.search.client;
  var query = this.str;
  var words = exports.stem(exports.stripStopWords(exports.words(query)));
  var keys = exports.metaphoneArray(words);
  var type = this._type;
  var start = this._start || 0;
  var stop = this._stop || -1;
  var limit = stop === -1 ? 0 : stop - start;
  var match = {word: {$in: keys}};
  var project = {_id: true};

  if (!keys.length) return fn(null, []);
  if (id) match.doc = id;
  if (score) project.score = true;

  var aggregate = [
    {$match: match},
    {$group: {_id: '$doc', words: {$sum: 1}, score: {$sum: '$score'}}}];
  if (type === 'zinterstore') aggregate.push(
    {$match: {words: keys.length}});
  if (!id) aggregate.push(
    {$sort: {score: -1}});
  if (!id && start > 0) aggregate.push(
    {$skip: start});
  if (!id && limit > 0) aggregate.push(
    {$limit: limit});
  aggregate.push({$project: project});

  db.collection(key).aggregate(aggregate, fn);

  return this;
};

/**
 * Perform the query fetching scores and callback `fn(err, scores)`.
 *
 * @param {Function} fn
 * @param {Number|String|null} optional id
 * @return {Query} for chaining
 * @api public
 */

Query.prototype.scores = function(fn){
  return this._search(function(err, res){
    if (err) return fn(err);
    var scores = {};
    res.forEach(function(r){
      scores[r._id] = r.score;
    });
    fn(null, scores);
  }, null, true);
};

/**
 * Get the score given `id` for the query and callback `fn(err, score)`.
 *
 * @param {Number|String} id
 * @param {Function} fn
 * @return {Number} the score
 * @api public
 */

Query.prototype.score = function(id, fn){
  return this._search(function(err, scores){
    if (err) return fn(err);
    fn(null, scores && scores.length > 0 && scores[0].score || 0);
  }, id, true);
};

/**
 * Check if the given `id` matches for the query and callback `fn(err, score)`.
 *
 * @param {Number|String} id
 * @param {Function} fn
 * @return {Boolean} match
 * @api public
 */

Query.prototype.match = function(id, fn){
  return this.score(id, function(err, score){
    fn(err, score > 0);
  });
};

/**
 * Initialize a new `Search` with the given `key`.
 *
 * @param {String} key
 * @api public
 */

function Search(key) {
  this.key = key;
  this.client = exports.createClient();
}

/**
 * Index the given `str` mapped to `id`.
 *
 * @param {String} str
 * @param {Number|String} id
 * @param {Function} fn
 * @api public
 */

Search.prototype.index = function(str, id, fn){
  var key = this.key;
  var db = this.client;
  var words = exports.stem(exports.stripStopWords(exports.words(str)));
  var counts = exports.countWords(exports.metaphoneArray(words, true));
  var keys = Object.keys(counts);

  var docs = [];
  keys.forEach(function(word, i){
    docs.push({word: word, doc: id, score: counts[word]});
  });

  db.collection(key).insert(docs, fn || noop);

  return this;
};

/**
 * Remove occurrences of `id` from the index.
 *
 * @param {Number|String} id
 * @api public
 */

Search.prototype.remove = function(id, fn){
  fn = fn || noop;
  var key = this.key;
  var db = this.client;
  
  db.collection(key).remove({doc: id}, fn);
  
  return this;
};

/**
 * Perform a search on the given `query` returning
 * a `Query` instance.
 *
 * @param {String} query
 * @param {Query}
 * @api public
 */

Search.prototype.query = function(query){
  return new Query(query, this);
};

/**
 * Close the mongo client connection.
 *
 * @param {Function} fn
 * @api public
 */

Search.prototype.close = function(fn){
  fn = fn || noop;
  if (this.client._db) {
    return this.client.close(fn);
  }
  if (this.client._connecting) {
    return this.client.once('open', function(err, db){
      if (err) return fn(err);
      if (db) return db.close(fn);
      fn();
    });
  }
  fn();
  return this;
};
