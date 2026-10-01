// Publish the repository by default, minus explicit deployment exclusions.
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDocumentation } from './build-docs.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const owner = 'cocoon-static-build-v1';
const exclusions = JSON.parse(await readFile(resolve(root, 'scripts/deploy-excludes.json'), 'utf8'));
function excluded(path, name) {
 return exclusions.paths.some(item => path === item || path.startsWith(item + '/'))
   || exclusions.names.includes(name)
   || exclusions.namePrefixes.some(prefix => name.startsWith(prefix));
}
const bundle = await compileDocumentation(); // Validate before replacing the last successful output.
let existing;
try { existing = await readFile(resolve(output, '.build-owner'), 'utf8'); }
catch (error) {
 if (error.code !== 'ENOENT') throw error;
 try { await readdir(output); throw Error('Refusing to replace dist without its generated build marker.'); }
 catch (check) { if (check.code !== 'ENOENT') throw check; }
}
if (existing !== undefined && existing !== owner) throw Error('dist is not owned by this build.');
await mkdir(resolve(root,'.generated'),{recursive:true});
const stage=await mkdtemp(resolve(root,'.generated/site-stage-'));
const published=[];
async function copy(path) {
 const destination=resolve(stage,path);
 await mkdir(dirname(destination),{recursive:true});
 await cp(resolve(root,path),destination,{dereference:false});
 published.push(path);
}
async function walk(path) {
 for (const entry of await readdir(resolve(root,path),{withFileTypes:true})) {
  const child=path ? `${path}/${entry.name}` : entry.name;
  if (excluded(child, entry.name)) continue;
  if (entry.isSymbolicLink()) throw Error(`Public asset symlinks must be reviewed explicitly: ${child}`);
  if (entry.isDirectory()) await walk(child);
  else if (entry.isFile()) await copy(child);
 }
}
try {
 await walk('');
 await writeFile(resolve(stage,'mockups/documentation/content.json'),JSON.stringify(bundle,null,2)+'\n');
 if (!published.includes('mockups/documentation/content.json')) published.push('mockups/documentation/content.json');
 await writeFile(resolve(stage,'.build-owner'),owner);
 if (existing === owner) await rm(output,{recursive:true}); // Only this tool's marked generated directory.
 await rename(stage,output);
 console.log(`Static site: ${published.length} public files prepared in dist/. Internal tooling and discovery records excluded.`);
} finally { await rm(stage,{recursive:true,force:true}); }
