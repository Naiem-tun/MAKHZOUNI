import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(config);
const storage = getStorage(app);
const testRef = ref(storage, 'test.txt');

uploadString(testRef, 'hello world').then(() => {
    console.log("Storage upload successful!");
    process.exit(0);
}).catch(e => {
    console.error("Storage upload failed:", e);
    process.exit(1);
});
