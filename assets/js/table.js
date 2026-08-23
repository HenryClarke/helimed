document.addEventListener("DOMContentLoaded",()=>{
const table=document.querySelector("#table"),body=table.querySelector("tbody"),status=document.querySelector("#status");
const search=document.querySelector("#search"),size=document.querySelector("#size"),panes=document.querySelector("#panes");
const clear=document.querySelector("#clear"),prev=document.querySelector("#prev"),next=document.querySelector("#next");
const pageText=document.querySelector("#page"),count=document.querySelector("#count"),heads=[...table.querySelectorAll("th")];
const registrationToggle=document.querySelector("#registration-toggle");
const columns=["Organisation","Base","Registration","Callsign","Aircraft Type","Operator"];
const filterColumns=["Organisation","Base","Aircraft Type","Operator"];
const selected=Object.fromEntries(filterColumns.map(k=>[k,new Set()]));
let rows=[],page=1,sortKey="Callsign",direction="asc";
let applyingUrlState=false;

applyBasicUrlState();
document.body.classList.toggle("hide-registrations",!registrationToggle.checked);

registrationToggle.addEventListener("change",()=>{
  document.body.classList.toggle("hide-registrations",!registrationToggle.checked);
  updateUrl();
});

fetch("assets/data/helimed.csv")
  .then(r=>{
    if(!r.ok)throw Error(r.status);
    return r.text();
  })
  .then(text=>{
    rows=parseCSV(text);
    buildPanes();
    applyFilterUrlState();
    table.hidden=false;
    status.hidden=true;
    render();
  })
  .catch(e=>{
    console.error(e);
    status.textContent="Could not load the CSV. Start the included local server rather than opening index.html directly.";
    status.classList.add("error");
  });

search.oninput=()=>{
  page=1;
  render();
};

size.onchange=()=>{
  page=1;
  render();
};

clear.onclick=()=>{
  search.value="";
  Object.values(selected).forEach(s=>s.clear());
  panes.querySelectorAll("input").forEach(i=>i.checked=false);
  page=1;
  render();
};

prev.onclick=()=>{
  page=Math.max(1,page-1);
  render();
};

next.onclick=()=>{
  page++;
  render();
};

heads.forEach(h=>h.onclick=()=>{
  const k=h.dataset.key;
  if(sortKey===k){
    direction=direction==="asc"?"desc":"asc";
  }else{
    sortKey=k;
    direction="asc";
  }
  page=1;
  render();
});

window.addEventListener("popstate",()=>{
  applyingUrlState=true;

  Object.values(selected).forEach(set=>set.clear());
  applyBasicUrlState();

  if(rows.length){
    applyFilterUrlState();
    render();
  }

  applyingUrlState=false;
});

function applyBasicUrlState(){
  const params=new URLSearchParams(location.search);

  search.value=params.get("q")||"";

  const requestedSize=params.get("size");
  if(requestedSize&&[...size.options].some(option=>option.value===requestedSize)){
    size.value=requestedSize;
  }

  const requestedSort=params.get("sort");
  if(requestedSort&&columns.includes(requestedSort)){
    sortKey=requestedSort;
  }

  const requestedDirection=params.get("dir");
  if(requestedDirection==="asc"||requestedDirection==="desc"){
    direction=requestedDirection;
  }

  const requestedPage=Number(params.get("page"));
  page=Number.isInteger(requestedPage)&&requestedPage>0?requestedPage:1;

  registrationToggle.checked=params.get("regs")==="1";
  document.body.classList.toggle("hide-registrations",!registrationToggle.checked);
}

function applyFilterUrlState(){
  const params=new URLSearchParams(location.search);

  filterColumns.forEach(key=>{
    selected[key].clear();

    const paramName=filterParamName(key);
    const values=params.getAll(paramName);

    values.forEach(value=>{
      if(value)selected[key].add(value);
    });
  });
}

function buildPanes(){
  panes.innerHTML="";

  filterColumns.forEach(key=>{
    const pane=document.createElement("section");
    pane.className="pane";
    pane.dataset.column=key;
    pane.innerHTML=`<h3>${key}</h3>`;

    const opts=document.createElement("div");
    opts.className="options";

    pane.append(opts);
    panes.append(pane);
  });

  updatePanes();
}

function updatePanes(){
  const q=search.value.trim().toLowerCase();

  filterColumns.forEach(key=>{
    const pane=panes.querySelector(`[data-column="${CSS.escape(key)}"] .options`);
    const counts=new Map();

    rows
      .filter(row=>{
        const matchesSearch=!q||Object.values(row).some(v=>String(v).toLowerCase().includes(q));

        const matchesOtherPanes=filterColumns.every(otherKey=>{
          if(otherKey===key||selected[otherKey].size===0)return true;
          return selected[otherKey].has(row[otherKey]||"(blank)");
        });

        return matchesSearch&&matchesOtherPanes;
      })
      .forEach(row=>{
        const value=row[key]||"(blank)";
        counts.set(value,(counts.get(value)||0)+1);
      });

    selected[key].forEach(value=>{
      if(!counts.has(value))counts.set(value,0);
    });

    pane.innerHTML="";

    [...counts.entries()]
      .filter(([value,total])=>total>0||selected[key].has(value))
      .sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}))
      .forEach(([value,total])=>{
        const label=document.createElement("label");
        label.className="option";

        const box=document.createElement("input");
        box.type="checkbox";
        box.checked=selected[key].has(value);

        box.onchange=()=>{
          box.checked?selected[key].add(value):selected[key].delete(value);
          page=1;
          render();
        };

        const text=document.createElement("span");
        text.textContent=value;

        const n=document.createElement("span");
        n.className="n";
        n.textContent=total;

        label.append(box,text,n);
        pane.append(label);
      });
  });
}

function render(){
  updatePanes();

  const q=search.value.trim().toLowerCase();

  let filtered=rows.filter(r=>
    (!q||Object.values(r).some(v=>String(v).toLowerCase().includes(q)))&&
    filterColumns.every(k=>!selected[k].size||selected[k].has(r[k]||"(blank)"))
  );

  filtered.sort((a,b)=>{
    let x=a[sortKey]||"",y=b[sortKey]||"";

    if(sortKey==="Callsign"){
      x=(String(x).match(/HELIMED\s*(\d+)/i)||[,9999])[1];
      y=(String(y).match(/HELIMED\s*(\d+)/i)||[,9999])[1];
    }

    const c=String(x).localeCompare(String(y),undefined,{
      numeric:true,
      sensitivity:"base"
    });

    return direction==="asc"?c:-c;
  });

  heads.forEach(h=>{
    h.classList.remove("asc","desc");
    if(h.dataset.key===sortKey)h.classList.add(direction);
  });

  const per=Number(size.value);
  const pages=Math.max(1,Math.ceil(filtered.length/per));
  page=Math.min(page,pages);

  const start=(page-1)*per;
  const visible=filtered.slice(start,start+per);

  body.innerHTML="";

  visible.forEach(r=>{
    const tr=document.createElement("tr");

    columns.forEach(k=>{
      const td=document.createElement("td");

      if(k==="Registration"){
        td.classList.add("registration-column");
        td.textContent=formatRegistrations(r[k]);
      }else if(k==="Organisation"&&r.Website){
        const link=document.createElement("a");
        link.href=r.Website;
        link.textContent=r[k]||"";
        link.target="_blank";
        link.rel="noopener noreferrer";
        td.append(link);
      }else{
        td.textContent=r[k]||"";
      }

      tr.append(td);
    });

    body.append(tr);
  });

  count.textContent=filtered.length
    ?`Showing ${start+1}–${Math.min(start+per,filtered.length)} of ${filtered.length} records`
    :"No matching records";

  pageText.textContent=`Page ${page} of ${pages}`;
  prev.disabled=page<=1;
  next.disabled=page>=pages;

  updateUrl();
}

function updateUrl(){
  if(applyingUrlState)return;

  const params=new URLSearchParams();

  const query=search.value.trim();
  if(query)params.set("q",query);

  if(size.value!=="25")params.set("size",size.value);
  if(sortKey!=="Callsign")params.set("sort",sortKey);
  if(direction!=="asc")params.set("dir",direction);
  if(page>1)params.set("page",String(page));
  if(registrationToggle.checked)params.set("regs","1");

  filterColumns.forEach(key=>{
    const paramName=filterParamName(key);
    [...selected[key]]
      .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}))
      .forEach(value=>params.append(paramName,value));
  });

  const queryString=params.toString();
  const nextUrl=queryString?`${location.pathname}?${queryString}${location.hash}`:`${location.pathname}${location.hash}`;

  history.replaceState(null,"",nextUrl);
}

function filterParamName(key){
  const names={
    "Organisation":"org",
    "Base":"base",
    "Aircraft Type":"type",
    "Operator":"operator"
  };

  return names[key];
}

function formatRegistrations(value){
  if(!value)return "";

  const registrations=String(value)
    .split(/\s*(?:,|;|\/|\r?\n|\bor\b)\s*|\s{2,}/i)
    .map(item=>item.trim())
    .filter(Boolean);

  return [...new Set(registrations)].join(", ");
}

function parseCSV(text){
  text=text.replace(/^\uFEFF/,"");

  const matrix=[];
  let row=[],field="",quoted=false;

  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];

    if(c==='"'){
      if(quoted&&n==='"'){
        field+='"';
        i++;
      }else{
        quoted=!quoted;
      }
    }else if(c===","&&!quoted){
      row.push(field);
      field="";
    }else if((c==="\n"||c==="\r")&&!quoted){
      if(c==="\r"&&n==="\n")i++;
      row.push(field);
      field="";

      if(row.some(v=>v!==""))matrix.push(row);
      row=[];
    }else{
      field+=c;
    }
  }

  if(field!==""||row.length){
    row.push(field);
    matrix.push(row);
  }

  const headers=matrix.shift().map(v=>v.trim());

  return matrix.map(values=>
    Object.fromEntries(
      headers.map((h,i)=>[h,(values[i]||"").trim()])
    )
  );
}
});
