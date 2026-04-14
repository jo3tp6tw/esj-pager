import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const metaPath = join(__dirname, 'src', 'userscript-meta.txt');
const banner = `${readFileSync(metaPath, 'utf8').trim()}\n\n`;

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/esj-pager.user.js',
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  banner: { js: banner },
  minify: false,
  sourcemap: true,
};

if (watch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching src/ …  output: dist/esj-pager.user.js');
} else {
  await esbuild.build(buildOptions);
  console.log('Built dist/esj-pager.user.js');
}
