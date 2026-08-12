import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const LANGUAGES = [
	'javascript',
	'typescript',
	'python',
	'json',
	'bash',
	'shell',
	'yaml',
	'markdown',
	'css',
	'xml',
	'go',
	'rust',
	'java',
	'c',
	'cpp',
	'csharp',
	'sql',
	'diff',
];

const entry = `
import hljs from 'highlight.js/lib/core';
${LANGUAGES.map(
	(lang, i) => `import lang${i} from 'highlight.js/lib/languages/${lang}';\nhljs.registerLanguage('${lang}', lang${i});`,
).join('\n')}
window.hljs = hljs;
`;

mkdirSync('.hljs-build', { recursive: true });
writeFileSync('.hljs-build/entry.js', entry);

await build({
	entryPoints: ['.hljs-build/entry.js'],
	bundle: true,
	minify: true,
	format: 'iife',
	outfile: 'media/highlight.min.js',
	platform: 'browser',
});

console.log('built media/highlight.min.js');
