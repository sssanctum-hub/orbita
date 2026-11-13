import fs from 'node:fs/promises';
import vm from 'node:vm';
import { androidPath } from './svg-path.mjs';
const base = 'src-tauri/gen/android/app/src/main/assets/widget';
await fs.mkdir(base, { recursive: true });
for (const name of ['Regular', 'SemiBold'])
  await fs.copyFile(`public/fonts/inter-tight/InterTight-${name}.ttf`, `${base}/InterTight-${name}.ttf`);
const dotSource = await fs.readFile('src/components/DotText.tsx', 'utf8');
const glyphs = vm.runInNewContext('(' + dotSource.match(/const G: Record<string, string\[\]> = (\{[\s\S]*?\n\});/)[1] + ')');
await fs.writeFile(`${base}/glyphs.json`, JSON.stringify(glyphs));
const names = ['orbit', 'circle', 'briefcase-business', 'laptop', 'house', 'utensils', 'heart', 'dumbbell', 'users', 'heart-pulse', 'shopping-bag', 'wallet', 'book-open', 'presentation', 'graduation-cap', 'cake', 'plane', 'music', 'palette', 'trees', 'camera', 'car', 'paw-print', 'star', 'coffee', 'gamepad-2', 'flower-2'];
const icons = {};
for (const name of names) {
  const source = await fs.readFile(`node_modules/lucide-react/dist/esm/icons/${name}.mjs`, 'utf8');
  const expression = source.match(/const __iconData = ([\s\S]*?);/)[1];
  icons[name] = vm.runInNewContext('(' + expression + ')').node;
  for (const [tag, attributes] of icons[name]) {
    if (tag === 'path') attributes.d = androidPath(attributes.d);
  }
}
await fs.writeFile(`${base}/icons.json`, JSON.stringify(icons));
await fs.copyFile('node_modules/lucide-react/LICENSE', `${base}/lucide-LICENSE.txt`);
console.log('Widget fonts, calendar glyphs and Lucide icons prepared.');
