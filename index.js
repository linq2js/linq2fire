const dbWrapper = db => {
  return {
    from(collection) {
      return create(db.collection(collection));
    }
  };
};

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
  return {
    limit(count) {
      limit = count;
      return this;
    },
    bind(callback) {
      let q = Object.keys(whereAnd).reduce((queryable, key) => {
        const [, field, op = '='] = /^([^<>=]+)(<|>|<=|>=|==|=)?/.exec(key);
        const value = whereAnd[key];
        return queryable.where(field, op === '=' ? '==' : op, value);
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
    },
    where(...conditions) {
      conditions.forEach(condition => {
        Object.keys(condition).forEach(key => {
          key = key.replace(/\s+/g, '');
          let value = condition[key];
          if (key === 'or') {
            if (!(value instanceof Array)) {
              value = Object.entries(value).map(entry => ({
                [entry[0]]: entry[1]
              }));
            }
            whereOr.push(...value);
          } else {
            if (value instanceof Array) {
              whereOr.push(...[].map.call(value, value => ({ [key]: value })));
            } else {
              Object.assign(whereAnd, { [key]: value });
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
    get: function get(options) {
      return new Promise((resolve, reject) => {
        const promises = [];
        this.bind(queryable => {
          if (limit) {
            queryable = queryable.limit(limit);
          }
          if (orderBy.length) {
            queryable = orderBy.reduce(
              (queryable, order) => queryable.orderBy(...order),
              queryable
            );
          }
          promises.push(queryable.get(options));
        });

        Promise.all(promises).then(results => {
          const docs = {};
          let count = 0;
          results.some(result => {
            result.forEach(doc => {
              if (limit && count >= limit) return;
              if (!(doc.id in docs)) {
                count++;
              }
              docs[doc.id] = doc;
            });
            return limit && count >= limit;
          });
          resolve(Object.values(docs));
        }, reject);
      });
    }
  };
}
