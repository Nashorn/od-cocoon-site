// Package canonical content for the linked, static documentation preview.
import { fileURLToPath } from 'node:url';
import { buildDocumentation } from './build-docs.mjs';
const outputFile = fileURLToPath(new URL('../mockups/documentation/content.json', import.meta.url));
const { bundle, written } = await buildDocumentation({ outputFile });
console.log(`Documentation preview: ${Object.keys(bundle.documents).length} documents; snapshot ${written ? 'updated' : 'unchanged'}.`);
