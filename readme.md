# Linq2Fire

Supports special operators: IN, OR, !=, startsWith (^=) and many more

```js
import linq from 'linq2fire';
const db = firebase.firestore();


const printDocs = heading => docs => {
  console.log('**********', heading.toUpperCase(), '**********');
  docs.forEach(doc => console.log(doc.id, doc.data()));
  console.log();
};

const test = async () => {
  const $todos = linq(db).from('todos');

  await $todos.remove();

  // add single doc
  await $todos.set(1, {
    text: 'Task 1'
  });
  // add multiple docs
  await $todos.set({
    1: {
      text: 'Task 1',
      category: 'A'
    },
    2: {
      text: 'Task 2',
      category: 'B'
    },
    3: {
      text: 'Task 3'
    },
    4: {
      text: 'Task 4',
      category: 'B'
    },
    5: {
      text: 'Task 5',
      category: 'A'
    },
    6: {
      text: 'Other task',
      category: 'C'
    }
  });

  await $todos
    .where({
      'text ^=': 'Task'
    })
    .get()
    .then(printDocs('Find all tasks which starts with Task'));

  await $todos
    .orderBy({ text: 'desc' })
    .first()
    .then(first => {
      console.log('Get first task ', first && first.data());
    });

  await $todos
    .where({
      // in operator
      text: ['Task 1', 'Task 2']
    })
    .get()
    .then(printDocs('Find tasks: 1, 2, 3'));

  await $todos
    .where({
      'text <': 'Task 2'
    })
    .get()
    .then(printDocs('Find all tasks which has text less than Task 2'));

  await $todos
    .where({
      // not equal
      'text <>': 'Task 1'
    })
    .get()
    .then(printDocs('Find all tasks which has text not equal Task 1'));

  await $todos
    .where({
      // find by id
      '@id': 1
    })
    .get()
    .then(printDocs('Find task by id'));

  await $todos
    .where({
      // multiple IN operators
      text: ['Task 1', 'Task 2', 'Task 3'],
      category: ['A', 'B']
    })
    .get()
    .then(printDocs('Find task with multiple IN operators'));

  await $todos
    .where({
      text: ['Task 1', 'Task 2', 'Task 3'],
      or: [{ category: 'A' }, { category: 'B' }]
    })
    .get()
    .then(printDocs('Find task with OR operator '));

  // get task names
  await $todos
    .select({ text: 'name' })
    .get()
    .then(console.log);

  // join all items using pipe
  await $todos
    .select(true, 'text')
    .pipe(String)
    .get()
    .then(console.log);

  // convert task names to uppercase
  await $todos
    .select(true, 'text')
    .map('toUpperCase')
    .get()
    .then(console.log);

  await $todos
    .select(true, 'text')
    .map(x => x.toUpperCase())
    .get()
    .then(console.log);

  await $todos
    .select(true, 'text')
    .get()
    .then(console.log);

  await $todos
    .where({
      or: {
        category: 'A',
        text: 'Task 3'
      }
    })
    .get()
    .then(printDocs('Find task with OR operator '));

  // support pagination
  const pagination = $todos
    .limit(1)
    .orderBy({
      text: 'asc'
    })
    .where({
      'text <>': 'Task 1'
    });

  await pagination
    .get()
    .then(printDocs('Find all tasks which has text not equal Task 1. Page 1'));

  await pagination
    .next()
    .then(printDocs('Find all tasks which has text not equal Task 1. Page 2'));
  await pagination
    .next()
    .then(printDocs('Find all tasks which has text not equal Task 1. Page 3'));
};

test();
```

## References:

### linq2fire(db):LinqDb
Create a linq object to wrap db

### LinqDb.from(collectionName): LinqCollection
Create a linq object to wrap collection

### LinqDb.from(collection, callback): LinqDb
Create a linq object to wrap collection, then pass it to callback. This method is useful for chaining calls

### linq2fire(collection): LinqCollection
Create a linq object to wrap collection

### LinqCollection.select(fieldName1: String, fieldName2: String, ...): LinqCollection
Projects each item of a result set into a new object with specific fields.

### LinqCollection.select(fieldMap: Object): LinqCollection
Projects each item of a result set into a new object with specific fields.

### LinqCollection.select(valueOnly: Boolean, field: String): LinqCollection
Transform result set into a array of field value

### LinqCollection.select(customSelector: Function(data: Object, doc: DocumentSnapshot)): LinqCollection
Projects each item of a result set by using custom selector.

### LinqCollection.limit(count): LinqCollection
Limit result set

### LinqCollection.where(conditions): LinqCollection
Filter result set by multiple conditions { text: 'abc', 'age >': 100, fieldValueMustBeIn: [1, 2, 3, 4, 5], 'field <>': 0 }
Support operators: >, <, >=, <=, =, ==, ===, <>, !=, !==

### LinqCollection.orderBy(fields): LinqCollection
Sort result set by specified fields { field1: 'asc', field2: 'desc' }

### LinqCollection.get(options): Promise
Get all documents which is satisfied query condition

### LinqCollection.next(options): Promise
Get next result set which starts after last result set

### LinqCollection.set(docsOrData, applyToResultSet): Promise

### LinqCollection.update(docsOrData, applyToResultSet): Promise

### LinqCollection.remove(): Promise
Remove all documents which is satisfied query condition