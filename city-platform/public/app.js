/**
 * 城市部件数据管理平台 v3 — 政务科技蓝 + 渐进树 + 分页 + 热力图 + 分类图标
 */
(function(){
'use strict';
let D,map,mkGrp=L.layerGroup(),heatLayer=null;
let view='map',selId=null,editId=null,ctxTarget=null;
let fState={cats:new Set,dists:new Set,depts:new Set,bizs:new Set(),search:''};
let flt=[],page=1,pageSize=100,pickCoords=null;
// Category icons
const CAT_ICONS={GY:{icon:'⚙️',bg:'#4a90d9'},JT:{icon:'🚦',bg:'#f5a623'},SR:{icon:'🧹',bg:'#7ed321'},YL:{icon:'🌳',bg:'#50c878'},QT:{icon:'📡',bg:'#9b59b6'},JY:{icon:'🎓',bg:'#e74c3c'},WS:{icon:'🏥',bg:'#27ae60'},SM:{icon:'⛽',bg:'#f39c12'}};
const ST_COLORS={正常:'#00c853',损坏:'#ff5252',废弃:'#546e7a',在建:'#ff9100',待维修:'#448aff'};

// ============ Init ============
async function init(){
  try{const r=await fetch('mock-data-min.json');if(!r.ok)throw Error('HTTP '+r.status);D=await r.json();buildTree();popTF();initMap();applyFilters();}
  catch(e){alert('数据加载失败: '+e.message);}
}
// ============ Tree (progressive expand) ============
function buildTree(){
  const c=document.getElementById('tree-filters');c.innerHTML='';
  function cnt(fn){return D.objects.filter(fn).length}
  // Category tree
  const ct=buildSec('📦 部件分类','cat');
  D.categoryTree.forEach(m=>{
    const n=addNode(ct.b,m.name,'cat','major',m.code,1,cnt(o=>o.majorCode===m.code));
    const sub=addSub(ct.b,m.code,'minor',2);
    m.children.forEach(c2=>{
      const n2=addNode(sub,c2.name,'cat','minor',c2.code,2,cnt(o=>o.minorCode===c2.code));
      const sub2=addSub(sub,c2.code,'detail',3);
      c2.children.forEach(d=>{
        addNode(sub2,d.name,'cat','detail',m.code+'/'+c2.code+'/'+d.name,3,cnt(o=>o.majorCode===m.code&&o.minorCode===c2.code&&o.detailType===d.name));
      });
      n._child=sub;n._subs=(n._subs||[]);n._subs.push(sub);
    });
    n._child=sub;
  });
  c.appendChild(ct.e);
  // District tree
  const dt=buildSec('📍 行政区划','dist');
  D.districts.forEach(d=>{
    const n=addNode(dt.b,d.name,'dist','district',d.code,1,cnt(o=>o.districtCode===d.code));
    const sub=addSub(dt.b,d.code,'street',2);
    d.streets.forEach(s=>addNode(sub,s,'dist','street',d.code+'/'+s,2,cnt(o=>o.districtCode===d.code&&o.streetName===s)));
    n._child=sub;
  });
  c.appendChild(dt.e);
  // Department tree
  const de=buildSec('🏢 管理部门','dept');
  D.departments.forEach(d=>{
    const n=addNode(de.b,d.name,'dept','dept',d.code,1,cnt(o=>o.departmentCode===d.code));
    const sub=addSub(de.b,d.code,'biz',2);
    d.systems.forEach(s=>addNode(sub,'  '+s.name,'biz','biz',d.code+'/'+s.code,2,cnt(o=>o.departmentCode===d.code&&o.bizSystemCode===s.code)));
    n._child=sub;
  });
  c.appendChild(de.e);
}

function buildSec(title){const e=document.createElement('div');e.className='tree-section';
const h=document.createElement('div');h.className='tree-section-header';h.innerHTML=`<span class="arrow open">▶</span>${title}`;
const b=document.createElement('div');b.className='tree-section-body open';
h.onclick=()=>{b.classList.toggle('open');h.querySelector('.arrow').classList.toggle('open')};
e.appendChild(h);e.appendChild(b);return{e,b};}

function addSub(parent,code,type,level){const s=document.createElement('div');s.className='tree-sub';s.id='sub-'+code;s.style.display='none';parent.appendChild(s);return s}
function addNode(parent,label,ft,nt,code,level,count){
  const d=document.createElement('div');d.className=`tree-node level-${level}`;
  d.innerHTML=`<input type="checkbox" data-ft="${ft}" data-nt="${nt}" data-code="${E(code)}"><span>${label}</span><span class="tree-count">${count>0?count:''}</span>`;
  d.onclick=function(e){if(e.target.tagName!=='INPUT'){
    const cb=this.querySelector('input');cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));
    // Progressive expand - click to toggle child sub
    const sub=document.getElementById('sub-'+code);
    if(sub){
      const isOpen=sub.style.display!=='none';
      sub.style.display=isOpen?'none':'block';
      this.style.fontWeight=isOpen?'normal':'600';
      this.style.color=isOpen?'':'var(--accent2)';
    }
  }};
  const cb=d.querySelector('input');cb.onchange=()=>{updateChildCB(cb);updateParentCB(cb)};
  parent.appendChild(d);return d;
}

function updateChildCB(cb){
  const node=cb.parentElement;
  let next=node.nextElementSibling;
  // 仅处理紧随的直属 tree-sub，不跨越到兄弟节点
  if(next&&next.classList.contains('tree-sub')){
    // 递归处理该sub及其内嵌sub中的所有checkbox
    const processSub=(sub)=>{
      [...sub.children].filter(c=>c.classList.contains('tree-node')).forEach(n=>{const icb=n.querySelector('input[type=checkbox]');if(icb){icb.checked=cb.checked;icb.indeterminate=false}});
      sub.querySelectorAll('.tree-sub').forEach(s=>processSub(s));
    };
    processSub(next);
  }
}
function updateParentCB(cb){
  const node=cb.parentElement; // tree-node div
  let parentSub=node.parentElement; // tree-sub or tree-section-body
  
  // 如果在 tree-sub 内，找到父级 checkbox
  if(parentSub.classList.contains('tree-sub')){
    // 找到该 tree-sub 的前一个兄弟（父节点）
    let prev=parentSub.previousElementSibling;
    while(prev&&!prev.classList.contains('tree-node'))prev=prev.previousElementSibling;
    if(prev){
      const parentCb=prev.querySelector('input[type=checkbox]');
      if(parentCb){
        // 统计同层所有 checkbox 是否全选
        const allCbs=[...parentSub.children].filter(c=>c.classList.contains('tree-node')).map(c=>c.querySelector('input[type=checkbox]')).filter(Boolean);
        const allChecked=allCbs.every(c=>c.checked);
        const anyChecked=allCbs.some(c=>c.checked);
        parentCb.checked=allChecked;
        parentCb.indeterminate=!allChecked&&anyChecked;
        // 递归向上
        updateParentCB(parentCb);
      }
    }
  }
}
function lvOf(el){return parseInt(el.className.match(/level-(\d)/)?.[1]||1)}

// ============ Filter ============
function collectFS(){
  fState.cats.clear();fState.dists.clear();fState.depts.clear();fState.bizs.clear();
  document.querySelectorAll('#tree-filters input[type=checkbox]:checked').forEach(cb=>{const t=cb.dataset.ft,c=cb.dataset.code;
    if(t==='cat')fState.cats.add(c);else if(t==='dist')fState.dists.add(c);else if(t==='dept')fState.depts.add(c);else if(t==='biz')fState.bizs.add(c);});
}
function applyFilters(){
  collectFS();fState.search=document.getElementById('search-input').value.trim().toLowerCase();
  flt=D.objects.filter(o=>{
    if(fState.cats.size>0){let m=false;for(const c of fState.cats){if(c.includes('/')){if(o.majorCode+'/'+o.minorCode+'/'+o.detailType===c)m=true}else if(c.length===4){if(o.minorCode===c)m=true}else if(o.majorCode===c)m=true}if(!m)return false}
    if(fState.dists.size>0){let m=false;for(const c of fState.dists){if(c.includes('/')){if(o.districtCode+'/'+o.streetName===c)m=true}else if(o.districtCode===c)m=true}if(!m)return false}
    if(fState.depts.size>0&&!fState.depts.has(o.departmentCode))return false;
    if(fState.bizs.size>0&&![...fState.bizs].some(c=>c===o.departmentCode+'/'+o.bizSystemCode))return false;
    if(fState.search){const h=[o.name,o.censusCode,o.address,o.manager,o.phone,o.districtName,o.streetName,o.majorCategory,o.minorCategory,o.detailType].join(' ').toLowerCase();if(!h.includes(fState.search))return false}
    return true;
  });
  page=1;updateBreadcrumb();updateAllViews();
}
function doSearch(){
  const kw=document.getElementById('search-input').value.trim().toLowerCase();
  if(!kw)return;
  // 先清空旧勾选再匹配
  document.querySelectorAll('#tree-filters input[type=checkbox]').forEach(cb=>{cb.checked=false;cb.indeterminate=false});
  document.querySelectorAll('#tree-filters input[type=checkbox]').forEach(cb=>{
    const code=cb.dataset.code,label=cb.parentElement.textContent.replace(/\d+/g,'').toLowerCase();
    if(label.includes(kw)||(code&&code.toLowerCase().includes(kw))){cb.checked=true}
  });
  fState.search=kw;
  applyFilters();
}
function resetFilters(){
  document.getElementById('search-input').value='';fState.search='';
  document.querySelectorAll('#tree-filters input[type=checkbox]').forEach(cb=>{cb.checked=false;cb.indeterminate=false});
  applyFilters();
}
function updateBreadcrumb(){
  const bc=document.getElementById('breadcrumb');bc.innerHTML='';
  const tags=[];
  fState.cats.forEach(c=>{let label=c;D.categoryTree.forEach(m=>{if(m.code===c)label=m.name;m.children.forEach(c2=>{if(c2.code===c)label=m.name+' › '+c2.name;c2.children.forEach(d=>{if(m.code+'/'+c2.code+'/'+d.name===c)label=m.name+' › '+c2.name+' › '+d.name})})});tags.push({label,key:c,ft:'cat'});});
  fState.dists.forEach(c=>{let label=c;D.districts.forEach(d=>{if(d.code===c)label=d.name;d.streets.forEach(s=>{if(d.code+'/'+s===c)label=d.name+' › '+s})});tags.push({label,key:c,ft:'dist'});});
  fState.depts.forEach(c=>{const d=D.departments.find(x=>x.code===c);if(d)tags.push({label:d.name,key:c,ft:'dept'});});
  fState.bizs.forEach(c=>{const parts=c.split('/');const d=D.departments.find(x=>x.code===parts[0]);if(d){const s=d.systems.find(x=>x.code===parts[1]);if(s)tags.push({label:d.name+' › '+s.name,key:c,ft:'biz'});}});
  tags.forEach(t=>{const el=document.createElement('span');el.className='bcrumb-tag';el.innerHTML=t.label+'<span class="rm">✕</span>';el.querySelector('.rm').onclick=()=>{removeBreadcrumb(t)};bc.appendChild(el)});
}
function removeBreadcrumb(tag){document.querySelectorAll('#tree-filters input[data-code="'+E(tag.key)+'"]').forEach(cb=>{cb.checked=false});applyFilters()}

// ============ Map ============
function initMap(){
  const off=L.tileLayer('tiles/{z}/{x}/{y}.png',{attribution:'Offline',maxZoom:14,minZoom:10,errorTileUrl:''});
  const gd=L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',{subdomains:'1234',attribution:'高德',maxZoom:18});
  map=L.map('map',{center:[32.01,112.14],zoom:11,layers:[off,gd],zoomControl:true});
  mkGrp.addTo(map);
  L.rectangle([[31.80,111.85],[32.30,112.45]],{color:'#2d6aa0',weight:1,fill:false,dashArray:'4 4',opacity:.4}).addTo(map);
  map.on('click',e=>{if(pickCoords){document.getElementById(pickCoords.latId).value=e.latlng.lat.toFixed(6);document.getElementById(pickCoords.lngId).value=e.latlng.lng.toFixed(6);document.getElementById('pick-indicator').style.display='none';map.getContainer().style.cursor='';pickCoords=null;document.getElementById('form-overlay').classList.add('show')}});
  map.on('contextmenu',e=>{L.DomEvent.preventDefault(e);if(!pickCoords)openAddFormAt(e.latlng.lat,e.latlng.lng)});
  
  // Map legend
  const legend=L.control({position:'bottomright'});
  legend.onAdd=function(){const div=L.DomUtil.create('div','map-legend');div.innerHTML=`<h4>🗺️ 图例</h4>${D.categoryTree.map(m=>`<div class="map-legend-item"><span class="map-legend-dot" style="background:${m.color}"></span>${m.icon} ${m.name}</div>`).join('')}`;return div};
  legend.addTo(map);
}

function renderMarkers(){
  mkGrp.clearLayers();
  if(heatLayer){map.removeLayer(heatLayer);heatLayer=null}
  if(flt.length>1000){
    // Heatmap
    const pts=flt.map(o=>[o.latitude,o.longitude,0.15+Math.random()*0.1]);
    heatLayer=L.heatLayer(pts,{radius:18,blur:12,max:0.6,maxZoom:13,gradient:{0.1:'rgba(45,106,160,0)',0.25:'#4a90d9',0.45:'#2d6aa0',0.6:'#f5a623',0.8:'#ff9100',0.95:'#ff5252'}}).addTo(map);
  }else{
    // Category scatter markers
    flt.forEach(o=>{
      const ci=CAT_ICONS[o.majorCode]||{icon:'📍',bg:'#666'};
      const icon=L.divIcon({className:'',html:`<div class="cat-marker" style="background:${ci.bg};${o.id===selId?'box-shadow:0 0 12px '+ci.bg+';transform:scale(1.3)':''}">${ci.icon}</div>`,iconSize:[26,26],iconAnchor:[13,13]});
      const m=L.marker([o.latitude,o.longitude],{icon}).addTo(mkGrp);m._cid=o.id;
      m.on('click',()=>showDetail(o.id));
      m.on('contextmenu',e=>{L.DomEvent.preventDefault(e);L.DomEvent.stopPropagation(e);showCM(e,o)});
    });
  }
}

// ============ List + Pagination ============
function renderList(){
  const totalPages=Math.ceil(flt.length/pageSize)||1;
  if(page>totalPages)page=totalPages;
  const items=flt.slice((page-1)*pageSize,page*pageSize);
  const tb=document.getElementById('list-body');
  tb.innerHTML=items.map((o,i)=>(`<tr data-id="${o.id}" class="${o.id===selId?'selected':''}" onclick="selectRow(${o.id})"><td onclick="event.stopPropagation()"><input type="checkbox" class="r-cb" data-id="${o.id}"></td><td>${(page-1)*pageSize+i+1}</td><td style="font-size:10px;color:var(--text-dim)">${o.censusCode}</td><td style="font-weight:500;cursor:pointer" onclick="showDetail(${o.id})">${o.name}</td><td>${o.majorCategory}</td><td>${o.minorCategory}</td><td>${o.detailType}</td><td>${o.districtName}</td><td style="font-size:10px">${o.streetName}</td><td><span class="status-badge st-${o.status}">${o.status}</span></td><td>${o.department}</td><td style="font-size:10px">${o.bizSystem}</td><td onclick="event.stopPropagation()"><div class="row-actions"><button class="act-detail" onclick="showDetail(${o.id})">详情</button><button class="act-edit" onclick="editComponent(${o.id})">修改</button><button class="act-del" onclick="deleteComponent(${o.id})">删除</button></div></td></tr>`)).join('');
  if(flt.length===0)tb.innerHTML='<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--text-dim)">暂无匹配数据</td></tr>';
  // Pagination
  const pg=document.getElementById('pagination');
  pg.innerHTML=`<button onclick="goPage(1)" ${page<=1?'disabled':''}>« 首页</button><button onclick="goPage(${page-1})" ${page<=1?'disabled':''}>‹ 上一页</button><span class="page-info">第 ${page}/${totalPages} 页</span><button onclick="goPage(${page+1})" ${page>=totalPages?'disabled':''}>下一页 ›</button><button onclick="goPage(${totalPages})" ${page>=totalPages?'disabled':''}>末页 »</button>`;
  document.getElementById('select-all').checked=false;updateBatchBtn();
}
function goPage(p){page=Math.max(1,Math.min(p,Math.ceil(flt.length/pageSize)||1));renderList()}
function selectRow(id){selId=selId===id?null:id;document.querySelectorAll('#list-body tr').forEach(r=>r.classList.toggle('selected',r.dataset.id==selId));updateBatchBtn()}
function toggleSelectAll(){const ck=document.getElementById('select-all').checked;document.querySelectorAll('.r-cb').forEach(cb=>cb.checked=ck);updateBatchBtn()}
function updateBatchBtn(){const n=document.querySelectorAll('.r-cb:checked').length;document.getElementById('btn-batch-del').disabled=n===0}
function batchDelete(){const ids=[...document.querySelectorAll('.r-cb:checked')].map(cb=>+cb.dataset.id);if(!ids.length||!confirm(`确认删除${ids.length}条？`))return;ids.forEach(id=>{D.objects=D.objects.filter(o=>o.id!==id)});refreshTree();applyFilters()}

// ============ Toolbar Filters ============
function popTF(){
  const m=document.getElementById('tf-major'),d=document.getElementById('tf-district');
  m.innerHTML='<option value="">全部大类</option>'+D.categoryTree.map(c=>`<option value="${c.code}">${c.name}</option>`).join('');
  d.innerHTML='<option value="">全部区县</option>'+D.districts.map(x=>`<option value="${x.code}">${x.name}</option>`).join('');
}
function onTFMajor(){const c=document.getElementById('tf-major').value,mi=document.getElementById('tf-minor'),de=document.getElementById('tf-detail');mi.innerHTML='<option value="">全部小类</option>';de.innerHTML='<option value="">全部细类</option>';if(!c)return;const m=D.categoryTree.find(x=>x.code===c);if(m)m.children.forEach(x=>mi.innerHTML+=`<option value="${x.code}">${x.name}</option>`)}
function onTFMinor(){const mc=document.getElementById('tf-major').value,mic=document.getElementById('tf-minor').value,de=document.getElementById('tf-detail');de.innerHTML='<option value="">全部细类</option>';if(!mc||!mic)return;const m=D.categoryTree.find(x=>x.code===mc);if(m){const mi=m.children.find(x=>x.code===mic);if(mi)mi.children.forEach(d=>de.innerHTML+=`<option value="${mc}/${mic}/${d.name}">${d.name}</option>`)}}
function onTFDistrict(){const c=document.getElementById('tf-district').value,s=document.getElementById('tf-street');s.innerHTML='<option value="">全部街道</option>';if(!c)return;const d=D.districts.find(x=>x.code===c);if(d)d.streets.forEach(x=>s.innerHTML+=`<option value="${c}/${x}">${x}</option>`)}
function applyToolFilters(){
  collectFS();
  const m=document.getElementById('tf-major').value,mi=document.getElementById('tf-minor').value,de=document.getElementById('tf-detail').value,di=document.getElementById('tf-district').value,s=document.getElementById('tf-street').value;
  flt=D.objects.filter(o=>{
    if(fState.cats.size>0){let ok=false;for(const c of fState.cats){if(c.includes('/')){if(o.majorCode+'/'+o.minorCode+'/'+o.detailType===c)ok=true}else if(c.length===4){if(o.minorCode===c)ok=true}else if(o.majorCode===c)ok=true}if(!ok)return false}
    if(fState.dists.size>0){let ok=false;for(const c of fState.dists){if(c.includes('/')){if(o.districtCode+'/'+o.streetName===c)ok=true}else if(o.districtCode===c)ok=true}if(!ok)return false}
    if(fState.depts.size>0&&!fState.depts.has(o.departmentCode))return false;
    if(fState.bizs.size>0&&![...fState.bizs].some(c=>c===o.departmentCode+'/'+o.bizSystemCode))return false;
    if(fState.search){const h=[o.name,o.censusCode,o.address,o.manager,o.phone,o.districtName,o.streetName,o.majorCategory,o.minorCategory,o.detailType].join(' ').toLowerCase();if(!h.includes(fState.search))return false}
    if(m&&o.majorCode!==m)return false;if(mi&&o.minorCode!==mi)return false;if(de&&(o.majorCode+'/'+o.minorCode+'/'+o.detailType)!==de)return false;if(di&&o.districtCode!==di)return false;if(s&&(o.districtCode+'/'+o.streetName)!==s)return false;
    return true;
  });
  page=1;updateBreadcrumb();updateAllViews();
}
function resetToolFilters(){['tf-major','tf-minor','tf-detail','tf-district','tf-street'].forEach(id=>document.getElementById(id).value='');popTF();applyFilters()}

// ============ Detail ============
function showDetail(id){const o=D.objects.find(x=>x.id===id);if(!o)return;selId=id;editId=id;
document.getElementById('detail-modal-title').textContent=o.name;
document.getElementById('detail-modal-body').innerHTML=`
<div class="detail-top"><img class="detail-img" src="${o.image||'assets/device-1.svg'}" onerror="this.src='assets/device-1.svg'"><div class="detail-grid">
<div class="detail-item"><span class="l">普查编码</span><span class="v">${o.censusCode}</span></div>
<div class="detail-item"><span class="l">状态</span><span class="v"><span class="status-badge st-${o.status}">${o.status}</span></span></div>
<div class="detail-item"><span class="l">大类</span><span class="v">${o.majorCategory}</span></div>
<div class="detail-item"><span class="l">小类</span><span class="v">${o.minorCategory}</span></div>
<div class="detail-item"><span class="l">细类</span><span class="v">${o.detailType}</span></div>
<div class="detail-item"><span class="l">等级</span><span class="v">${o.level}</span></div>
<div class="detail-item"><span class="l">区县</span><span class="v">${o.districtName}</span></div>
<div class="detail-item"><span class="l">街道</span><span class="v">${o.streetName}</span></div>
<div class="detail-item"><span class="l">部门</span><span class="v">${o.department}</span></div>
<div class="detail-item"><span class="l">业务系统</span><span class="v">${o.bizSystem}</span></div>
<div class="detail-item"><span class="l">负责人</span><span class="v">${o.manager}</span></div>
<div class="detail-item"><span class="l">电话</span><span class="v">${o.phone}</span></div></div></div>
<div class="detail-section"><h4>📌 位置信息</h4><div class="detail-grid">
<div class="detail-item"><span class="l">地址</span><span class="v">${o.address}</span></div>
<div class="detail-item"><span class="l">经度</span><span class="v">${o.longitude}</span></div>
<div class="detail-item"><span class="l">纬度</span><span class="v">${o.latitude}</span></div></div></div>
<div class="detail-section"><h4>🔧 属性</h4><div class="detail-grid">
<div class="detail-item"><span class="l">安装日期</span><span class="v">${o.installDate}</span></div>
<div class="detail-item"><span class="l">面积</span><span class="v">${o.area}㎡</span></div>
<div class="detail-item"><span class="l">材质</span><span class="v">${o.material}</span></div>
<div class="detail-item"><span class="l">普查日期</span><span class="v">${o.censusDate}</span></div>
<div class="detail-item"><span class="l">审核状态</span><span class="v">${o.auditStatus||'-'}</span></div>
<div class="detail-item"><span class="l">审核人</span><span class="v">${o.auditor||'-'}</span></div></div></div>`;
document.getElementById('detail-overlay').classList.add('show');
if(view==='map')map.setView([o.latitude,o.longitude],15,{animate:true});
}
function closeDetail(){document.getElementById('detail-overlay').classList.remove('show');selId=null}
function editCurrent(){if(editId)editComponent(editId)}
function deleteCurrent(){if(editId)deleteComponent(editId)}

// ============ Context Menu ============
function showCM(e,o){ctxTarget=o;const cm=document.getElementById('ctx-menu');
cm.innerHTML=`<div class="ctx-item" onclick="showDetail(${o.id});hideCM()">📋 查看详情</div><div class="ctx-item" onclick="editComponent(${o.id});hideCM()">✏️ 编辑</div><div class="ctx-item" onclick="deleteComponent(${o.id});hideCM()">🗑 删除</div>`;
cm.style.display='block';cm.style.left=(e.originalEvent.clientX+5)+'px';cm.style.top=(e.originalEvent.clientY+5)+'px';
setTimeout(()=>document.addEventListener('click',hideCM,{once:true}),0);
}
function hideCM(){document.getElementById('ctx-menu').style.display='none';ctxTarget=null}

// ============ CRUD ============
function openAddForm(){editId=null;document.getElementById('form-title').textContent='➕ 新增部件';renderForm(null);document.getElementById('form-overlay').classList.add('show')}
function openAddFormAt(lat,lng){openAddForm();setTimeout(()=>{const fa=document.getElementById('form-lat'),fo=document.getElementById('form-lng');if(fa)fa.value=lat.toFixed(6);if(fo)fo.value=lng.toFixed(6)},100)}
function editComponent(id){const o=D.objects.find(x=>x.id===id);if(!o)return;editId=id;document.getElementById('form-title').textContent='✏️ 编辑部件';renderForm(o);document.getElementById('form-overlay').classList.add('show')}
function renderForm(d){
  const o=d||{};
  document.getElementById('form-body').innerHTML=`
<div class="form-group full"><label>部件名称 *</label><input id="form-name" value="${E(o.name||'')}"></div>
<div class="form-group full"><label>普查编码</label><input id="form-census" value="${E(o.censusCode||'')}"></div>
<div class="form-group"><label>大类</label><select id="form-major" onchange="onFMajor()"><option value="">请选择</option>${D.categoryTree.map(m=>`<option value="${m.code}" ${o.majorCode===m.code?'selected':''}>${m.name}</option>`).join('')}</select></div>
<div class="form-group"><label>小类</label><select id="form-minor" onchange="onFMinor()"><option value="">请先选大类</option></select></div>
<div class="form-group"><label>细类</label><select id="form-detail"><option value="">请先选小类</option></select></div>
<div class="form-group"><label>区县</label><select id="form-district" onchange="onFDistrict()"><option value="">请选择</option>${D.districts.map(x=>`<option value="${x.code}" ${o.districtCode===x.code?'selected':''}>${x.name}</option>`).join('')}</select></div>
<div class="form-group"><label>街道</label><select id="form-street"><option value="">请先选区县</option></select></div>
<div class="form-group"><label>部门</label><select id="form-dept" onchange="onFDept()"><option value="">请选择</option>${D.departments.map(x=>`<option value="${x.code}" ${o.departmentCode===x.code?'selected':''}>${x.name}</option>`).join('')}</select></div>
<div class="form-group"><label>业务系统</label><select id="form-biz"><option value="">请先选部门</option></select></div>
<div class="form-group"><label>状态</label><select id="form-status">${STS.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="form-group"><label>等级</label><select id="form-level">${LVS.map(s=>`<option value="${s}" ${o.level===s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="form-group"><label>负责人</label><input id="form-manager" value="${E(o.manager||'')}"></div>
<div class="form-group"><label>电话</label><input id="form-phone" value="${E(o.phone||'')}"></div>
<div class="form-group"><label>安装日期</label><input type="date" id="form-install" value="${E(o.installDate||'')}"></div>
<div class="form-group"><label>材质</label><select id="form-material">${MATS.map(s=>`<option value="${s}" ${o.material===s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="form-group full"><label>坐标</label><div class="form-coord"><input id="form-lng" placeholder="经度" value="${o.longitude||''}"><input id="form-lat" placeholder="纬度" value="${o.latitude||''}"><button onclick="startPick()">📍 地图选点</button></div></div>
<div class="form-group full"><label>地址</label><input id="form-addr" value="${E(o.address||'')}"></div>
<div class="form-group"><label>面积(㎡)</label><input type="number" id="form-area" value="${E(o.area||'')}"></div>
<div class="form-group"><label>审核状态</label><select id="form-audit">${['','已审核','待审核','已驳回'].map(s=>`<option value="${s}" ${(o.auditStatus||'')===s?'selected':''}>${s||'无'}</option>`).join('')}</select></div>`;
  if(o.majorCode){onFMajor();setTimeout(()=>{const mi=document.getElementById('form-minor');if(mi&&o.minorCode){mi.value=o.minorCode;onFMinor()}const ds=document.getElementById('form-district');if(ds&&o.districtCode){ds.value=o.districtCode;onFDistrict()}const dt=document.getElementById('form-dept');if(dt&&o.departmentCode){dt.value=o.departmentCode;onFDept()}setTimeout(()=>{const d=document.getElementById('form-detail');if(d&&o.detailType)d.value=o.majorCode+'/'+o.minorCode+'/'+o.detailType;const s=document.getElementById('form-street');if(s&&o.streetName)s.value=o.districtCode+'/'+o.streetName;const b=document.getElementById('form-biz');if(b&&o.bizSystemCode)b.value=o.departmentCode+'/'+o.bizSystemCode},50)},50)}
}
const STS=['正常','损坏','废弃','在建','待维修'],LVS=['一级','二级','三级','普通'],MATS=['不锈钢','铸铁','混凝土','PE','铝合金','钢化玻璃'];
function onFMajor(){const c=document.getElementById('form-major').value,mi=document.getElementById('form-minor'),de=document.getElementById('form-detail');mi.innerHTML='<option value="">请选择</option>';de.innerHTML='<option value="">请先选小类</option>';if(!c)return;const m=D.categoryTree.find(x=>x.code===c);if(m)m.children.forEach(x=>mi.innerHTML+=`<option value="${x.code}">${x.name}</option>`)}
function onFMinor(){const mc=document.getElementById('form-major').value,mic=document.getElementById('form-minor').value,de=document.getElementById('form-detail');de.innerHTML='<option value="">请选择</option>';if(!mc||!mic)return;const m=D.categoryTree.find(x=>x.code===mc);if(m){const mi=m.children.find(x=>x.code===mic);if(mi)mi.children.forEach(d=>de.innerHTML+=`<option value="${mc}/${mic}/${d.name}">${d.name}</option>`)}}
function onFDistrict(){const c=document.getElementById('form-district').value,s=document.getElementById('form-street');s.innerHTML='<option value="">请选择</option>';if(!c)return;const d=D.districts.find(x=>x.code===c);if(d)d.streets.forEach(x=>s.innerHTML+=`<option value="${c}/${x}">${x}</option>`)}
function onFDept(){const c=document.getElementById('form-dept').value,b=document.getElementById('form-biz');b.innerHTML='<option value="">请选择</option>';if(!c)return;const d=D.departments.find(x=>x.code===c);if(d)d.systems.forEach(s=>b.innerHTML+=`<option value="${c}/${s.code}">${s.name}</option>`)}
function startPick(){pickCoords={latId:'form-lat',lngId:'form-lng'};document.getElementById('pick-indicator').style.display='block';map.getContainer().style.cursor='crosshair';const ov=document.getElementById('form-overlay');ov.classList.remove('show');switchView('map')}
function refreshTree(){
  // 保存当前勾选状态
  const checked=new Set();
  document.querySelectorAll('#tree-filters input[type=checkbox]:checked').forEach(cb=>checked.add(cb.dataset.code));
  buildTree();
  // 恢复勾选
  document.querySelectorAll('#tree-filters input[type=checkbox]').forEach(cb=>{if(checked.has(cb.dataset.code))cb.checked=true});
}
function saveForm(){
  const v={name:document.getElementById('form-name').value.trim(),censusCode:document.getElementById('form-census').value.trim(),majorCode:document.getElementById('form-major').value,minorCode:document.getElementById('form-minor').value,detailType:(document.getElementById('form-detail').value||'').split('/').pop(),districtCode:document.getElementById('form-district').value,streetName:(document.getElementById('form-street').value||'').split('/').pop(),departmentCode:document.getElementById('form-dept').value,bizSystemCode:(document.getElementById('form-biz').value||'').split('/').pop(),status:document.getElementById('form-status').value,level:document.getElementById('form-level').value,manager:document.getElementById('form-manager').value.trim(),phone:document.getElementById('form-phone').value.trim(),installDate:document.getElementById('form-install').value,material:document.getElementById('form-material').value,longitude:parseFloat(document.getElementById('form-lng').value)||112.14,latitude:parseFloat(document.getElementById('form-lat').value)||32.01,address:document.getElementById('form-addr').value.trim(),area:parseInt(document.getElementById('form-area').value)||0,auditStatus:document.getElementById('form-audit').value};
  if(!v.name){alert('请填写部件名称');return}
  const ma=D.categoryTree.find(x=>x.code===v.majorCode),mi=ma?.children.find(x=>x.code===v.minorCode),de=D.departments.find(x=>x.code===v.departmentCode),bi=de?.systems.find(x=>x.code===v.bizSystemCode),di=D.districts.find(x=>x.code===v.districtCode);
  const now=new Date().toISOString().slice(0,19).replace('T',' ');
  if(editId){const idx=D.objects.findIndex(x=>x.id===editId);if(idx>=0){D.objects[idx]={...D.objects[idx],...v,id:editId,majorCategory:ma?.name||D.objects[idx].majorCategory,minorCategory:mi?.name||D.objects[idx].minorCategory,department:de?.name||D.objects[idx].department,bizSystem:bi?.name||D.objects[idx].bizSystem,districtName:di?.name||D.objects[idx].districtName,updatedAt:now}}}
  else{const cd=v.censusCode||`XY-${v.districtCode||'000'}-${String((D.objects.length+1)).padStart(4,'0')}`;D.objects.push({...v,id:D.objects.length+1,censusCode:cd,majorCategory:ma?.name||'',minorCategory:mi?.name||'',department:de?.name||'',bizSystem:bi?.name||'',districtName:di?.name||'',image:`assets/device-${((D.objects.length+1)%12)+1}.svg`,auditor:'',censusDate:now.slice(0,10),createdAt:now,updatedAt:now})}
  closeForm();refreshTree();applyFilters();if(editId)showDetail(editId);
}
function cancelPick(){if(!pickCoords)return;document.getElementById('pick-indicator').style.display='none';map.getContainer().style.cursor='';pickCoords=null;document.getElementById('form-overlay').classList.add('show')}
function closeForm(){document.getElementById('form-overlay').classList.remove('show');if(pickCoords){document.getElementById('pick-indicator').style.display='none';map.getContainer().style.cursor='';pickCoords=null}}
function deleteComponent(id){if(!confirm('确认删除？'))return;if(selId===id)closeDetail();D.objects=D.objects.filter(x=>x.id!==id);refreshTree();applyFilters()}

// ============ View Toggle ============
function switchView(v){view=v;document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
document.getElementById('map-container').classList.toggle('hidden',v!=='map');
document.getElementById('list-wrap').classList.toggle('active',v==='list');
document.getElementById('stats-container').classList.toggle('active',v==='stats');
if(v==='map'){map.invalidateSize();renderMarkers()}else if(v==='list')renderList();else if(v==='stats')renderStats()}
function updateAllViews(){
  document.getElementById('result-count').textContent=`共 ${flt.length} 条`;
  if(view==='map')renderMarkers();else if(view==='list')renderList();else if(view==='stats')renderStats();
}

// ============ Stats ============
function renderStats(){
  const sc=document.getElementById('stats-container');
  const stDist={};flt.forEach(o=>{stDist[o.status]=(stDist[o.status]||0)+1});
  const mcDist={};flt.forEach(o=>{mcDist[o.majorCategory]=(mcDist[o.majorCategory]||0)+1});
  const dsDist={};flt.forEach(o=>{dsDist[o.districtName]=(dsDist[o.districtName]||0)+1});
  const stCol={正常:'#00c853',损坏:'#ff5252',废弃:'#546e7a',在建:'#ff9100',待维修:'#448aff'};
  const maxSt=Math.max(...Object.values(stDist),1),maxDs=Math.max(...Object.values(dsDist),1);
  sc.innerHTML=`
<h3 style="color:var(--accent2);margin-bottom:16px;font-size:16px">📊 数据统计看板 <span style="font-size:12px;color:var(--text-dim)">（当前筛选结果 ${flt.length} 条）</span></h3>
<div class="stat-grid">
  <div class="stat-card"><h4>📌 按状态分布</h4>${['正常','损坏','废弃','在建','待维修'].map(s=>`<div class="stat-bar-wrap"><span class="stat-bar-label">${s}</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(stDist[s]||0)/maxSt*100}%;background:${stCol[s]}">${stDist[s]||0}</div></div></div>`).join('')}</div>
  <div class="stat-card"><h4>📦 按大类分布</h4><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${D.categoryTree.map(m=>`<div class="stat-num-card"><div class="num">${mcDist[m.name]||0}</div><div class="lbl">${m.name}</div></div>`).join('')}</div></div>
  <div class="stat-card"><h4>🏆 按区县 TOP5</h4>${Object.entries(dsDist).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`<div class="stat-bar-wrap"><span class="stat-bar-label">${k}</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${v/maxDs*100}%;background:var(--accent2)">${v}</div></div></div>`).join('')}</div>
</div>`;
}

// ============ CSV Export ============
function exportCSV(){
  const hd=['序号','普查编码','部件名称','大类','小类','细类','区县','街道','状态','等级','部门','业务系统','负责人','电话','地址','经度','纬度','安装日期','面积','材质','审核状态','审核人'];
  const rows=flt.map((o,i)=>[i+1,o.censusCode,o.name,o.majorCategory,o.minorCategory,o.detailType,o.districtName,o.streetName,o.status,o.level,o.department,o.bizSystem,o.manager,o.phone,o.address,o.longitude,o.latitude,o.installDate,o.area,o.material,o.auditStatus,o.auditor].map(v=>'"'+(v!=null?String(v).replace(/"/g,'""'):'')+'"').join(','));
  const csv='\uFEFF'+hd.join(',')+'\n'+rows.join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`城市部件_${new Date().toISOString().slice(0,10)}.csv`;a.click();
}

// ============ Esc ============
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.getElementById('ctx-menu').style.display!=='none'){hideCM()}else if(pickCoords){cancelPick()}else if(document.getElementById('form-overlay').classList.contains('show')){closeForm()}else if(document.getElementById('detail-overlay').classList.contains('show')){closeDetail()}}});

// ============ Helpers ============
function E(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
// Global exports
window.switchView=switchView;window.showDetail=showDetail;window.closeDetail=closeDetail;window.editCurrent=editCurrent;window.deleteCurrent=deleteCurrent;
window.openAddForm=openAddForm;window.openAddFormAt=openAddFormAt;window.editComponent=editComponent;window.deleteComponent=deleteComponent;window.closeForm=closeForm;window.saveForm=saveForm;
window.startPick=startPick;window.toggleSelectAll=toggleSelectAll;window.batchDelete=batchDelete;window.selectRow=selectRow;window.goPage=goPage;
window.applyFilters=applyFilters;window.resetFilters=resetFilters;window.doSearch=doSearch;
window.applyToolFilters=applyToolFilters;window.resetToolFilters=resetToolFilters;
window.onTFMajor=onTFMajor;window.onTFMinor=onTFMinor;window.onTFDistrict=onTFDistrict;
window.onFMajor=onFMajor;window.onFMinor=onFMinor;window.onFDistrict=onFDistrict;window.onFDept=onFDept;
window.hideCM=hideCM;window.showCM=showCM;window.exportCSV=exportCSV;
init();
})();
