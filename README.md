# ki1r0y.fs-store

A very simple file-based document store for (mostly) json.

**Note: This version puts all the documents of a collection into the same directory. That puts a file-system-dependent limit on the number of documents in a collection.**

large numbers (millions) of small documents
json (and binary buffers?)
asynchronous access, including locking to ensure data integrity, but only within the application. I.e., read/write data integrity is not guaranteed between other processes using the same underlying files, or even separate processes using fs-store.

Results are undefined if an external program modifies json files with corrupt json.

no memory cache - intended for applications in which the distribution of requests gives not advantage to doing so

documentPathname has no restrictions. Missing directories will be created as needed.

Functions that accept or answer data take care of serialization/deserialization (as JSON). Functions that do not access the data (rename, touch, destroy) will work on any data (e.g., binary files).

## Document Opertions

### fs-store.getBuffer(documentPathname, callback)
### fs-store.get(documentPathname, callback)
### fs-store.getWithModificationTime(documentPathname, callback)

### fs-store.doesNotExist(error)
True if error (as produced by get, getBuffer, or getWithModificationTime) indicates that the document does not exist.

### fs-store.setBuffer(documentPathname, documentBuffer, callback)
### fs-store.set(documentPathname, document, callback)

### fs-store.update(documentPathname, transformer, defaultValue, callback)

### fs-store.rename(sourcePathname, documentPathname, callback)

### fs-store.touch(documentPathname, callback)
_alias: ensure_
Ensures that a document exists at documentPathname. Does not modify any existing document there, except that the modification time answered by getWithModificationTime is updated.


### fs-store.exists(documentPathname, callback)
### fs-store.destroy(documentPathname, callback)

## Collection Operations

### fs-store.ensureCollection(collectionDirectory, callback);
### fs-store.destroyCollection(collectionDirectory, callback);

### fs-store.iterateIdentifiers(collectionDirectory, iterator, callback)
### fs-store.iterateDocuments(collectionDirectory, iterator, callback)
Exclusive access is guaranteed during the execution of each iterator. However, there are no guarantees on timeliness of coordination between iterator and mutations of the collection.