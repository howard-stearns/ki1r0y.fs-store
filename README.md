# ki1r0y.fs-store

A very simple file-based document store for (mostly) json.

Intended for large numbers (millions) of small documents. **HOWEVER: This version puts all the documents of a collection into the same directory. That puts a file-system-dependent limit on the number of documents in a collection.**  There is no memory cache and no (known) memory leaks.

Access is asynchronous, with standard node callbacks. Data read-write integrity is provided for overlapping aysnchronous requests, but only within the application. I.e., read/write data integrity is not guaranteed between other processes using the same underlying files, or even separate processes using fs-store.

Results are undefined if an external program modifies json files with corrupt json.

A _collectionName_ is a string naming a directory in the file system. Missing directories will be created as needed. A _documentName_ is a _collectionName_ followed by path.sep and a _DocumentId_ that must be unique within the collection. Both have the same case sensitivity as the file system.

## Document Opertions

```javascript
getBuffer(documentName, callback)
get(documentName, callback)
getWithModificationTime(documentName, callback)
```
Invoke ```callback(error, contentString)```, ```callback(error, contentData)```, ```callback(error, object, DateTime)```, respectively.

```doesNotExist(error)``` is ```true``` iff the specified document does not exist.

```javascript
setBuffer(documentName, contentString, callback)
set(documentName, contentData, callback)
```
Invoke ```callback(error)``` after storing _contentString_ or _contentData_ at the specified pathname, respectively.

```javascript
update(documentName, defaultValue, transformer, callback)
```
Invokes ```transformer(oldData, writerFunction)``` on the contents of path, where _oldData_ is the parsed content fo documentPathname if the document exists, else _defaultValue_.
The transformer should in turn call ```writerFunction(error, newData, optionalResult)```, which will leave _newData_ as the sole content of the file
unless _newData_ is ```undefined``` or _error_ is truthy, in which case no change is made to the document. Finally, ```callback(error, optionalResult)``` is invoked.


```javascript
rename(sourcePathname, documentName, callback)
exists(documentName, callback)
destroy(documentName, callback)
```
These have the same semantics as ```fs.rename```, ```fs.exists```, and ```fs.unlink```, except that they operate on _documentName_ (e.g., creating missing directories).

```javascript
ensure(documentName, callback)
```
Ensures that a document exists at documentName. Does not modify any existing document there. However, it is not specified whether the modification time (as reported by ```getWithModificationTime``` of an existing document is updated.

## Collection Operations

```javascript
ensureCollection(collectionName, callback)
destroyCollection(collectionName, callback)
```
Like ```ensure``` and ```destroy```, but for collections. In both cases, the _collection_ need not be empty.

```javascript
iterateIdentifiers(collectionName, iterator, callback)
iterateDocuments(collectionName, iterator, callback)
```
Invoke ```iterator(doc, documentId, cb)``` on each document in the collection, in an unspecified order that may be in parallel.
The _doc_ is either the _documentName_ or the _contentData_, respectively.
The _iterator_ must call ```cb(error)```, and it must do so asynchronously (e.g., using ```setImmediate```, ```nextTick``` or similar if necessary). 
Per-document read/write consistency is guaranteed during the execution of each iterator. However, there are no guarantees on timeliness of coordination between iterator and additions/removals to the collection.