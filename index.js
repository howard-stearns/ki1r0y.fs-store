"use strict";
/*jslint node: true, vars: true*/
/*Copyright (c) 2013-2015 Howard Stearns. MIT License*/

var path = require('path');
var fse = require('fs-extra'); // extra, to create missing directories
var fs = fse; // Just to be explicit about what is normal fs behavior vs fse.
var async = require('async');
var lock = require('ki1r0y.lock').lock;

exports.doesNotExist = function doesNotExist(error) { return error && (error.code === 'ENOENT'); };

// Should we consider using the operating system's synchronization or exclusivity utilities instead of our own locks?
function writeLockFile(path, data, cb) { // Like fs.writeFile within a lock.
    lock(path, function (unlock) {
        fse.writeFile(path, data, function (e, d) { unlock(); cb(e, d); });
    });
}
function readLockFile(path, cb) { // Like fs.readFile within a lock.
    // Would we gain anything by allowing simultaneous overlapping reads as long as there is no write?
    // (See QT's QReadWriteLock.lockForRead. Note that a waiting write lock must take precedence over newly waiting readers.)
    lock(path, function (unlock) {
        fs.readFile(path, function (e, d) { unlock(); cb(e, d); });
    });
}

exports.getBuffer = readLockFile;
exports.get = function get(path, cb) {
    readLockFile(path, function (err, json) {
        cb(err, !err && JSON.parse(json));
    });
};

// Notes on file modification times:
// We currently define creation and modification dates as defined by the server storage system, because:
// 1. express.static uses this for last-modified header (when using cache-control)
// 2. It's much less complicated than trying to handle modification time within the
//    uploaded client data, but not within the hash used to tell if something has really changed.
// 3. It's unnecessary data for uploading.
// 4. We know the time is right because it's determined by server instead of client.
// But there are drawbacks:
// 1. If use a moving (copying) data garbage collector, we would need a copy operation that would preserve
//    the file system modification time. That's tough to do with portable code. Might have to use the shell
//    touch command, which probably wouldn't scale well. As it happens, the ki1r0y garbage collector
//    merely notes (with fs-store.touch) when a file is marked, rather than making a copy.
// 2. The modification time is not preserved by: git checkout -- db-branch-name
// 3. The file modification time won't precisely match the version timestamp set by the plugin during saving.
// 
// We do not display creation time because there is no standard way to get it.
// stat.ctime is inode change time (which is useless). OSX/Darwin does report creation time with ls -lU,
// but it doesn't show up in nodejs fs.stat.
exports.getWithModificationTime = function getWithModificationTime(documentPathname, callback) {
    lock(documentPathname, function (unlock) {
        async.parallel([
            function (cb) { fs.stat(documentPathname, cb); },
            function (cb) { fs.readFile(documentPathname, cb); }
        ], function (err, results) {
            unlock();
            callback(err, !err && JSON.parse(results[1]), !err && results[0].mtime);
        });
    });
};

exports.setBuffer = writeLockFile;
exports.set = function set(path, obj, cb) {
    writeLockFile(path, JSON.stringify(obj), cb);
};

exports.update = function update(documentPathname, defaultValue, transformer, callback) {
    lock(documentPathname, function (unlock) {
        fs.readFile(documentPathname, function (eRead, contentString) {
            var cb = function (error, optionalResult) {
                unlock();
                callback(error, optionalResult);
            };
            var writerFunction = function (error, newData, optionalResult) {
                if (error) {
                    cb(error);
                } else if (newData === undefined) {
                    cb(null, optionalResult);
                } else {
                    fse.writeFile(documentPathname, JSON.stringify(newData), function (e) { cb(e, optionalResult); });
                }
            };
            if (exports.doesNotExist(eRead)) {
                transformer(defaultValue, writerFunction);
            } else if (eRead) {
                cb(eRead);
            } else {
                transformer(JSON.parse(contentString), writerFunction);
            }
        });
    });
};


// See modification time notes, above.
exports.rename = fse.rename;

// The general behavior expected for "touch" is to not alter the contents of the documentPathname being touched.
//
// The current usage in ki1r0y is more forgiving: we only need the documentPathname to exist, and the content
// could be destroyed. (We currently do not copy files from oldspace to newspace when marking for garbage collection,
// but rather we simply note in newspace that the file has been marked.) Thus fs.truncate could be used.
//
// Alas, fs.truncate doesn't create new files on Amazon linux (which ki1r0y does need).
//
// We could use the following, which concidentally does preserve any existing contents at documentPathname:
// fs.open(documentPathname, 'w', function (e, fd) { if (e) { callback(e); } else { fs.close(fd, callback); } })
//
// Alas, that doesn't missing directories as needed.
//
// Note that fs-extra.ensureFile does not update the modification time for an existing file, but we don't need that for ki1r0y.
exports.ensure = fse.ensureFile;
exports.exists = fs.exists;
exports.destroy = fs.unlink;
exports.ensureCollection = fse.ensureDir;
exports.destroyCollection = fse.remove; // This isn't very fast. We could rename to a temp dir, do cb, and then remove temp in background...

// FIXME: recurse through directories
// FIXME eachLimit instead of eachSeries?
exports.iterateIdentifiers = function iterate(collectionDirectory, iterator, callback) {
    fs.readdir(collectionDirectory, function (err, ids) {
        if (err) { return callback(err); }
        function eachIdtag(id, cb) {
            var documentPathname = path.resolve(collectionDirectory, id);
            lock(documentPathname, function (unlock) {
                iterator(documentPathname, id, function (error) {
                    unlock();
                    cb(error);
                });
            });
        }
        async.eachSeries(ids, eachIdtag, callback);
    });
};

exports.iterateDocuments = function iterate(collectionDirectory, iterator, callback) {
    exports.iterateIdentifiers(collectionDirectory, function (documentPathname, id, cb) {
        fs.readFile(documentPathname, function (err, content) {
            if (err) { return cb((err.code !== 'ENOENT') && err); } // tolerate deletion during iteration
            iterator(JSON.parse(content), id, cb);
        });
    }, callback);
};
