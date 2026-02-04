import * as vscode from 'vscode';

type LayoutOption = 'split' | 'tabs';

interface TerminalConfig {
	name: string;
	command: string;
}

interface AutorunConfig {
	layout: LayoutOption;
	terminals: TerminalConfig[];
	closeExisting: boolean;
	launchOnStart: boolean;
}

const SPLIT_WARNING_THRESHOLD = 3;
const DEFAULT_LAYOUT: LayoutOption = 'split';
const DEFAULT_CONFIG_PATH = 'autorun.config.json';
const DEFAULT_CLOSE_EXISTING = true;
const DEFAULT_LAUNCH_ON_START = true;

let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('autorun.launchTerminals', async () => {
			await launchTerminals();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('autorun.toggleLaunchOnStart', async () => {
			const settings = vscode.workspace.getConfiguration('autorun');
			const currentValue = settings.get<boolean>('launchOnStart') ?? DEFAULT_LAUNCH_ON_START;
			await settings.update('launchOnStart', !currentValue, vscode.ConfigurationTarget.Global);
			updateStatusBar(!currentValue);
			void vscode.window.showInformationMessage(
				`Auto-Run Terminals: Launch on start is now ${!currentValue ? 'enabled' : 'disabled'}`
			);
		})
	);

	// Create status bar button
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'autorun.launchTerminals';
	context.subscriptions.push(statusBarItem);

	// Check if we should auto-launch on startup
	const config = await resolveConfig();
	updateStatusBar(config.launchOnStart);
	statusBarItem.show();

	if (config.launchOnStart) {
		await launchTerminals();
	}
}

function updateStatusBar(launchOnStart: boolean): void {
	if (launchOnStart) {
		statusBarItem.text = '$(terminal) Auto-Terminals';
		statusBarItem.tooltip = 'Click to launch configured terminals (Auto-launch ON)';
	} else {
		statusBarItem.text = '$(terminal) Launch Terminals';
		statusBarItem.tooltip = 'Click to launch configured terminals (Auto-launch OFF)';
	}
}

async function launchTerminals(): Promise<void> {
	const { layout, terminals, closeExisting } = await resolveConfig();

	if (terminals.length === 0) {
		void vscode.window.showWarningMessage(
			'Auto-Run Terminals: No terminals configured. Add terminals to your settings or config file.'
		);
		return;
	}

	if (closeExisting) {
		vscode.window.terminals.forEach((terminal) => terminal.dispose());
	}

	if (layout === 'split' && terminals.length > SPLIT_WARNING_THRESHOLD) {
		void vscode.window.showWarningMessage(
			`Launching ${terminals.length} split terminals may feel cramped. Consider using the "tabs" layout or widening the window.`,
		);
	}

	if (layout === 'tabs') {
		terminals.forEach((terminalConfig) => {
			const terminal = vscode.window.createTerminal({ name: terminalConfig.name });
			terminal.show();
			terminal.sendText(terminalConfig.command);
		});
	} else {
		let activeTerminal: vscode.Terminal | undefined;

		for (const [index, terminalConfig] of terminals.entries()) {
			if (index === 0) {
				activeTerminal = vscode.window.createTerminal({ name: terminalConfig.name });
				activeTerminal.show();
			} else {
				// Splitting relies on the current terminal having focus.
				activeTerminal?.show();
				await vscode.commands.executeCommand('workbench.action.terminal.split');
				activeTerminal = vscode.window.activeTerminal;
				await vscode.commands.executeCommand('workbench.action.terminal.renameWithArg', { name: terminalConfig.name });
			}

			if (activeTerminal) {
				await delay(200);
				activeTerminal.sendText(terminalConfig.command);
			}
		}
	}

	void vscode.window.showInformationMessage(
		`Auto-Run Terminals: Launched ${terminals.length} terminal(s)`
	);
}

async function resolveConfig(): Promise<AutorunConfig> {
	const settings = vscode.workspace.getConfiguration('autorun');
	const fallback: AutorunConfig = {
		layout: (settings.get<LayoutOption>('layout') ?? DEFAULT_LAYOUT) as LayoutOption,
		terminals: settings.get<TerminalConfig[]>('terminals') ?? [],
		closeExisting: settings.get<boolean>('closeExisting') ?? DEFAULT_CLOSE_EXISTING,
		launchOnStart: settings.get<boolean>('launchOnStart') ?? DEFAULT_LAUNCH_ON_START,
	};

	const configPath = settings.get<string>('configPath') || DEFAULT_CONFIG_PATH;
	const root = vscode.workspace.workspaceFolders?.[0];
	if (!root) {
		return fallback;
	}

	const configUri = vscode.Uri.joinPath(root.uri, configPath);

	try {
		const data = await vscode.workspace.fs.readFile(configUri);
		const parsed = JSON.parse(new TextDecoder().decode(data));

		if (!isValidConfig(parsed)) {
			throw new Error('Missing "layout" or "terminals" with name/command strings.');
		}

		return {
			layout: (parsed.layout as LayoutOption) ?? fallback.layout,
			terminals: parsed.terminals,
			closeExisting:
				typeof parsed.closeExisting === 'boolean' ? parsed.closeExisting : fallback.closeExisting,
			launchOnStart:
				typeof parsed.launchOnStart === 'boolean' ? parsed.launchOnStart : fallback.launchOnStart,
		};
	} catch (error) {
		if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
			// Silent fallback if the file is absent.
			return fallback;
		}

		const message = error instanceof Error ? error.message : String(error);
		void vscode.window.showWarningMessage(
			`Auto-Run Terminals: Could not load ${configPath}. Falling back to settings. (${message})`,
		);
		return fallback;
	}
}

function isValidConfig(data: unknown): data is AutorunConfig {
	if (!data || typeof data !== 'object') {
		return false;
	}

	const candidate = data as Partial<AutorunConfig>;
	const hasValidLayout = candidate.layout === 'split' || candidate.layout === 'tabs';
	const hasTerminals = Array.isArray(candidate.terminals);
	const hasValidCloseExisting =
		typeof candidate.closeExisting === 'undefined' || typeof candidate.closeExisting === 'boolean';
	const hasValidLaunchOnStart =
		typeof candidate.launchOnStart === 'undefined' || typeof candidate.launchOnStart === 'boolean';

	if (!hasValidLayout || !hasTerminals || !hasValidCloseExisting || !hasValidLaunchOnStart) {
		return false;
	}

	const terminals = candidate.terminals as TerminalConfig[];
	return terminals.every((item) => item && typeof item.name === 'string' && typeof item.command === 'string');
}

export function deactivate(): void {
	// No teardown required.
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
