# Linq2Fire
Zero dependency
Support operators: >, <, >=, <=, =, ==, ===, <>, !=, !==

```js
import linq from 'linq2fire';
const db = firebase.firestore();


const printDocs = heading => docs => {
  console.log('**********', heading.toUpperCase(), '**********');
  docs.forEach(doc => console.log(doc.id, doc.data()));
  console.log();
};

const test = async () => {
  await linq(db)
    .from('todos')
    .removeAll();

  // add single doc
  await linq(db)
    .from('todos')
    .set(1, {
      text: 'Task 1'
    });

  await // add multiple docs
  linq(db)
    .from('todos')
    .set({
      1: {
        text: 'Task 1'
      },
      2: {
        text: 'Task 2'
      },
      3: {
        text: 'Task 3'
      },
      4: {
        text: 'Task 4'
      }
    });

  await linq(db)
    .from('todos')
    .where({
      // in operator
      text: ['Task 1', 'Task 2'],
      // or logic
      or: {
        text: 'Task 3'
      }
    })
    .get()
    .then(printDocs('Find tasks: 1, 2, 3'));

  await linq(db)
    .from('todos', query =>
      query
        .where({
          'text <': 'Task 2'
        })
        .get()
        .then(printDocs('Find all tasks which has text less than Task 2'))
    )
    .from('todos', query =>
      query
        .where({
          'text <>': 'Task 1'
        })
        .get()
        .then(printDocs('Find all tasks which has text not equal Task 1'))
    )
    .from('todos', query =>
      query
        .where({
          '@id': 1
        })
        .get()
        .then(printDocs('Find task by id'))
    );
};

test();

```