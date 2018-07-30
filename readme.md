# Linq2Fire
Supports OR and IN operators for firestore DB. Zero Dependency

```js
import linq from 'linq2fire';
linq(db)
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
  .then(docs => docs.forEach(doc => console.log(doc.id, doc.data())));
```