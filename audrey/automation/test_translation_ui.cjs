const {chromium}=require('/Users/rosie/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const data={updatedAt:new Date().toISOString(),coins:[{id:'test',name:'Test',logs:[
 {id:'foreign',date:'2026-09-11',text:'Díky za ukázku\n❤️',translation:{language:'en',sourceLanguage:'cs',sourceText:'Díky za ukázku\n❤️',text:'Thanks for showing it\n❤️'}},
 {id:'english',text:'Hello',translation:{language:'en',sourceLanguage:'en',sourceText:'Hello',text:'Hello'}},
 {id:'empty',text:''},{id:'emoji',text:'❤️'},
 {id:'stale',text:'Changed',translation:{language:'en',sourceLanguage:'cs',sourceText:'Old',text:'Stale translation'}}]}]};
 await page.route('**/data/coins.json*',r=>r.fulfill({json:data}));
 await page.goto(process.env.URL||'http://127.0.0.1:8768/audrey/');
 await page.waitForSelector('.timeline-row');
 assert.equal(await page.locator('.log-translation').count(),1);
 assert.equal(await page.locator('.log-original').first().textContent(),'Díky za ukázku\n❤️');
 assert.equal(await page.locator('.translation-text').textContent(),'Thanks for showing it\n❤️');
 assert.match(await page.locator('.log-translation').textContent(),/English translation/);
 assert.deepEqual(errors,[]);
 await browser.close();console.log('PASS: original, translation, English/empty/emoji suppression, stale guard, no JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
