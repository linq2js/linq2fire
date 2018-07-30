const keyRegex = /^([^<>=]+)(<|>|<=|>=|==|=)?/;
const specialFields = {
  '@id': '__name__'
};

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

const isNotEqualOp = op => {
  return op.endsWith('<>') || op.endsWith('!=') || op.endsWith('!==');
};

const translateField = field => specialFields[field] || field;
const translateValue = (field, value) =>
  field === '@id' ? String(value) : value;

export default function create(queryable, collection) {
  if (queryable.collection) {
    if (collection) {
      queryable = queryable.collection(collection);
    } else {
      return dbWrapper(queryable);
    }
  }
  const orderBy = [];
  const whereAnd = {};
  const whereOr = [];
  let limit = 0;
  let lastGet, lastDocs;

  function bind(callback) {
    let q = Object.keys(whereAnd).reduce((queryable, key) => {
      const [, field, op = '='] = keyRegex.exec(key);
      const value = whereAnd[key];
      return queryable.where(
        translateField(field),
        op === '=' ? '==' : op,
        translateValue(field, value)
      );
    }, queryable);

    if (whereOr.length) {
      whereOr.forEach(or => {
        create(q)
          .where(or)
          .bind(callback);
      });
    } else {
      callback(q);
    }
  }

  function buildQueries() {
    const queries = [];
    bind(queryable => {
      if (limit) {
        queryable = queryable.limit(limit);
      }
      if (orderBy.length) {
        queryable = orderBy.reduce(
          (queryable, order) => queryable.orderBy(...order),
          queryable
        );
      }
      queries.push(queryable);
    });

    return queries;
  }

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

  return {
    limit(count) {
      limit = count;
      return this;
    },
    bind,
    where(...conditions) {
      conditions.forEach(condition => {
        Object.keys(condition).forEach(key => {
          let value = condition[key];
          key = key.replace(/\s+/g, '');
          if (key === 'or') {
            if (!(value instanceof Array)) {
              value = Object.entries(value).map(entry => ({
                [entry[0]]: entry[1]
              }));
            }
            whereOr.push(...value);
          } else {
            const notEqualOp = isNotEqualOp(key);

            if (value instanceof Array) {
              if (notEqualOp) {
                // process not in operator
              } else {
                whereOr.push(
                  ...[].map.call(value, value => ({ [key]: value }))
                );
              }
            } else {
              if (notEqualOp) {
                const [, field] = keyRegex.exec(key);
                whereOr.push(
                  { [field + '<']: value },
                  { [field + '>']: value }
                );
              } else {
                Object.assign(whereAnd, { [key]: value });
              }
            }
          }
        });
      });
      return this;
    },
    orderBy(fields) {
      Object.keys(fields).forEach(field =>
        orderBy.push([field, fields[field]])
      );
      return this;
    },
    get: function get({ source } = {}) {
      const promises = buildQueries().map(queryable => queryable.get(source));
      return (lastGet = Promise.all(promises).then(processResults));
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
    set(id, data) {
      // create multiple document
      if (arguments.length === 1) {
        const multipleDocData = id;
        return Promise.all(
          Object.keys(multipleDocData).map(id =>
            queryable.doc(String(id)).set(multipleDocData[id])
          )
        );
      }
      return queryable.doc(String(id)).set(data);
    },
    update(data) {
      return this.get().then(docs => {
        return Promise.all(
          docs.map(doc => {
            return doc.ref.set(data);
          })
        );
      });
    },
    remove() {
      return this.get().then(docs => {
        return Promise.all(
          docs.map(doc => {
            return doc.ref.delete();
          })
        );
      });
    }
  };
}

Object.assign(create, {
  fields(newSpecialFields) {
    Object.assign(specialFields, newSpecialFields);
    return this;
  }
});
