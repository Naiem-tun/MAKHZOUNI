import * as fs from 'fs';

const content = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

// The new imports are at the top
// Find the first 'export default function SettingsPage() {'
const firstExport = content.indexOf('export default function SettingsPage() {');
const secondExport = content.indexOf('export default function SettingsPage() {', firstExport + 1);

// We want to delete from the end of the imports up to the second export.
// Let's find exactly what to delete.
const lines = content.split('\n');

const newLines = [];
let i = 0;
while (i < lines.length) {
    if (lines[i].startsWith('export default function SettingsPage() {')) {
        // We found the FIRST one which we added!
        break;
    }
    newLines.push(lines[i]);
    i++;
}

// Now we skip everything until the SECOND 'export default function SettingsPage() {'
while (i < lines.length) {
    if (lines[i].startsWith('export default function SettingsPage() {')) {
        break; // found the real one
    }
    i++;
}

// now we add the rest of the lines
while (i < lines.length) {
    newLines.push(lines[i]);
    i++;
}

let newContent = newLines.join('\n');

// Now remove the DataManagement logic from SettingsPage
// We look for 'const handleExport = async () => {'
// and the end is '  if (activeView === 'data') {' up to '    );'
// We can just use string replacement for the parts to delete.

// Let's replace the whole data management logic block inside SettingsPage with nothing.
const handleExportStart = newContent.indexOf('  const handleExport = async () => {');
if (handleExportStart !== -1) {
  const handleSaveStoreStart = newContent.indexOf('  const [tempSettings, setTempSettings] = useState({', handleExportStart);
  if (handleSaveStoreStart !== -1) {
    newContent = newContent.substring(0, handleExportStart) + newContent.substring(handleSaveStoreStart);
  }
}

// Remove the inline views rendering
const categoriesViewStart = newContent.indexOf(`  if (activeView === 'categories') {`);
if (categoriesViewStart !== -1) {
    const dataViewEndStr = "      </div>\n    );\n  }\n";
    const dataViewEnd = newContent.indexOf(dataViewEndStr, categoriesViewStart);
    if (dataViewEnd !== -1) {
        newContent = newContent.substring(0, categoriesViewStart) + newContent.substring(dataViewEnd + dataViewEndStr.length);
    }
}

fs.writeFileSync('src/pages/SettingsPage.tsx', newContent);
console.log('done');
