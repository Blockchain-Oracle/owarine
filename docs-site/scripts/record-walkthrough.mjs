#!/usr/bin/env node
/** Isolated Chromium recorder. Product footage is restricted to the hosted Owarine origin. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://owarine.xyz';
export class Recorder {
  constructor(page) { this.page=page; this.active=null; this.mouse={x:800,y:500}; }
  async start(name) {
    if(this.active) throw new Error('Stop the active recording first.');
    if(!/^[a-z0-9-]+$/.test(name)) throw new Error('Unsafe recording name');
    if(new URL(this.page.url()).origin!==origin) throw new Error('Only hosted Owarine pixels may be recorded.');
    const directory=resolve(root,'evidence/raw-video',name); await mkdir(directory,{recursive:true});
    const viewport=this.page.viewportSize();
    this.active={name,directory,origin:this.page.url(),capturedAt:new Date().toISOString(),viewport:{...viewport,deviceScaleFactor:2},frames:[],actions:[],started:performance.now(),busy:false,lastHash:null};
    await this.frame(); this.timer=setInterval(()=>void this.frame(),166);
    return {name,capturedAt:this.active.capturedAt};
  }
  now(){return this.active?Math.round(performance.now()-this.active.started):0;}
  async frame(){
    const a=this.active;if(!a||a.busy)return;a.busy=true;
    try{
      if(new URL(this.page.url()).origin!==origin) return;
      const t=this.now();const png=await this.page.screenshot({type:'png',animations:'allow',timeout:15000});
      const hash=createHash('sha256').update(png).digest('hex');
      let file=a.lastFile;
      if(hash!==a.lastHash){file=`frame-${String(a.frames.length).padStart(5,'0')}.png`;await writeFile(resolve(a.directory,file),png);a.lastHash=hash;a.lastFile=file;}
      a.frames.push({t,file,sha256:hash});
    }catch(error){a.captureError=String(error.message);}finally{a.busy=false;}
  }
  async stop(){
    clearInterval(this.timer);const a=this.active;if(!a)throw new Error('No recording');
    while(a.busy)await new Promise(r=>setTimeout(r,40));await this.frame();
    const {name,directory,origin,capturedAt,viewport,frames,actions,captureError}=a;
    await writeFile(resolve(directory,'frames.json'),JSON.stringify({origin,capturedAt,viewport,frames,captureError},null,2)+'\n');
    await writeFile(resolve(directory,'actions.json'),JSON.stringify({actions},null,2)+'\n');
    this.active=null;return {name,frames:frames.length,duration:frames.at(-1)?.t/1000,actions:actions.length,captureError};
  }
  async move(x,y){
    const path=[],from={...this.mouse};
    for(let i=1;i<=12;i++){const p=i/12,e=1-(1-p)**3;const px=from.x+(x-from.x)*e,py=from.y+(y-from.y)*e;await this.page.mouse.move(px,py);path.push({t:this.now(),x:px,y:py});await new Promise(r=>setTimeout(r,16));}
    this.mouse={x,y};return path;
  }
  async action(kind,locator,value){
    const target=typeof locator==='string'?this.page.locator(locator):locator;
    await target.waitFor({state:'visible',timeout:15000});await target.scrollIntoViewIfNeeded();
    const box=await target.boundingBox();if(!box)throw new Error('Target has no box');
    const x=box.x+box.width/2,y=box.y+box.height/2;
    const mousePath=await this.move(x,y);
    // Measure immediately before acting; avoid retaining user-entered text in action metadata.
    const measured=await target.boundingBox();const event={t:this.now(),kind,box:measured,x,y,mousePath};
    if(kind==='click')await target.click();
    else if(kind==='type'){await target.fill(value);event.characters=value.length;}
    else if(kind==='hover')await target.hover();
    this.active?.actions.push(event);return {index:this.active?this.active.actions.length-1:null,...event};
  }
  click(locator){return this.action('click',locator);}
  fill(locator,value){return this.action('type',locator,value);}
  hover(locator){return this.action('hover',locator);}
  async scroll(delta){const t=this.now();await this.page.mouse.wheel(0,delta);this.active?.actions.push({t,kind:'scroll',box:{x:0,y:0,...this.page.viewportSize()},x:this.mouse.x,y:this.mouse.y,mousePath:[{t,...this.mouse}],delta});}
  async key(key){const focused=this.page.locator(':focus');const box=await focused.boundingBox().catch(()=>null);const t=this.now();await this.page.keyboard.press(key);this.active?.actions.push({t,kind:'key',key,box:box??{x:0,y:0,...this.page.viewportSize()},mousePath:[{t,...this.mouse}]});}
  async open(path){const url=new URL(path,origin);if(url.origin!==origin||url.pathname.startsWith('/dev'))throw new Error('Hosted product routes only');await this.page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});}
  async capture(name){if(new URL(this.page.url()).origin!==origin)throw new Error('Hosted capture only');const path=resolve(root,'evidence/raw-captures',`${name}.png`);await mkdir(dirname(path),{recursive:true});await this.page.screenshot({path,type:'png'});return {path,url:this.page.url(),capturedAt:new Date().toISOString(),viewport:this.page.viewportSize()};}
  async snapshot(){return {url:new URL(this.page.url()).origin+new URL(this.page.url()).pathname,text:(await this.page.locator('body').innerText()).slice(0,22000),controls:await this.page.locator('button,a,input,select,textarea').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>({tag:e.tagName,role:e.getAttribute('role'),text:e.textContent?.trim().slice(0,90),label:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),type:e.getAttribute('type'),href:e.getAttribute('href')})))};}
}

if(process.argv.includes('--serve')){
  const cached=resolve(process.env.HOME,'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  const browser=await chromium.launch({headless:true,...(existsSync(cached)?{executablePath:cached}:{})});
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:2,colorScheme:'light',reducedMotion:'no-preference'});
  const page=await context.newPage();const rec=new Recorder(page);const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Browser plugin was unavailable in this session; this Playwright browser is isolated from Abu's browsers.
  const server=createServer(async(req,res)=>{
    // This development bridge accepts local CLI calls, never requests from a
    // captured website or a hostname rebound to the loopback address.
    if(req.headers.origin || !['127.0.0.1:3157','localhost:3157'].includes(req.headers.host)){
      res.writeHead(403);res.end();return;
    }
    if(req.method!=='POST'){res.writeHead(405);res.end();return;}
    let body='';for await(const chunk of req)body+=chunk;
    try{const {code}=JSON.parse(body);const result=await new (Object.getPrototypeOf(async function(){}).constructor)('page','rec','browser','errors',code)(page,rec,browser,errors);res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,result}));}
    catch(error){res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,error:error.message,stack:error.stack?.split('\n').slice(0,3)}));}
  });server.listen(3157,'127.0.0.1',()=>console.log('Isolated hosted-product recorder listening on127.0.0.1:3157'));
  process.on('SIGTERM',async()=>{if(rec.active)await rec.stop();await browser.close();server.close();process.exit(0);});
}else if(process.argv.includes('--help'))console.log('node scripts/record-walkthrough.mjs --serve\nLocal-only control bridge for an isolated Playwright browser. Recorder.start/stop writes lossless frames, timing, measured targets and cursor paths. Never enter credentials; guest-seat flows only.');
