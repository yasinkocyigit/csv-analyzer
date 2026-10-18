import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeCSV, isMissing, parseCSV } from './analyzer';

test('parses quoted commas, newlines, escaped quotes, and BOM', () => {
    assert.deepEqual(parseCSV('\uFEFFName,Note\nAlice,"hello, world"\nBob,"line 1\nline 2"\n"Quote ""value""",ok'), [
        ['Name', 'Note'],
        ['Alice', 'hello, world'],
        ['Bob', 'line 1\nline 2'],
        ['Quote "value"', 'ok']
    ]);
});

test('rejects an unclosed quoted field', () => {
    assert.throws(() => parseCSV('Name,Note\nAlice,"unfinished'), /unclosed quoted field/i);
});

test('recognizes supported missing value markers', () => {
    for (const value of ['', ' null ', 'NA', 'n/a', 'NaN', 'none']) {
        assert.equal(isMissing(value), true);
    }
    assert.equal(isMissing('not available'), false);
});

test('analyzes numeric and text columns', () => {
    const result = analyzeCSV('sample.csv', parseCSV('Name,Age,City\nAlice,20,Paris\nBob,,Paris\nCara,22,London'));

    assert.equal(result.totalRows, 3);
    assert.equal(result.totalColumns, 3);
    assert.equal(result.columns[1].type, 'Numeric');
    assert.equal(result.columns[1].missingCount, 1);
    assert.equal(result.columns[2].uniqueCount, 2);
    assert.equal(result.columns[2].mostFrequent, 'Paris');
});
