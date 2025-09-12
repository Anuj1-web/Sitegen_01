
function getLibraryData(){ 
  try { 
    return JSON.parse(localStorage.getItem("sitegenLibrary")||"[]"); 
  } catch{return [];} 
}
function decodeContent(content){ 
  if(!content) return ""; 
  if(content.startsWith("data:")) return atob(content.split(',')[1]||""); 
  return content; 
}

let allAssets = getLibraryData();
allAssets = allAssets.map(item => {
  // Normalize only HTML files to "page"
  if(item.name.endsWith('.html')) {
    item.type = 'page';
  }
  // Leave .zip templates as "template" so they can be skipped later
  return item;
});

function renderLibraryAssets(filter=""){
  const container = document.getElementById('libraryContainer');
  container.innerHTML='';

  const categories = {};
  allAssets.forEach(item=>{
    // 🚫 Skip templates completely (they go to index page, not sidebar)
    if(item.type === "template") return;

    const cat=item.type; 
    const sub=item.subcategory||"General";
    if(!categories[cat]) categories[cat]={};
    if(!categories[cat][sub]) categories[cat][sub]=[];
    categories[cat][sub].push(item);
  });

  Object.keys(categories).forEach(cat=>{
    const catDiv=document.createElement('div'); catDiv.className='library-category';
    catDiv.textContent=cat.charAt(0).toUpperCase()+cat.slice(1);
    container.appendChild(catDiv);

    Object.keys(categories[cat]).forEach(sub=>{
      const subDiv=document.createElement('div'); subDiv.className='library-subcategory';
      subDiv.textContent=sub.charAt(0).toUpperCase()+sub.slice(1);
      container.appendChild(subDiv);

      categories[cat][sub].forEach(item=>{
        if(filter && !item.name.toLowerCase().includes(filter.toLowerCase())) return;

        const div=document.createElement('div'); div.className='library-item';
        const thumb=document.createElement('div'); thumb.className='library-thumb';
        const img=document.createElement('img');

        if(item.thumbnail){ img.src=item.thumbnail; }
        else if(item.type==="page" && item.content){
          const tmpIframe=document.createElement('iframe');
          tmpIframe.style.width="1920px"; tmpIframe.style.height="1080px";
          tmpIframe.style.position="absolute"; tmpIframe.style.left="-9999px";
          document.body.appendChild(tmpIframe);
          tmpIframe.srcdoc = decodeContent(item.content);
          tmpIframe.onload = ()=>{
            try{
              const canvas=document.createElement('canvas');
              canvas.width=1920; canvas.height=1080;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle="#fff"; ctx.fillRect(0,0,1920,1080);
              ctx.drawImage(tmpIframe.contentWindow.document.body,0,0,1920,1080);
              img.src = canvas.toDataURL();
              document.body.removeChild(tmpIframe);
            }catch(e){ img.src='https://via.placeholder.com/320x180?text=Preview'; document.body.removeChild(tmpIframe); }
          }
        } else { img.src='https://via.placeholder.com/320x180?text=No+Thumbnail'; }

        thumb.appendChild(img); div.appendChild(thumb);

        const title=document.createElement('div'); title.className='library-title';
        title.innerText=item.name.replace(/[_-]/g," ");
        div.appendChild(title);

       // Delete page button (robust version)
if (item.type === "page") {
  const removeBtn = document.createElement('button');
  removeBtn.className = 'removePageBtn';
  removeBtn.innerText = '🗑️';

  removeBtn.onclick = e => {
    e.stopPropagation();

    // Build candidate filenames to match whatever format pages[] may have
    const rawName = (item.name || '').replace(/^\s+|\s+$/g, '');
    const candidates = new Set();

    // If item.name already has .html, include it
    if (rawName.endsWith('.html')) candidates.add(rawName);
    // raw with .html appended
    candidates.add(rawName + (rawName.endsWith('.html') ? '' : '.html'));
    // normalized: spaces/ dashes -> underscore, lowercase
    candidates.add(rawName.replace(/\.html$/i, '')
                         .replace(/[_\s-]+/g, '_')
                         .toLowerCase() + '.html');
    // kebab-case
    candidates.add(rawName.replace(/\.html$/i, '')
                         .replace(/[_\s]+/g, '-')
                         .toLowerCase() + '.html');

    // Also include a plain base-name match (no extension)
    candidates.add(rawName.replace(/\.html$/i, ''));

    // Convert to array
    const candArr = Array.from(candidates);

    if (confirm(`Remove page "${rawName}" from live preview?`)) {
      if (typeof pages === 'undefined' || !Array.isArray(pages)) {
        console.error('pages is not defined or not an array', pages);
        alert('Cannot remove page: pages list not available (see console).');
        return;
      }

      // Find page index by any candidate match
      const pageIndex = pages.findIndex(p => {
        // compare both with and without extension
        const pnorm = (p || '').toString();
        if (candArr.includes(pnorm)) return true;
        const pBase = pnorm.replace(/\.html$/i, '');
        if (candArr.includes(pBase)) return true;
        return false;
      });

      if (pageIndex === -1) {
        console.warn('Delete: no matching page found. Candidates:', candArr, 'pages:', pages);
        alert('Page not found in project — cannot remove (check console).');
        return;
      }

      // Actual filename string we will remove
      const filename = pages[pageIndex];

      // Remove from pages array
      pages.splice(pageIndex, 1);

      // Clean up content maps
      try { delete pageContents[filename]; } catch(_) {}
      try { delete editedContents[filename]; } catch(_) {}

      // Remove iframe if you keep references in iframeRefs (optional)
      try {
        if (typeof iframeRefs !== 'undefined' && iframeRefs[filename]) {
          const ifr = iframeRefs[filename];
          try { ifr.remove(); } catch(_) {}
          delete iframeRefs[filename];
        }
      } catch (err) {
        console.warn('Could not remove iframeRefs entry', err);
      }

      // If the deleted page was active, switch to next available page
      if (typeof activePage !== 'undefined' && activePage === filename) {
        activePage = pages[0] || '';
      }

      // Force UI refresh
      try { renderTabs(); } catch(_) {}
      try { renderIframes(); } catch(_) {}

      // Optional: if you have a previewArea element, clear it when no pages left
      const previewArea = document.getElementById('previewArea');
      if (previewArea && pages.length === 0) {
        previewArea.innerHTML = "<p style='color:#999;text-align:center;padding:2rem;'>No pages in project</p>";
      }
    }
  };

  div.appendChild(removeBtn);
}




        // Fullscreen button
        const fsBtn=document.createElement('div'); fsBtn.className='fullscreen-btn'; fsBtn.innerHTML='&#8644;';
        fsBtn.onclick=e=>{
          e.stopPropagation();
          const overlay=document.getElementById('fullscreenPreview');
          const overlayImg=overlay.querySelector('img');
          overlayImg.src=img.src;
          overlay.style.display='flex';
        }
        div.appendChild(fsBtn);

        // Click behavior
        div.addEventListener('click', ()=>{
          if(item.type==="page"){
            const name = prompt("Enter page name:", item.name.replace(/\.html$/,''));
            if(!name) return;
            const filename = name.replace(/\s+/g,'_').toLowerCase()+".html";
            if(!pages.includes(filename)){
              pages.push(filename);
              pageContents[filename] = decodeContent(item.content||'');
              editedContents[filename] = pageContents[filename];
              activePage = filename;
              renderTabs(); renderIframes();
            } else { alert("Page already exists!"); }
          } else {
            const iframe=iframeRefs[activePage]; if(!iframe) return;
            const doc=iframe.contentDocument||iframe.contentWindow.document;
            const target = doc.activeElement && doc.body.contains(doc.activeElement) ? doc.activeElement : doc.body;
            const temp=document.createElement('div'); temp.innerHTML=item.content;
            target.appendChild(temp.firstChild);
            editedContents[activePage]="<!DOCTYPE html>"+doc.documentElement.outerHTML;
          }
        });

        // Drag/drop
        if(item.type!=="page"){
          div.draggable=true;
          div.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/html', item.content); div.classList.add('dragging'); });
          div.addEventListener('dragend', ()=>div.classList.remove('dragging'));
        }

        container.appendChild(div);
      });
    });
  });
}

// Search
document.getElementById("librarySearch").addEventListener("input", e=>{ renderLibraryAssets(e.target.value); });

// Open/close
document.getElementById('openLibraryBtn').onclick=()=>{document.getElementById('librarySidebar').style.display='flex';};
document.getElementById('closeLibraryBtn').onclick=()=>{document.getElementById('librarySidebar').style.display='none';};

// Sidebar drag anywhere
let isDraggingSidebar=false;
const sidebar = document.getElementById('librarySidebar');
sidebar.addEventListener('mousedown', e=>{
  isDraggingSidebar=true;
  e.preventDefault();
});
document.addEventListener('mousemove', e=>{
  if(!isDraggingSidebar) return;
  let newWidth = window.innerWidth - e.clientX;
  newWidth=Math.max(200, Math.min(800, newWidth));
  sidebar.style.width = newWidth+'px';
});
document.addEventListener('mouseup', ()=>{ isDraggingSidebar=false; });

// Fullscreen close
const fsOverlay=document.getElementById('fullscreenPreview');
fsOverlay.querySelector('.close-btn').onclick = ()=>{ 
  fsOverlay.style.display='none'; 
  const img = fsOverlay.querySelector('img');
  img.style.left='0px'; img.style.top='0px'; img.style.position='relative';
};

// Fullscreen drag & zoom
let isFsDragging=false, offsetX=0, offsetY=0;
const fsImg=fsOverlay.querySelector('img');
fsImg.addEventListener('mousedown', e=>{
  isFsDragging=true;
  offsetX=e.clientX - fsImg.offsetLeft;
  offsetY=e.clientY - fsImg.offsetTop;
  fsImg.style.position='absolute';
});
document.addEventListener('mousemove', e=>{
  if(!isFsDragging) return;
  fsImg.style.left = (e.clientX - offsetX)+'px';
  fsImg.style.top = (e.clientY - offsetY)+'px';
});
document.addEventListener('mouseup', ()=>{ isFsDragging=false; });
fsOverlay.addEventListener('wheel', e=>{
  e.preventDefault();
  let scale = e.deltaY<0 ? 1.1 : 0.9;
  fsImg.style.width = (fsImg.offsetWidth*scale)+'px';
  fsImg.style.height = (fsImg.offsetHeight*scale)+'px';
});

// Enable drop inside iframe
function enableDrop(){
  const iframe=iframeRefs[activePage]; if(!iframe) return;
  const doc=iframe.contentDocument||iframe.contentWindow.document;
  doc.body.addEventListener("dragover", e=>e.preventDefault());
  doc.body.addEventListener("drop", e=>{
    e.preventDefault();
    const html=e.dataTransfer.getData("text/html");
    if(html){ const temp=document.createElement("div"); temp.innerHTML=html; doc.body.appendChild(temp.firstChild); editedContents[activePage]="<!DOCTYPE html>"+doc.documentElement.outerHTML; }
  });
}
const originalRenderIframes=renderIframes;
renderIframes=function(){ originalRenderIframes(); enableDrop(); };

// Add blank page
document.getElementById('addPageBtnSidebar').onclick=()=>{
  const name=prompt('Enter new page name:'); if(!name) return;
  const filename=name.replace(/\s+/g,'_').toLowerCase()+'.html';
  const html=`<!DOCTYPE html><html><head><title>${name}</title></head><body><h1>${name}</h1></body></html>`;
  pages.push(filename); pageContents[filename]=html; editedContents[filename]=html; activePage=filename;
  renderTabs(); renderIframes();
};

// Initial render
renderLibraryAssets();

