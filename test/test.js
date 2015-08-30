"use strict";
/*jslint node: true, nomen: true, plusplus: true, vars: true */
var assert = require('assert');
var mocha = require('mocha'), describe = mocha.describe, before = mocha.before, after = mocha.after, it = mocha.it;
var store = require('ki1r0y.fs-store');
var path = require('path');
var async = require('async');

var collectionName = 'myDb/testCollection';
function makeDocName(id) { return collectionName + path.sep + id; }
var rawId = 'raw', rawDoc = makeDocName(rawId), rawPayload = 'some random non-json text', rawDoc2 = rawDoc + 2;
var objId = 'obj', objDoc = makeDocName(objId), objPayload = {a: 'some text', b: 17}, objPayload2;
var nParallel = 10 * 1000;
var nFiles = 5 * 1000;
function contains(array, x) { return array.indexOf(x) >= 0; }

describe('fs-store', function () {
    before(function (done) {
        store.destroyCollection(collectionName, done);
    });
    it('creates collection', function (done) {
        store.ensureCollection(collectionName, done);
    });
    it('allows multiple attempts to create collection', function (done) {
        store.ensureCollection(collectionName, done);
    });
    it('sets and gets raw text', function (done) {
        store.setBuffer(rawDoc, rawPayload, function (e) {
            assert.ifError(e);
            store.getBuffer(rawDoc, function (e, contentString) {
                assert.equal(contentString, rawPayload);
                done(e);
            });
        });
    });
    it('sets and gets objects', function (done) {
        store.set(objDoc, objPayload, function (e) {
            assert.ifError(e);
            store.get(objDoc, function (e, contentData) {
                assert.deepEqual(contentData, objPayload);
                done(e);
            });
        });
    });
    it('iterates doc ids', function (done) {
        var identifiers = [rawId, objId], count = 0;
        store.iterateIdentifiers(collectionName, function (documentName, documentId, icb) {
            count++;
            assert.ok(contains(identifiers, documentId));
            store.exists(documentName, function (exists) { assert.ok(exists); icb(); });
        }, function (e) {
            assert.equal(count, identifiers.length);
            done(e);
        });
    });
    it('renames (even raw) documents, after which original exist is false', function (done) {
        store.rename(rawDoc, rawDoc2, function (e) {
            assert.ifError(e);
            store.exists(rawDoc, function (exists) {
                assert.ok(!exists);
                store.getBuffer(rawDoc2, function (e, contentString) {
                    assert.equal(contentString, rawPayload);
                    done(e);
                });
            });
        });
    });
    // Behavior of iterateDocuments, below is not specified if there are non-json documents in collection, so do this test now.
    it('destroys document, after which doesNotExist', function (done) {
        store.destroy(rawDoc2, function (e) {
            assert.ifError(e);
            store.getBuffer(rawDoc2, function (e) {
                assert.ok(store.doesNotExist(e));
                done();
            });
        });
    });
    it('iterates doc contents', function (done) {
        var identifiers = [objId], count = 0, contents = [objPayload].map(JSON.stringify);
        store.iterateDocuments(collectionName, function (documentData, documentId, icb) {
            count++;
            assert.ok(contains(identifiers, documentId));
            assert.ok(contains(contents, JSON.stringify(documentData)));
            icb();
        }, function (e) {
            assert.equal(count, identifiers.length);
            done(e);
        });
    });
    it('ensures new docs', function (done) {
        var name = makeDocName('something');
        store.ensure(name, function (e) {
            assert.ifError(e);
            store.exists(name, function (exists) {
                assert.ok(exists);
                // But behavior of store.get, and store.getBuffer are undefined for this new doc!
                done();
            });
        });
    });
    it('ensures existing docs without modifing', function (done) {
        store.ensure(objDoc, function (e) {
            assert.ifError(e);
            store.get(objDoc, function (e, content) {
                assert.deepEqual(content, objPayload);
                // But modification time of getWithModificationTime is not defined!
                done(e);
            });
        });
    });
    it('updates data', function (done) {
        var optionalFinalValue = 'typically the same as obj';
        store.update(objDoc, 'default not used because this doc exists', function (data, cb) {
            data.someProperty = 42;
            cb(null, data, optionalFinalValue);
        }, function (error, result) {
            assert.ifError(error);
            assert.equal(result, optionalFinalValue);
            store.get(objDoc, function (error, newData) {
                objPayload2 = JSON.parse(JSON.stringify(objPayload));
                objPayload2.someProperty = 42;
                assert.deepEqual(objPayload2, newData);
                done(error);
            });
        });
    });
    it.skip('passes update error without modification', function (done) {
        var specificError = 'some Error';
        store.update(objDoc, 'not used here either', function (data, cb) {
            assert.deepEqual(objPayload2, data);
            cb(specificError);
        }, function (error) {
            assert.equal(error, specificError);
            store.get(objDoc, function (error, storedData) {
                assert.deepEqual(objPayload2, storedData);
                done(error);
            });
        });
    });
    it.skip('skips update when given undefined', function (done) {
        var optionalFinalValue = 'some value';
        store.update(objDoc, 'not used here either', function (data, cb) {
            assert.deepEqual(data, objPayload2);
            cb(null, undefined, optionalFinalValue);
        }, function (error, result) {
            assert.ifError(error);
            assert.equal(result, optionalFinalValue);
            store.get(objDoc, function (error, storedValue) {
                assert.deepEqual(objPayload2, storedValue); // same as before without change, not matching 'result'
                done(error);
            });
        });
    });
    it('queues lots of simultulaneous sets on the same document', function (done) {
        var docName = makeDocName('foo'), counter = 0, start = new Date(), timeCheck = start;
        this.timeout(nParallel); // allowing 1 ms / test
        async.times(nParallel, function (n, cb) {
            var valueWritten = ++counter;
            store.set(docName, valueWritten, function (error) {
                assert.ifError(error);
                store.getWithModificationTime(docName, function (error, currentValue, modTime) {
                    assert.ok(currentValue >= valueWritten); // There could be intervening writes, but no garbage allowed.
                    assert.ok(modTime >= timeCheck);
                    timeCheck = modTime;
                    cb(error);
                });
            });
        }, function (error, emptyResults) {
            assert.ifError(error);
            store.get(docName, function (error, finalValue) {
                assert.equal(finalValue, emptyResults.length);
                assert.ok(timeCheck > start);
                done(error);
            });
        });
    });
    it('queues lots of simultulaneous updates on the same document', function (done) {
        var docName = makeDocName('bar');
        this.timeout(nParallel); // allowing 1 ms / test
        store.set(docName, 0, function (e) { // let's start small
            assert.ifError(e);
            async.times(nParallel, function (n, cb) {
                store.update(docName, 0, function (old, ucb) {
                    ucb(null, old + 1);
                }, cb);
            }, function (error) {
                assert.ifError(error);
                store.get(docName, function (error, finalValue) {
                    assert.equal(finalValue, nParallel);
                    done(error);
                });
            });
        });
    });
    it('handles lots of documents', function (done) {
        this.timeout(nFiles); // allowing 1 ms / test
        async.times(nFiles, function (n, cb) {
            store.set(makeDocName('f' + n), n, cb);
        }, function (error) {
            assert.ifError(error);
            async.times(nFiles, function (n, cb) {
                store.get(makeDocName('f' + n), function (error, value) {
                    assert.equal(value, n);
                    cb(error);
                });
            }, done);
        });
    });
    it('deletes collection', function (done) {
        store.destroyCollection(collectionName, done);
    });
});
