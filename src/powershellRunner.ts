import * as vscode from 'vscode';
import { exec } from 'child_process';

export class PowerShellRunner {
    private static readonly utf8Header = '\$OutputEncoding = [Console]::InputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();';

    public static async run(document: vscode.TextDocument, codeToExecute: string, blockIndex: number) {
        const text = document.getText();
        const lines = text.split('\n');

        let currentBlockIdx = -1;
        let insidePowerShell = false;
        let targetLine = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('```powershell')) {
                insidePowerShell = true;
                continue;
            }
            if (insidePowerShell && lines[i].trim().startsWith('```')) {
                insidePowerShell = false;
                currentBlockIdx++;
                if (currentBlockIdx === blockIndex) {
                    targetLine = i;
                    break;
                }
            }
        }

        if (targetLine === -1) return;

        let processedCode = codeToExecute
            .split('\n')
            .map(line => line.trimEnd())
            .join('\n')
            .replace(/`\s*\n/g, ' ');

        const isWin = process.platform === 'win32';
        const shellExecutable = isWin ? 'powershell.exe' : 'pwsh';
        const escapedCode = processedCode.replace(/"/g, '\"');
        const pswhCommand = `chcp 65001 > $null; $env:WSL_UTF8=1; ${this.utf8Header} ${escapedCode}`;

        vscode.window.setStatusBarMessage('Выполнение PowerShell...', 3000);

        exec(pswhCommand, {
            shell: shellExecutable,
            encoding: 'utf8',
            env: process.env
        }, async (error: Error | null, stdout: string, stderr: string) => {
            let output = stdout || stderr || (error ? error.message : 'Выполнено успешно (нет вывода).');
            const resultBlock = `\n\`\`\`text\n${output.trim()}\n\`\`\`\n`;

            let deleteRange: vscode.Range | null = null;
            let nextLineIdx = targetLine + 1;

            while (nextLineIdx < lines.length && lines[nextLineIdx].trim() === '') {
                nextLineIdx++;
            }

            if (nextLineIdx < lines.length && lines[nextLineIdx].trim().startsWith('```text')) {
                let endLineIdx = nextLineIdx + 1;
                while (endLineIdx < lines.length && !lines[endLineIdx].trim().startsWith('```')) {
                    endLineIdx++;
                }
                deleteRange = new vscode.Range(
                    new vscode.Position(nextLineIdx, 0),
                    new vscode.Position(endLineIdx + 1, 0)
                );
            }

            const edit = new vscode.WorkspaceEdit();
            if (deleteRange) {
                edit.delete(document.uri, deleteRange);
            }
            edit.insert(document.uri, new vscode.Position(targetLine + 1, 0), resultBlock);

            await vscode.workspace.applyEdit(edit);
        });
    }
}
