'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = create;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var keyRegex = /^\s*([^^<>=\s]+)\s*(<>|<|>|<=|>=|==|=|\^=)?\s*$/;
var specialFields = {
  '@id': '__name__'
};
var arrayMethods = 'slice reduce filter some every'.split(/\s+/);
var copy = '__copy__';
var dbWrapper = function dbWrapper(db) {
  return {
    from: function from(collection, callback) {
      var col = create(db.collection(collection));
      if (arguments.length < 2) {
        return col;
      }
      callback(col);
      return this;
    }
  };
};
var deepClone = function deepClone(obj) {
  var clone = Object.assign({}, obj);
  Object.keys(clone).forEach(function (key) {
    return clone[key] = _typeof(obj[key]) === 'object' ? deepClone(obj[key]) : obj[key];
  });
  return Array.isArray(obj) ? (clone.length = obj.length) && Array.from(clone) : clone;
};
var translateField = function translateField(field) {
  return specialFields[field] || field;
};
var translateValue = function translateValue(field, value) {
  return field === '@id' ? String(value) : value;
};
var cloneNode = function cloneNode(node) {
  return Object.assign({}, node, {
    children: node.children ? node.children.map(cloneNode) : undefined
  });
};
/**
 * algorithm:
 * collect all or node, then put them into the list
 * each or node contains childIndex (from 0 - number of child)
 * we perform infinite loop until no child index can be increased
 * for sample:
 *  A (2) B (3)  are nodes and its chid number (number insde parentheses)
 *  0     0 are values/child indexes
 * for each child index, if we can incease it by 1, we reset prev indexes to 0,
 * unless we try to increase next child index,
 * if no child index can be increased the loop is end
 *  A  B
 *  0  0
 *  1  0
 *  0  1
 *  1  1
 *  0  2
 *  1  2
 *  totally 6 possible generated
 */
var findAllPossibles = function findAllPossibles(root) {
  root = cloneNode(root);
  function traverse(node, callback, parent, index) {
    if (callback(node, parent, index)) return true;
    if (node.children && node.children.length) {
      node.children.some(function (child, childIndex) {
        return traverse(child, callback, node, childIndex);
      });
    }
  }

  var orNodes = [];

  // create indexes
  traverse(root, function (node, parent, index) {
    node.parent = function () {
      return parent;
    };
    if (node.type === 'or') {
      node.id = orNodes.length;
      node.__children = node.children;
      node.childIndex = 0;
      orNodes.push(node);
    }
  });
  var result = [];
  var posible = void 0;
  while (true) {
    traverse(root, function (node) {
      if (node.type === 'or') {
        node.children = [node.__children[node.childIndex]];
      }
      if (node.type !== 'or' && node.type !== 'and') {
        if (!posible) {
          posible = [];
          result.push(posible);
        }
        posible.push(node);
      }
    });
    posible = null;
    var increased = false;
    // increase possible number
    for (var i = 0; i < orNodes.length; i++) {
      // can increase
      var node = orNodes[i];
      if (node.childIndex + 1 < node.__children.length) {
        node.childIndex++;
        // reset prev nodes
        orNodes.slice(0, i).forEach(function (node) {
          return node.childIndex = 0;
        });
        increased = true;
        break;
      }
    }
    if (!increased) break;
  }

  return result;
};

var parseCondition = function parseCondition(condition) {
  var result = [];
  Object.keys(condition).forEach(function (key) {
    var value = condition[key];
    if (key === 'or') {
      var children = [];
      if (value instanceof Array) {
        children.push.apply(children, _toConsumableArray(value));
      } else {
        Object.keys(value).forEach(function (field) {
          children.push(_defineProperty({}, field, value[field]));
        });
      }

      result.push({
        type: 'or',
        children: children.map(function (child) {
          return {
            type: 'and',
            children: parseCondition(child)
          };
        })
      });
    } else {
      // parse normal criteria
      var _ref = keyRegex.exec(key) || [],
          _ref2 = _slicedToArray(_ref, 3),
          field = _ref2[1],
          _ref2$ = _ref2[2],
          op = _ref2$ === undefined ? '==' : _ref2$;

      if (!field) {
        throw new Error('Invalid criteria ' + key);
      }
      if (op === '=' || op === '===') {
        op = '==';
      }
      if (value instanceof Array) {
        if (op !== '==') {
          throw new Error('Unsupported ' + op + ' for Array');
        }
        result.push({
          type: 'or',
          children: value.map(function (value) {
            return { field: field, type: op, value: value };
          })
        });
      } else {
        if (op === '<>' || op === '!=' || op === '!==') {
          result.push({
            type: 'or',
            children: [{ field: field, type: '>', value: value }, { field: field, type: '<', value: value }]
          });
        }
        // process startsWith operator
        else if (op === '^=') {
            value = String(value);
            var length = value.length;
            var frontCode = value.slice(0, length - 1);
            var endChar = value.slice(length - 1, value.length);
            var endcode = frontCode + String.fromCharCode(endChar.charCodeAt(0) + 1);
            result.push({ field: field, type: '>=', value: value }, { field: field, type: '<', value: endcode });
          } else {
            result.push({ field: field, type: op, value: value });
          }
      }
    }
  });
  return result;
};

function create(queryable, collection) {
  var _query;

  if (queryable.collection) {
    if (collection) {
      queryable = queryable.collection(collection);
    } else {
      return dbWrapper(queryable);
    }
  }
  var unsubscribes = [];
  var limit = 0;
  var startAt = void 0;
  var _orderBy = void 0;
  var _where = [];
  var lastGet = void 0,
      lastDocs = void 0;
  var compiledQueries = void 0;
  var select = [];
  var _pipe = [];
  var _map = [];

  function processResults(results) {
    var docs = {};
    var count = 0;
    lastDocs = results.map(function (result) {
      return result ? result.docs[result.docs.length - 1] : undefined;
    });
    results.some(function (result) {
      if (!result) return;
      result.forEach(function (doc) {
        if (limit && count >= limit) return;
        if (!(doc.id in docs)) {
          count++;
        }
        docs[doc.id] = doc;
      });
      return limit && count >= limit;
    });

    var result = Object.values(docs);

    if (select.length) {
      result = result.map(function (doc) {
        return select.reduce(function (mappedObj, selector) {
          return selector(mappedObj, doc.data(), doc);
        }, {});
      });
    }

    if (_map.length) {
      result = _map.reduce(function (result, mapper) {
        return result.map(function (item, index) {
          return mapper instanceof Function ? mapper(item, index) : item[mapper]();
        });
      }, result);
    }

    if (_pipe.length) {
      result = _pipe.reduce(function (result, f) {
        return f(result);
      }, result);
    }

    return result;
  }

  function modify(docs, callback) {
    return Promise.resolve(docs).then(function (docs) {
      var batch = queryable.firestore.batch();
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = docs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var doc = _step.value;

          callback(batch, doc);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return batch.commit();
    });
  }

  function createOrderedQuery(q) {
    if (!_orderBy) return q;
    var pairs = Object.entries(_orderBy);
    return pairs.reduce(function (q, order) {
      return q.orderBy.apply(q, _toConsumableArray(order));
    }, q);
  }

  function buildQueries(noCache) {
    if (!noCache && compiledQueries) return compiledQueries;

    if (!_where.length) {
      var q = queryable;
      if (limit) {
        q = q.limit(limit);
      }
      if (startAt !== undefined) {
        q = q.startAt(startAt);
      }

      return [createOrderedQuery(q)];
    }

    // should copy where before process
    var posible = findAllPossibles({
      type: 'and',
      children: _where
    });

    return compiledQueries = posible.map(function (p) {
      var q = p.reduce(function (q, node) {
        return q.where(translateField(node.field), node.type, translateValue(node.field, node.value));
      }, queryable);

      if (limit) {
        q = q.limit(limit);
      }
      if (startAt !== undefined) {
        q = q.startAt(startAt);
      }

      return createOrderedQuery(q);
    });
  }

  function clone(overwriteData) {
    return create(queryable)[copy](Object.assign({
      limit: limit,
      where: _where,
      orderBy: _orderBy,
      startAt: startAt,
      select: select,
      pipe: _pipe,
      map: _map
    }, overwriteData));
  }

  var query = (_query = {}, _defineProperty(_query, copy, function (data) {
    limit = data.limit;
    _where = data.where;
    _orderBy = data.orderBy;
    startAt = data.startAt;
    select = data.select;
    _pipe = data.pipe;
    _map = data.map;
    return this;
  }), _defineProperty(_query, 'pipe', function pipe() {
    for (var _len = arguments.length, funcs = Array(_len), _key = 0; _key < _len; _key++) {
      funcs[_key] = arguments[_key];
    }

    return clone({
      pipe: _pipe.slice().concat(funcs)
    });
  }), _defineProperty(_query, 'map', function map() {
    for (var _len2 = arguments.length, mappers = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      mappers[_key2] = arguments[_key2];
    }

    return clone({
      map: _map.slice().concat(mappers)
    });
  }), _defineProperty(_query, 'subscribe', function subscribe(options, callback) {
    if (options instanceof Function) {
      callback = options;
      options = {};
    }
    unsubscribes.push.apply(unsubscribes, _toConsumableArray(buildQueries().map(function (queryable) {
      return queryable.onSnapshot(options, callback);
    })));
    return this;
  }), _defineProperty(_query, 'unsubscribeAll', function unsubscribeAll() {
    var copyOfUnsubscribes = unsubscribes.slice();
    unsubscribes.length = 0;
    copyOfUnsubscribes.forEach(function (unsubscribe) {
      return unsubscribe();
    });
    return this;
  }), _defineProperty(_query, 'select', function select() {
    var selector = void 0;
    // single field value selector

    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    if (args[0] === true) {
      var field = args[1];
      selector = function selector(mappedObj, data, doc) {
        return field === '@id' ? doc.id : data[field];
      };
    } else if (args[0] instanceof Function) {
      var customSelector = args[0];
      selector = function selector(mappedObj, data, doc) {
        return customSelector(data, doc);
      };
    } else if (typeof args[0] === 'string') {
      var fields = args;
      selector = function selector(mappedObj, data, doc) {
        fields.forEach(function (field) {
          return mappedObj[field] = field === '@id' ? doc.id : data[field];
        });
        return mappedObj;
      };
    } else {
      var pairs = Object.entries(args[0]);
      selector = function selector(mappedObj, data, doc) {
        pairs.forEach(function (pair) {
          return mappedObj[pair[1]] = pair[0] === '@id' ? doc.id : data[pair[0]];
        });
        return mappedObj;
      };
    }
    return clone({
      select: [selector]
    });
  }), _defineProperty(_query, 'limit', function limit(count) {
    return clone({ limit: count });
  }), _defineProperty(_query, 'first', function first() {
    return this.limit(1).get().then(function (results) {
      return results[0];
    });
  }), _defineProperty(_query, 'where', function where() {
    var newWhere = _where.slice();

    for (var _len4 = arguments.length, conditions = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      conditions[_key4] = arguments[_key4];
    }

    conditions.forEach(function (condition) {
      return newWhere.push.apply(newWhere, _toConsumableArray(parseCondition(condition)));
    });
    return clone({
      where: newWhere
    });
  }), _defineProperty(_query, 'orderBy', function orderBy(fields) {
    return clone({
      orderBy: Object.assign({}, _orderBy, fields)
    });
  }), _defineProperty(_query, 'get', function get() {
    var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        source = _ref3.source;

    var promises = buildQueries().map(function (queryable) {
      return queryable.get(source);
    });
    return lastGet = Promise.all(promises).then(processResults);
  }), _defineProperty(_query, 'data', function data(options) {
    return this.get(options).then(function (results) {
      return results.map(function (x) {
        return x.data();
      });
    });
  }), _defineProperty(_query, 'next', function next() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var source = options.source;

    if (lastGet) {
      return lastGet = lastGet.then(function (docs) {
        if (!docs.length) return [];
        var queries = buildQueries();
        var promises = queries.map(function (queryable, index) {
          if (!lastDocs[index]) return undefined;
          return queryable.startAfter(lastDocs[index]).get(source);
        });
        return Promise.all(promises).then(processResults);
      });
    }
    return this.get(options);
  }), _defineProperty(_query, 'set', function set(docsOrData, applyToResultSet) {
    if (applyToResultSet) {
      return modify(this.get(), function (batch, doc) {
        return batch.set(doc.ref, docsOrData);
      });
    }
    return modify(Object.keys(docsOrData).map(function (id) {
      return queryable.doc(String(id));
    }), function (batch, doc) {
      return batch.set(doc, docsOrData[doc.id]);
    });
  }), _defineProperty(_query, 'update', function update(docsOrData, applyToResultSet) {
    if (applyToResultSet) {
      return modify(this.get(), function (batch, doc) {
        return batch.update(doc.ref, docsOrData);
      });
    }
    return modify(Object.keys(docsOrData).map(function (id) {
      return queryable.doc(String(id));
    }), function (batch, doc) {
      return batch.update(doc, docsOrData[doc.id]);
    });
  }), _defineProperty(_query, 'remove', function remove() {
    return modify(this.get(), function (batch, doc) {
      return batch.delete(doc.ref);
    });
  }), _query);

  arrayMethods.forEach(function (method) {
    query[method] = function () {
      for (var _len5 = arguments.length, args = Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
        args[_key5] = arguments[_key5];
      }

      return query.get().then(function (results) {
        return results[method].apply(results, args);
      });
    };
  });

  return query;
}

Object.assign(create, {
  fields: function fields(newSpecialFields) {
    Object.assign(specialFields, newSpecialFields);
    return this;
  }
});
//# sourceMappingURL=index.js.map