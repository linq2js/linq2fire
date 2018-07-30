'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.default = create;

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var dbWrapper = function dbWrapper(db) {
  return {
    from: function from(collection) {
      return create(db.collection(collection));
    }
  };
};

function create(queryable, collection) {
  if (queryable.collection) {
    if (collection) {
      queryable = queryable.collection(collection);
    } else {
      return dbWrapper(queryable);
    }
  }
  var _orderBy = [];
  var whereAnd = {};
  var whereOr = [];
  var _limit = 0;
  return {
    limit: function limit(count) {
      _limit = count;
      return this;
    },
    bind: function bind(callback) {
      var q = Object.keys(whereAnd).reduce(function (queryable, key) {
        var _$exec = /^([^<>=]+)(<|>|<=|>=|==|=)?/.exec(key),
            _$exec2 = _slicedToArray(_$exec, 3),
            field = _$exec2[1],
            _$exec2$ = _$exec2[2],
            op = _$exec2$ === undefined ? '=' : _$exec2$;

        var value = whereAnd[key];
        return queryable.where(field, op === '=' ? '==' : op, value);
      }, queryable);

      if (whereOr.length) {
        whereOr.forEach(function (or) {
          create(q).where(or).bind(callback);
        });
      } else {
        callback(q);
      }
    },
    where: function where() {
      for (var _len = arguments.length, conditions = Array(_len), _key = 0; _key < _len; _key++) {
        conditions[_key] = arguments[_key];
      }

      conditions.forEach(function (condition) {
        Object.keys(condition).forEach(function (key) {
          key = key.replace(/\s+/g, '');
          var value = condition[key];
          if (key === 'or') {
            if (!(value instanceof Array)) {
              value = Object.entries(value).map(function (entry) {
                return _defineProperty({}, entry[0], entry[1]);
              });
            }
            whereOr.push.apply(whereOr, _toConsumableArray(value));
          } else {
            if (value instanceof Array) {
              whereOr.push.apply(whereOr, _toConsumableArray([].map.call(value, function (value) {
                return _defineProperty({}, key, value);
              })));
            } else {
              Object.assign(whereAnd, _defineProperty({}, key, value));
            }
          }
        });
      });
      return this;
    },
    orderBy: function orderBy(fields) {
      Object.keys(fields).forEach(function (field) {
        return _orderBy.push([field, fields[field]]);
      });
      return this;
    },

    get: function get(options) {
      var _this = this;

      return new Promise(function (resolve, reject) {
        var promises = [];
        _this.bind(function (queryable) {
          if (_limit) {
            queryable = queryable.limit(_limit);
          }
          if (_orderBy.length) {
            queryable = _orderBy.reduce(function (queryable, order) {
              return queryable.orderBy.apply(queryable, _toConsumableArray(order));
            }, queryable);
          }
          promises.push(queryable.get(options));
        });

        Promise.all(promises).then(function (results) {
          var docs = {};
          var count = 0;
          results.some(function (result) {
            result.forEach(function (doc) {
              if (_limit && count >= _limit) return;
              if (!(doc.id in docs)) {
                count++;
              }
              docs[doc.id] = doc;
            });
            return _limit && count >= _limit;
          });
          resolve(Object.values(docs));
        }, reject);
      });
    }
  };
}
//# sourceMappingURL=index.js.map