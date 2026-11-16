const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('proxy.ts','utf8');
const fn=source.slice(source.indexOf('function isBusinessRouteProtected('),source.indexOf('// /cars needs'));
const context={};vm.createContext(context);vm.runInContext(ts.transpileModule(fn+'\nglobalThis.check=isBusinessRouteProtected;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
test('business agreement is public with exact-match exemption only',()=>{assert.equal(context.check('/business/terms'),false);for(const p of ['/business','/business/billing','/business/campaigns','/business/terms-extra','/business/terms/admin'])assert.equal(context.check(p),true,p);});
test('existing public signup and password restoration remain public',()=>{for(const p of ['/business/join','/business/join/signup','/business/set-password'])assert.equal(context.check(p),false,p);});
