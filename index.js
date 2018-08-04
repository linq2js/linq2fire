const keyRegex = /^\s*([^<>=\s]+)\s*(<>|<|>|<=|>=|==|=)?\s*$/;
const specialFields = {
  '@id': '__name__'
};
const arrayMethods = 'slice reduce map filter'.split(/\s+/);
const copy = Symbol('copy');
const dbWrapper = db => {
  return {
    from(collection, callback) {
      const col = create(db.collection(collection));
      if (arguments.length < 2) {
        return col;
      }
      callback(col);
      return this;
    }
  };
};

const translateField = field => specialFields[field] || field;
const translateValue = (field, value) =>
  field === '@id' ? String(value) : value;

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
const findAllPossibles = root => {
  function traverse(node, callback, parent, index) {
    if (callback(node, parent, index)) return true;
    if (node.children && node.children.length) {
      node.children.some((child, childIndex) =>
        traverse(child, callback, node, childIndex)
      );
    }
  }

  const orNodes = [];

  // create indexes
  traverse(root, (node, parent, index) => {
    node.parent = () => parent;
    if (node.type === 'or') {
      node.id = orNodes.length;
      node.__children = node.children;
      node.childIndex = 0;
      orNodes.push(node);
    }
  });
  const result = [];
  let posible;
  while (true) {
    traverse(root, node => {
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
    let increased = false;
    // increase possible number
    for (let i = 0; i < orNodes.length; i++) {
      // can increase
      const node = orNodes[i];
      if (node.childIndex + 1 < node.__children.length) {
        node.childIndex++;
        // reset prev nodes
        orNodes.slice(0, i).forEach(node => (node.childIndex = 0));
        increased = true;
        break;
      }
    }
    if (!increased) break;
  }

  return result;
};

const parseCondition = condition => {
  const result = [];
  Object.keys(condition).forEach(key => {
    const value = condition[key];
    if (key === 'or') {
      const children = [];
      if (value instanceof Array) {
        children.push(...value);
      } else {
        Object.keys(value).forEach(field => {
          children.push({ [field]: value[field] });
        });
      }

      result.push({
        type: 'or',
        children: children.map(child => ({
          type: 'and',
          children: parseCondition(child)
        }))
      });
    } else {
      // parse normal criteria
      let [, field, op = '=='] = keyRegex.exec(key) || [];
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
          children: value.map(value => ({ field, type: op, value }))
        });
      } else {
        if (op === '<>' || op === '!=' || op === '!==') {
          result.push({
            type: 'or',
            children: [{ field, type: '>', value }, { field, type: '<', value }]
          });
        } else {
          result.push({ field, type: op, value });
        }
      }
    }
  });
  return result;
};

export default function create(queryable, collection) {
  if (queryable.collection) {
    if (collection) {
      queryable = queryable.collection(collection);
    } else {
      return dbWrapper(queryable);
    }
  }
  const unsubscribes = [];
  let limit = 0;
  let startAt;
  let orderBy = [];
  let where = [];
  let lastGet, lastDocs;
  let compiledQueries;

  function processResults(results) {
    const docs = {};
    let count = 0;
    lastDocs = results.map(
      result => (result ? result.docs[result.docs.length - 1] : undefined)
    );
    results.some(result => {
      if (!result) return;
      result.forEach(doc => {
        if (limit && count >= limit) return;
        if (!(doc.id in docs)) {
          count++;
        }
        docs[doc.id] = doc;
      });
      return limit && count >= limit;
    });
    return Object.values(docs);
  }

  function modify(docs, callback) {
    return Promise.resolve(docs).then(docs => {
      const batch = queryable.firestore.batch();
      for (let doc of docs) {
        callback(batch, doc);
      }
      return batch.commit();
    });
  }

  function buildQueries(noCache) {
    if (!noCache && compiledQueries) return compiledQueries;

    if (!where.length) {
      let q = queryable;
      if (limit) {
        q = q.limit(limit);
      }
      if (startAt !== undefined) {
        q = q.startAt(startAt);
      }

      return [orderBy.reduce((q, order) => q.orderBy(...order), q)];
    }

    // should copy where before process
    const posible = findAllPossibles(
      JSON.parse(
        JSON.stringify({
          type: 'and',
          children: where
        })
      )
    );

    return (compiledQueries = posible.map(p => {
      return p.reduce((q, node) => {
        if (limit) {
          q = q.limit(limit);
        }
        if (startAt !== undefined) {
          q = q.startAt(startAt);
        }
        return orderBy
          .reduce((q, order) => q.orderBy(...order), q)
          .where(
            translateField(node.field),
            node.type,
            translateValue(node.field, node.value)
          );
      }, queryable);
    }));
  }

  function clone(overwriteData) {
    return create(queryable)[copy](
      Object.assign(
        {
          limit,
          where,
          orderBy,
          startAt
        },
        overwriteData
      )
    );
  }

  const query = {
    [copy](data) {
      limit = data.limit;
      where = data.where;
      orderBy = data.orderBy;
      startAt = data.startAt;
      return this;
    },
    subscribe(options, callback) {
      if (options instanceof Function) {
        callback = options;
        options = {};
      }
      unsubscribes.push(
        ...buildQueries().map(queryable =>
          queryable.onSnapshot(options, callback)
        )
      );
      return this;
    },
    unsubscribeAll() {
      const copyOfUnsubscribes = unsubscribes.slice();
      unsubscribes.length = 0;
      copyOfUnsubscribes.forEach(unsubscribe => unsubscribe());
      return this;
    },
    limit(count) {
      return clone({ limit: count });
    },
    first() {
      return this.limit(1)
        .get()
        .then(results => {
          return results[0];
        });
    },
    where(...conditions) {
      const newWhere = where.slice();
      conditions.forEach(condition =>
        newWhere.push(...parseCondition(condition))
      );
      return clone({
        where: newWhere
      });
    },
    orderBy(fields) {
      const newOrderBy = orderBy.slice();
      Object.keys(fields).forEach(field =>
        newOrderBy.push([field, fields[field]])
      );
      return clone({
        orderBy: newOrderBy
      });
    },
    get: function get({ source } = {}) {
      const promises = buildQueries().map(queryable => queryable.get(source));
      return (lastGet = Promise.all(promises).then(processResults));
    },
    data(options) {
      return this.get(options).then(results => results.map(x => x.data()));
    },
    next(options = {}) {
      const { source } = options;
      if (lastGet) {
        return (lastGet = lastGet.then(docs => {
          if (!docs.length) return [];
          const queries = buildQueries();
          const promises = queries.map((queryable, index) => {
            if (!lastDocs[index]) return undefined;
            return queryable.startAfter(lastDocs[index]).get(source);
          });
          return Promise.all(promises).then(processResults);
        }));
      }
      return this.get(options);
    },
    set(docsOrData, applyToResultSet) {
      if (applyToResultSet) {
        return modify(this.get(), (batch, doc) =>
          batch.set(doc.ref, docsOrData)
        );
      }
      return modify(
        Object.keys(docsOrData).map(id => queryable.doc(String(id))),
        (batch, doc) => batch.set(doc, docsOrData[doc.id])
      );
    },
    update(docsOrData, applyToResultSet) {
      if (applyToResultSet) {
        return modify(this.get(), (batch, doc) =>
          batch.update(doc.ref, docsOrData)
        );
      }
      return modify(
        Object.keys(docsOrData).map(id => queryable.doc(String(id))),
        (batch, doc) => batch.update(doc, docsOrData[doc.id])
      );
    },
    remove() {
      return modify(this.get(), (batch, doc) => batch.delete(doc.ref));
    }
  };

  arrayMethods.forEach(method => {
    query[method] = (...args) =>
      query.get().then(results => results[method](...args));
  });

  return query;
}

Object.assign(create, {
  fields(newSpecialFields) {
    Object.assign(specialFields, newSpecialFields);
    return this;
  }
});
