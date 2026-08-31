import {CACHE_FILE_LIST_TTL_MS} from '@/constants';
import {formatError} from './error-formatter';
import {walkProjectEntries} from './file-search';
import {fuzzyScoreFilePath} from './fuzzy-matching';
import {getLogger} from './logging';

interface FileCompletion {
	path: string; // Relative path from cwd
	displayPath: string; // Shortened for display
	score: number; // Fuzzy match score (higher = better match)
	isDirectory: boolean;
}

interface FileListCache {
	files: string[];
	timestamp: number;
}

let fileListCache: FileListCache | null = null;

async function getAllFiles(cwd: string): Promise<string[]> {
	const now = Date.now();
	if (fileListCache && now - fileListCache.timestamp < CACHE_FILE_LIST_TTL_MS) {
		return fileListCache.files;
	}

	try {
		const allFiles: string[] = [];
		await walkProjectEntries(
			cwd,
			undefined,
			entry => {
				allFiles.push(entry.relativePath.replace(/\\/g, '/'));
				return false;
			},
			{includeDirectories: false},
		);

		fileListCache = {
			files: allFiles,
			timestamp: now,
		};

		return allFiles;
	} catch (error) {
		const logger = getLogger();
		logger.error({error: formatError(error)}, 'Failed to list files');
		return [];
	}
}

export function getCurrentFileMention(
	input: string,
	cursorPosition?: number,
): {mention: string; startIndex: number; endIndex: number} | null {
	const pos = cursorPosition ?? input.length;

	let startIndex = -1;
	for (let i = pos - 1; i >= 0; i--) {
		if (input[i] === '@') {
			startIndex = i;
			break;
		}
		// Stop if we hit whitespace (except for path separators)
		if (input[i] === ' ' || input[i] === '\t' || input[i] === '\n') {
			break;
		}
	}

	if (startIndex === -1) {
		return null;
	}

	let endIndex = pos;
	for (let i = pos; i < input.length; i++) {
		if (
			input[i] === ' ' ||
			input[i] === '\t' ||
			input[i] === '\n' ||
			input[i] === '@'
		) {
			break;
		}
		endIndex = i + 1;
	}

	const fullText = input.substring(startIndex, endIndex);
	const mention = fullText.substring(1); // strip @
	const mentionWithoutRange = mention.replace(/:\d+(-\d+)?$/, ''); // strip :10-20 suffix

	return {
		mention: mentionWithoutRange,
		startIndex,
		endIndex,
	};
}

export async function getFileCompletions(
	partialPath: string,
	cwd: string,
	maxResults: number = 20,
): Promise<FileCompletion[]> {
	const allFiles = await getAllFiles(cwd);

	const scoredFiles = allFiles
		.map(file => ({
			path: file,
			displayPath: file.length > 50 ? '...' + file.slice(-47) : file,
			score: fuzzyScoreFilePath(file, partialPath),
			isDirectory: false,
		}))
		.filter(f => f.score > 0)
		.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return a.path.localeCompare(b.path);
		})
		.slice(0, maxResults);

	return scoredFiles;
}

export function clearFileListCache(): void {
	fileListCache = null;
}
