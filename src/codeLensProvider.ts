import * as vscode from 'vscode';

export function calculateLenses(document: vscode.TextDocument, token: vscode.CancellationToken, commandName: any): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    let blockCount = 0;
    let insidePowerShell = false;
    let startLine = 0;
    let currentCode = '';

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```powershell')) {
            insidePowerShell = true;
            startLine = i;
            currentCode = '';
            continue;
        }
        if (insidePowerShell) {
            if (lines[i].trim().startsWith('```')) {
                insidePowerShell = false;

                const range = new vscode.Range(startLine, 0, startLine, 0);
                const currentIndex = blockCount++;

                const codeLens = new vscode.CodeLens(range, {
                    title: "▶",
                    command: commandName.command,
                    tooltip: commandName.title,
                    arguments: [document.uri.toString(), currentCode, currentIndex]
                });

                codeLenses.push(codeLens);
                continue;
            }
            currentCode += lines[i] + '\n';
        }
    }
    return codeLenses;
}
