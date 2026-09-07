/* Chat Copy 0.2.3 — Firefox P1 direct Google Docs build. */
(function () {
  'use strict';

  const VERSION = '0.2.3';
  const LAUNCHER_ID = 'chatcopy-v0230-launcher';
  const PANEL_ID = 'chatcopy-v0230-panel';
  const TOAST_ID = 'chatcopy-v0230-toast';
  const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
  let lastCapture = null;
  let scanning = false;
  let lastCanonicalError = null;
  let lastDriveState = null;

  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function stripTitle(s) { return (s || 'ChatGPT Conversation').replace(/\s*[|–—-]\s*ChatGPT\s*$/i, '').trim() || 'ChatGPT Conversation'; }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function safeFilename(name, ext) {
    const base=(name||'ChatGPT Conversation').replace(/[\\/:*?"<>|]/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'ChatGPT Conversation';
    return base+'.'+ext;
  }

  function createUi() {
    if (!document.body) return false;
    cleanupLegacyUi();
    if (!document.getElementById(LAUNCHER_ID)) {
      const launcher=document.createElement('button'); launcher.id=LAUNCHER_ID; launcher.type='button'; launcher.textContent='Chat Copy'; launcher.setAttribute('aria-label','Open Chat Copy');
      document.body.appendChild(launcher); launcher.addEventListener('click',togglePanel);
    }
    if (!document.getElementById(PANEL_ID)) {
      const panel=document.createElement('div'); panel.id=PANEL_ID;
      panel.innerHTML=[
        '<div class="cc-head"><div><div class="cc-title">Chat Copy</div><div class="cc-version">Firefox Drive '+VERSION+'</div></div><button type="button" class="cc-close" data-cc-action="close" title="Close">×</button></div>',
        '<div class="cc-chat-title" data-cc="title">Current conversation</div>',
        '<div class="cc-meta" data-cc="meta">Canonical capture ready.</div>',
        '<div class="cc-stack">',
          '<button type="button" class="cc-btn cc-primary" data-cc-action="doc">Export directly to Google Docs</button>',
          '<button type="button" class="cc-btn" data-cc-action="scan">Scan entire chat</button>',
          '<button type="button" class="cc-btn" data-cc-action="rich">Copy entire chat as rich text</button>',
        '</div>',
        '<div class="cc-grid"><button type="button" class="cc-btn" data-cc-action="html">HTML</button><button type="button" class="cc-btn" data-cc-action="md">Markdown</button><button type="button" class="cc-btn" data-cc-action="json">JSON</button></div>',
        '<label class="cc-opt"><input type="checkbox" data-cc="source" checked> Include source URL and export metadata</label>',
        '<label class="cc-opt"><input type="checkbox" data-cc="json-sidecar"> Also download JSON truth layer when creating Google Doc</label>',
        '<div class="cc-drive">',
          '<div class="cc-section-title">Google Drive destination</div>',
          '<label class="cc-field">Folder<select data-cc="folder-select"><option value="">My Drive</option></select></label>',
          '<div class="cc-inline"><input type="text" data-cc="folder-name" placeholder="New folder name" spellcheck="false"><button type="button" class="cc-btn" data-cc-action="folder-create">Create & use</button></div>',
          '<div class="cc-google-help">Folders created here are remembered. Each chat remembers its own destination. New Google Docs use the ChatGPT chat title automatically.</div>',
          '<label class="cc-opt cc-public"><input type="checkbox" data-cc="share-anyone"> Anyone with the link can view</label>',
          '<label class="cc-opt"><input type="checkbox" data-cc="copy-link" checked> Copy Google Doc link after export</label>',
          '<div class="cc-two"><button type="button" class="cc-btn" data-cc-action="share-last">Share last + copy link</button><button type="button" class="cc-btn" data-cc-action="copy-last-link">Copy last link</button></div>',
          '<div class="cc-dest-state" data-cc="dest-state">Destination: My Drive</div>',
        '</div>',
        '<button type="button" class="cc-linkbtn" data-cc-action="google-toggle">Google setup</button>',
        '<div class="cc-google" data-cc="google-box" hidden>',
          '<div class="cc-google-state" data-cc="google-state">Checking Google connection…</div>',
          '<label class="cc-field">Desktop OAuth Client ID<input type="text" data-cc="google-client" placeholder="123456789-…apps.googleusercontent.com" spellcheck="false"></label>',
          '<label class="cc-field">Desktop OAuth Client Secret<input type="password" data-cc="google-secret" placeholder="Paste the Client secret from Google Cloud" autocomplete="off" spellcheck="false"></label>',
          '<div class="cc-google-help">One-time setup: create a <strong>Desktop app</strong> OAuth client in Google Cloud, then paste its Client ID and Client Secret here. Both stay only in Firefox extension storage.</div>',
          '<div class="cc-row"><button type="button" class="cc-btn" data-cc-action="google-save">Save Google credentials</button><button type="button" class="cc-btn" data-cc-action="google-connect">Connect Google</button><button type="button" class="cc-btn" data-cc-action="google-disconnect">Disconnect</button></div>',
          '<div class="cc-redirect" data-cc="google-redirect"></div>',
        '</div>',
        '<div class="cc-status" data-cc="status"></div>'
      ].join('');
      document.body.appendChild(panel); panel.addEventListener('click',handlePanelClick); panel.addEventListener('change',handlePanelChange);
    }
    return true;
  }

  function cleanupLegacyUi(){
    try{document.querySelectorAll('[id^="chatcopy-v"]').forEach(function(el){if(el.id!==LAUNCHER_ID&&el.id!==PANEL_ID&&el.id!==TOAST_ID)el.remove();});}catch(_){}
  }
  function toast(text){const old=document.getElementById(TOAST_ID);if(old)old.remove();if(!document.body)return;const el=document.createElement('div');el.id=TOAST_ID;el.textContent=text;document.body.appendChild(el);setTimeout(function(){if(el&&el.parentNode)el.parentNode.removeChild(el);},2600);}
  function panel(){return document.getElementById(PANEL_ID);} function q(name){const p=panel();return p?p.querySelector('[data-cc="'+name+'"]'):null;}
  function setStatus(text,kind){const el=q('status');if(!el)return;el.textContent=text||'';el.className='cc-status'+(kind?' cc-'+kind:'');}
  async function bgMessage(msg){
    if(!api||!api.runtime||!api.runtime.sendMessage)throw new Error('Extension background messaging is unavailable.');
    const r=await api.runtime.sendMessage(msg); if(!r)throw new Error('Extension background returned no result.'); return r;
  }
  async function updateGoogleStatus(){
    try{
      const r=await bgMessage({type:'CHAT_COPY_GOOGLE_STATUS'}); const el=q('google-state'),input=q('google-client'),redir=q('google-redirect');
      if(!r.ok)throw new Error(r.error||'Google status failed.');
      if(input && !input.value && r.clientId)input.value=r.clientId;
      if(el)el.textContent=r.connected?'Google: connected':(r.configured?'Google: configured, not connected':'Google: not configured');
      if(redir)redir.textContent='OAuth redirect: '+r.redirectUri;
      return r;
    }catch(e){const el=q('google-state');if(el)el.textContent='Google status error: '+(e&&e.message?e.message:String(e));return null;}
  }
  function showGoogleSetup(show){const box=q('google-box');if(box)box.hidden=show===false?true:!box.hidden;if(box&&!box.hidden)updateGoogleStatus();}
  async function saveGoogleClient(){const input=q('google-client'),secretInput=q('google-secret');const id=input?input.value.trim():'';const secret=secretInput?secretInput.value.trim():'';const r=await bgMessage({type:'CHAT_COPY_GOOGLE_SAVE_CLIENT',clientId:id,clientSecret:secret});if(!r.ok)throw new Error(r.error||'Could not save Google OAuth credentials.');if(secretInput)secretInput.value='';await updateGoogleStatus();setStatus('Google OAuth credentials saved locally. Click Connect Google once, then exports become one-click.','ok');}
  async function connectGoogle(){setStatus('Opening Google authorization…');const r=await bgMessage({type:'CHAT_COPY_GOOGLE_CONNECT'});if(!r.ok)throw new Error(r.error||'Google connection failed.');await updateGoogleStatus();setStatus('Google connected. Direct Google Docs export is ready.','ok');}
  async function disconnectGoogle(){const r=await bgMessage({type:'CHAT_COPY_GOOGLE_DISCONNECT'});if(!r.ok)throw new Error(r.error||'Google disconnect failed.');await updateGoogleStatus();setStatus('Google authorization removed from Chat Copy.','ok');}
  function folderPath(folder,all){
    if(!folder)return 'My Drive';
    const byId={};(all||[]).forEach(function(f){if(f&&f.id)byId[f.id]=f;});
    const names=[];let cur=folder,guard=0;
    while(cur&&guard++<20){names.unshift(cur.name||'Folder');cur=cur.parentId?byId[cur.parentId]:null;}
    return names.join(' / ');
  }
  async function updateDriveDestination(){
    try{
      const r=await bgMessage({type:'CHAT_COPY_DRIVE_DEST_STATUS',conversationId:conversationIdFromUrl()});
      if(!r.ok)throw new Error(r.error||'Drive destination status failed.');
      lastDriveState=r;
      const sel=q('folder-select'),state=q('dest-state');
      if(sel){
        const current=r.selectedId||''; sel.innerHTML='';
        const root=document.createElement('option');root.value='';root.textContent='My Drive';sel.appendChild(root);
        (r.folders||[]).forEach(function(f){const o=document.createElement('option');o.value=f.id;o.textContent=folderPath(f,r.folders);sel.appendChild(o);});
        sel.value=current;
      }
      if(state)state.textContent='Destination: '+(r.selectedId?folderPath((r.folders||[]).find(function(f){return f.id===r.selectedId;}),r.folders):'My Drive')+(r.lastGoogleDoc&&r.lastGoogleDoc.url?' · Last Doc ready':'');
      return r;
    }catch(e){const state=q('dest-state');if(state)state.textContent='Destination error: '+(e&&e.message?e.message:String(e));return null;}
  }
  async function setDriveDestination(folderId){
    const r=await bgMessage({type:'CHAT_COPY_DRIVE_SET_DEST',conversationId:conversationIdFromUrl(),folderId:folderId||''});
    if(!r.ok)throw new Error(r.error||'Could not set Drive destination.');
    await updateDriveDestination();
    setStatus('Drive destination saved for this chat: '+(r.selectedName||'My Drive')+'.','ok');
  }
  async function createDriveFolder(){
    const input=q('folder-name'),sel=q('folder-select');const name=input?input.value.trim():'';if(!name)throw new Error('Enter a new folder name first.');
    setStatus('Creating Drive folder “'+name+'”…');
    const r=await bgMessage({type:'CHAT_COPY_DRIVE_CREATE_FOLDER',name:name,parentId:sel?sel.value:'',conversationId:conversationIdFromUrl()});
    if(!r.ok)throw new Error(r.error||'Could not create Drive folder.');
    if(input)input.value='';await updateDriveDestination();setStatus('Created and selected Drive folder: '+(r.selectedName||name)+'.','ok');
  }
  async function copyLastGoogleDocLink(){
    const r=await updateDriveDestination();const doc=r&&r.lastGoogleDoc;if(!doc||!doc.url)throw new Error('No Google Doc has been created by Chat Copy yet.');
    await copyPlain(doc.url);setStatus('Last Google Doc link copied.','ok');
  }
  async function shareLastGoogleDoc(){
    setStatus('Setting the last Google Doc to anyone-with-link view…');
    const r=await bgMessage({type:'CHAT_COPY_SHARE_LAST_DOC',conversationId:conversationIdFromUrl()});if(!r.ok)throw new Error(r.error||'Could not change sharing.');
    if(!r.doc||!r.doc.url)throw new Error('Google returned no link for the last document.');
    await copyPlain(r.doc.url);await updateDriveDestination();setStatus('Last Google Doc is now anyone-with-link view. Link copied.','ok');
  }
  function togglePanel(){createUi();const p=panel();if(!p)return;p.classList.toggle('chatcopy-open');const open=p.classList.contains('chatcopy-open');const l=document.getElementById(LAUNCHER_ID);if(l)l.style.setProperty('display',open?'none':'block','important');if(open){updateGoogleStatus();updateDriveDestination();}}
  function closePanel(){const p=panel();if(p)p.classList.remove('chatcopy-open');const l=document.getElementById(LAUNCHER_ID);if(l)l.style.setProperty('display','block','important');}

  function sanitize(root) {
    const clone=root.cloneNode(true); const unwantedButton=/(copy|edit|read aloud|good response|bad response|regenerate|retry|share|more|sources?|branch)/i;
    clone.querySelectorAll('.katex').forEach(function(k){const ann=k.querySelector('annotation[encoding="application/x-tex"]');const tex=ann&&ann.textContent?ann.textContent.trim():'';if(tex)k.replaceWith(document.createTextNode('$'+tex+'$'));});
    clone.querySelectorAll('img,picture').forEach(function(img){const alt=img.getAttribute&&img.getAttribute('alt')?img.getAttribute('alt').trim():'';const span=document.createElement('span');span.textContent=alt?'[Image: '+alt+']':'[Image]';img.replaceWith(span);});
    clone.querySelectorAll('button').forEach(function(btn){const text=(btn.innerText||btn.textContent||'').trim();const aria=(btn.getAttribute('aria-label')||'').trim();if(!text||unwantedButton.test(text+' '+aria)){btn.remove();}else{const span=document.createElement('span');span.textContent=text;btn.replaceWith(span);}});
    clone.querySelectorAll('script,style,svg,canvas,video,audio,iframe,form,textarea,input,noscript').forEach(function(n){n.remove();});
    clone.querySelectorAll('*').forEach(function(el){Array.from(el.attributes).forEach(function(a){const n=a.name.toLowerCase();if(n.indexOf('on')===0||n==='class'||n==='id'||n.indexOf('data-')===0||n==='style')el.removeAttribute(a.name);});if(el.tagName.toLowerCase()==='a'){const href=el.getAttribute('href')||'';if(!/^https?:\/\//i.test(href))el.removeAttribute('href');}});
    return clone.innerHTML.trim();
  }
  function chooseContentRoot(node){return node.querySelector('.markdown')||node.querySelector('[class*="whitespace-pre-wrap"]')||node.querySelector('.prose')||node;}
  function normalizeText(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function hashString(s){
    // FNV-1a 32-bit: compact deterministic fingerprint for fallback identity.
    let h=0x811c9dc5;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193);}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function turnHint(turn){
    const test=turn.getAttribute&&turn.getAttribute('data-testid')||'';
    const m=test.match(/conversation-turn-(\d+)/i);
    return m?parseInt(m[1],10):null;
  }
  function roleOfTurn(turn){
    const explicit=(turn.getAttribute&&turn.getAttribute('data-turn')||'').toLowerCase();
    if(explicit==='user'||explicit==='assistant')return explicit;
    const roleNode=turn.querySelector&&turn.querySelector('[data-message-author-role]');
    return roleNode?(roleNode.getAttribute('data-message-author-role')||'unknown').toLowerCase():'unknown';
  }
  function stableMessageId(turn,roleNode){
    const candidates=[];
    function add(n){if(n&&candidates.indexOf(n)===-1)candidates.push(n);}
    add(roleNode); add(turn);
    try{add(roleNode&&roleNode.closest('[data-message-id]'));}catch(_){}
    try{add(turn&&turn.closest('[data-message-id]'));}catch(_){}
    try{add(roleNode&&roleNode.querySelector('[data-message-id]'));}catch(_){}
    try{add(turn&&turn.querySelector('[data-message-id]'));}catch(_){}
    const attrs=['data-message-id','data-turn-id','data-message-uuid','data-id'];
    for(const n of candidates){
      for(const a of attrs){
        const v=(n.getAttribute&&n.getAttribute(a)||'').trim();
        if(v && !/^\d+$/.test(v) && !/^conversation-turn-/i.test(v)) return a+':'+v;
      }
    }
    return null;
  }
  function messageFromTurn(turn){
    const role=roleOfTurn(turn);
    if(['user','assistant','system','tool'].indexOf(role)===-1)return null;
    const roleNode=(turn.querySelector&&turn.querySelector('[data-message-author-role]'))||turn;
    const root=chooseContentRoot(roleNode);
    const html=sanitize(root);
    const temp=document.createElement('div'); temp.innerHTML=html;
    const text=(temp.innerText||temp.textContent||'').trim();
    if(!text)return null;
    const stableId=stableMessageId(turn,roleNode);
    const norm=normalizeText(text);
    const fingerprint=role+':'+hashString(role+'\n'+norm);
    return {role:role,html:html,text:text,stableId:stableId,fingerprint:fingerprint,key:stableId?('id:'+stableId):('fp:'+fingerprint),turnHint:turnHint(turn)};
  }
  function visibleWindow(){
    let turns=Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
    if(!turns.length){
      const seen=new Set();
      turns=Array.from(document.querySelectorAll('[data-message-author-role]')).map(function(n){return n.closest('[data-testid^="conversation-turn-"]')||n;}).filter(function(n){if(seen.has(n))return false;seen.add(n);return true;});
    }
    const messages=[];
    let prevKey=null;
    turns.forEach(function(turn){
      const m=messageFromTurn(turn); if(!m)return;
      // Nested renderer copies can produce the same physical message twice consecutively.
      if(m.key===prevKey)return;
      messages.push(m); prevKey=m.key;
    });
    return messages;
  }
  function windowSignature(win){
    if(!win.length)return 'empty';
    return win.length+'|'+win.slice(0,3).map(function(m){return m.key;}).join('|')+'|'+win.slice(-3).map(function(m){return m.key;}).join('|');
  }
  function findSubsequence(hay,needle){
    if(!needle.length)return 0;
    if(needle.length>hay.length)return -1;
    outer:for(let i=0;i<=hay.length-needle.length;i++){
      for(let j=0;j<needle.length;j++)if(hay[i+j]!==needle[j])continue outer;
      return i;
    }
    return -1;
  }
  function suffixPrefixOverlap(seq,win){
    const max=Math.min(seq.length,win.length);
    for(let k=max;k>=1;k--){
      let ok=true;
      for(let i=0;i<k;i++)if(seq[seq.length-k+i]!==win[i]){ok=false;break;}
      if(ok)return k;
    }
    return 0;
  }
  function makeAssembler(){return {sequence:[],messageByKey:new Map(),windows:0,breaks:0,stableIdSeen:0,totalObserved:0};}
  function rememberMessages(a,win){
    win.forEach(function(m){
      a.totalObserved++;
      if(m.stableId)a.stableIdSeen++;
      const old=a.messageByKey.get(m.key);
      if(!old||m.text.length>old.text.length)a.messageByKey.set(m.key,m);
    });
  }
  function addWindow(a,win){
    if(!win.length)return;
    a.windows++;
    rememberMessages(a,win);
    const keys=win.map(function(m){return m.key;});
    if(!a.sequence.length){a.sequence=keys.slice();return;}
    // If this complete renderer window is already represented, it adds no new chronology.
    if(findSubsequence(a.sequence,keys)!==-1)return;
    const overlap=suffixPrefixOverlap(a.sequence,keys);
    if(overlap>0){a.sequence.push.apply(a.sequence,keys.slice(overlap));return;}
    // A window can sometimes begin slightly before the current tail because of renderer recycling.
    // Find the longest anchored overlap anywhere near the tail and extend only past the sequence end.
    let best={len:0,si:-1,wi:-1};
    const seqStart=Math.max(0,a.sequence.length-80);
    for(let si=seqStart;si<a.sequence.length;si++){
      for(let wi=0;wi<Math.min(keys.length,30);wi++){
        let k=0;while(si+k<a.sequence.length&&wi+k<keys.length&&a.sequence[si+k]===keys[wi+k])k++;
        if(k>best.len)best={len:k,si:si,wi:wi};
      }
    }
    if(best.len>=2 || (best.len===1 && (a.sequence.length<3||keys.length<3))){
      const offset=best.si-best.wi;
      const suffixStart=a.sequence.length-offset;
      if(suffixStart<keys.length)a.sequence.push.apply(a.sequence,keys.slice(Math.max(0,suffixStart)));
      return;
    }
    // No trustworthy overlap means we may have skipped a virtualized batch. Keep the data but flag it.
    a.breaks++;
    a.sequence.push.apply(a.sequence,keys);
  }
  function assemblerMessages(a){
    return a.sequence.map(function(k){return a.messageByKey.get(k);}).filter(Boolean);
  }
  function findScrollHost(){
    const visibleTurn=document.querySelector('[data-testid^="conversation-turn-"]');
    if(visibleTurn){let el=visibleTurn.parentElement;while(el&&el!==document.body&&el!==document.documentElement){const cs=getComputedStyle(el);if((/auto|scroll/i.test(cs.overflowY)||/auto|scroll/i.test(cs.overflow))&&el.scrollHeight>el.clientHeight+100)return el;el=el.parentElement;}}
    const root=document.scrollingElement||document.documentElement;if(root&&root.scrollHeight>root.clientHeight+100)return root;
    let best=null,bestScore=0;Array.from(document.querySelectorAll('main,section,div')).forEach(function(el){if(el.clientHeight<250||el.scrollHeight<=el.clientHeight+150)return;const r=el.getBoundingClientRect();if(r.width<350||r.height<250)return;const cs=getComputedStyle(el);if(!/auto|scroll/i.test(cs.overflowY+' '+cs.overflow))return;const score=(el.scrollHeight-el.clientHeight)+(el.querySelector('[data-testid^="conversation-turn-"]')?1000000:0);if(score>bestScore){best=el;bestScore=score;}});return best||root;
  }
  function setScroll(host,y){if(host===document.scrollingElement||host===document.documentElement||host===document.body){window.scrollTo(0,y);}else{host.scrollTop=y;host.dispatchEvent(new Event('scroll',{bubbles:true}));}}
  function getTop(host){if(host===document.scrollingElement||host===document.documentElement||host===document.body)return window.scrollY||document.documentElement.scrollTop||0;return host.scrollTop;}
  function getMax(host){if(host===document.scrollingElement||host===document.documentElement||host===document.body){const r=document.scrollingElement||document.documentElement;return Math.max(0,r.scrollHeight-window.innerHeight);}return Math.max(0,host.scrollHeight-host.clientHeight);}
  function getViewport(host){return (host===document.scrollingElement||host===document.documentElement||host===document.body)?window.innerHeight:host.clientHeight;}

  async function wakeOlderHistory(host){
    let stable=0,prevSig='',prevMax=-1;
    for(let round=0;round<55&&stable<6;round++){
      setScroll(host,0);
      try{host.dispatchEvent(new Event('scroll',{bubbles:true}));}catch(_){}
      try{host.dispatchEvent(new WheelEvent('wheel',{deltaY:-1400,bubbles:true,cancelable:true}));}catch(_){}
      await sleep(round<5?700:460);
      const win=visibleWindow(); const sig=windowSignature(win); const max=getMax(host);
      setStatus('Loading oldest history… top window '+win.length+' messages');
      if(sig===prevSig && Math.abs(max-prevMax)<4)stable++;else stable=0;
      prevSig=sig;prevMax=max;
      await sleep(90);
    }
  }
  async function sweepDown(host,a){
    let loops=0,lastTop=-1,stagnant=0;
    setScroll(host,0);await sleep(380);
    while(loops<2200){
      loops++;
      const win=visibleWindow(); addWindow(a,win);
      const msgs=assemblerMessages(a);
      setStatus('Stitching conversation… '+msgs.length+' messages · '+a.windows+' windows · '+a.breaks+' breaks');
      const top=getTop(host),max=getMax(host),view=Math.max(320,getViewport(host));
      if(top>=max-3){await sleep(450);addWindow(a,visibleWindow());break;}
      if(Math.abs(top-lastTop)<2)stagnant++;else stagnant=0;
      lastTop=top;
      // Small stride intentionally preserves message overlap between renderer windows.
      const step=Math.max(150,Math.floor(view*0.30));
      setScroll(host,Math.min(max,top+step));
      await sleep(stagnant>3?300:175);
      if(stagnant>8){setScroll(host,Math.min(getMax(host),top+Math.max(240,Math.floor(view*0.50))));await sleep(340);stagnant=0;}
    }
  }
  async function catchNewest(host,a){
    for(let i=0;i<5;i++){setScroll(host,getMax(host));await sleep(300);addWindow(a,visibleWindow());}
  }
  function repeatedBlockCount(keys){
    let hits=0;
    // Detect pathological repeated 3-message blocks caused by recycled virtual-DOM numbering.
    const seen=new Map();
    for(let i=0;i+2<keys.length;i++){
      const sig=keys.slice(i,i+3).join('>');
      if(seen.has(sig)&&i-seen.get(sig)>3)hits++;else if(!seen.has(sig))seen.set(sig,i);
    }
    return hits;
  }
  function integrityFor(messages,a){
    const keys=a.sequence;
    let sameRole=0;
    for(let i=1;i<messages.length;i++)if((messages[i-1].role==='user'||messages[i-1].role==='assistant')&&messages[i-1].role===messages[i].role)sameRole++;
    const repeatedBlocks=repeatedBlockCount(keys);
    const first=messages[0]||null,last=messages[messages.length-1]||null;
    const critical=[];
    if(a.breaks>0)critical.push(a.breaks+' stitching break'+(a.breaks===1?'':'s'));
    if(repeatedBlocks>0)critical.push(repeatedBlocks+' repeated message block'+(repeatedBlocks===1?'':'s'));
    if(first&&first.role!=='user')critical.push('first captured message is not a user turn');
    return {ok:critical.length===0,critical:critical,sameRoleRuns:sameRole,repeatedBlocks:repeatedBlocks,breaks:a.breaks,windows:a.windows,stableIdCoverage:a.totalObserved?Math.round(100*a.stableIdSeen/a.totalObserved):0,firstPreview:first?normalizeText(first.text).slice(0,110):'',lastPreview:last?normalizeText(last.text).slice(0,110):''};
  }
  function resultFromAssembler(a){
    const raw=assemblerMessages(a);
    const messages=raw.map(function(m){return {role:m.role,html:m.html,text:m.text,stableId:m.stableId||null,fingerprint:m.fingerprint,turnHint:m.turnHint};});
    if(!messages.length)throw new Error('No ChatGPT conversation messages were found on this page.');
    const integrity=integrityFor(raw,a);
    const result={schema:'chat-copy/0.5',captureMethod:'dom-fallback',title:stripTitle(document.title),url:location.href,exportedAt:new Date().toLocaleString(),exportedAtISO:new Date().toISOString(),messageCount:messages.length,userMessageCount:messages.filter(function(m){return m.role==='user';}).length,assistantMessageCount:messages.filter(function(m){return m.role==='assistant';}).length,integrity:integrity,messages:messages};
    const titleEl=q('title'),metaEl=q('meta');if(titleEl)titleEl.textContent=result.title;
    if(metaEl)metaEl.textContent=messages.length+' messages · stitch '+(integrity.ok?'OK':'WARNING')+' · stable IDs '+integrity.stableIdCoverage+'%';
    return result;
  }
  function conversationIdFromUrl(){
    const m=location.pathname.match(/\/c\/([0-9a-zA-Z_-]+)/);
    return m?m[1]:null;
  }
  async function sessionAccessToken(){
    try{
      const r=await fetch('https://chatgpt.com/api/auth/session',{credentials:'include',cache:'no-store'});
      if(!r.ok)return null;
      const j=await r.json();
      return j&&typeof j.accessToken==='string'?j.accessToken:null;
    }catch(_){return null;}
  }
  async function fetchConversationPayload(){
    const id=conversationIdFromUrl();
    if(!id)throw new Error('This page does not have a ChatGPT conversation ID in its URL.');
    const url='https://chatgpt.com/backend-api/conversation/'+encodeURIComponent(id);
    const errors=[];
    let r=null;
    try{
      r=await fetch(url,{credentials:'include',cache:'no-store',headers:{'Accept':'application/json'}});
      if(r.status===401||r.status===403){
        const token=await sessionAccessToken();
        if(token)r=await fetch(url,{credentials:'include',cache:'no-store',headers:{'Accept':'application/json','Authorization':'Bearer '+token}});
      }
      if(r.ok){
        const j=await r.json();
        if(j&&j.mapping)return j;
        errors.push('content fetch succeeded but response had no conversation mapping');
      }else{
        let detail='';try{detail=(await r.text()).slice(0,220).replace(/\s+/g,' ');}catch(_){}
        errors.push('content fetch HTTP '+r.status+(detail?' — '+detail:''));
      }
    }catch(e){errors.push('content fetch network error — '+(e&&e.message?e.message:String(e)));}

    if(api&&api.runtime&&api.runtime.sendMessage){
      try{
        const bg=await api.runtime.sendMessage({type:'CHAT_COPY_FETCH_CANONICAL',id:id});
        if(bg&&bg.ok&&bg.data&&bg.data.mapping)return bg.data;
        if(bg)errors.push((bg.error||'background proxy failed')+(bg.diagnostic?' — '+bg.diagnostic:''));
        else errors.push('background proxy returned no result');
      }catch(e){errors.push('background proxy message error — '+(e&&e.message?e.message:String(e)));}
    }else errors.push('runtime messaging unavailable');

    throw new Error(errors.join(' | '));
  }
  function partToText(part){
    if(typeof part==='string')return part;
    if(!part||typeof part!=='object')return '';
    if(typeof part.text==='string')return part.text;
    if(typeof part.content==='string')return part.content;
    const t=String(part.content_type||part.type||'').toLowerCase();
    if(t.includes('image'))return '[Image]';
    if(t.includes('audio'))return '[Audio]';
    if(t.includes('file')||t.includes('attachment'))return '[Attachment]';
    return '';
  }
  function apiMessageText(msg){
    if(!msg||!msg.content)return '';
    const c=msg.content;
    const ct=String(c.content_type||'text').toLowerCase();
    if(ct==='thoughts'||ct.includes('reasoning')||ct.includes('analysis'))return '';
    let parts=[];
    if(Array.isArray(c.parts))parts=c.parts;
    else if(typeof c.text==='string')parts=[c.text];
    else if(typeof c.result==='string')parts=[c.result];
    let text=parts.map(partToText).filter(Boolean).join('\n').trim();
    const atts=msg.metadata&&Array.isArray(msg.metadata.attachments)?msg.metadata.attachments:[];
    if(atts.length){
      const labels=atts.map(a=>'[Attachment'+(a&&a.name?': '+a.name:'')+']');
      text=(labels.join('\n')+(text?'\n'+text:'')).trim();
    }
    return text;
  }
  function simpleHtmlFromText(text){
    const esc=escapeHtml(text);
    return esc.split(/\n{2,}/).map(function(block){
      if(/^```/.test(block.trim()))return '<pre>'+block.replace(/^```[^\n]*\n?/,'').replace(/```$/,'')+'</pre>';
      return '<p>'+block.replace(/\n/g,'<br>')+'</p>';
    }).join('');
  }
  function directMessagesFromPayload(j){
    const mapping=j.mapping||{};
    let nodeId=j.current_node||null;
    if(!nodeId||!mapping[nodeId]){
      const ids=Object.keys(mapping);
      const leaves=ids.filter(id=>!(mapping[id].children||[]).length);
      nodeId=(leaves.length?leaves:ids).sort((a,b)=>{
        const am=mapping[a]&&mapping[a].message, bm=mapping[b]&&mapping[b].message;
        return ((bm&&bm.create_time)||0)-((am&&am.create_time)||0);
      })[0]||null;
    }
    const chain=[]; const seen=new Set();
    while(nodeId&&mapping[nodeId]&&!seen.has(nodeId)){
      seen.add(nodeId);chain.push(mapping[nodeId]);nodeId=mapping[nodeId].parent||null;
    }
    chain.reverse();
    const out=[];
    for(const node of chain){
      const msg=node&&node.message;if(!msg)continue;
      const role=msg.author&&String(msg.author.role||'').toLowerCase();
      if(role!=='user'&&role!=='assistant')continue;
      const md=msg.metadata||{};
      if(md.is_visually_hidden_from_conversation===true)continue;
      const recipient=msg.recipient==null?'all':String(msg.recipient);
      if(role==='assistant'&&recipient!=='all')continue;
      const text=apiMessageText(msg).trim();if(!text)continue;
      out.push({role:role,text:text,html:simpleHtmlFromText(text),stableId:msg.id||node.id||null,fingerprint:role+':'+hashString(role+'\n'+normalizeText(text)),turnHint:null});
    }
    return out;
  }
  function directIntegrity(messages){
    const critical=[];
    if(!messages.length)critical.push('no visible user/assistant messages');
    if(messages.length&&messages[0].role!=='user')critical.push('first visible message is not a user turn');
    const ids=new Set();let dupIds=0;
    messages.forEach(m=>{if(m.stableId){if(ids.has(m.stableId))dupIds++;ids.add(m.stableId);}});
    if(dupIds)critical.push(dupIds+' duplicate stable message IDs');
    return {ok:critical.length===0,critical:critical,sameRoleRuns:0,repeatedBlocks:0,breaks:0,windows:0,stableIdCoverage:messages.length?Math.round(100*messages.filter(m=>m.stableId).length/messages.length):0,firstPreview:messages[0]?normalizeText(messages[0].text).slice(0,110):'',lastPreview:messages.length?normalizeText(messages[messages.length-1].text).slice(0,110):''};
  }
  async function directCapture(){
    setStatus('Reading canonical conversation history…');
    const j=await fetchConversationPayload();
    const messages=directMessagesFromPayload(j);
    if(!messages.length)throw new Error('Canonical history was returned, but no visible user/assistant messages were found.');
    const integrity=directIntegrity(messages);
    const result={schema:'chat-copy/0.5',captureMethod:'canonical-history',title:j.title||stripTitle(document.title),url:location.href,exportedAt:new Date().toLocaleString(),exportedAtISO:new Date().toISOString(),messageCount:messages.length,userMessageCount:messages.filter(m=>m.role==='user').length,assistantMessageCount:messages.filter(m=>m.role==='assistant').length,integrity:integrity,messages:messages};
    const titleEl=q('title'),metaEl=q('meta');if(titleEl)titleEl.textContent=result.title;
    if(metaEl)metaEl.textContent=messages.length+' messages · canonical history · stable IDs '+integrity.stableIdCoverage+'%';
    return result;
  }
  async function domCapture(){
    if(scanning)throw new Error('A scan is already running.');scanning=true;
    const host=findScrollHost();const saved=getTop(host);const a=makeAssembler();
    try{
      setStatus('Finding the true beginning of the conversation…');
      await wakeOlderHistory(host);
      // Important: discard all wake-up snapshots. Only a single ordered top-to-bottom pass defines chronology.
      setScroll(host,0);await sleep(420);
      await sweepDown(host,a);
      await catchNewest(host,a);
      lastCapture=resultFromAssembler(a);
      if(lastCanonicalError)lastCapture.canonicalFailure=lastCanonicalError;
      const it=lastCapture.integrity;
      const preview='First: “'+it.firstPreview+(it.firstPreview.length>=110?'…':'')+'”';
      if(it.ok)setStatus(lastCapture.messageCount+' messages · integrity OK · '+preview,'ok');
      else setStatus(lastCapture.messageCount+' messages · DOM FALLBACK · INTEGRITY WARNING: '+it.critical.join('; ')+' · '+preview+(lastCanonicalError?' · Canonical failed: '+lastCanonicalError:''),'err');
      return lastCapture;
    } finally {setScroll(host,saved);scanning=false;}
  }

  async function deepCapture(){
    if(scanning)throw new Error('A scan is already running.');
    scanning=true;
    try{
      try{
        const c=await directCapture();
        lastCapture=c;
        const it=c.integrity;
        setStatus(c.messageCount+' messages · CANONICAL HISTORY '+(it.ok?'OK':'WARNING')+' · First: “'+it.firstPreview+'”',it.ok?'ok':'err');
        return c;
      }catch(e){
        lastCanonicalError=(e&&e.message)?e.message:String(e);
        console.warn('[Chat Copy] canonical history unavailable; using DOM fallback',e);
        setStatus('Canonical history failed: '+lastCanonicalError+' · trying DOM fallback…','err');
      }
    }finally{scanning=false;}
    // domCapture owns its own scan lock.
    return await domCapture();
  }

  function buildHtml(c,includeSource,fragmentOnly){const meta=includeSource?'<p><strong>Source:</strong> <a href="'+escapeHtml(c.url)+'">'+escapeHtml(c.url)+'</a><br><strong>Exported:</strong> '+escapeHtml(c.exportedAt)+'<br><strong>Messages:</strong> '+c.messages.length+'</p>':'';const turns=c.messages.map(function(m,i){const label=m.role==='user'?'You':(m.role==='assistant'?'ChatGPT':m.role);return '<section><h2>'+escapeHtml(label)+' <small>'+(i+1)+'</small></h2><div>'+m.html+'</div></section>';}).join('\n');const frag='<div><h1>'+escapeHtml(c.title)+'</h1>'+meta+turns+'</div>';if(fragmentOnly)return frag;return '<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHtml(c.title)+'</title><style>body{font-family:Arial,sans-serif;line-height:1.48;color:#191919;max-width:920px;margin:40px auto;padding:0 28px}h1{font-size:26px}h2{font-size:16px;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:5px}pre{white-space:pre-wrap;background:#f3f3f3;padding:10px;border-radius:5px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:5px 7px}blockquote{border-left:3px solid #bbb;padding-left:12px}</style></head><body>'+frag+'</body></html>';}
  function toMarkdown(c,includeSource){const lines=['# '+c.title,''];if(includeSource)lines.push('Source: '+c.url,'Exported: '+c.exportedAt,'Messages: '+c.messages.length,'');c.messages.forEach(function(m,i){const label=m.role==='user'?'You':(m.role==='assistant'?'ChatGPT':m.role);lines.push('## '+label+' — '+(i+1),'',m.text,'');});return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim()+'\n';}
  function download(data,mime,filename){const blob=new Blob([data],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},2000);}
  function copyPlain(text){if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);return new Promise(function(resolve,reject){try{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.focus();ta.select();const ok=document.execCommand('copy');ta.remove();ok?resolve():reject(new Error('Clipboard copy was blocked.'));}catch(e){reject(e);}});}
  async function copyRich(c){const source=q('source');const include=!source||source.checked;const html=buildHtml(c,include,true);const text=toMarkdown(c,include);try{if(navigator.clipboard&&navigator.clipboard.write&&window.ClipboardItem){const item=new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})});await navigator.clipboard.write([item]);return'rich';}}catch(_){}await copyPlain(text);return'plain';}
  async function getCapture(){if(lastCapture&&lastCapture.url===location.href)return lastCapture;return await deepCapture();}

  async function handleAction(action){
    try{
      if(scanning){setStatus('Scan already running…');return;}
      if(action==='scan'){const c=await deepCapture();if(c.integrity&&c.integrity.ok)setStatus(c.messages.length+' messages · '+(c.captureMethod==='canonical-history'?'CANONICAL HISTORY OK':'DOM FALLBACK OK')+' · First: “'+c.integrity.firstPreview+'”','ok');return;}
      if(action==='google-toggle'){showGoogleSetup();return;}
      if(action==='google-save'){await saveGoogleClient();return;}
      if(action==='google-connect'){await connectGoogle();return;}
      if(action==='google-disconnect'){await disconnectGoogle();return;}
      if(action==='folder-create'){await createDriveFolder();return;}
      if(action==='copy-last-link'){await copyLastGoogleDocLink();return;}
      if(action==='share-last'){await shareLastGoogleDoc();return;}

      // Every export performs a fresh history read. Never export a stale scan snapshot.
      setStatus('Refreshing canonical history before export…');
      const c=await deepCapture(); const source=q('source'); const include=!source||source.checked;
      if(c.integrity && !c.integrity.ok && action!=='json') throw new Error('Capture integrity warning: '+c.integrity.critical.join('; ')+'. JSON diagnostic export is still available.');

      if(action==='doc'){
        const gs=await updateGoogleStatus();
        if(!gs || !gs.configured){const box=q('google-box');if(box)box.hidden=false;throw new Error('Google setup is required once: paste the Desktop OAuth Client ID and Client Secret, save them, then connect Google.');}
        const md=toMarkdown(c,include);
        let ds=await updateDriveDestination();
        const folderSelect=q('folder-select');const folderId=folderSelect?folderSelect.value:(ds&&ds.selectedId?ds.selectedId:'');
        const shareBox=q('share-anyone'),copyBox=q('copy-link');const shareAnyone=!!(shareBox&&shareBox.checked),copyLink=!copyBox||copyBox.checked;
        setStatus('Creating “'+c.title+'” in '+(folderId?'the selected Drive folder':'My Drive')+' from '+c.messages.length+' canonical messages…');
        const r=await bgMessage({type:'CHAT_COPY_CREATE_GOOGLE_DOC',title:c.title,markdown:md,options:{folderId:folderId||'',shareAnyone:shareAnyone,conversationId:conversationIdFromUrl()}});
        if(!r.ok)throw new Error(r.error||'Google Doc creation failed.');
        let copied=false;if(copyLink&&r.url){await copyPlain(r.url);copied=true;}
        const side=q('json-sidecar'); if(side&&side.checked)download(JSON.stringify(c,null,2),'application/json;charset=utf-8',safeFilename(c.title,'json'));
        await updateDriveDestination();
        if(r.shareError){setStatus('Google Doc created and opened, but anyone-with-link sharing failed: '+r.shareError+(copied?' Link copied (still private).':''),'err');}
        else setStatus('Google Doc created as “'+(r.name||c.title)+'”'+(r.shared?' · anyone with link can view':' · private')+(copied?' · link copied':'')+'.','ok');
      }
      else if(action==='rich'){const mode=await copyRich(c);setStatus('Copied '+c.messages.length+' messages ('+mode+').','ok');}
      else if(action==='html'){download(buildHtml(c,include,false),'text/html;charset=utf-8',safeFilename(c.title,'html'));setStatus('HTML archive downloaded: '+c.messages.length+' messages.','ok');}
      else if(action==='md'){download(toMarkdown(c,include),'text/markdown;charset=utf-8',safeFilename(c.title,'md'));setStatus('Markdown archive downloaded: '+c.messages.length+' messages.','ok');}
      else if(action==='json'){download(JSON.stringify(c,null,2),'application/json;charset=utf-8',safeFilename(c.title,'json'));setStatus('JSON archive downloaded: '+c.messages.length+' messages.','ok');}
    }catch(e){setStatus((e&&e.message)?e.message:String(e),'err');}
  }
  function handlePanelClick(ev){const target=ev.target&&ev.target.closest?ev.target.closest('[data-cc-action]'):null;if(!target)return;const action=target.getAttribute('data-cc-action');if(action==='close')closePanel();else handleAction(action);}
  function handlePanelChange(ev){const t=ev.target;if(!t||!t.getAttribute)return;if(t.getAttribute('data-cc')==='folder-select')setDriveDestination(t.value).catch(function(e){setStatus((e&&e.message)?e.message:String(e),'err');});}
  function boot(){if(!createUi()){setTimeout(boot,250);return;}console.info('[Chat Copy] content script loaded',VERSION,location.href);toast('Chat Copy '+VERSION+' loaded');const observer=new MutationObserver(function(){if(!document.getElementById(LAUNCHER_ID)||!document.getElementById(PANEL_ID))createUi();});observer.observe(document.documentElement,{childList:true,subtree:true});if(api&&api.runtime&&api.runtime.onMessage){api.runtime.onMessage.addListener(function(msg){if(msg&&msg.type==='CHAT_COPY_TOGGLE')togglePanel();});}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
