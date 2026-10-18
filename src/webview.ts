import * as vscode from 'vscode';
import { CSVAnalysisResult } from './analyzer';

export class CSVAnalyzerWebview {
    public static currentPanel: CSVAnalyzerWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _onExportToChannel: () => void;

    public static createOrShow(extensionUri: vscode.Uri, result: CSVAnalysisResult, onExportToChannel: () => void) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (CSVAnalyzerWebview.currentPanel) {
            CSVAnalyzerWebview.currentPanel._panel.reveal(column);
            CSVAnalyzerWebview.currentPanel._onExportToChannel = onExportToChannel;
            CSVAnalyzerWebview.currentPanel._update(result);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'csvAnalyzer',
            `CSV Analysis: ${result.fileName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        CSVAnalyzerWebview.currentPanel = new CSVAnalyzerWebview(panel, extensionUri, result, onExportToChannel);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, result: CSVAnalysisResult, onExportToChannel: () => void) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._onExportToChannel = onExportToChannel;

        // Set the webview's initial html content
        this._update(result);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'exportToChannel':
                        this._onExportToChannel();
                        return;
                    case 'showErrorMessage':
                        vscode.window.showErrorMessage(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        CSVAnalyzerWebview.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(result: CSVAnalysisResult) {
        const webview = this._panel.webview;
        this._panel.title = `CSV Analysis: ${result.fileName}`;
        webview.html = this._getHtmlForWebview(result);
    }

    private _getHtmlForWebview(result: CSVAnalysisResult): string {
        const nonce = getNonce();
        const escapeHtml = (value: string): string => value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const totalMissingCount = result.columns.reduce((acc, col) => acc + col.missingCount, 0);
        const totalPossibleCells = result.totalRows * result.totalColumns;
        const totalMissingPercentage = totalPossibleCells > 0 ? (totalMissingCount / totalPossibleCells) * 100 : 0;

        // Format decimal numbers helper
        const fmt = (num?: number) => (num !== undefined ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '-');

        // Column Rows HTML
        const tableRowsHtml = result.columns.map((col, index) => {
            const columnName = escapeHtml(col.name);
            const searchName = escapeHtml(col.name.toLowerCase());
            const isHighMissing = col.missingPercentage > 10;
            const missingClass = isHighMissing ? 'warning-text' : '';
            const typeBadgeClass = col.type === 'Numeric' ? 'badge-numeric' : 'badge-text';
            
            let typeSpecificHtml = '';
            if (col.type === 'Numeric') {
                typeSpecificHtml = `
                    <td class="num-cell">${fmt(col.mean)}</td>
                    <td class="num-cell">${fmt(col.stdDev)}</td>
                    <td class="num-cell">${fmt(col.min)}</td>
                    <td class="num-cell">${fmt(col.max)}</td>
                `;
            } else {
                const uniqueStr = col.uniqueCount !== undefined ? col.uniqueCount.toString() : '-';
                const freqStr = col.mostFrequent !== undefined ? `"${col.mostFrequent}" (${col.mostFrequentCount})` : '-';
                typeSpecificHtml = `
                    <td colspan="4" class="text-meta-cell">
                        <span class="meta-label">Unique:</span> <span class="meta-value">${uniqueStr}</span>
                        <span class="meta-separator">|</span>
                        <span class="meta-label">Mode:</span> <span class="meta-value" title="${escapeHtml(freqStr)}">${escapeHtml(freqStr)}</span>
                    </td>
                `;
            }

            return `
                <tr class="data-row" data-type="${col.type}" data-name="${searchName}">
                    <td class="idx-col">${index + 1}</td>
                    <td class="name-col" title="${columnName}">${columnName}</td>
                    <td><span class="badge ${typeBadgeClass}">${col.type}</span></td>
                    <td class="${missingClass} num-cell">
                        ${col.missingCount}
                        <div class="progress-bar-container" title="${col.missingPercentage.toFixed(1)}% missing">
                            <div class="progress-bar ${isHighMissing ? 'progress-warning' : 'progress-normal'}" style="width: ${col.missingPercentage}%"></div>
                        </div>
                    </td>
                    ${typeSpecificHtml}
                </tr>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>CSV Analysis Dashboard</title>
    <style>
        :root {
            --font-family: var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
            --bg-color: var(--vscode-editor-background, #1e1e1e);
            --fg-color: var(--vscode-foreground, #cccccc);
            --card-bg: var(--vscode-editor-inactiveSelectionBackground, rgba(255, 255, 255, 0.03));
            --border-color: var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
            --hover-bg: var(--vscode-list-hoverBackground, rgba(255, 255, 255, 0.05));
            --badge-num-bg: rgba(0, 180, 160, 0.15);
            --badge-num-fg: #00e5c8;
            --badge-txt-bg: rgba(180, 100, 240, 0.15);
            --badge-txt-fg: #c080ff;
            --warning-fg: #ff6b6b;
            --warning-bg: rgba(255, 107, 107, 0.1);
            --primary-btn-bg: var(--vscode-button-background, #007acc);
            --primary-btn-fg: var(--vscode-button-foreground, #ffffff);
            --primary-btn-hover: var(--vscode-button-hoverBackground, #0062a3);
        }

        body {
            background-color: var(--bg-color);
            color: var(--fg-color);
            font-family: var(--font-family);
            padding: 24px;
            margin: 0;
            line-height: 1.5;
            animation: fadeIn 0.4s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 16px;
            margin-bottom: 24px;
        }

        .header h1 {
            font-size: 24px;
            margin: 0;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header h1 svg {
            fill: var(--primary-btn-bg);
            width: 28px;
            height: 28px;
        }

        .header .subtitle {
            font-size: 13px;
            opacity: 0.7;
            margin-top: 4px;
        }

        .btn {
            background-color: var(--primary-btn-bg);
            color: var(--primary-btn-fg);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background-color 0.2s, transform 0.1s;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            background-color: var(--primary-btn-hover);
        }

        .btn:active {
            transform: scale(0.98);
        }

        /* Metric Grid */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 28px;
        }

        .metric-card {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px 20px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-color: var(--primary-btn-bg);
        }

        .metric-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            opacity: 0.6;
            margin-bottom: 6px;
        }

        .metric-value {
            font-size: 24px;
            font-weight: 700;
        }

        /* Filter Controls */
        .controls-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            gap: 16px;
            flex-wrap: wrap;
        }

        .search-box {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            color: var(--fg-color);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            min-width: 250px;
            font-family: inherit;
        }

        .search-box:focus {
            outline: 1px solid var(--primary-btn-bg);
            border-color: var(--primary-btn-bg);
        }

        .filter-tabs {
            display: flex;
            gap: 8px;
            background-color: var(--card-bg);
            padding: 4px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
        }

        .tab {
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            border: none;
            background: transparent;
            color: var(--fg-color);
            opacity: 0.7;
            transition: opacity 0.2s, background-color 0.2s;
        }

        .tab:hover {
            opacity: 1;
            background-color: var(--hover-bg);
        }

        .tab.active {
            opacity: 1;
            background-color: var(--primary-btn-bg);
            color: var(--primary-btn-fg);
        }

        /* Table Design */
        .table-container {
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
            background-color: var(--card-bg);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
            font-size: 13px;
        }

        th {
            background-color: rgba(0, 0, 0, 0.15);
            font-weight: 600;
            padding: 12px 16px;
            border-bottom: 2px solid var(--border-color);
            opacity: 0.9;
        }

        td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            vertical-align: middle;
        }

        .data-row:hover {
            background-color: var(--hover-bg);
        }

        .idx-col {
            opacity: 0.5;
            width: 40px;
        }

        .name-col {
            font-weight: 500;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .num-cell {
            font-variant-numeric: tabular-nums;
        }

        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }

        .badge-numeric {
            background-color: var(--badge-num-bg);
            color: var(--badge-num-fg);
        }

        .badge-text {
            background-color: var(--badge-txt-bg);
            color: var(--badge-txt-fg);
        }

        .warning-text {
            color: var(--warning-fg);
            font-weight: 600;
        }

        /* Progress Bar */
        .progress-bar-container {
            width: 60px;
            height: 4px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            margin-top: 4px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            border-radius: 2px;
        }

        .progress-normal {
            background-color: var(--primary-btn-bg);
        }

        .progress-warning {
            background-color: var(--warning-fg);
        }

        /* Metadata Column Row details */
        .text-meta-cell {
            opacity: 0.85;
            background-color: rgba(0, 0, 0, 0.05);
        }

        .meta-label {
            font-size: 11px;
            opacity: 0.6;
            margin-right: 4px;
        }

        .meta-value {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            font-weight: 500;
        }

        .meta-separator {
            margin: 0 8px;
            opacity: 0.3;
        }

        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }
            .controls-row {
                flex-direction: column;
                align-items: stretch;
            }
            .search-box {
                min-width: unset;
            }
            table {
                font-size: 12px;
            }
            th, td {
                padding: 8px 10px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>
                <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2zm0 8H7v-2h10v2z"/></svg>
                CSV Analyzer Dashboard
            </h1>
            <div class="subtitle">Analyzing: <strong>${escapeHtml(result.fileName)}</strong></div>
        </div>
        <button class="btn" id="exportBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export to Output Channel
        </button>
    </div>

    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-label">Total Columns</div>
            <div class="metric-value">${result.totalColumns}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Total Rows</div>
            <div class="metric-value">${result.totalRows}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Total Cells</div>
            <div class="metric-value">${totalPossibleCells}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Overall Missing Rate</div>
            <div class="metric-value ${totalMissingPercentage > 10 ? 'warning-text' : ''}">
                ${totalMissingPercentage.toFixed(1)}%
            </div>
        </div>
    </div>

    <div class="controls-row">
        <input type="text" id="searchBox" class="search-box" placeholder="Search column names..." />
        <div class="filter-tabs">
            <button class="tab active" data-filter="all">All Fields</button>
            <button class="tab" data-filter="Numeric">Numeric Fields</button>
            <button class="tab" data-filter="Text">Text Fields</button>
        </div>
    </div>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th class="idx-col">#</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Missing</th>
                    <th>Mean (Avg)</th>
                    <th>Std Dev (&sigma;)</th>
                    <th>Min</th>
                    <th>Max / Unique Meta</th>
                </tr>
            </thead>
            <tbody id="tableBody">
                ${tableRowsHtml}
            </tbody>
        </table>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        
        // Export to output channel event listener
        document.getElementById('exportBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'exportToChannel' });
        });

        // Search & Filter system
        const searchBox = document.getElementById('searchBox');
        const filterTabs = document.querySelectorAll('.tab');
        const rows = document.querySelectorAll('.data-row');

        let activeFilter = 'all';
        let searchQuery = '';

        function updateRowsVisibility() {
            rows.forEach(row => {
                const type = row.getAttribute('data-type');
                const name = row.getAttribute('data-name');
                
                const matchesFilter = activeFilter === 'all' || type === activeFilter;
                const matchesSearch = name.includes(searchQuery);

                if (matchesFilter && matchesSearch) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        searchBox.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            updateRowsVisibility();
        });

        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeFilter = tab.getAttribute('data-filter');
                updateRowsVisibility();
            });
        });
    </script>
</body>
</html>`;
    }
}

function getNonce(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let index = 0; index < 32; index++) {
        nonce += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return nonce;
}
