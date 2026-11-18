import { describe, it, expect, jest } from '@jest/globals';
const values=new Map<string,string>();
const getdel=jest.fn(async (key:string)=>{const value=values.get(key);values.delete(key);return value??null;});
jest.unstable_mockModule('../src/redis.js',()=>({getRedis:()=>({getdel,set:async(key:string,value:string)=>{values.set(key,value);}})}));
const resets=await import('../src/db/password-reset.js');
const confirmations=await import('../src/db/email-verification.js');
describe('Redis account link claims',()=>{
 it('uses atomic GETDEL for reset and confirmation and preserves existing key formats',async()=>{
  for(const [set,consume] of [[resets.setPasswordResetToken,resets.consumePasswordResetToken],[confirmations.setEmailVerificationToken,confirmations.consumeEmailVerificationToken]] as const){
   const token=crypto.randomUUID();await set(token,'user');expect(await Promise.all([consume(token),consume(token)])).toEqual(['user',null]);
  }
  expect(getdel).toHaveBeenCalledTimes(4);
 });
});
