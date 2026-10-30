import {readFileSync} from 'node:fs';
// Launcher and health endpoint must always agree with the installed package.
export const VERSION=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
