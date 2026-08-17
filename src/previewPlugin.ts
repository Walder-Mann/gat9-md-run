import * as vscode from 'vscode';

export function extendMarkdownItPlugin(md: any, publisherId: string, extensionName: string) {
    const defaultRender = md.renderer.rules.fence;
    let blockCount = 0;

    md.core.ruler.push('reset_counter', (state: any) => {
        blockCount = 0;
    });

    md.renderer.rules.fence = (tokens: any[], idx: number, options: any, env: any, self: any) => {
        const token = tokens[idx];

        if (token.info.trim() === 'powershell') {
            const currentIndex = blockCount++;
            const originalHtml = defaultRender(tokens, idx, options, env, self);
            const encodedCode = encodeURIComponent(token.content);

            let fileUriString = '';

            if (env && env.markdownPreviewSource) {
                fileUriString = encodeURIComponent(env.markdownPreviewSource.toString());
            }
            else if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'markdown') {
                fileUriString = encodeURIComponent(vscode.window.activeTextEditor.document.uri.toString());
            }
            else {
                const anyMdDoc = vscode.workspace.textDocuments.find(doc =>
                    doc.languageId === 'markdown' || doc.fileName.toLowerCase().endsWith('.md')
                );
                if (anyMdDoc) {
                    fileUriString = encodeURIComponent(anyMdDoc.uri.toString());
                }
            }

            const globalHref = 'vscode://' + publisherId + '.' + extensionName + '/run?code=' + encodedCode + '&index=' + currentIndex + '&file=' + fileUriString;

            let html = '';
            html += '<div style="position: relative; margin-bottom: 5px;">';
            html += '<a href="' + globalHref + '" ';
            html += 'style="position: absolute; top: 5px; right: 5px; z-index: 10; text-decoration: none; cursor: pointer; padding: 4px 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; font-size: 11px; font-weight: bold; font-family: sans-serif;">';
            html += '▶';
            html += '</a>';
            html += originalHtml;
            html += '</div>';

            return html;
        }
        return defaultRender(tokens, idx, options, env, self);
    };

    return md;
}
