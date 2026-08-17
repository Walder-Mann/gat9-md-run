import * as vscode from 'vscode';
import { exec } from 'child_process';

export class PowerShellRunner {
    public static collectInitScriptsBefore(lines: string[], targetLine: number): string {
        let initCodeCombined = '';
        let isInsideInitBlock = false;

        for (let i = 0; i < targetLine; i++) {
            const trimmedLine = lines[i].trim();

            if (!isInsideInitBlock) {
                if (/^```powershell(\s|$)/.test(trimmedLine) && trimmedLine.includes('init-script')) {
                    isInsideInitBlock = true;
                }
            } else {
                if (trimmedLine.startsWith('```')) {
                    isInsideInitBlock = false;
                    if (initCodeCombined && !initCodeCombined.trim().endsWith(';')) {
                        initCodeCombined += ';';
                    }
                } else {
                    initCodeCombined += lines[i] + '\n';
                }
            }
        }

        return initCodeCombined.trim();
    }

    public static async run(document: vscode.TextDocument, codeToExecute: string, blockIndex: number, extensionName: string) {
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

        const config = vscode.workspace.getConfiguration(extensionName);
        const enableInitScripts = config.get<boolean>('powershell.enableInitScripts', true);
        const enableUtf8 = config.get<boolean>('powershell.enableInitCommand', true);

        let pswhHeader = config.get<string>('powershell.initCommand', '').trim();

        const isWin = process.platform === 'win32';
        const shellExecutable = isWin ? 'powershell.exe' : 'pwsh';
        let escapedCode = processedCode.replace(/"/g, '\"');

        let initCode = '';
        if (enableInitScripts) {
            initCode = PowerShellRunner.collectInitScriptsBefore(lines, targetLine);
        }

        if (initCode) {
            escapedCode = `${initCode} ${escapedCode}`;
        }

        let pswhCommand = '';

        if (enableUtf8 && pswhHeader) {
            if (!pswhHeader.endsWith(';')) {
                pswhHeader += ';';
            }
            pswhCommand = `${pswhHeader} ${escapedCode}`;
        } else {
            pswhCommand = escapedCode;
        }

        vscode.window.setStatusBarMessage('Выполнение PowerShell...', 3000);

        exec(pswhCommand, {
            shell: shellExecutable,
            encoding: 'utf8',
            env: process.env
        }, async (error: Error | null, stdout: string, stderr: string) => {
            let output = stdout || stderr || (error ? error.message : 'Выполнено успешно (нет вывода).');
            const targetLineText = lines[targetLine];
            const indentMatch = targetLineText.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[0] : '';

            const resultBlock = `${indent}\`\`\`text\n${output.trim()}\n${indent}\`\`\`\n`;

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
