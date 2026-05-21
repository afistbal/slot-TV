import fs from 'fs';
const p = 'src/pages/user/RadixRc.tsx';
let c = fs.readFileSync(p, 'utf8');
c = c.replaceAll('</motion>', '</div>').replaceAll('<motion className', '<motion className');
fs.writeFileSync(p, c);
