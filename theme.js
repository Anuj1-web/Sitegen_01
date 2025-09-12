<!-- ========== Universal Theme Manager (Contrast-Safe Upgraded) ========== -->
(function(){

  // ----------------- Theme Presets -----------------
  const themePresets = [
    {name:'Oceanic', primary:'#0b79ff', accent:'#06b6d4', bg:'#f6fbff'},
    {name:'Midnight', primary:'#7c3aed', accent:'#06b6d4', bg:'#071026'},
    {name:'Sunset', primary:'#ff6b6b', accent:'#ff9a00', bg:'#fff7f2'},
    {name:'Forest', primary:'#0b8457', accent:'#34d399', bg:'#f3fbf6'},
    {name:'Corporate', primary:'#0b3d91', accent:'#06b6d4', bg:'#fbfdff'},
    {name:'Warm', primary:'#d97706', accent:'#fb923c', bg:'#fffaf0'},
    {name:'Violet', primary:'#6b21a8', accent:'#8b5cf6', bg:'#fbf7ff'},
    {name:'Candy', primary:'#ff6bcb', accent:'#ffd166', bg:'#fff7fb'},
    {name:'Grayscale', primary:'#111827', accent:'#6b7280', bg:'#ffffff'},
    {name:'Aqua', primary:'#0088cc', accent:'#00c2c7', bg:'#f0fcff'},
    {name:'Rose', primary:'#e11d48', accent:'#fb7185', bg:'#fff5f7'},
    {name:'Indigo', primary:'#272ddf', accent:'#7c3aed', bg:'#f5f7ff'},
    {name:'Lime', primary:'#84cc16', accent:'#bef264', bg:'#fbfff0'},
    {name:'Coral', primary:'#ff7a59', accent:'#ffb199', bg:'#fff6f2'},
    {name:'Teal', primary:'#0d9488', accent:'#2dd4bf', bg:'#f2fffb'},
    {name:'Slate', primary:'#334155', accent:'#64748b', bg:'#f8fafc'},
    {name:'Classic', primary:'#0b79ff', accent:'#ff6b6b', bg:'#ffffff'},
    {name:'Lavender', primary:'#a78bfa', accent:'#c4b5fd', bg:'#fbf8ff'},
    {name:'Copper', primary:'#9a3412', accent:'#fb923c', bg:'#fff6f0'}
  ];

  const themeGrid = document.getElementById("themeGrid");
  themePresets.forEach(t=>{
    const tile = document.createElement("div");
    tile.className="preset-tile";
    tile.style.border="1px solid #eee";
    tile.style.padding="8px";
    tile.style.borderRadius="8px";
    tile.style.cursor="pointer";
    tile.style.textAlign="center";
    tile.style.fontSize="12px";
    tile.style.background=`linear-gradient(90deg,${t.primary},${t.accent})`;
    tile.innerHTML=`<div>${t.name}</div>`;
    tile.addEventListener("click",()=>applyTheme(t));
    themeGrid.appendChild(tile);
  });

  // ----------------- Helpers -----------------
  function hexToRgb(hex){
    hex = hex.replace("#","");
    if(hex.length === 3) hex = hex.split("").map(c=>c+c).join("");
    const num = parseInt(hex,16);
    return {r:(num>>16)&255, g:(num>>8)&255, b:num&255};
  }

  function rgbToHex(rgb){
    return "#" + rgb.r.toString(16).padStart(2,"0") + rgb.g.toString(16).padStart(2,"0") + rgb.b.toString(16).padStart(2,"0");
  }

  // WCAG-like luminance and contrast
  function luminance(hex){
    const c = hexToRgb(hex);
    const a = [c.r/255,c.g/255,c.b/255].map(v => v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));
    return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];
  }

  function contrastRatio(fg, bg){
    const L1 = luminance(fg)+0.05;
    const L2 = luminance(bg)+0.05;
    return L1 > L2 ? L1/L2 : L2/L1;
  }

  // Return black or white for best readable contrast
  function bestTextColor(bg){
    const blackContrast = contrastRatio('#000000', bg);
    const whiteContrast = contrastRatio('#ffffff', bg);
    return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
  }

  function lightenColor(hex, percent){
    const c = hexToRgb(hex);
    c.r = Math.min(255,c.r+Math.round((255-c.r)*percent));
    c.g = Math.min(255,c.g+Math.round((255-c.g)*percent));
    c.b = Math.min(255,c.b+Math.round((255-c.b)*percent));
    return rgbToHex(c);
  }

  function getEffectiveBg(el, doc){
    const bg = window.getComputedStyle(el).backgroundColor;
    if(!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent"){
      if(el.parentElement) return getEffectiveBg(el.parentElement, doc);
      return '#ffffff';
    }
    const rgb = bg.match(/\d+/g);
    return rgbToHex({r:parseInt(rgb[0]), g:parseInt(rgb[1]), b:parseInt(rgb[2])});
  }

  // ----------------- Save Theme -----------------
  function saveThemeToEditedContents(){
    if(typeof editedContents === "undefined" || typeof activePage === "undefined") return;
    const iframe = (typeof iframeRefs!=="undefined" && iframeRefs[activePage]) ? iframeRefs[activePage] : null;
    const doc = iframe ? (iframe.contentDocument || iframe.contentWindow.document) : document;
    if(!doc) return;
    editedContents[activePage] = doc.documentElement.outerHTML;
  }

  // ----------------- Apply Theme -----------------
  function applyTheme(theme){
    const iframe = (typeof iframeRefs!=="undefined" && iframeRefs[activePage]) ? iframeRefs[activePage] : null;
    if(!iframe) return; // fail silently
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if(!doc) return;

    const mainBg = theme.name === "Midnight" ? theme.bg : lightenColor(theme.primary,0.75);
    const mainTextColor = bestTextColor(mainBg);
    const headerFooterTextColor = bestTextColor(theme.primary);

    // Update CSS variables
    const vars = {
      '--primary-color': theme.primary,
      '--accent-color': theme.accent,
      '--bg-color': mainBg,
      '--text-color': mainTextColor
    };
    Object.keys(vars).forEach(k => doc.documentElement.style.setProperty(k, vars[k]));

    const sections = [
      {sel:'header, .header, nav, .nav, .navbar, footer, .footer, .site-footer', bg:theme.primary, text:headerFooterTextColor},
      {sel:'.card, .panel, .tile, .box, .content-card, .card-body', bg:theme.accent},
      {sel:'button, .btn, .button, a.button, a.btn, input[type=submit], .cta', bg:theme.primary, text:headerFooterTextColor},
      {sel:'main, .section, .hero, .banner, .jumbotron, .container', bg:mainBg, text:mainTextColor}
    ];

    sections.forEach(s=>{
      doc.querySelectorAll(s.sel).forEach(el=>{
        if(el.dataset.themeIgnore) return;
        if(s.bg) el.style.backgroundColor = s.bg;
        if(s.text) el.style.color = s.text;
        Array.from(el.querySelectorAll('*')).forEach(ch=>{
          if(ch.dataset.themeIgnore) return;
          if(!ch.tagName.includes('BUTTON') && !ch.classList.contains('btn')){
            const bg = getEffectiveBg(ch, doc);
            ch.style.color = bestTextColor(bg);
          }
          ch.style.transition = "background-color 0.3s ease,color 0.3s ease";
        });
        el.style.transition = "background-color 0.3s ease,color 0.3s ease";
      });
    });

    saveThemeToEditedContents();
  }

  // ----------------- Reset Theme -----------------
  function resetTheme(){
    const iframe = (typeof iframeRefs!=="undefined" && iframeRefs[activePage]) ? iframeRefs[activePage] : null;
    if(!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if(!doc) return;

    // Reset CSS variables
    doc.documentElement.style.setProperty('--primary-color','#0b79ff');
    doc.documentElement.style.setProperty('--accent-color','#06b6d4');
    doc.documentElement.style.setProperty('--bg-color','#ffffff');
    doc.documentElement.style.setProperty('--text-color','#000000');

    // Remove all inline theme colors
    doc.querySelectorAll('*').forEach(el=>{
      el.style.backgroundColor = '';
      el.style.color = '';
      el.style.transition = '';
    });

    saveThemeToEditedContents();
  }

  // ----------------- Panel Toggle & Custom Theme -----------------
  document.getElementById("themeToggleBtn").onclick = ()=> {
    const panel = document.getElementById("themePanel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  };
  document.getElementById("applyCustomTheme").onclick = ()=>{
    const t = {name:"Custom", primary:primaryColor.value, accent:accentColor.value, bg:bgColor.value};
    applyTheme(t);
  };
  document.getElementById("resetTheme").onclick = resetTheme;

})();
