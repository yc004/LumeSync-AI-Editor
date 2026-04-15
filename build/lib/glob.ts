/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as globModule from 'glob';

type LegacyGlobFn = (pattern: string, options: unknown, cb: (err: Error | null, matches: string[]) => void) => void;
type ModernGlobFn = (pattern: string, options?: unknown) => Promise<string[]>;
type GlobSyncFn = (pattern: string, options?: unknown) => string[];

const moduleAny = globModule as unknown as {
	default?: LegacyGlobFn & { sync?: GlobSyncFn };
	glob?: ModernGlobFn;
	globSync?: GlobSyncFn;
};

const legacyGlob = moduleAny.default;
const modernGlob = moduleAny.glob;
const syncGlob = moduleAny.globSync ?? legacyGlob?.sync;

export function globSync(pattern: string, options?: unknown): string[] {
	if (!syncGlob) {
		throw new Error('[glob] No sync API found');
	}
	return syncGlob(pattern, options) ?? [];
}

export async function globAsync(pattern: string, options?: unknown): Promise<string[]> {
	if (modernGlob) {
		return modernGlob(pattern, options);
	}

	if (!legacyGlob) {
		throw new Error('[glob] No async API found');
	}

	return new Promise<string[]>((resolve, reject) => {
		legacyGlob(pattern, options, (err, matches) => err ? reject(err) : resolve(matches ?? []));
	});
}
