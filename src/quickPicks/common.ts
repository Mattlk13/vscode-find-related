'use strict';
import {
    CancellationTokenSource,
    commands,
    Disposable,
    QuickPickItem,
    QuickPickOptions,
    TextDocumentShowOptions,
    TextEditor,
    Uri,
    window
} from 'vscode';
import { openEditor } from '../commands';
import { configuration } from '../configuration';
import { Container } from '../container';
import { KeyMapping, Keys } from '../keyboard';
// import { Logger } from '../logger';

export function showQuickPickProgress(
    message: string,
    mapping?: KeyMapping,
    delay: boolean = false
): CancellationTokenSource {
    const cancellation = new CancellationTokenSource();

    if (delay) {
        let disposable: Disposable;
        const timer = setTimeout(() => {
            disposable && disposable.dispose();
            void _showQuickPickProgress(message, cancellation, mapping);
        }, 250);
        disposable = cancellation.token.onCancellationRequested(() => clearTimeout(timer));
    }
    else {
        void _showQuickPickProgress(message, cancellation, mapping);
    }

    return cancellation;
}

async function _showQuickPickProgress(message: string, cancellation: CancellationTokenSource, mapping?: KeyMapping) {
    const scope = mapping && (await Container.keyboard.beginScope(mapping));

    try {
        await window.showQuickPick(
            _getInfiniteCancellablePromise(cancellation),
            {
                placeHolder: message
            } as QuickPickOptions,
            cancellation.token
        );
    }
    catch (ex) {
        // Not sure why this throws
    }
    finally {
        cancellation.cancel();
        scope && scope.dispose();
    }
}

function _getInfiniteCancellablePromise(cancellation: CancellationTokenSource) {
    return new Promise<QuickPickItem[]>((resolve, reject) => {
        const disposable = cancellation.token.onCancellationRequested(() => {
            disposable.dispose();
            resolve([]);
        });
    });
}

export interface QuickPickItem extends QuickPickItem {
    onDidSelect?(): void;
    onDidPressKey?(key: Keys): Promise<{} | undefined>;
}

export class CommandQuickPickItem implements QuickPickItem {
    label!: string;
    description!: string;
    detail?: string | undefined;
    protected command: string | undefined;
    protected args: any[] | undefined;

    constructor(item: QuickPickItem, args?: [string, any[]]);
    constructor(item: QuickPickItem, command?: string, args?: any[]);
    constructor(item: QuickPickItem, commandOrArgs?: string | [string, any[]], args?: any[]) {
        if (commandOrArgs === undefined) {
            this.command = undefined;
            this.args = args;
        }
        else if (typeof commandOrArgs === 'string') {
            this.command = commandOrArgs;
            this.args = args;
        }
        else {
            this.command = commandOrArgs[0];
            this.args = commandOrArgs.slice(1);
        }
        Object.assign(this, item);
    }

    execute(): Promise<{} | undefined> {
        if (this.command === undefined) return Promise.resolve(undefined);

        return commands.executeCommand(this.command, ...(this.args || [])) as Promise<{} | undefined>;
    }

    onDidPressKey(key: Keys): Promise<{} | undefined> {
        return this.execute();
    }
}

export class OpenFileCommandQuickPickItem extends CommandQuickPickItem {
    constructor(
        public uri: Uri,
        item: QuickPickItem
    ) {
        super(item, undefined, undefined);
    }

    async execute(options?: TextDocumentShowOptions): Promise<TextEditor | undefined> {
        return openEditor(this.uri, options);
    }

    onDidSelect(): Promise<{} | undefined> {
        if (!configuration.get<boolean>(configuration.name('autoPreview').value)) return Promise.resolve(undefined);

        return this.execute({
            preserveFocus: true,
            preview: true
        });
    }

    onDidPressKey(key: Keys): Promise<{} | undefined> {
        return this.execute({
            preserveFocus: true,
            preview: false
        });
    }
}

export class OpenFilesCommandQuickPickItem extends CommandQuickPickItem {
    constructor(
        public uris: Uri[],
        item: QuickPickItem
    ) {
        super(item, undefined, undefined);
    }

    async execute(
        options: TextDocumentShowOptions = { preserveFocus: false, preview: false }
    ): Promise<{} | undefined> {
        for (const uri of this.uris) {
            await openEditor(uri, options);
        }
        return undefined;
    }

    async onDidPressKey(key: Keys): Promise<{} | undefined> {
        return this.execute({
            preserveFocus: true,
            preview: false
        });
    }
}
