'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.default = create;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var keyRegex = /^\s*([^<>=\s]+)\s*(<>|<|>|<=|>=|==|=)?\s*$/;
var specialFields = {
  '@id': '__name__'
};

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

var isNotEqualOp = function isNotEqualOp(op) {
  return op.endsWith('<>') || op.endsWith('!=') || op.endsWith('!==');
};

var translateField = function translateField(field) {
  return specialFields[field] || field;
};
var translateValue = function translateValue(field, value) {
  return field === '@id' ? String(value) : value;
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
        } else {
          result.push({ field: field, type: op, value: value });
        }
      }
    }
  });
  return result;
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
  var _where = [];
  var unsubscribes = [];
  var _limit = 0;
  var lastGet = void 0,
      lastDocs = void 0;
  var compiledQueries = void 0;

  function processResults(results) {
    var docs = {};
    var count = 0;
    lastDocs = results.map(function (result) {
      return result ? result.docs[result.docs.length - 1] : undefined;
    });
    results.some(function (result) {
      if (!result) return;
      result.forEach(function (doc) {
        if (_limit && count >= _limit) return;
        if (!(doc.id in docs)) {
          count++;
        }
        docs[doc.id] = doc;
      });
      return _limit && count >= _limit;
    });
    return Object.values(docs);
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

  function buildQueries(noCache) {
    if (!noCache && compiledQueries) return compiledQueries;

    // should copy where before process
    var posible = findAllPossibles(JSON.parse(JSON.stringify({
      type: 'and',
      children: _where
    })));

    return compiledQueries = posible.map(function (p) {
      return p.reduce(function (q, node) {
        if (_limit) {
          q = q.limit(_limit);
        }
        return _orderBy.reduce(function (q, order) {
          return q.orderBy.apply(q, _toConsumableArray(order));
        }, q).where(translateField(node.field), node.type, translateValue(node.field, node.value));
      }, queryable);
    });
  }

  return {
    limit: function limit(count) {
      _limit = count;
      return this;
    },
    subscribe: function subscribe(options, callback) {
      if (options instanceof Function) {
        callback = options;
        options = {};
      }
      unsubscribes.push.apply(unsubscribes, _toConsumableArray(buildQueries().map(function (queryable) {
        return queryable.onSnapshot(options, callback);
      })));
      return this;
    },
    unsubscribeAll: function unsubscribeAll() {
      var copyOfUnsubscribes = unsubscribes.slice();
      unsubscribes.length = 0;
      copyOfUnsubscribes.forEach(function (unsubscribe) {
        return unsubscribe();
      });
      return this;
    },
    where: function where() {
      for (var _len = arguments.length, conditions = Array(_len), _key = 0; _key < _len; _key++) {
        conditions[_key] = arguments[_key];
      }

      conditions.forEach(function (condition) {
        return _where.push.apply(_where, _toConsumableArray(parseCondition(condition)));
      });
      lastGet = lastDocs = compiledQueries = undefined;
      return this;
    },
    orderBy: function orderBy(fields) {
      Object.keys(fields).forEach(function (field) {
        return _orderBy.push([field, fields[field]]);
      });
      return this;
    },

    get: function get() {
      var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          source = _ref3.source;

      var promises = buildQueries().map(function (queryable) {
        return queryable.get(source);
      });
      return lastGet = Promise.all(promises).then(processResults);
    },
    next: function next() {
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
    },
    set: function set(docsOrData, applyToResultSet) {
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
    },
    update: function update(docsOrData, applyToResultSet) {
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
    },
    remove: function remove() {
      return modify(this.get(), function (batch, doc) {
        return batch.delete(doc.ref);
      });
    }
  };
}

Object.assign(create, {
  fields: function fields(newSpecialFields) {
    Object.assign(specialFields, newSpecialFields);
    return this;
  }
});
//# sourceMappingURL=index.js.map