import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/^import \{\s*\}[\n\r]*$/gm, '');
  content = content.replace(/^import \{\s*$/gm, '');
  content = content.replace(/^import \{ \n$/gm, '');
  fs.writeFileSync(file, content);
});
