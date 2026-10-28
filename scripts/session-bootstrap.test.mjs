import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const files=['clientIsAnonymous','anonymousLogin','refreshSessionFromStoredToken','bootstrapSession'];
const compiled=Object.fromEntries(files.map(name=>[name,ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText]));
function setup(initial={},responses={}) {
 const storage=new Map(Object.entries(initial)),requests=[],modules={};
 const state={signed:false,info:undefined,balance:-1,signin(info){state.info=info;state.signed=true;},signout(){state.signed=false;state.info=undefined;},setBalance(value){state.balance=value;}};
 const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,v)=>storage.set(key,String(v)),removeItem:key=>storage.delete(key)};
 const deps={
  '@/api':{api:async(path,options)=>{requests.push({path,options});const value=responses[path];return typeof value==='function'?value():value??{c:0,d:0};},formatApiFailure:(_method,path,result)=>`${path}: ${result.m||'failed'}`},
  '@/stores/user':{useUserStore:{getState:()=>state}},
  '@/hooks/usePixel':{trackAnonymousCompleteRegistration(){}},
  './adAttribution':{fromSourceForLogin:()=>({})},
  './browserFingerprint':{getOrCreateDeviceUuid:()=>storage.get('device_uuid')||'stable-device'},
 };
 function load(name){if(modules[name])return modules[name];const exports={};modules[name]=exports;vm.runInNewContext(compiled[name],{exports,localStorage,require:key=>deps[key]??load(key.split('/').at(-1))});return exports;}
 return {storage,requests,state,api:load('bootstrapSession'),load};
}
const guest={c:0,d:{token:'guest-session',info:{id:7,anonymous:1}}};
test('guest recovery replaces stale account flags without clearing device or preferences',async()=>{
 const s=setup({isAnonymous:'0','login-method':'email','user-avatar':'old',device_uuid:'existing-device',locale:'zh-TW'},{'login/anonymous':guest});
 await s.api.bootstrapSession(()=>true);
 assert.equal(s.storage.get('token'),'guest-session');assert.equal(s.storage.get('isAnonymous'),'1');assert.equal(s.storage.has('login-method'),false);
 assert.equal(s.storage.get('device_uuid'),'existing-device');assert.equal(s.storage.get('locale'),'zh-TW');assert.equal(s.state.signed,true);
});
test('network error keeps the existing token and reports a retryable failure',async()=>{
 const s=setup({token:'account-session',isAnonymous:'0'},{'login/token':{c:1,m:'timeout',httpStatus:0}});
 await assert.rejects(s.api.bootstrapSession(()=>true),/timeout/);
 assert.equal(s.storage.get('token'),'account-session');assert.equal(s.requests.length,1);
});
test('invalid token recovers through anonymous login',async()=>{
 const s=setup({token:'expired',isAnonymous:'0'},{'login/token':{c:1,m:'invalid',httpStatus:401},'login/anonymous':guest});
 await s.api.bootstrapSession(()=>true);assert.equal(s.storage.get('token'),'guest-session');assert.equal(s.storage.get('isAnonymous'),'1');
});
test('anonymous failure is visible and can be retried without clearing storage',async()=>{
 let fail=true;const s=setup({device_uuid:'existing'},{'login/anonymous':()=>fail?{c:1,m:'server unavailable',httpStatus:503}:guest});
 await assert.rejects(s.api.bootstrapSession(()=>true),/server unavailable/);fail=false;
 await s.api.bootstrapSession(()=>true);assert.equal(s.state.signed,true);assert.equal(s.storage.get('device_uuid'),'existing');
});
test('simultaneous anonymous initialization shares one request',async()=>{
 let resolve;const s=setup({}, {'login/anonymous':()=>new Promise(r=>{resolve=r;})});
 const a=s.load('anonymousLogin').loginAnonymous(),b=s.load('anonymousLogin').loginAnonymous();assert.equal(a,b);assert.equal(s.requests.length,1);resolve(guest);await a;
});
test('restored token uses server anonymous flag over stale local flag',async()=>{
 const s=setup({token:'current',isAnonymous:'0'},{'login/token':{c:0,d:{id:7,anonymous:1}}});
 await s.api.bootstrapSession(()=>true);assert.equal(s.storage.get('isAnonymous'),'1');
});
test('late guest response cannot overwrite a newer successful account login',async()=>{
 let resolve;const s=setup({}, {'login/anonymous':()=>new Promise(r=>{resolve=r;})});
 const pending=s.api.bootstrapSession(()=>true);s.storage.set('token','new-account');s.storage.set('isAnonymous','0');s.state.signin({id:99,anonymous:0});resolve(guest);await pending;
 assert.equal(s.storage.get('token'),'new-account');assert.equal(s.storage.get('isAnonymous'),'0');assert.equal(s.state.info.id,99);
});
