import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const storage=new Map<string,string>();
const fetchMock=vi.fn<typeof fetch>();
const response=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const success=()=>response(200,{success:true,data:{ok:true}});
const rotated=()=>response(200,{success:true,data:{accessToken:'fresh-access',refreshToken:'fresh-refresh'}});
function deferred(){let resolve!:(value:Response)=>void;const promise=new Promise<Response>(r=>resolve=r);return {promise,resolve};}
beforeEach(()=>{
 vi.resetModules();storage.clear();fetchMock.mockReset();
 vi.stubGlobal('fetch',fetchMock);
 vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
 vi.stubGlobal('navigator',{});
});
afterEach(()=>vi.unstubAllGlobals());
async function setup(){const module=await import('@/lib/api');module.setTokens('old-access','old-refresh');return module;}
async function beginRefresh(){
 const module=await setup();const refresh=deferred();
 fetchMock.mockResolvedValueOnce(response(401,{})).mockReturnValueOnce(refresh.promise);
 const request=module.api.get('/api/v1/test');
 await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(2));
 return {module,refresh,request};
}
describe('session refresh ownership',()=>{
 it('does not clear a peer rotation when a stale refresh is rejected without Web Locks',async()=>{
  const {refresh,request}=await beginRefresh();
  storage.set('fra_access_token','fresh-access');storage.set('fra_refresh_token','fresh-refresh');
  fetchMock.mockResolvedValueOnce(success());refresh.resolve(response(401,{}));
  await expect(request).resolves.toEqual({ok:true});expect(storage.get('fra_refresh_token')).toBe('fresh-refresh');
 });
 it('does not restore tokens after logout while refresh is pending',async()=>{
  const {module,refresh,request}=await beginRefresh();const assertion=expect(request).rejects.toThrow('Session expired');
  module.clearTokens();refresh.resolve(rotated());await assertion;expect(module.hasStoredTokens()).toBe(false);
 });
 it('does not overwrite or retry as another account after a new login',async()=>{
  const {module,refresh,request}=await beginRefresh();const assertion=expect(request).rejects.toThrow('Session expired');
  module.setTokens('other-access','other-refresh');refresh.resolve(rotated());await assertion;
  expect(storage.get('fra_access_token')).toBe('other-access');expect(fetchMock).toHaveBeenCalledTimes(2);
 });
 it('preserves credentials on a transient server error',async()=>{
  const {refresh,request}=await beginRefresh();const assertion=expect(request).rejects.toThrow('Session expired');
  refresh.resolve(response(503,{}));await assertion;expect(storage.get('fra_refresh_token')).toBe('old-refresh');
 });
 it('retains credentials on a refused fallback refresh so a peer can still commit',async()=>{
  const {refresh,request}=await beginRefresh();const assertion=expect(request).rejects.toThrow('Session expired');
  refresh.resolve(response(401,{}));await assertion;expect(storage.get('fra_refresh_token')).toBe('old-refresh');
 });
 it('clears a genuinely refused session when rotation is exclusive',async()=>{
  vi.stubGlobal('navigator',{locks:{request:(_name:string,work:()=>Promise<boolean>)=>work()}});
  const {refresh,request}=await beginRefresh();const assertion=expect(request).rejects.toThrow('Session expired');
  refresh.resolve(response(401,{}));await assertion;expect(storage.has('fra_refresh_token')).toBe(false);
 });
 it('coordinates independent module instances through an origin-wide lock',async()=>{
  let queue=Promise.resolve<unknown>(undefined);
  const lock=vi.fn((_name:string,work:()=>Promise<boolean>)=>{const result=queue.then(work);queue=result.catch(()=>undefined);return result;});
  vi.stubGlobal('navigator',{locks:{request:lock}});
  const first=await setup();vi.resetModules();const second=await import('@/lib/api');
  let refreshes=0;
  fetchMock.mockImplementation(async(input,init)=>{
   if(String(input).endsWith('/auth/refresh')){refreshes++;return rotated();}
   const auth=(init?.headers as Record<string,string>)?.Authorization;
   return auth==='Bearer fresh-access'?success():response(401,{});
  });
  await expect(Promise.all([first.api.get('/api/v1/test'),second.api.get('/api/v1/test')])).resolves.toEqual([{ok:true},{ok:true}]);
  expect(lock).toHaveBeenCalledTimes(2);expect(refreshes).toBe(1);
 });
});
