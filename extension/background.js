/* Chat Copy 0.2.3 — Firefox launcher, canonical-history proxy, Google OAuth + Drive import. */
(function () {
  'use strict';
  const api = typeof browser !== 'undefined' ? browser : chrome;
  if (!api || !api.tabs) return;

  const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  const TOKEN_URL = 'https://oauth2.googleapis.com/token';
  const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

  async function injectAndToggle(tab) {
    try {
      const target = tab || (await api.tabs.query({active: true, currentWindow: true}))[0];
      if (!target || !target.id || !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//i.test(target.url || '')) return;
      try { await api.tabs.insertCSS(target.id, {file: 'content.css'}); } catch (_) {}
      let present = false;
      try {
        const res = await api.tabs.executeScript(target.id, {code: "Boolean(document.getElementById('chatcopy-v0230-launcher') || document.getElementById('chatcopy-v0230-panel'))"});
        present = !!(res && res[0]);
      } catch (_) {}
      if (!present) {
        await api.tabs.executeScript(target.id, {file: 'content.js'});
        setTimeout(function () { try { api.tabs.sendMessage(target.id, {type: 'CHAT_COPY_TOGGLE'}); } catch (_) {} }, 100);
      } else {
        try { await api.tabs.sendMessage(target.id, {type: 'CHAT_COPY_TOGGLE'}); } catch (_) {}
      }
    } catch (e) { console.error('[Chat Copy 0.2.3] injection failed', e); }
  }

  async function fetchText(url, headers) {
    const r = await fetch(url, {credentials:'include', cache:'no-store', headers:headers || {'Accept':'application/json'}});
    const text = await r.text();
    return {status:r.status, ok:r.ok, text:text, contentType:r.headers.get('content-type') || ''};
  }
  function preview(text) { return String(text || '').replace(/\s+/g,' ').slice(0,240); }

  async function backgroundCanonical(id) {
    const endpoint='https://chatgpt.com/backend-api/conversation/'+encodeURIComponent(id);
    const diag=[];
    let first;
    try { first=await fetchText(endpoint, {'Accept':'application/json'}); diag.push('background endpoint HTTP '+first.status+(first.text?' — '+preview(first.text):'')); }
    catch (e) { diag.push('background endpoint network error — '+(e&&e.message?e.message:String(e))); first=null; }
    if(first && first.ok){
      try { return {ok:true, data:JSON.parse(first.text), diagnostic:diag.join(' | ')}; }
      catch(e){ return {ok:false,error:'Background endpoint returned non-JSON: '+preview(first.text),diagnostic:diag.join(' | ')}; }
    }
    let token=null;
    try {
      const session=await fetchText('https://chatgpt.com/api/auth/session', {'Accept':'application/json'});
      diag.push('background session HTTP '+session.status+(session.text?' — '+preview(session.text):''));
      if(session.ok){ try { const sj=JSON.parse(session.text); if(sj&&typeof sj.accessToken==='string') token=sj.accessToken; } catch(_){} }
    } catch(e){ diag.push('background session network error — '+(e&&e.message?e.message:String(e))); }
    if(token){
      try{
        const second=await fetchText(endpoint, {'Accept':'application/json','Authorization':'Bearer '+token});
        diag.push('background bearer endpoint HTTP '+second.status+(second.text?' — '+preview(second.text):''));
        if(second.ok){ try{return {ok:true,data:JSON.parse(second.text),diagnostic:diag.join(' | ')};} catch(_){return {ok:false,error:'Background bearer endpoint returned non-JSON: '+preview(second.text),diagnostic:diag.join(' | ') };} }
      }catch(e){diag.push('background bearer network error — '+(e&&e.message?e.message:String(e)));}
    } else diag.push('background session did not expose accessToken');
    return {ok:false,error:'Canonical background proxy failed',diagnostic:diag.join(' | ')};
  }

  function storageGet(keys){ return api.storage.local.get(keys); }
  function storageSet(obj){ return api.storage.local.set(obj); }
  function storageRemove(keys){ return api.storage.local.remove(keys); }

  function randomVerifier(len) {
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes=new Uint8Array(len || 72); crypto.getRandomValues(bytes);
    let out=''; for(let i=0;i<bytes.length;i++) out+=chars[bytes[i]%chars.length]; return out;
  }
  function randomState(){ const b=new Uint8Array(24); crypto.getRandomValues(b); return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join(''); }
  function base64Url(bytes){ let s=''; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  async function pkceChallenge(verifier){ const data=new TextEncoder().encode(verifier); const digest=await crypto.subtle.digest('SHA-256',data); return base64Url(new Uint8Array(digest)); }

  function googleLoopbackRedirect(){
    const generated=api.identity.getRedirectURL();
    const host=(new URL(generated)).hostname;
    const sub=host.split('.')[0];
    return 'http://127.0.0.1/mozoauth2/'+sub+'/';
  }

  async function googleStatus(){
    const s=await storageGet(['googleClientId','googleClientSecret','googleAccessToken','googleExpiresAt','googleRefreshToken']);
    const configured=!!(s.googleClientId && /\.apps\.googleusercontent\.com$/i.test(s.googleClientId) && s.googleClientSecret);
    const connected=!!(configured && ((s.googleAccessToken && Number(s.googleExpiresAt||0)>Date.now()+60000) || s.googleRefreshToken));
    return {ok:true,configured,connected,clientId:s.googleClientId||'',hasClientSecret:!!s.googleClientSecret,redirectUri:googleLoopbackRedirect(),scope:GOOGLE_SCOPE};
  }

  async function saveGoogleClient(clientId, clientSecret){
    const id=String(clientId||'').trim();
    const secret=String(clientSecret||'').trim();
    if(!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/i.test(id)) throw new Error('That does not look like a Google OAuth Client ID.');
    if(!secret) throw new Error('Desktop OAuth Client Secret is required for this Google Desktop client.');
    const old=await storageGet(['googleClientId','googleClientSecret']);
    if((old.googleClientId && old.googleClientId!==id) || (old.googleClientSecret && old.googleClientSecret!==secret)) {
      await storageRemove(['googleAccessToken','googleExpiresAt','googleRefreshToken','googleScope']);
    }
    await storageSet({googleClientId:id,googleClientSecret:secret}); return googleStatus();
  }

  async function exchangeCode(clientId, clientSecret, code, verifier, redirectUri){
    const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:code,code_verifier:verifier,redirect_uri:redirectUri,grant_type:'authorization_code'});
    const r=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
    const text=await r.text(); let j={}; try{j=JSON.parse(text);}catch(_){}
    if(!r.ok || !j.access_token) throw new Error('Google token exchange failed (HTTP '+r.status+'): '+(j.error_description||j.error||preview(text)));
    const old=await storageGet(['googleRefreshToken']);
    const save={googleAccessToken:j.access_token,googleExpiresAt:Date.now()+Math.max(60,Number(j.expires_in||3600)-30)*1000,googleScope:j.scope||GOOGLE_SCOPE};
    if(j.refresh_token) save.googleRefreshToken=j.refresh_token; else if(old.googleRefreshToken) save.googleRefreshToken=old.googleRefreshToken;
    await storageSet(save); return j.access_token;
  }

  async function connectGoogle(){
    const s=await storageGet(['googleClientId','googleClientSecret']); const clientId=String(s.googleClientId||'').trim(); const clientSecret=String(s.googleClientSecret||'').trim();
    if(!clientId || !clientSecret) throw new Error('Google is not configured. Save both the Desktop OAuth Client ID and Client Secret first.');
    const verifier=randomVerifier(72), challenge=await pkceChallenge(verifier), state=randomState(), redirectUri=googleLoopbackRedirect();
    const p=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirectUri,scope:GOOGLE_SCOPE,code_challenge:challenge,code_challenge_method:'S256',state:state,access_type:'offline',prompt:'consent'});
    const finalUrl=await api.identity.launchWebAuthFlow({url:AUTH_URL+'?'+p.toString(),interactive:true});
    if(!finalUrl) throw new Error('Google authorization did not return a redirect URL.');
    const u=new URL(finalUrl); const err=u.searchParams.get('error'); if(err) throw new Error('Google authorization failed: '+err);
    if(u.searchParams.get('state')!==state) throw new Error('Google authorization state check failed.');
    const code=u.searchParams.get('code'); if(!code) throw new Error('Google authorization returned no code.');
    await exchangeCode(clientId,clientSecret,code,verifier,redirectUri); return googleStatus();
  }

  async function refreshGoogleToken(){
    const s=await storageGet(['googleClientId','googleClientSecret','googleRefreshToken']);
    if(!s.googleClientId || !s.googleClientSecret || !s.googleRefreshToken) return null;
    const body=new URLSearchParams({client_id:s.googleClientId,client_secret:s.googleClientSecret,refresh_token:s.googleRefreshToken,grant_type:'refresh_token'});
    const r=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
    const text=await r.text(); let j={}; try{j=JSON.parse(text);}catch(_){}
    if(!r.ok || !j.access_token){ await storageRemove(['googleAccessToken','googleExpiresAt']); return null; }
    await storageSet({googleAccessToken:j.access_token,googleExpiresAt:Date.now()+Math.max(60,Number(j.expires_in||3600)-30)*1000,googleScope:j.scope||GOOGLE_SCOPE});
    return j.access_token;
  }

  async function ensureGoogleToken(interactive){
    const s=await storageGet(['googleClientId','googleClientSecret','googleAccessToken','googleExpiresAt']);
    if(!s.googleClientId || !s.googleClientSecret) throw new Error('Google is not configured. Open Google setup and save the Desktop OAuth Client ID and Client Secret.');
    if(s.googleAccessToken && Number(s.googleExpiresAt||0)>Date.now()+60000) return s.googleAccessToken;
    const refreshed=await refreshGoogleToken(); if(refreshed) return refreshed;
    if(interactive) { await connectGoogle(); const n=await storageGet(['googleAccessToken']); if(n.googleAccessToken)return n.googleAccessToken; }
    throw new Error('Google authorization is required.');
  }

  async function driveError(r){ const t=await r.text(); let j={}; try{j=JSON.parse(t);}catch(_){}; return (j.error&&j.error.message)||j.error_description||preview(t)||('HTTP '+r.status); }

  async function driveDestinationStatus(conversationId){
    const s=await storageGet(['managedDriveFolders','conversationDriveFolders','lastGoogleDoc','lastGoogleDocsByConversation']);
    const folders=Array.isArray(s.managedDriveFolders)?s.managedDriveFolders:[];
    const map=(s.conversationDriveFolders&&typeof s.conversationDriveFolders==='object')?s.conversationDriveFolders:{};
    const selectedId=(conversationId&&map[conversationId])?String(map[conversationId]):'';
    const selected=folders.find(f=>f&&f.id===selectedId)||null;
    const perChat=(s.lastGoogleDocsByConversation&&typeof s.lastGoogleDocsByConversation==='object')?s.lastGoogleDocsByConversation:{};
    return {ok:true,folders:folders,selectedId:selectedId,selectedName:selected?selected.name:'My Drive',lastGoogleDoc:(conversationId&&perChat[conversationId])?perChat[conversationId]:(s.lastGoogleDoc||null)};
  }

  async function setConversationFolder(conversationId,folderId){
    const id=String(folderId||'').trim();
    const s=await storageGet(['managedDriveFolders','conversationDriveFolders']);
    const folders=Array.isArray(s.managedDriveFolders)?s.managedDriveFolders:[];
    if(id && !folders.some(f=>f&&f.id===id)) throw new Error("That folder is not in Chat Copy\'s managed folder list.");
    const map=(s.conversationDriveFolders&&typeof s.conversationDriveFolders==='object')?s.conversationDriveFolders:{};
    if(conversationId){ if(id)map[conversationId]=id; else delete map[conversationId]; }
    await storageSet({conversationDriveFolders:map});
    return driveDestinationStatus(conversationId);
  }

  async function createDriveFolder(name,parentId,conversationId){
    const clean=String(name||'').trim();
    if(!clean) throw new Error('Enter a folder name first.');
    const token=await ensureGoogleToken(true);
    const metadata={name:clean.slice(0,255),mimeType:'application/vnd.google-apps.folder'};
    if(parentId)metadata.parents=[String(parentId)];
    const r=await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,parents,mimeType,webViewLink',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(metadata)});
    if(!r.ok){ if(r.status===401)await storageRemove(['googleAccessToken','googleExpiresAt']); throw new Error('Google Drive folder creation failed: '+await driveError(r)); }
    const folder=await r.json();
    const s=await storageGet(['managedDriveFolders','conversationDriveFolders']);
    const folders=Array.isArray(s.managedDriveFolders)?s.managedDriveFolders.slice():[];
    if(!folders.some(f=>f&&f.id===folder.id))folders.push({id:folder.id,name:folder.name||metadata.name,parentId:parentId||'',createdAt:new Date().toISOString()});
    const map=(s.conversationDriveFolders&&typeof s.conversationDriveFolders==='object')?s.conversationDriveFolders:{};
    if(conversationId)map[conversationId]=folder.id;
    await storageSet({managedDriveFolders:folders,conversationDriveFolders:map});
    return {ok:true,folder:folders.find(f=>f.id===folder.id),folders:folders,selectedId:folder.id,selectedName:folder.name||metadata.name};
  }

  async function makeAnyoneReader(fileId,token){
    const r=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'/permissions?fields=id,type,role,allowFileDiscovery',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})});
    if(!r.ok)throw new Error('Google Drive sharing failed: '+await driveError(r));
    return await r.json();
  }

  async function shareLastGoogleDoc(conversationId){
    const s=await storageGet(['lastGoogleDoc','lastGoogleDocsByConversation']);
    const perChat=(s.lastGoogleDocsByConversation&&typeof s.lastGoogleDocsByConversation==='object')?s.lastGoogleDocsByConversation:{};
    const doc=(conversationId&&perChat[conversationId])?perChat[conversationId]:s.lastGoogleDoc;
    if(!doc||!doc.id)throw new Error('No Google Doc has been created by Chat Copy for this chat yet.');
    const token=await ensureGoogleToken(true);
    await makeAnyoneReader(doc.id,token);
    const updated=Object.assign({},doc,{shared:true,sharedAt:new Date().toISOString()});
    if(conversationId)perChat[conversationId]=updated;
    await storageSet({lastGoogleDoc:updated,lastGoogleDocsByConversation:perChat});
    return {ok:true,doc:updated};
  }

  async function createGoogleDoc(title, markdown, options){
    const token=await ensureGoogleToken(true);
    const opts=options||{};
    const bytes=new TextEncoder().encode(String(markdown||''));
    const metadata={name:(String(title||'ChatGPT Conversation').trim()||'ChatGPT Conversation').slice(0,255),mimeType:'application/vnd.google-apps.document'};
    if(opts.folderId)metadata.parents=[String(opts.folderId)];
    let result;
    if(bytes.byteLength <= 4.5*1024*1024){
      const boundary='chatcopy_'+Math.random().toString(16).slice(2)+Date.now().toString(16);
      const head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n';
      const tail='\r\n--'+boundary+'--';
      const body=new Blob([head,bytes,tail],{type:'multipart/related; boundary='+boundary});
      const r=await fetch(DRIVE_UPLOAD+'?uploadType=multipart&fields=id,name,webViewLink,parents',{method:'POST',headers:{'Authorization':'Bearer '+token},body});
      if(!r.ok){ if(r.status===401){ await storageRemove(['googleAccessToken','googleExpiresAt']); } throw new Error('Google Drive create failed: '+await driveError(r)); }
      result=await r.json();
    } else {
      const init=await fetch(DRIVE_UPLOAD+'?uploadType=resumable&fields=id,name,webViewLink,parents',{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'text/markdown; charset=UTF-8','X-Upload-Content-Length':String(bytes.byteLength)},body:JSON.stringify(metadata)});
      if(!init.ok){ if(init.status===401){ await storageRemove(['googleAccessToken','googleExpiresAt']); } throw new Error('Google Drive resumable upload start failed: '+await driveError(init)); }
      const location=init.headers.get('Location'); if(!location) throw new Error('Google Drive did not return a resumable upload URL.');
      const put=await fetch(location,{method:'PUT',headers:{'Authorization':'Bearer '+token,'Content-Type':'text/markdown; charset=UTF-8','Content-Length':String(bytes.byteLength)},body:bytes});
      if(!put.ok) throw new Error('Google Drive upload failed: '+await driveError(put));
      result=await put.json();
      if(!result.webViewLink && result.id){
        try{const g=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(result.id)+'?fields=id,name,webViewLink,parents',{headers:{'Authorization':'Bearer '+token}});if(g.ok)result=await g.json();}catch(_){}
      }
    }
    if(!result || !result.id) throw new Error('Google Drive created a file but returned no document ID.');
    const url=result.webViewLink || ('https://docs.google.com/document/d/'+encodeURIComponent(result.id)+'/edit');
    let shared=false,shareError=null;
    if(opts.shareAnyone){ try{await makeAnyoneReader(result.id,token);shared=true;}catch(e){shareError=e&&e.message?e.message:String(e);} }
    const lastGoogleDoc={id:result.id,name:result.name||metadata.name,url:url,folderId:opts.folderId||'',shared:shared,createdAt:new Date().toISOString()};
    const oldDocs=await storageGet(['lastGoogleDocsByConversation']);
    const perChat=(oldDocs.lastGoogleDocsByConversation&&typeof oldDocs.lastGoogleDocsByConversation==='object')?oldDocs.lastGoogleDocsByConversation:{};
    if(opts.conversationId)perChat[opts.conversationId]=lastGoogleDoc;
    await storageSet({lastGoogleDoc:lastGoogleDoc,lastGoogleDocsByConversation:perChat});
    await api.tabs.create({url:url});
    return {ok:true,id:result.id,name:lastGoogleDoc.name,url:url,folderId:lastGoogleDoc.folderId,shared:shared,shareError:shareError};
  }

  if (api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener(function(msg) {
      if (!msg) return;
      if (msg.type === 'CHAT_COPY_FETCH_CANONICAL' && msg.id) return backgroundCanonical(msg.id).catch(e=>({ok:false,error:e&&e.message?e.message:String(e),diagnostic:'background proxy threw'}));
      if (msg.type === 'CHAT_COPY_GOOGLE_STATUS') return googleStatus().catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_GOOGLE_SAVE_CLIENT') return saveGoogleClient(msg.clientId,msg.clientSecret).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_GOOGLE_CONNECT') return connectGoogle().then(()=>googleStatus()).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_GOOGLE_DISCONNECT') return storageRemove(['googleAccessToken','googleExpiresAt','googleRefreshToken','googleScope']).then(()=>googleStatus()).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_DRIVE_DEST_STATUS') return driveDestinationStatus(msg.conversationId).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_DRIVE_SET_DEST') return setConversationFolder(msg.conversationId,msg.folderId).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_DRIVE_CREATE_FOLDER') return createDriveFolder(msg.name,msg.parentId,msg.conversationId).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_SHARE_LAST_DOC') return shareLastGoogleDoc(msg.conversationId).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
      if (msg.type === 'CHAT_COPY_CREATE_GOOGLE_DOC') return createGoogleDoc(msg.title,msg.markdown,msg.options).catch(e=>({ok:false,error:e&&e.message?e.message:String(e)}));
    });
  }

  if (api.browserAction && api.browserAction.onClicked) api.browserAction.onClicked.addListener(tab=>injectAndToggle(tab));
  if (api.commands && api.commands.onCommand) api.commands.onCommand.addListener(command=>{if(command==='toggle-chat-copy')injectAndToggle();});
})();
