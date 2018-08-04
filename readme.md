# Linq2Fire

```js
import linq from 'linq2fire';
const db = firebase.firestore();


const printDocs = heading => docs => {
  console.log('**********', heading.toUpperCase(), '**********');
  docs.forEach(doc => console.log(doc.id, doc.data()));
  console.log();
};

const test = async () => {
  // linq(db)
  //   .from('todos')
  //   .subscribe(snapshot => {
  //     snapshot
  //       .docChanges()
  //       .forEach(change => console.log(change, change.doc.data()));
  //   });

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
    }
  });

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