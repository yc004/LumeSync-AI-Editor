import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const launchArgs = args.filter(arg => arg !== '--dry-run');

const outMain = path.join(root, 'out', 'main.js');
const electronPackageDir = path.join(root, 'node_modules', 'electron');
const electronInstallScript = path.join(electronPackageDir, 'install.js');
const electronPathFile = path.join(electronPackageDir, 'path.txt');
const defaultElectronRelativePath = process.platform === 'win32' ? 'electron.exe' : 'electron';
const electronBinary = path.join(
	electronPackageDir,
	'dist',
	existsSync(electronPathFile) ? readFileSync(electronPathFile, 'utf8').trim() : defaultElectronRelativePath
);

function run(command, commandArgs, extraEnv = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: root,
		stdio: 'inherit',
		env: {
			...process.env,
			...extraEnv
		}
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

function ensureOut() {
	if (existsSync(outMain)) {
		return;
	}

	console.log('[dev] out/ not found, running transpile-client...');

	if (dryRun) {
		return;
	}

	run(process.execPath, ['build/next/index.ts', 'transpile']);
}

function ensureElectron() {
	if (existsSync(electronBinary)) {
		return;
	}

	console.log('[dev] Electron runtime not found, downloading from configured mirror...');
	console.log('[dev] mirror =', process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/');

	if (dryRun) {
		return;
	}

	run(process.execPath, [electronInstallScript], {
		ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
		npm_config_electron_mirror: process.env.npm_config_electron_mirror || 'https://npmmirror.com/mirrors/electron/'
	});
}

ensureOut();
ensureElectron();

const disableTestExtension = launchArgs.includes('--extensionTestsPath')
	? []
	: ['--disable-extension=vscode.vscode-api-tests'];

if (dryRun) {
	console.log('[dev] root =', root);
	console.log('[dev] electron =', electronBinary);
	console.log('[dev] argv =', ['.', ...disableTestExtension, ...launchArgs].join(' '));
	process.exit(0);
}

run(electronBinary, ['.', ...disableTestExtension, ...launchArgs], {
	NODE_ENV: 'development',
	VSCODE_DEV: '1',
	VSCODE_CLI: '1',
	ELECTRON_ENABLE_LOGGING: '1',
	ELECTRON_ENABLE_STACK_DUMPING: '1'
});
