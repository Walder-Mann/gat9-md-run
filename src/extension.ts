import * as vscode from 'vscode';
import { PowerShellRunner } from './powershellRunner';
import { calculateLenses } from './codeLensProvider';
import { extendMarkdownItPlugin } from './previewPlugin';

export async function activate(context: vscode.ExtensionContext) {
    const packageJSON = context.extension.packageJSON;
    const publisherId = packageJSON.publisher;
    const extensionName = packageJSON.name;
    const commandName = packageJSON.contributes.commands[0].command

    context.subscriptions.push(
        vscode.window.registerUriHandler({
            async handleUri(uri: vscode.Uri) {
                if (uri.path === '/run') {
                    const queryParams = new URLSearchParams(uri.query);
                    const rawCode = queryParams.get('code');
                    const rawIndex = queryParams.get('index');
                    const rawFileUri = queryParams.get('file');

                    if (rawCode && rawIndex && rawFileUri) {
                        const targetUri = vscode.Uri.parse(decodeURIComponent(rawFileUri));

                        let document = vscode.workspace.textDocuments.find(doc =>
                            doc.uri.fsPath.toLowerCase() === targetUri.fsPath.toLowerCase()
                        );

                        if (!document) {
                            try {
                                document = await vscode.workspace.openTextDocument(targetUri);
                            } catch (e) {
                                // Ошибка открытия
                            }
                        }

                        if (document) {
                            await PowerShellRunner.run(document, decodeURIComponent(rawCode), parseInt(rawIndex, 10), extensionName);
                        } else {
                            vscode.window.showErrorMessage('GAT9 Runner: Не удалось открыть целевой файл.');
                        }
                    }
                }
            }
        })
    );


    context.subscriptions.push(
        vscode.commands.registerCommand(commandName, async (fileUriStr: string, code: string, index: number) => {
            const targetUri = vscode.Uri.parse(fileUriStr);
            const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath.toLowerCase() === targetUri.fsPath.toLowerCase());
            if (document) {
                await PowerShellRunner.run(document, code, index, extensionName);
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ language: 'markdown' },
            {
                provideCodeLenses(document, token) {
                    return calculateLenses(document, token, packageJSON.contributes.commands[0]);
                }
            }
        )
    );

    return {
        extendMarkdownIt(md: any) {
            return extendMarkdownItPlugin(md, publisherId, extensionName);
        }
    };
}

export function deactivate() { }
