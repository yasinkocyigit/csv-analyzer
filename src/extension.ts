import * as vscode from 'vscode';
import * as path from 'path';
import { parseCSV, analyzeCSV } from './analyzer';
import { CSVAnalyzerWebview } from './webview';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Initialize Output Channel
    outputChannel = vscode.window.createOutputChannel('CSV Analyzer');
    context.subscriptions.push(outputChannel);

    outputChannel.appendLine('CSV Analyzer extension has been activated.');

    // Register "Analyze CSV File" command
    const analyzeCommand = vscode.commands.registerCommand('csv-analyzer.analyze', async (uri: vscode.Uri) => {
        let fileUri = uri;

        // If command was triggered without explorer selection (e.g. Command Palette)
        if (!fileUri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.fileName.endsWith('.csv')) {
                fileUri = activeEditor.document.uri;
            } else {
                vscode.window.showErrorMessage('Please open a CSV file or right-click a .csv file in the Explorer.');
                return;
            }
        }

        try {
            // Get file name and path info
            const fileName = path.basename(fileUri.fsPath);
            outputChannel.appendLine(`Starting analysis of file: ${fileName}`);

            // Read CSV file content
            const fileData = await vscode.workspace.fs.readFile(fileUri);
            const content = new TextDecoder('utf-8').decode(fileData);

            if (!content || content.trim().length === 0) {
                vscode.window.showErrorMessage(`File "${fileName}" is empty.`);
                return;
            }

            // Parse and analyze CSV
            const parsedRows = parseCSV(content);
            if (parsedRows.length <= 1) {
                vscode.window.showErrorMessage(`File "${fileName}" contains no data rows (only header or empty).`);
                return;
            }

            const analysisResult = analyzeCSV(fileName, parsedRows);

            // Define the export function to log results to Output Channel
            const exportToOutputChannel = () => {
                outputChannel.clear();
                outputChannel.appendLine('========================================');
                outputChannel.appendLine(`CSV ANALYSIS REPORT: ${analysisResult.fileName}`);
                outputChannel.appendLine(`Timestamp: ${new Date().toLocaleString()}`);
                outputChannel.appendLine('========================================');
                outputChannel.appendLine(`Total Rows (excluding header): ${analysisResult.totalRows}`);
                outputChannel.appendLine(`Total Columns: ${analysisResult.totalColumns}`);
                outputChannel.appendLine('----------------------------------------');
                
                analysisResult.columns.forEach((col, idx) => {
                    outputChannel.appendLine(`Column #${idx + 1}: "${col.name}" (${col.type})`);
                    outputChannel.appendLine(`  - Missing count: ${col.missingCount} (${col.missingPercentage.toFixed(2)}%)`);
                    
                    if (col.type === 'Numeric') {
                        outputChannel.appendLine(`  - Mean: ${col.mean !== undefined ? col.mean.toFixed(4) : 'N/A'}`);
                        outputChannel.appendLine(`  - Std Dev: ${col.stdDev !== undefined ? col.stdDev.toFixed(4) : 'N/A'}`);
                        outputChannel.appendLine(`  - Min: ${col.min !== undefined ? col.min.toFixed(4) : 'N/A'}`);
                        outputChannel.appendLine(`  - Max: ${col.max !== undefined ? col.max.toFixed(4) : 'N/A'}`);
                    } else {
                        outputChannel.appendLine(`  - Unique Values: ${col.uniqueCount}`);
                        outputChannel.appendLine(`  - Mode: ${col.mostFrequent ? `"${col.mostFrequent}" (count: ${col.mostFrequentCount})` : 'N/A'}`);
                    }
                    outputChannel.appendLine('----------------------------------------');
                });
                
                outputChannel.show(true); // Bring output channel to focus (preserve focus on webview)
                vscode.window.showInformationMessage(`Analysis results exported to Output Channel: CSV Analyzer.`);
            };

            // Show Webview Panel
            CSVAnalyzerWebview.createOrShow(context.extensionUri, analysisResult, exportToOutputChannel);

        } catch (error: any) {
            outputChannel.appendLine(`Error during analysis: ${error.message || error}`);
            vscode.window.showErrorMessage(`Failed to analyze CSV file: ${error.message || error}`);
        }
    });

    context.subscriptions.push(analyzeCommand);
}

export function deactivate() {
    if (CSVAnalyzerWebview.currentPanel) {
        CSVAnalyzerWebview.currentPanel.dispose();
    }
}
