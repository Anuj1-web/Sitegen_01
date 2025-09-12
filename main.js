
const zipInput = document.getElementById("zipInput");
const exportBtn = document.getElementById("exportBtn");
const tabsEl = document.getElementById("tabs");
const iframeContainer = document.getElementById("iframeContainer");

const toolbar = document.getElementById("editorToolbar");
const tbText = document.getElementById("modalText");
const tbColor = document.getElementById("modalColor");
const tbTarget = document.getElementById("colorTarget");
const tbImageUrl = document.getElementById("imageUrl");
const tbImageFile = document.getElementById("imageFile");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const btnBold = document.getElementById("btnBold");
const btnItalic = document.getElementById("btnItalic");
const btnUnderline = document.getElementById("btnUnderline");
const fontSelect = document.getElementById("fontSelect");
const fontSizeInput = document.getElementById("fontSize");
const btnUndo = document.getElementById("btnUndo");
const btnRedo = document.getElementById("btnRedo");
const btnDelete = document.getElementById("btnDelete");

let pages=[], pageContents={}, editedContents={}, otherFiles={}, activePage="", iframeRefs={}, fileMap={};
let currentTarget = { page:"", id:"" };
let snapshotBeforeEdit = null;

// Global history stacks for all elements
let historyMap = {}; // { page: { elementId: [snapshot1, snapshot2...] } }
let redoMap = {};    // { page: { elementId: [snapshot] } }

// --- ZIP file handling ---
zipInput.addEventListener("change", async e => {
  const file = e.target.files?.[0]; if(!file) return;
  const zip = await JSZip.loadAsync(file);
  const newPages=[], newContents={}, other={};
  await Promise.all(Object.keys(zip.files).map(async filename=>{
    const entry=zip.files[filename]; if(entry.dir) return;
    if(filename.toLowerCase().endsWith(".html")){
      newPages.push(filename);
      newContents[filename] = await entry.async("string");
    } else {
      const blob = await entry.async("blob");
      fileMap[filename] = URL.createObjectURL(blob);
      other[filename] = await entry.async("uint8array");
    }
  }));
  newPages.sort((a,b)=>{
    const ai=/index\.html$/i.test(a), bi=/index\.html$/i.test(b);
    if(ai&&!bi) return -1; if(!ai&&bi) return 1; return a.localeCompare(b);
  });
  pages = newPages; pageContents = newContents; editedContents={...newContents}; otherFiles=other;
  activePage = newPages[0]||"";
  renderTabs(); renderIframes();
});

// --- Tabs ---
function renderTabs(){
  tabsEl.innerHTML="";
  pages.forEach(p=>{
    const tab=document.createElement("div");
    tab.className="tab"+(p===activePage?" active":"");
    tab.textContent=p;
    tab.onclick=()=>{ activePage=p; renderTabs(); renderIframes(); };
    tabsEl.appendChild(tab);
  });
}

// --- Editing bridge injection ---
function injectEditingBridge(html,pageName){
  const bridge=`<script>(function(){
    var EDIT_ATTR='data-edit-id';
    function ensureId(el){if(!el.getAttribute(EDIT_ATTR)) el.setAttribute(EDIT_ATTR,'e'+Math.random().toString(36).slice(2,9)); return el.getAttribute(EDIT_ATTR);}
    function buildSnapshot(el) {
      const cs = window.getComputedStyle(el);
      return {
        html: el.innerHTML || '',
        text: el.innerText || '',
        placeholder: el.placeholder || '',
        src: (el.tagName === 'IMG' ? el.src : ''),
        inline: {
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          bold: cs.fontWeight === '700' || cs.fontWeight === 'bold',
          italic: cs.fontStyle === 'italic',
          underline: cs.textDecorationLine?.includes('underline'),
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize
        }
      };
    }
    document.addEventListener('click', function(e){
      try{
        var el=e.target; if(!el) return; var tn=(el.tagName||'').toUpperCase();
        if(['A','BUTTON','INPUT','TEXTAREA','SELECT','LABEL','IMG'].includes(tn)){ e.preventDefault(); e.stopPropagation();}
        var id=ensureId(el); var snap=buildSnapshot(el);
        parent.postMessage({ type:'OPEN_EDITOR', page:'${pageName}', id:id, snapshot:snap }, '*');
      }catch(err){}
    }, true);
    document.addEventListener('dblclick', function(e){
      try{
        var el=e.target; if(!el) return; e.preventDefault(); e.stopPropagation();
        if(el.tagName!=='INPUT' && el.tagName!=='TEXTAREA' && el.tagName!=='IMG'){
          el.setAttribute('contenteditable','true'); el.focus();
          el.addEventListener('blur', function onBlur(){
            parent.postMessage({type:'INLINE_UPDATED', id:ensureId(el), text:el.innerText}, '*');
            el.removeAttribute('contenteditable'); el.removeEventListener('blur', onBlur);
          },{once:true});
        } else if(el.tagName==='INPUT' || el.tagName==='TEXTAREA'){ el.focus(); }
      }catch(err){}
    }, true);
    window.addEventListener('message', function(ev){
      var d=ev.data||{}; if(!d||!d.type) return; var el=document.querySelector('['+EDIT_ATTR+'="'+d.id+'"]'); if(!el) return;
      if(d.type==='APPLY_TEXT'){ if('placeholder' in el) el.placeholder=d.text||''; else el.innerText=d.text||''; }
      if(d.type==='APPLY_COLOR'){ if(d.target==='background') el.style.backgroundColor=d.color; else el.style.color=d.color; }
      if(d.type==='APPLY_IMAGE' && el.tagName==='IMG') el.src=d.src;
      if(d.type==='APPLY_STYLE'){
        if(d.bold!==undefined) el.style.fontWeight=d.bold?'bold':el.style.fontWeight;
        if(d.italic!==undefined) el.style.fontStyle=d.italic?'italic':el.style.fontStyle;
        if(d.underline!==undefined) el.style.textDecoration=d.underline?'underline':el.style.textDecoration;
        if(d.fontFamily) el.style.fontFamily=d.fontFamily;
        if(d.fontSize) el.style.fontSize=d.fontSize;
      }
      if(d.type==='RESTORE_ELEMENT' && d.snapshot){
        if(d.snapshot.html!==undefined && !('placeholder' in el)) el.innerHTML=d.snapshot.html;
        if(d.snapshot.placeholder!==undefined && 'placeholder' in el) el.placeholder=d.snapshot.placeholder;
        if(d.snapshot.src!==undefined && el.tagName==='IMG') el.src=d.snapshot.src;
        if (d.snapshot.inline) {
          var s = d.snapshot.inline;
          if (s.color) el.style.color = s.color;
          if (s.backgroundColor) el.style.backgroundColor = s.backgroundColor;
          if (s.bold !== undefined) el.style.fontWeight = s.bold ? 'bold' : '';
          if (s.italic !== undefined) el.style.fontStyle = s.italic ? 'italic' : '';
          if (s.underline !== undefined) el.style.textDecoration = s.underline ? 'underline' : '';
          if (s.fontFamily) el.style.fontFamily = s.fontFamily;
          if (s.fontSize) el.style.fontSize = s.fontSize;
        }
      }
    }, false);
  })();<\/script>`;
  return html.replace(/<\/body>/i, bridge+"</body>");
}

// --- Render iframe ---
function renderIframes(){
  iframeContainer.innerHTML="";
  if(!activePage) return;
  let rawHtml=editedContents[activePage]||pageContents[activePage]||"";
  const parser=new DOMParser();
  const doc=parser.parseFromString(rawHtml,"text/html");

  function resolvePath(htmlFile, resourcePath){
    if(!resourcePath) return null;
    const htmlDir=htmlFile.substring(0, htmlFile.lastIndexOf("/")+1);
    let normalized=htmlDir+resourcePath; normalized=normalized.replace(/^\.\//,"").replace(/\/\.\//g,"/");
    if(fileMap[normalized]) return fileMap[normalized];
    if(fileMap[resourcePath]) return fileMap[resourcePath];
    const stripped=resourcePath.replace(/^(\.\/|\/)/,"");
    if(fileMap[stripped]) return fileMap[stripped];
    const fileName=resourcePath.split("/").pop();
    for(const key in fileMap) if(key.endsWith(fileName)) return fileMap[key];
    return null;
  }

  doc.querySelectorAll("link[href], script[src], img[src]").forEach(el=>{
    const attr=el.tagName==="LINK"?"href":"src";
    const fixed=resolvePath(activePage, el.getAttribute(attr));
    if(fixed) el.setAttribute(attr,fixed);
  });

  const finalHtml=injectEditingBridge("<!DOCTYPE html>"+doc.documentElement.outerHTML, activePage);
  const iframe=document.createElement("iframe");
  iframe.srcdoc=finalHtml;
  iframeContainer.appendChild(iframe);
  iframeRefs[activePage]=iframe;
}

// --- Toolbar message handling ---
window.addEventListener("message", (event)=>{
  const d = event.data||{};
  if(d.type==="OPEN_EDITOR"){
    currentTarget={ page:d.page,id:d.id };
    snapshotBeforeEdit=d.snapshot;

    if(!historyMap[d.page]) historyMap[d.page]={};
    if(!historyMap[d.page][d.id]) historyMap[d.page][d.id]=[JSON.parse(JSON.stringify(d.snapshot))];
    redoMap[d.page] = redoMap[d.page] || {};
    redoMap[d.page][d.id] = [];

    tbText.value=d.snapshot.text||"";
    tbColor.value=d.snapshot.inline?.color||"#000000";
    tbTarget.value="auto";
    tbImageUrl.value=d.snapshot.src||"";
    btnBold.classList.toggle("active", d.snapshot.inline?.bold);
    btnItalic.classList.toggle("active", d.snapshot.inline?.italic);
    btnUnderline.classList.toggle("active", d.snapshot.inline?.underline);
    fontSelect.value = d.snapshot.inline?.fontFamily || "Arial";
    fontSizeInput.value = parseInt(d.snapshot.inline?.fontSize) || 16;
    toolbar.style.display="flex";
  } else if(d.type==="CLOSE_EDITOR"){
    toolbar.style.display="none"; currentTarget={ page:"",id:"" };
  } else if(d.type==="INLINE_UPDATED"){
    if(d.id && currentTarget.id===d.id){ tbText.value=d.text||""; }
  }
});

// --- Apply changes live ---
function applyChanges(){
  const {page,id}=currentTarget; if(!page||!id) return;
  const iframeWin = iframeRefs[page]?.contentWindow; if(!iframeWin) return;

  const snapshot = {
    text: tbText.value,
    src: tbImageUrl.value,
    inline:{
      color: tbColor.value,
      backgroundColor: "",
      bold: btnBold.classList.contains("active"),
      italic: btnItalic.classList.contains("active"),
      underline: btnUnderline.classList.contains("active"),
      fontFamily: fontSelect.value,
      fontSize: fontSizeInput.value+"px"
    }
  };

  if(!historyMap[page]) historyMap[page]={};
  if(!historyMap[page][id]) historyMap[page][id]=[JSON.parse(JSON.stringify(snapshot))];
  else{
    const last = historyMap[page][id][historyMap[page][id].length-1];
    if(JSON.stringify(last) !== JSON.stringify(snapshot)){
      historyMap[page][id].push(JSON.parse(JSON.stringify(snapshot)));
      redoMap[page][id] = [];
    }
  }

  let target = tbTarget.value==="auto" ? "color" : tbTarget.value;
  iframeWin.postMessage({ type:"APPLY_COLOR", id, color:tbColor.value, target }, "*");
  iframeWin.postMessage({ type:"APPLY_STYLE", id,
    bold: snapshot.inline.bold,
    italic: snapshot.inline.italic,
    underline: snapshot.inline.underline,
    fontFamily: snapshot.inline.fontFamily,
    fontSize: snapshot.inline.fontSize
  }, "*");

  if(tbImageUrl.value) iframeWin.postMessage({ type:"APPLY_IMAGE", id, src:tbImageUrl.value }, "*");
}

// --- Toolbar events ---
tbText.addEventListener("input", applyChanges);
tbColor.addEventListener("input", applyChanges);
fontSelect.addEventListener("change", applyChanges);
fontSizeInput.addEventListener("input", applyChanges);
btnBold.addEventListener("click", ()=>{ btnBold.classList.toggle("active"); applyChanges(); });
btnItalic.addEventListener("click", ()=>{ btnItalic.classList.toggle("active"); applyChanges(); });
btnUnderline.addEventListener("click", ()=>{ btnUnderline.classList.toggle("active"); applyChanges(); });

// --- Image File Upload ---
tbImageFile.addEventListener("change", async e=>{
  const file = e.target.files?.[0]; if(!file) return;
  const url = URL.createObjectURL(file);
  tbImageUrl.value = url;
  applyChanges();
});

// --- Delete ---
btnDelete.addEventListener("click", ()=>{
  const { page, id } = currentTarget; if(!page||!id) return;
  const iframeDoc = iframeRefs[page]?.contentDocument; if(!iframeDoc) return;
  const el = iframeDoc.querySelector(`[data-edit-id="${id}"]`); if(!el) return;

  const cs = window.getComputedStyle(el);
  const snapshot = {
    html: el.outerHTML,
    text: el.innerText||'',
    placeholder: el.placeholder||'',
    src: el.tagName==='IMG'?el.src:'',
    inline:{
      color: cs.color, backgroundColor: cs.backgroundColor,
      bold: cs.fontWeight==='700'||cs.fontWeight==='bold',
      italic: cs.fontStyle==='italic',
      underline: cs.textDecorationLine?.includes('underline'),
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize
    },
    deleted:true
  };

  if(!historyMap[page]) historyMap[page]={};
  if(!historyMap[page][id]) historyMap[page][id]=[];
  historyMap[page][id].push(snapshot);
  redoMap[page][id]=[];

  el.remove();
  toolbar.style.display="none"; currentTarget={ page:"", id:"" };
});

// --- Undo / Redo (improved) ---
btnUndo.addEventListener("click", ()=>{
  const {page,id}=currentTarget; if(!page||!id) return;
  const hist = historyMap[page]?.[id]; if(!hist || hist.length<2) return;
  const current = hist.pop();
  redoMap[page][id].push(JSON.parse(JSON.stringify(current)));
  const prev = hist[hist.length-1];
  restoreSnapshot(prev,page,id);
});

btnRedo.addEventListener("click", ()=>{
  const {page,id}=currentTarget; if(!page||!id) return;
  const redo = redoMap[page]?.[id]; if(!redo || redo.length<1) return;
  const snap = redo.pop();
  historyMap[page][id].push(JSON.parse(JSON.stringify(snap)));
  restoreSnapshot(snap,page,id);
});

// --- Restore Snapshot ---
function restoreSnapshot(snap,page,id){
  const iframeDoc = iframeRefs[page]?.contentDocument; if(!iframeDoc) return;
  let el = iframeDoc.querySelector(`[data-edit-id="${id}"]`);

  if(snap.deleted){
    if(!el){
      const temp = document.createElement("div"); temp.innerHTML=snap.html||'';
      el=temp.firstElementChild; if(el){ el.setAttribute("data-edit-id",id); iframeDoc.body.appendChild(el);}
    }
  } else {
    if(!el) return;
    el.innerHTML = snap.html||el.innerHTML;
    if('placeholder' in el) el.placeholder=snap.placeholder||'';
    if(el.tagName==='IMG') el.src=snap.src||'';
  }

  if(el){
    const s = snap.inline||{};
    el.style.color = s.color||'';
    el.style.backgroundColor = s.backgroundColor||'';
    el.style.fontWeight = s.bold?'bold':'';
    el.style.fontStyle = s.italic?'italic':'';
    el.style.textDecoration = s.underline?'underline':'';
    el.style.fontFamily = s.fontFamily||'';
    el.style.fontSize = s.fontSize||'';
  }

  if(currentTarget.page===page && currentTarget.id===id){
    tbText.value = snap.text||'';
    tbColor.value = snap.inline?.color||'#000000';
    fontSelect.value = snap.inline?.fontFamily||'Arial';
    fontSizeInput.value = parseInt(snap.inline?.fontSize)||16;
    btnBold.classList.toggle('active',snap.inline?.bold);
    btnItalic.classList.toggle('active',snap.inline?.italic);
    btnUnderline.classList.toggle('active',snap.inline?.underline);
    if(el?.tagName==='IMG') tbImageUrl.value=el.src;
  }
}

// --- Save / Cancel ---
saveBtn.addEventListener("click", ()=>{
  const {page}=currentTarget; applyChanges();
  const iframeDoc = iframeRefs[page]?.contentDocument;
  if(iframeDoc) editedContents[page]="<!DOCTYPE html>"+iframeDoc.documentElement.outerHTML;
  toolbar.style.display="none"; currentTarget={ page:"", id:"" };
});

cancelBtn.addEventListener("click", ()=>{
  const {page,id}=currentTarget; if(!page||!id||!snapshotBeforeEdit) return;
  const iframeWin = iframeRefs[page]?.contentWindow;
  if(iframeWin) iframeWin.postMessage({ type:"RESTORE_ELEMENT", id, snapshot:snapshotBeforeEdit }, "*");
  toolbar.style.display="none"; currentTarget={ page:"", id:"" };
});

// --- Drag toolbar ---
(function(){
  let dragging=false, offsetX=0, offsetY=0;
  toolbar.style.position="absolute"; toolbar.style.top="10px"; toolbar.style.left="10px"; toolbar.style.cursor="move";
  toolbar.addEventListener("mousedown", e=>{
    if([tbText,tbColor,tbTarget,tbImageUrl,tbImageFile,saveBtn,cancelBtn,btnBold,btnItalic,btnUnderline,fontSelect,fontSizeInput].includes(e.target)) return;
    dragging=true; offsetX=e.clientX-toolbar.offsetLeft; offsetY=e.clientY-toolbar.offsetTop;
    document.body.style.userSelect="none";
  });
  document.addEventListener("mousemove", e=>{ if(!dragging) return; toolbar.style.left=(e.clientX-offsetX)+"px"; toolbar.style.top=(e.clientY-offsetY)+"px"; });
  document.addEventListener("mouseup", ()=>{ dragging=false; document.body.style.userSelect=""; });
})();

// --- Export ZIP ---
exportBtn.addEventListener("click", async ()=>{
  const zip = new JSZip();
  pages.forEach(filename=>{
    const iframe=iframeRefs[filename];
    if(iframe?.contentDocument) editedContents[filename]="<!DOCTYPE html>"+iframe.contentDocument.documentElement.outerHTML;
    const html=editedContents[filename]||pageContents[filename]||"";
    zip.file(filename, html);
  });
  Object.entries(otherFiles).forEach(([filename,data])=>{ zip.file(filename,data); });
  const blob = await zip.generateAsync({type:"blob"});
  saveAs(blob,"custom-site.zip");
});

