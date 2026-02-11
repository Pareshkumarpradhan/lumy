import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NETSCAPE_COOKIE_HEADER = '# Netscape HTTP Cookie File';

export type YtAuthInput = {
	cookies?: string;
	cookiesFromBrowser?: string;
};

export type YtAuth = {
	cookies?: string;
	cookiesFromBrowser?: string;
	rawArgs: string[];
	cleanup: () => Promise<void>;
};

export async function resolveYtAuth(input: YtAuthInput): Promise<YtAuth> {
	const cleanupFiles: string[] = [];
	const cleanupDirs: string[] = [];
	const browser = normalize(input.cookiesFromBrowser || process.env.YT_COOKIES_FROM_BROWSER || '');
	const directCookieFile = normalize(process.env.YT_COOKIES_FILE || '');
	const base64Cookies = normalize(process.env.YT_COOKIES_B64 || '');
	const decodedBase64Cookies = decodeBase64Cookies(base64Cookies);
	const inlineOrPath = normalize(input.cookies || process.env.YT_COOKIES || decodedBase64Cookies || '');

	let cookiesFile = '';
	if (inlineOrPath) {
		cookiesFile = await resolveCookiesPath(inlineOrPath, cleanupFiles, cleanupDirs);
	} else if (directCookieFile) {
		cookiesFile = await resolveCookiesPath(directCookieFile, cleanupFiles, cleanupDirs);
	}

	return {
		cookies: cookiesFile || undefined,
		cookiesFromBrowser: browser || undefined,
		rawArgs: [
			...(cookiesFile ? ['--cookies', cookiesFile] : []),
			...(browser ? ['--cookies-from-browser', browser] : [])
		],
		cleanup: async () => {
			for (const tmpFile of cleanupFiles) {
				try {
					await rm(tmpFile, { force: true });
				} catch {
					// best-effort cleanup
				}
			}
			for (const tmpDir of cleanupDirs) {
				try {
					await rm(tmpDir, { recursive: true, force: true });
				} catch {
					// best-effort cleanup
				}
			}
		}
	};
}

async function resolveCookiesPath(value: string, cleanupFiles: string[], cleanupDirs: string[]): Promise<string> {
	if (await fileExists(value)) {
		return value;
	}

	if (looksLikeCookieContent(value)) {
		ensureHasCookieRows(value);
		const dir = await mkdtemp(path.join(os.tmpdir(), 'lumy-cookies-'));
		const cookiePath = path.join(dir, 'cookies.txt');
		await writeFile(cookiePath, ensureCookieHeader(value), 'utf8');
		cleanupFiles.push(cookiePath);
		cleanupDirs.push(dir);
		return cookiePath;
	}

	throw new Error(
		'Cookie configuration is invalid. Provide YT_COOKIES_FILE, YT_COOKIES, or YT_COOKIES_B64 with Netscape cookie rows.'
	);
}

function looksLikeCookieContent(value: string): boolean {
	return value.includes('\n') || value.includes('\t') || value.includes(NETSCAPE_COOKIE_HEADER);
}

function ensureCookieHeader(content: string): string {
	const trimmed = content.trim();
	if (!trimmed.startsWith(NETSCAPE_COOKIE_HEADER)) {
		return `${NETSCAPE_COOKIE_HEADER}\n${trimmed}\n`;
	}
	return `${trimmed}\n`;
}

function ensureHasCookieRows(content: string): void {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const dataRows = lines.filter((line) => !line.startsWith('#'));
	if (dataRows.length === 0) {
		throw new Error(
			'Cookie file has only header comments and no cookie rows. Re-export youtube.com cookies and paste full content.'
		);
	}
}

function decodeBase64Cookies(value: string): string {
	if (!value) return '';
	try {
		return Buffer.from(value, 'base64').toString('utf8').trim();
	} catch {
		throw new Error('Invalid YT_COOKIES_B64 value. Provide valid base64-encoded Netscape cookies content.');
	}
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

function normalize(value: string): string {
	return value.trim();
}
