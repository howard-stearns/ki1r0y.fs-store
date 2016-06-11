# ki1r0y.fs-store

A very simple file-based document store for (mostly) json.

Intended for large numbers (millions) of small documents. **HOWEVER: This version puts all the documents of a collection into the same directory. That puts a file-system-dependent limit on the number of documents in a collection.**  There is no memory cache and no (known) memory leaks.

Access is asynchronous, with standard NodeJS callbacks. Data read-write integrity is provided for overlapping aysnchronous requests, but only within the application. I.e., read/write data integrity is not guaranteed between other processes using the same underlying files, or even separate processes using fs-store.

Results are undefined if an external program modifies json files with corrupt json.

No protection is given for having too many open files. The application should limit parallel requests as needed.

A _collectionName_ is a string naming a directory in the file system. Missing directories will be created as needed. A _documentName_ is a _collectionName_ followed by ```path.sep``` and a _documentId_ that must be unique within the collection. Both have the same case sensitivity and character requirements as the file system. (For portability, case-insenstive a _collectionName_ and _documentName_ is required.)

## Document Operations

```javascript
getBuffer(documentName, callback)
get(documentName, callback)
getWithModificationTime(documentName, callback)
```
Invoke ```callback(error, contentBuffer)```, ```callback(error, contentData)```, ```callback(error, contentData, DateTime)```, respectively. Here _contentBuffer_ is as by ```fs.readFile```, and _contentData_ is the result of ```JSON.parse``` of the _contentBuffer_.

```javascript
setBuffer(documentName, contentBuffer, callback)
set(documentName, contentData, callback)
```
Invoke ```callback(error)``` after storing _contentBuffer_ or _contentData_ at the specified _documentName_, respectively.

```javascript
update(documentName, defaultValue, transformer, callback)
```
Invokes ```transformer(oldData, writerFunction)``` on the contents of the document, where _oldData_ is the parsed content of _documentName_ if the document exists, else _defaultValue_.
The transformer must in turn call ```writerFunction(error, newData, optionalResult)```, which will leave _newData_ as the sole content of the file
unless _newData_ is ```undefined``` or _error_ is truthy, in which case no change is made to the document.
(The _writerFunction_ may be called synchronously. I.e., there is not need to delay it with ```setImmediate```, etc.)
Finally, ```callback(error, optionalResult)``` is invoked.


```javascript
rename(sourcePathname, documentName, callback)
exists(documentName, callback)
destroy(documentName, callback)
```
These have the same semantics as ```fs.rename```, ```fs.exists```, and ```fs.unlink```, except that they operate on _documentName_ (e.g., creating missing directories).

```javascript
ensure(documentName, callback)
```
Ensures that a document exists at _documentName_, without modifying any existing document there. However, it is not specified whether the modification time (as reported by ```getWithModificationTime```) of an existing document is updated. 

## Collection Operations

```javascript
ensureCollection(collectionName, callback)
destroyCollection(collectionName, callback)
```
Like ```ensure``` and ```destroy```, but for collections. In both cases, the collection need not be empty.

```javascript
iterateIdentifiers(collectionName, iterator, callback)
iterateDocuments(collectionName, iterator, callback)
```
Invoke ```iterator(doc, documentId, cb)``` on each document in the collection, in an unspecified order (and which may be in parallel).
The _doc_ is either the _documentName_ or the _contentData_, respectively.
The _iterator_ must call ```cb(error)```, and it must do so asynchronously (e.g., using ```setImmediate```, ```nextTick``` or similar if necessary). 
Per-document read/write consistency is guaranteed during the execution of each iterator. However, there are no guarantees on timeliness of coordination between iterator and additions/removals to the collection.

## Other Operations

```javascript
doesNotExist(error)
```
Answers ```true``` iff the specified document does not exist, where _error_ is as above.
