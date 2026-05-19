import * as fs from 'fs';

const content = fs.readFileSync('src/pages/SettingsPage.tsx', 'utf8');

// I will just use string manipulation to cut out things.

// Find type View
const typeViewIdx = content.indexOf("type View = 'main' | 'data' | 'guide' | 'categories';");
const endOfImports = content.indexOf('\n\n', typeViewIdx);

// The REAL SettingsPage starts here:
// wait, we have two `export default function SettingsPage() {`. 
// The real one is the SECOND one.
const firstExport = content.indexOf('export default function SettingsPage() {');
const secondExport = content.indexOf('export default function SettingsPage() {', firstExport + 10);

const beforeRealSettingsPage = content.substring(0, typeViewIdx + "type View = 'main' | 'data' | 'guide' | 'categories';".length) + `
import { useCategories } from '../hooks/useCategories';
import { CategoriesManager } from '../components/settings/CategoriesManager';
import { GuideView } from '../components/settings/GuideView';
import { DataManagement } from '../components/settings/DataManagement';

`;

let realSettingsPage = content.substring(secondExport);

// Now remove handleExport from the realSettingsPage
const handleExportStart = realSettingsPage.indexOf('  const handleExport = async () => {');
const tempSettingsStart = realSettingsPage.indexOf('  const [tempSettings, setTempSettings] = useState({', handleExportStart);
if (handleExportStart !== -1 && tempSettingsStart !== -1) {
    realSettingsPage = realSettingsPage.substring(0, handleExportStart) + realSettingsPage.substring(tempSettingsStart);
}

// Ensure the inline views are rendered properly
const viewRenderStart = realSettingsPage.indexOf(`  if (activeView === 'categories') {`);
if (viewRenderStart !== -1) {
    // we just replace all of this with our new views
    const viewRenderEnd = realSettingsPage.indexOf(`  return (`, viewRenderStart);
    if (viewRenderEnd !== -1) {
        realSettingsPage = realSettingsPage.substring(0, viewRenderStart) + `
  if (activeView === 'categories') {
    return <CategoriesManager onBack={() => setActiveView('main')} />;
  }

  if (activeView === 'guide') {
    return <GuideView onBack={() => setActiveView('main')} />;
  }

  if (activeView === 'data') {
    return <DataManagement onBack={() => setActiveView('main')} />;
  }

` + realSettingsPage.substring(viewRenderEnd);
    }
}

fs.writeFileSync('src/pages/SettingsPage.tsx', beforeRealSettingsPage + realSettingsPage);
console.log('done');
