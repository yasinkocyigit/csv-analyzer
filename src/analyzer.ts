/**
 * CSV parser and statistical analysis engine.
 */

export interface ColumnStats {
    name: string;
    index: number;
    type: 'Numeric' | 'Text';
    totalCount: number;
    missingCount: number;
    missingPercentage: number;
    // Numeric stats
    mean?: number;
    stdDev?: number;
    min?: number;
    max?: number;
    // Text stats
    uniqueCount?: number;
    mostFrequent?: string;
    mostFrequentCount?: number;
}

export interface CSVAnalysisResult {
    fileName: string;
    totalRows: number;
    totalColumns: number;
    columns: ColumnStats[];
}

/**
 * Parses raw CSV content adhering to RFC 4180.
 * Handles commas, quotes, and newlines inside quotes.
 */
export function parseCSV(content: string): string[][] {
    const result: string[][] = [];
    let row: string[] = [];
    let insideQuote = false;
    let entry = '';
    
    // Normalize line endings
    const text = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (insideQuote) {
            if (char === '"') {
                if (nextChar === '"') {
                    entry += '"';
                    i++; // skip next quote
                } else {
                    insideQuote = false;
                }
            } else {
                entry += char;
            }
        } else {
            if (char === '"') {
                insideQuote = true;
            } else if (char === ',') {
                row.push(entry);
                entry = '';
            } else if (char === '\n') {
                row.push(entry);
                // Avoid pushing empty trailing lines
                if (row.length > 1 || row[0] !== '') {
                    result.push(row);
                }
                row = [];
                entry = '';
            } else {
                entry += char;
            }
        }
    }
    
    if (entry !== '' || row.length > 0) {
        row.push(entry);
        result.push(row);
    }

    if (insideQuote) {
        throw new Error('CSV contains an unclosed quoted field.');
    }
    
    return result;
}

/**
 * Checks if a value should be considered "missing".
 */
export function isMissing(val: string): boolean {
    const cleaned = val.trim().toLowerCase();
    return (
        cleaned === '' ||
        cleaned === 'null' ||
        cleaned === 'na' ||
        cleaned === 'n/a' ||
        cleaned === 'nan' ||
        cleaned === 'none'
    );
}

/**
 * Analyzes parsed CSV rows and produces detailed column-level statistics.
 */
export function analyzeCSV(fileName: string, rows: string[][]): CSVAnalysisResult {
    if (rows.length === 0) {
        return { fileName, totalRows: 0, totalColumns: 0, columns: [] };
    }
    
    // Assume first row is header
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const totalRows = dataRows.length;
    const totalColumns = headers.length;
    
    const columns: ColumnStats[] = headers.map((headerName, colIndex) => {
        // Collect all values for this column
        const rawValues = dataRows.map(row => (row[colIndex] !== undefined ? row[colIndex] : ''));
        const nonMissingValues = rawValues.filter(v => !isMissing(v));
        const missingCount = rawValues.length - nonMissingValues.length;
        const missingPercentage = totalRows > 0 ? (missingCount / totalRows) * 100 : 0;
        
        // Infer data type: if >= 80% of non-missing values are parseable as floats, classify as Numeric
        const numericValues: number[] = [];
        for (const val of nonMissingValues) {
            const num = Number(val);
            if (!isNaN(num) && val.trim() !== '') {
                numericValues.push(num);
            }
        }
        
        const isNumeric = nonMissingValues.length > 0 && (numericValues.length / nonMissingValues.length) >= 0.8;
        
        if (isNumeric && numericValues.length > 0) {
            // Mean
            const sum = numericValues.reduce((acc, v) => acc + v, 0);
            const mean = sum / numericValues.length;
            
            // Standard Deviation (Sample)
            let stdDev = 0;
            if (numericValues.length > 1) {
                const squareDiffs = numericValues.map(v => Math.pow(v - mean, 2));
                const sumSquareDiffs = squareDiffs.reduce((acc, v) => acc + v, 0);
                stdDev = Math.sqrt(sumSquareDiffs / (numericValues.length - 1));
            }
            
            // Min / Max
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            
            return {
                name: headerName || `Column ${colIndex + 1}`,
                index: colIndex,
                type: 'Numeric',
                totalCount: totalRows,
                missingCount,
                missingPercentage,
                mean,
                stdDev,
                min,
                max
            };
        } else {
            // Text classification
            // Unique count
            const uniqueValues = new Set(nonMissingValues);
            const uniqueCount = uniqueValues.size;
            
            // Most frequent value
            const frequencies: { [key: string]: number } = {};
            let mostFrequent = '';
            let mostFrequentCount = 0;
            
            for (const val of nonMissingValues) {
                frequencies[val] = (frequencies[val] || 0) + 1;
                if (frequencies[val] > mostFrequentCount) {
                    mostFrequentCount = frequencies[val];
                    mostFrequent = val;
                }
            }
            
            return {
                name: headerName || `Column ${colIndex + 1}`,
                index: colIndex,
                type: 'Text',
                totalCount: totalRows,
                missingCount,
                missingPercentage,
                uniqueCount,
                mostFrequent: mostFrequentCount > 0 ? mostFrequent : undefined,
                mostFrequentCount: mostFrequentCount > 0 ? mostFrequentCount : undefined
            };
        }
    });
    
    return {
        fileName,
        totalRows,
        totalColumns,
        columns
    };
}
