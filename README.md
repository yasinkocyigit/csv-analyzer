# VS Code CSV Analyzer Extension

A VS Code extension for exploring CSV files and understanding their column-level data quality.

[GitHub profile: yasinkocyigit](https://github.com/yasinkocyigit)

## English

CSV Analyzer is a lightweight VS Code extension that parses CSV files and calculates column-level statistics such as missing-value counts, averages, and standard deviations. Results are displayed in a theme-responsive dashboard and can also be exported to the VS Code Output Channel.

This project uses TypeScript, the VS Code Extension API, CSV parsing, data analysis, and webview-based user interfaces.

## Features

1. **Explorer Context Menu Integration**: Right-click on any `.csv` file in the VS Code Explorer and click "Analyze CSV File".
2. **Missing Data Analytics**: Detects empty fields as well as standard placeholder markers like `N/A`, `NA`, `null`, `NaN`, `none`. Displays a visual progress bar indicating column-level completion rates.
3. **Data Type Auto-Inference**: Dynamically checks if column content is predominantly Numeric or Text.
4. **Calculates Key Statistics**:
   - **Numeric Fields**: Mean (average), Sample Standard Deviation ($\sigma$), Minimum value, and Maximum value.
   - **Text Fields**: Unique value counts and Mode (most frequent value with occurrence count).
5. **Interactive Webview Dashboard**: Filter columns by name, group by type, and enjoy a responsive modern table design synced with your current VS Code theme colors.
6. **Output Channel Export**: Single-click button to print full formatted results directly to the VS Code Output Channel.

## About

- **Developer:** [Yasin Kocyigit](https://github.com/yasinkocyigit)
- **Purpose:** Analyze CSV data quickly and clearly

---

## File Structure

```
├── package.json         # Extension configuration & command hooks
├── tsconfig.json        # TypeScript configuration options
├── src/
│   ├── extension.ts     # Main entry point and lifecycle coordinator
│   ├── analyzer.ts      # RFC 4180 CSV parser & math formulas
│   └── webview.ts       # HTML & custom HSL/CSS styled dashboard
├── sample.csv           # Diagnostic dataset for testing
└── README.md            # Documentation
```

---

## Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) and `npm` installed.

### 2. Install Dependencies
Run the following command in the root folder of the project to download the TypeScript compiler types and ESLint configuration:
```bash
npm install
```

### 3. Build & Compile TypeScript
To compile the TypeScript code into the output JavaScript folder (`out/`), run:
```bash
npm run compile
```

If you plan to edit code and want to compile on-the-fly, run:
```bash
npm run watch
```

### 4. Validate the Extension
Run the compiler, ESLint, and analyzer tests before publishing:
```bash
npm test
```

### 5. Run & Debug in VS Code
1. Open this project directory in VS Code.
2. Open the Run & Debug view from the sidebar (or press `Ctrl+Shift+D` / `Cmd+Shift+D`).
3. Select **Run Extension** (or simply press `F5`).
4. A new window ([Extension Development Host]) will launch containing this extension.
5. In the new window, open a workspace with a `.csv` file (e.g. use `sample.csv`).
6. Right-click on the `.csv` file in the Explorer panel and click **Analyze CSV File**.
7. Enjoy the statistics dashboard!

---

## Publish to GitHub

Create an empty repository named `csv-analyzer` under your GitHub account, then run
these commands from the project folder:

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/yasinkocyigit/csv-analyzer.git
git push -u origin main
```

Do not commit `node_modules/`, `out/`, or `.vsix` files; they are already excluded
by `.gitignore`.

## Package and Install the Extension Locally

Install dependencies, create a VSIX package, and install it in VS Code:

```bash
npm install
npm run package
code --install-extension csv-analyzer-0.1.0.vsix
```

The `package` script compiles the extension through `vsce` before creating the
VSIX package. Increase the `version` in `package.json` for each new release.

## Publish to the VS Code Marketplace

1. Create a publisher at <https://marketplace.visualstudio.com/manage>.
2. Create an Azure DevOps Personal Access Token with Marketplace
   **Manage** scope.
3. Set `publisher` in `package.json` to the exact publisher ID shown by
   Marketplace. The current value, `yasin`, is only correct if that publisher
   ID exists in your Marketplace account.
4. Log in and publish:

```bash
npx @vscode/vsce login <publisher-id>
npx @vscode/vsce publish
```

Publishing runs `vscode:prepublish`, which compiles TypeScript before the VSIX
is uploaded. You can also publish a specific version with:

```bash
npx @vscode/vsce publish patch
```
