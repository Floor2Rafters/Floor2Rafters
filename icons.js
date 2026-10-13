// Rebuilds the app icons from the brand icon. Run: node icons.js  (needs sharp)
const sharp=require('sharp');
(async()=>{for(const s of [180,192,512])await sharp('public/brand/icon.svg',{density:300}).resize(s,s).png().toFile(`public/icons/icon-${s}.png`);console.log('icons done');})();
