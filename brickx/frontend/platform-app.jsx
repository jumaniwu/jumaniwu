import { useState, useCallback } from "react";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── COLORS ───────────────────────────────────────────────────
const C = {
  bg0:"#020509",bg1:"#060D18",bg2:"#0A1628",
  blue:"#1A56DB",blueL:"#3B82F6",accent:"#0EA5E9",
  green:"#10B981",gold:"#F59E0B",red:"#EF4444",purple:"#8B5CF6",teal:"#14B8A6",
  white:"#FFFFFF",off:"#E2E8F0",muted:"#64748B",dim:"#374151",
  border:"rgba(26,86,219,0.15)",borderH:"rgba(26,86,219,0.5)",
};
const mono="'Courier New',monospace";
const serif="'Georgia',serif";

// ── GLOBAL STYLES ─────────────────────────────────────────────
const GS = () => (
  <style>{`
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{background:${C.bg0};color:${C.off};font-family:${mono};overflow-x:hidden;-webkit-text-size-adjust:100%}
    input,select,button{font-family:${mono};outline:none}
    button{-webkit-tap-highlight-color:transparent;cursor:pointer}
    ::-webkit-scrollbar{width:3px;height:3px}
    ::-webkit-scrollbar-thumb{background:${C.blue};border-radius:3px}
    input[type=range]{accent-color:${C.blue};width:100%}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .fu{animation:fadeUp .35s ease both}
    .blink{animation:blink 2s ease infinite}
    .spin{animation:spin .9s linear infinite}
    .card{background:${C.bg2};border:1px solid ${C.border};border-radius:14px;padding:16px;transition:all .25s}
    .card.glow{border-color:${C.borderH};box-shadow:0 0 24px rgba(26,86,219,.12)}
    .card.tap:hover{border-color:${C.borderH};transform:translateY(-3px)}
    .g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .g4{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    @media(min-width:640px){.g4{grid-template-columns:repeat(4,1fr)}}
    .wrap{width:100%;max-width:1100px;margin:0 auto;padding:0 16px}
    .main{padding:14px 0 80px}
    @media(min-width:768px){.main{padding:20px 0 32px}}
    .bnav{position:fixed;bottom:0;left:0;right:0;z-index:200;display:flex;
      background:rgba(6,13,24,.97);border-top:1px solid ${C.border};backdrop-filter:blur(20px)}
    .bnav button{flex:1;padding:9px 2px 13px;border:none;background:transparent;
      color:${C.muted};font-size:9px;font-family:${mono};
      display:flex;flex-direction:column;align-items:center;gap:3px;transition:color .2s}
    .bnav button .ic{font-size:18px}
    .bnav button.on{color:${C.blueL}}
    @media(min-width:768px){.bnav{display:none}}
    .tnav{position:sticky;top:0;z-index:100;height:52px;
      background:rgba(3,8,16,.95);border-bottom:1px solid ${C.border};
      backdrop-filter:blur(20px);display:flex;align-items:center;
      justify-content:space-between;padding:0 16px}
    .dtabs{display:none}
    @media(min-width:768px){.dtabs{display:flex;gap:2px}}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;
      border:none;border-radius:10px;font-weight:700;transition:all .2s;
      font-family:${mono};letter-spacing:.3px}
    .btn:active{transform:scale(.97)}
    .bp{background:${C.blue};color:#fff}
    .bs{background:${C.green};color:#fff}
    .bo{background:transparent;color:${C.blueL};border:1px solid rgba(59,130,246,.4)}
    .bg{background:rgba(26,86,219,.08);color:${C.blueL}}
    .bteal{background:rgba(20,184,166,.12);color:${C.teal};border:1px solid rgba(20,184,166,.3)}
    .bgold{background:rgba(245,158,11,.12);color:${C.gold};border:1px solid rgba(245,158,11,.3)}
    .sm{padding:7px 13px;font-size:11px}
    .md{padding:10px 20px;font-size:12px}
    .lg{padding:13px 22px;font-size:14px}
    .full{width:100%}
    .inp{width:100%;background:${C.bg1};border:1px solid ${C.border};
      border-radius:10px;padding:12px 14px;color:${C.off};font-size:14px;
      transition:border .2s;font-family:${mono}}
    .inp:focus{border-color:${C.blueL}}
    select.inp option{background:${C.bg1}}
    .pb{background:rgba(255,255,255,.06);border-radius:100px;overflow:hidden}
    .pf{border-radius:100px;transition:width .8s ease}
    .bdg{display:inline-flex;align-items:center;gap:3px;border-radius:100px;
      padding:3px 9px;font-size:10px;font-weight:700;letter-spacing:.5px}
    .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.75);
      backdrop-filter:blur(8px);z-index:500;
      display:flex;align-items:flex-end;justify-content:center}
    @media(min-width:640px){.modal-bg{align-items:center}}
    .modal{background:${C.bg2};border:1px solid ${C.border};border-radius:20px 20px 0 0;
      width:100%;max-width:500px;padding:22px;max-height:90vh;overflow-y:auto;
      animation:fadeUp .3s ease}
    @media(min-width:640px){.modal{border-radius:20px}}
    .toast{position:fixed;top:58px;left:16px;right:16px;z-index:999;
      border-radius:12px;padding:12px 16px;font-size:12px;animation:fadeUp .3s ease}
    @media(min-width:640px){.toast{left:auto;right:20px;width:300px}}
    .prop-card{background:${C.bg2};border:1px solid ${C.border};
      border-radius:14px;overflow:hidden;cursor:pointer;transition:all .3s}
    .prop-card:hover{border-color:${C.borderH};transform:translateY(-4px)}
    .hscroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
    .hscroll::-webkit-scrollbar{display:none}
    .tabs{display:flex;gap:3px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px}
    .tabs::-webkit-scrollbar{display:none}
    .tbtn{flex-shrink:0;padding:7px 13px;border-radius:8px;border:none;
      font-size:11px;font-weight:600;transition:all .2s;
      letter-spacing:.7px;font-family:${mono};white-space:nowrap}
  `}</style>
);

// ── DATA ──────────────────────────────────────────────────────
const USERS = {};
let ICO = { sold:67000000, total:100000000, raise:1005000 };

const PROPS = [
  { id:"h1", name:"The Horizon Hotel Batam", loc:"Nagoya Business District, Batam",
    type:"Hotel", emoji:"🏨", status:"ICO Funding",
    price:10.00, tokens:1200000, sold:310000, value:12000000,
    yield:12.5, yieldPT:0.104, monthlyRent:114000, holders:310,
    desc:"BRICKX flagship. 4-star 120-room business hotel funded by ICO. 70% of net hotel revenue distributed monthly to BRICK holders.",
    highlights:["14 Floors · 120 Rooms","4-Star Business Hotel","70% revenue to holders","Nagoya Business District","Opens Q4 2028"],
    phases:[{n:"Land Acquisition",done:true},{n:"Permits & AMDAL",done:true},
      {n:"ICO Fundraising",done:false,active:true,pct:30},{n:"Construction",done:false},
      {n:"Grand Opening",done:false}],
    history:[{m:"Proj Q1'29",v:0.085},{m:"Q2'29",v:0.098},{m:"Q3'29",v:0.104}] },
  { id:"s2", name:"Skyline Residences Jakarta", loc:"SCBD District, Jakarta Selatan",
    type:"Residential", emoji:"🏙️", status:"Live",
    price:2.40, tokens:1000000, sold:742000, value:2400000,
    yield:8.4, yieldPT:0.0168, monthlyRent:16800, holders:742,
    desc:"Luxury serviced apartments in SCBD. 95% occupancy with corporate tenants. Consistent monthly yield.",
    highlights:["SCBD Prime Location","95% Occupancy","48 Luxury Units","Corporate Tenants"],
    phases:[], history:[{m:"Jan",v:.017},{m:"Feb",v:.016},{m:"Mar",v:.018},{m:"Apr",v:.017},{m:"May",v:.016},{m:"Jun",v:.017}] },
  { id:"b3", name:"Green Valley Villa Bali", loc:"Ubud Highlands, Bali",
    type:"Hospitality", emoji:"🌴", status:"Live",
    price:1.75, tokens:1000000, sold:380000, value:1750000,
    yield:14.2, yieldPT:0.0207, monthlyRent:20708, holders:380,
    desc:"5-star private villa managed by premium hospitality group. 88% avg occupancy. Highest yield in portfolio.",
    highlights:["5-Star Private Villa","88% Avg Occupancy","Ubud Premium Location","Managed by Pro Group"],
    phases:[], history:[{m:"Jan",v:.019},{m:"Feb",v:.022},{m:"Mar",v:.021},{m:"Apr",v:.023},{m:"May",v:.018},{m:"Jun",v:.022}] },
  { id:"k4", name:"Marina Towers KL", loc:"KLCC, Kuala Lumpur",
    type:"Commercial", emoji:"🏢", status:"Live",
    price:3.20, tokens:1000000, sold:890000, value:3200000,
    yield:7.8, yieldPT:0.0208, monthlyRent:20800, holders:890,
    desc:"Grade-A commercial office in KL financial district. Fortune 500 tenants on long-term leases.",
    highlights:["Grade-A Office","Fortune 500 Tenants","Long-term Leases","KLCC Location"],
    phases:[], history:[{m:"Jan",v:.020},{m:"Feb",v:.021},{m:"Mar",v:.021},{m:"Apr",v:.020},{m:"May",v:.021},{m:"Jun",v:.022}] },
  { id:"v5", name:"Saigon Rise HCMC", loc:"District 1, Ho Chi Minh City",
    type:"Residential", emoji:"🌆", status:"Coming Soon",
    price:0.62, tokens:1000000, sold:0, value:620000,
    yield:11.5, yieldPT:0.006, monthlyRent:0, holders:0,
    desc:"Prime District 1 residential in Vietnam's fastest-growing market. Pre-sale launching Q2 2026.",
    highlights:["District 1 Location","High-growth Market","Pre-sale Open"],
    phases:[], history:[] },
];

let LISTINGS = [
  {id:"L1",pid:"s2",name:"Skyline Residences",emoji:"🏙️",seller:"0x7f3a...9c2b",tokens:500,price:2.40,total:1200,yield:8.4,ago:"2d ago"},
  {id:"L2",pid:"s2",name:"Skyline Residences",emoji:"🏙️",seller:"0x4b2c...1e8f",tokens:1200,price:2.40,total:2880,yield:8.4,ago:"5d ago"},
  {id:"L3",pid:"b3",name:"Green Valley Bali",emoji:"🌴",seller:"0x9e5c...6a2d",tokens:2000,price:1.75,total:3500,yield:14.2,ago:"1d ago"},
];

const TKNS=[
  {n:"Ecosystem",v:35,c:"#1A56DB"},{n:"ICO Public",v:15,c:"#3B82F6"},
  {n:"Team",v:12,c:"#6366F1"},{n:"Partners",v:10,c:"#8B5CF6"},
  {n:"Seed",v:8,c:"#0EA5E9"},{n:"Marketing",v:8,c:"#F59E0B"},
  {n:"DEX Liq.",v:7,c:"#10B981"},{n:"DAO",v:5,c:"#64748B"},
];
const TVL=[{m:"Jan",v:.5},{m:"Mar",v:2.1},{m:"May",v:5.4},{m:"Jul",v:9.8},{m:"Sep",v:18.5},{m:"Dec",v:50}];
const COUNTRIES=["Indonesia","Malaysia","Singapore","Philippines","Thailand","Vietnam","India","Australia","United States","Other"];

const fN=n=>n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(0)}K`:String(n);
const fU=n=>`$${n>=1e6?(n/1e6).toFixed(2)+"M":n>=1000?(n/1000).toFixed(1)+"K":n.toLocaleString()}`;

// ── ATOMS ─────────────────────────────────────────────────────
const Dot=({c=C.green,s=6})=><span className="blink" style={{display:"inline-block",width:s,height:s,borderRadius:"50%",background:c,boxShadow:`0 0 6px ${c}`,flexShrink:0}}/>;
const Bdg=({ch,c=C.green})=><span className="bdg" style={{background:`${c}18`,border:`1px solid ${c}44`,color:c}}>{ch}</span>;
const Spin=()=><div className="spin" style={{width:17,height:17,border:"2px solid rgba(255,255,255,.2)",borderTop:"2px solid #fff",borderRadius:"50%"}}/>;
const Btn=({ch,onClick,v="p",sz="md",dis=false,ld=false,full=false,st={}})=>(
  <button onClick={onClick} disabled={dis||ld} className={`btn b${v} ${sz}${full?" full":""}`} style={{opacity:dis?.5:1,...st}}>
    {ld?<Spin/>:ch}
  </button>
);
const Lbl=({ch,mb=10})=><div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:mb}}>{ch}</div>;
const PBar=({pct,h=6,c=C.blue})=>(
  <div className="pb" style={{height:h}}>
    <div className="pf" style={{width:`${Math.min(pct,100)}%`,height:h,background:`linear-gradient(90deg,${c},${C.accent})`}}/>
  </div>
);

function Field({label,type="text",val,set,ph,err,note,req,icon,prefix}) {
  return(
    <div style={{marginBottom:13}}>
      {label&&<label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>
        {label}{req&&<span style={{color:C.red}}> *</span>}
      </label>}
      <div style={{position:"relative"}}>
        {(icon||prefix)&&<span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted,fontSize:12,zIndex:1}}>{icon||prefix}</span>}
        <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
          className="inp" style={icon||prefix?{paddingLeft:34}:{}}/>
      </div>
      {err&&<div style={{fontSize:11,color:C.red,marginTop:3}}>⚠ {err}</div>}
      {note&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>{note}</div>}
    </div>
  );
}

function SelField({label,val,set,opts,req}) {
  return(
    <div style={{marginBottom:13}}>
      {label&&<label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>
        {label}{req&&<span style={{color:C.red}}> *</span>}
      </label>}
      <select value={val} onChange={e=>set(e.target.value)} className="inp">
        {opts.map(o=><option key={o.v||o} value={o.v||o}>{o.l||o}</option>)}
      </select>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────
function Auth({onAuth}) {
  const [mode,setMode]=useState("login");
  const [step,setStep]=useState(1);
  const [ld,setLd]=useState(false);
  const [errs,setErrs]=useState({});
  const [f,setF]=useState({email:"",pw:"",pw2:"",fn:"",ln:"",ph:"",country:"Indonesia",dob:"",ref:""});
  const s=(k,v)=>{setF(p=>({...p,[k]:v}));setErrs(p=>({...p,[k]:""}));};

  const chk1=()=>{
    const e={};
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))e.email="Invalid email";
    if(f.pw.length<8)e.pw="Min 8 chars";
    if(mode==="register"&&f.pw!==f.pw2)e.pw2="Passwords don't match";
    setErrs(e);return !Object.keys(e).length;
  };
  const chk2=()=>{
    const e={};
    if(!f.fn.trim())e.fn="Required";
    if(!f.ln.trim())e.ln="Required";
    if(!f.ph.match(/^\+?[\d\s\-]{7,}/))e.ph="Invalid";
    if(!f.dob)e.dob="Required";
    setErrs(e);return !Object.keys(e).length;
  };

  const doLogin=()=>{
    if(!chk1())return;
    setLd(true);
    setTimeout(()=>{
      const u=USERS[f.email];
      if(u&&u.pw===f.pw)onAuth(u);
      else if(!u)setErrs({email:"Not found. Please register."});
      else setErrs({pw:"Wrong password"});
      setLd(false);
    },800);
  };
  const doReg=()=>{
    if(!chk2())return;
    setLd(true);
    setTimeout(()=>{
      const u={id:Date.now().toString(),email:f.email,pw:f.pw,
        firstName:f.fn,lastName:f.ln,phone:f.ph,country:f.country,dob:f.dob,ref:f.ref,
        kycStatus:"not_started",brx:0,usdc:50000,bricks:{},txs:[],
        createdAt:new Date().toISOString()};
      USERS[f.email]=u;onAuth(u);setLd(false);
    },900);
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <GS/>
      <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100vw",height:"50vh",background:"radial-gradient(ellipse at top,rgba(26,86,219,.1) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400}} className="fu">
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:34,fontWeight:900,color:C.white,fontFamily:serif,letterSpacing:3}}>BRICK<span style={{color:C.blueL}}>X</span></div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginTop:3}}>REAL ESTATE YIELD MARKETPLACE</div>
        </div>
        <div className="card glow">
          <div style={{display:"flex",background:C.bg1,borderRadius:10,padding:3,marginBottom:18}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setStep(1);setErrs({});}}
                style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",fontSize:12,fontWeight:700,letterSpacing:1,transition:"all .2s",background:mode===m?C.blue:"transparent",color:mode===m?C.white:C.muted,fontFamily:mono}}>
                {m==="login"?"SIGN IN":"REGISTER"}
              </button>
            ))}
          </div>
          {mode==="login"&&<>
            <Field label="Email" type="email" val={f.email} set={v=>s("email",v)} ph="you@email.com" icon="✉" err={errs.email} req/>
            <Field label="Password" type="password" val={f.pw} set={v=>s("pw",v)} ph="••••••••" icon="🔒" err={errs.pw} req/>
            <Btn ch="SIGN IN →" full v="p" sz="lg" ld={ld} onClick={doLogin} st={{marginTop:4}}/>
            <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:10}}>Demo: register first, then sign in</p>
          </>}
          {mode==="register"&&step===1&&<>
            <div style={{fontSize:11,color:C.blueL,fontWeight:700,marginBottom:12}}>Step 1/2 — Credentials</div>
            <Field label="Email" type="email" val={f.email} set={v=>s("email",v)} ph="you@email.com" icon="✉" err={errs.email} req/>
            <Field label="Password" type="password" val={f.pw} set={v=>s("pw",v)} ph="Min 8 characters" icon="🔒" err={errs.pw} req/>
            <Field label="Confirm Password" type="password" val={f.pw2} set={v=>s("pw2",v)} ph="Repeat password" icon="🔒" err={errs.pw2} req/>
            <Field label="Referral Code (optional)" val={f.ref} set={v=>s("ref",v)} ph="BRX-XXXXX" icon="🎁" note="500 BRX bonus if referred"/>
            <Btn ch="NEXT →" full v="p" sz="lg" onClick={()=>chk1()&&setStep(2)}/>
          </>}
          {mode==="register"&&step===2&&<>
            <div style={{fontSize:11,color:C.blueL,fontWeight:700,marginBottom:12}}>Step 2/2 — Personal Info</div>
            <div className="g2">
              <Field label="First Name" val={f.fn} set={v=>s("fn",v)} ph="John" err={errs.fn} req/>
              <Field label="Last Name" val={f.ln} set={v=>s("ln",v)} ph="Doe" err={errs.ln} req/>
            </div>
            <Field label="Phone" type="tel" val={f.ph} set={v=>s("ph",v)} ph="+62 812 xxxx" icon="📞" err={errs.ph} req/>
            <Field label="Date of Birth" type="date" val={f.dob} set={v=>s("dob",v)} err={errs.dob} req note="Must be 18+"/>
            <SelField label="Country" val={f.country} set={v=>s("country",v)} opts={COUNTRIES} req/>
            <div style={{display:"flex",gap:8}}>
              <Btn ch="← Back" v="o" onClick={()=>setStep(1)}/>
              <Btn ch="CREATE ACCOUNT ✓" full v="s" sz="lg" ld={ld} onClick={doReg}/>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── KYC ───────────────────────────────────────────────────────
function KYC({user,onDone,onSkip}) {
  const [step,setStep]=useState(1);
  const [ld,setLd]=useState(false);
  const [f,setF]=useState({idType:"passport",idNum:"",idExp:"",front:false,selfie:false,addr:"",city:"",zip:"",country:user.country});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=()=>{setLd(true);setTimeout(()=>{setLd(false);setStep(6);setTimeout(()=>onDone("pending"),2000);},2000);};

  return(
    <div style={{minHeight:"100vh",background:C.bg0}}>
      <GS/>
      <div style={{background:C.bg1,borderBottom:`1px solid ${C.border}`,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:17,fontWeight:900,color:C.white,fontFamily:serif}}>BRICK<span style={{color:C.blueL}}>X</span> <span style={{fontSize:11,color:C.muted}}>KYC</span></span>
        <Btn ch="Skip →" v="g" sz="sm" onClick={onSkip}/>
      </div>
      <div style={{padding:"18px 16px",maxWidth:500,margin:"0 auto"}}>
        {step<6&&(
          <div style={{display:"flex",alignItems:"center",marginBottom:18}}>
            {["Intro","ID","Selfie","Address","Submit"].map((lb,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",flex:i<4?1:0}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
                  <div style={{width:24,height:24,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:step>i+1?C.green:step===i+1?C.blue:C.bg2,border:`1px solid ${step>=i+1?"transparent":C.border}`,color:step>=i+1?C.white:C.muted}}>{step>i+1?"✓":i+1}</div>
                  <div style={{fontSize:8,color:step>=i+1?C.blueL:C.muted}}>{lb}</div>
                </div>
                {i<4&&<div style={{flex:1,height:1,background:step>i+1?C.green:C.border,margin:"0 2px",marginBottom:14}}/>}
              </div>
            ))}
          </div>
        )}
        {step===1&&(
          <div className="card fu">
            <Lbl ch="WHY KYC?"/>
            <div style={{fontSize:17,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:8}}>Verify to Invest</div>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.7,marginBottom:18}}>Required for AML compliance. Takes ~5 minutes. Protects all investors.</p>
            <div className="g2" style={{marginBottom:18}}>
              {[["🪪","Govt ID","Passport / KTP / SIM"],["🤳","Live Selfie","With your ID"],["🏠","Address","Proof of address"],["🔒","Secure","AES-256 · GDPR"]].map(([ic,ti,de])=>(
                <div key={ti} style={{background:C.bg1,borderRadius:11,padding:13,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:22,marginBottom:5}}>{ic}</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:2}}>{ti}</div>
                  <div style={{fontSize:10,color:C.muted}}>{de}</div>
                </div>
              ))}
            </div>
            <Btn ch="START VERIFICATION →" full v="p" sz="lg" onClick={()=>setStep(2)}/>
          </div>
        )}
        {step===2&&(
          <div className="card fu">
            <Lbl ch="IDENTITY DOCUMENT"/>
            <SelField label="Type" val={f.idType} set={v=>s("idType",v)} opts={[{v:"passport",l:"🛂 Passport"},{v:"national_id",l:"🪪 National ID"},{v:"drivers",l:"🚗 Driver License"}]}/>
            <Field label="Document Number" val={f.idNum} set={v=>s("idNum",v)} ph="A1234567" req/>
            <Field label="Expiry Date" type="date" val={f.idExp} set={v=>s("idExp",v)} req/>
            <div className="g2" style={{marginBottom:13}}>
              {[{k:"front",l:"Front of Document"},{k:"selfie",l:"Selfie with ID"}].map(({k,l})=>(
                <div key={k}>
                  <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:5}}>{l} <span style={{color:C.red}}>*</span></label>
                  <div onClick={()=>s(k,true)} style={{background:C.bg1,border:`2px dashed ${f[k]?C.green:C.border}`,borderRadius:11,padding:"22px 10px",textAlign:"center",cursor:"pointer"}}>
                    {f[k]?<><div style={{fontSize:26}}>✅</div><div style={{fontSize:11,color:C.green,fontWeight:700}}>Uploaded</div></>
                    :<><div style={{fontSize:26}}>📤</div><div style={{fontSize:11,color:C.muted}}>Tap to upload</div></>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn ch="← Back" v="o" onClick={()=>setStep(1)}/>
              <Btn ch="NEXT →" full v="p" sz="lg" onClick={()=>setStep(3)} dis={!f.idNum||!f.idExp||!f.front}/>
            </div>
          </div>
        )}
        {step===3&&(
          <div className="card fu">
            <Lbl ch="SELFIE"/>
            <p style={{fontSize:12,color:C.muted,marginBottom:14,lineHeight:1.6}}>Hold your ID next to your face. Ensure text is clearly visible.</p>
            <div onClick={()=>s("selfie",true)} style={{background:C.bg1,border:`2px dashed ${f.selfie?C.green:C.border}`,borderRadius:13,padding:"28px 12px",textAlign:"center",cursor:"pointer",marginBottom:14}}>
              {f.selfie?<><div style={{fontSize:44}}>🤳</div><div style={{fontSize:13,color:C.green,fontWeight:700,marginTop:6}}>Captured ✓</div></>
              :<><div style={{fontSize:44}}>📸</div><div style={{fontSize:13,color:C.white,fontWeight:700,marginTop:6}}>Tap to Capture</div></>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn ch="← Back" v="o" onClick={()=>setStep(2)}/>
              <Btn ch="NEXT →" full v="p" sz="lg" onClick={()=>setStep(4)} dis={!f.selfie}/>
            </div>
          </div>
        )}
        {step===4&&(
          <div className="card fu">
            <Lbl ch="ADDRESS"/>
            <Field label="Street Address" val={f.addr} set={v=>s("addr",v)} ph="Jl. Sudirman No. 1" req/>
            <div className="g2">
              <Field label="City" val={f.city} set={v=>s("city",v)} ph="Batam" req/>
              <Field label="ZIP" val={f.zip} set={v=>s("zip",v)} ph="29444" req/>
            </div>
            <SelField label="Country" val={f.country} set={v=>s("country",v)} opts={COUNTRIES}/>
            <div style={{display:"flex",gap:8}}>
              <Btn ch="← Back" v="o" onClick={()=>setStep(3)}/>
              <Btn ch="REVIEW →" full v="p" sz="lg" onClick={()=>setStep(5)} dis={!f.addr||!f.city}/>
            </div>
          </div>
        )}
        {step===5&&(
          <div className="card fu">
            <Lbl ch="REVIEW & SUBMIT"/>
            <div style={{fontSize:17,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:14}}>Confirm Details</div>
            {[["Name",`${user.firstName} ${user.lastName}`],["Email",user.email],["Document",`${f.idType} — ${f.idNum}`],["Address",`${f.addr}, ${f.city} ${f.zip}`]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
                <span style={{color:C.muted}}>{k}</span>
                <span style={{color:C.white,fontWeight:600,textAlign:"right",maxWidth:"60%",wordBreak:"break-all"}}>{v}</span>
              </div>
            ))}
            <p style={{fontSize:11,color:C.muted,marginTop:13,marginBottom:13,lineHeight:1.5}}>By submitting you confirm all information is accurate.</p>
            <div style={{display:"flex",gap:8}}>
              <Btn ch="← Edit" v="o" onClick={()=>setStep(4)}/>
              <Btn ch="SUBMIT ✓" full v="s" sz="lg" ld={ld} onClick={submit}/>
            </div>
          </div>
        )}
        {step===6&&(
          <div className="card fu" style={{textAlign:"center",padding:32}}>
            <div style={{fontSize:52,marginBottom:10}}>⏳</div>
            <div style={{fontSize:19,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:6}}>Submitted!</div>
            <p style={{fontSize:12,color:C.muted}}>Review takes 5–30 minutes. Redirecting...</p>
            <div style={{marginTop:14}}><Bdg ch="⏳ PENDING REVIEW" c={C.gold}/></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────
function InfoModal({onClose}) {
  return(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:C.white,fontFamily:serif}}>⚡ How Stable Price Works</div>
          <Btn ch="✕" v="g" sz="sm" onClick={onClose}/>
        </div>
        <div style={{background:"rgba(20,184,166,.08)",border:"1px solid rgba(20,184,166,.3)",borderRadius:10,padding:12,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.teal}}>🔒 Fixed Token Price · Yield-Based Returns</div>
        </div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.8,marginBottom:14}}>BRICKX uses a <strong style={{color:C.white}}>stable token price model</strong> — the price of each BRICK token is permanently fixed. Returns come entirely from property/hotel yield.</p>
        {[["📌","Fixed Price","Token price never changes — no speculation"],
          ["💰","Yield = Return","Monthly rental/hotel income distributed to holders"],
          ["🔄","Sell Anytime","List tokens at exact same price on marketplace"],
          ["🏨","Hotel Batam","70% net hotel revenue → BRICK holders monthly"],
          ["✅","Low Risk","Pure yield investment — like an on-chain REIT"],
        ].map(([ic,t,d])=>(
          <div key={t} style={{display:"flex",gap:11,padding:"9px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
            <span style={{fontSize:17,flexShrink:0}}>{ic}</span>
            <div><div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:2}}>{t}</div><div style={{fontSize:11,color:C.muted}}>{d}</div></div>
          </div>
        ))}
        <div style={{background:"rgba(20,184,166,.07)",border:"1px solid rgba(20,184,166,.2)",borderRadius:11,padding:13,marginTop:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:C.teal,marginBottom:5}}>Example: Hotel Batam</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>Buy 1,000 tokens at <strong style={{color:C.white}}>$10 each = $10,000</strong>.<br/>Hotel earns $114K/mo → 70% to holders = $79.8K pool.<br/>Your share: <strong style={{color:C.green}}>~$66.50/month</strong> (12.5% APY).<br/>Sell → list 1,000 tokens at <strong style={{color:C.white}}>$10</strong> on marketplace. <strong style={{color:C.teal}}>Price stays $10 forever.</strong></div>
        </div>
        <Btn ch="Got it ✓" full v="p" sz="lg" onClick={onClose}/>
      </div>
    </div>
  );
}

function BuyModal({listing,user,setUser,notify,onClose}) {
  const [ld,setLd]=useState(false);
  const can=user.kycStatus==="approved"||user.kycStatus==="pending";
  const mo=((listing.tokens*listing.price)*(listing.yield/100)/12).toFixed(2);
  const yr=((listing.tokens*listing.price)*(listing.yield/100)).toFixed(2);
  const doBuy=()=>{
    if(user.usdc<listing.total){notify("Insufficient balance","error");return;}
    setLd(true);
    setTimeout(()=>{
      const tx={id:Date.now(),type:"BRICK_PURCHASE",prop:listing.name,tokens:listing.tokens,usd:listing.total,price:listing.price,date:new Date().toISOString(),hash:"0x"+Math.random().toString(16).slice(2,18),status:"confirmed"};
      const bricks={...(user.bricks||{})};bricks[listing.pid]=(bricks[listing.pid]||0)+listing.tokens;
      const u={...user,usdc:user.usdc-listing.total,bricks,txs:[tx,...(user.txs||[])]};
      setUser(u);USERS[user.email]=u;
      LISTINGS=LISTINGS.filter(l=>l.id!==listing.id);
      setLd(false);notify(`Bought ${listing.tokens.toLocaleString()} BRICK tokens!`);onClose();
    },1700);
  };
  return(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontSize:15,fontWeight:800,color:C.white,fontFamily:serif}}>{listing.emoji} Buy Tokens</div>
          <Btn ch="✕" v="g" sz="sm" onClick={onClose}/>
        </div>
        <div style={{background:C.bg1,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:10}}>{listing.name}</div>
          {[["Tokens",`${listing.tokens.toLocaleString()} BRICK`],["Fixed Price",`$${listing.price.toFixed(2)}`],["Total Cost",`$${listing.total.toLocaleString()}`],["Annual Yield",`${listing.yield}%`]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
              <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:700}}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:11,padding:13,marginBottom:14}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:8}}>PROJECTED RETURNS</div>
          <div className="g2">
            <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:C.green,fontFamily:serif}}>${mo}</div><div style={{fontSize:10,color:C.muted}}>Monthly</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:C.green,fontFamily:serif}}>${yr}</div><div style={{fontSize:10,color:C.muted}}>Annual</div></div>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:14}}>
          <span>Your balance:</span><span style={{color:C.white}}>${user.usdc.toLocaleString()} USDC</span>
        </div>
        {!can&&<div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:11,marginBottom:12,fontSize:12,color:C.gold,textAlign:"center"}}>⚠ Complete KYC to purchase</div>}
        <Btn ch={can?`BUY — $${listing.total.toLocaleString()}`:"Complete KYC First"} full v="s" sz="lg" ld={ld} onClick={can?doBuy:onClose} dis={can&&user.usdc<listing.total}/>
        <p style={{fontSize:10,color:C.dim,textAlign:"center",marginTop:7}}>Fixed price · Earn yield · Resell anytime at same price</p>
      </div>
    </div>
  );
}

function SellModal({user,setUser,notify,onClose}) {
  const [pid,setPid]=useState("");
  const [amt,setAmt]=useState("");
  const [ld,setLd]=useState(false);
  const bricks=user.bricks||{};
  const owned=Object.keys(bricks).filter(k=>bricks[k]>0);
  const prop=PROPS.find(p=>p.id===pid);
  const max=bricks[pid]||0;
  const total=prop?(Number(amt)*prop.price).toFixed(2):0;
  const doList=()=>{
    if(!pid||!amt||Number(amt)<=0||Number(amt)>max)return;
    setLd(true);
    setTimeout(()=>{
      const listing={id:"L"+Date.now(),pid,name:prop.name,emoji:prop.emoji,seller:user.email,tokens:Number(amt),price:prop.price,total:Number(total),yield:prop.yield,ago:"just now"};
      LISTINGS=[listing,...LISTINGS];
      const newBricks={...bricks,[pid]:bricks[pid]-Number(amt)};
      const tx={id:Date.now(),type:"BRICK_LISTED",prop:prop.name,tokens:Number(amt),usd:Number(total),price:prop.price,date:new Date().toISOString(),hash:"0x"+Math.random().toString(16).slice(2,18),status:"listed"};
      const u={...user,bricks:newBricks,txs:[tx,...(user.txs||[])]};
      setUser(u);USERS[user.email]=u;
      setLd(false);notify(`Listed ${amt} BRICK tokens!`);onClose();
    },1500);
  };
  return(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:C.white,fontFamily:serif}}>📢 List Tokens for Sale</div>
          <Btn ch="✕" v="g" sz="sm" onClick={onClose}/>
        </div>
        <div style={{background:"rgba(20,184,166,.06)",border:"1px solid rgba(20,184,166,.2)",borderRadius:9,padding:11,marginBottom:14,fontSize:12,color:C.teal}}>🔒 Token price is fixed — listed at same stable price. Buyer gets your yield rights.</div>
        {owned.length===0?<div style={{textAlign:"center",padding:"28px 0",color:C.muted}}><div style={{fontSize:36,marginBottom:8}}>💼</div>No tokens owned yet.</div>:(
          <>
            <SelField label="Select Property" val={pid} set={setPid} opts={[{v:"",l:"Choose property..."},...owned.map(id=>{const p=PROPS.find(x=>x.id===id);return{v:id,l:`${p?.emoji} ${p?.name} (${bricks[id]} tokens)`};})]}/>
            {pid&&(
              <>
                <div style={{background:C.bg1,borderRadius:9,padding:11,marginBottom:13}}>
                  {[["You own",`${max} tokens`],["Fixed price",`$${prop?.price.toFixed(2)}`],["Yield",`${prop?.yield}% APY`]].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}><span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:700}}>{v}</span></div>
                  ))}
                </div>
                <Field label="Tokens to List" type="number" val={amt} set={setAmt} ph={`e.g. 500 (max ${max})`} note={`Total listing value: $${total}`}/>
                {amt&&Number(amt)>0&&<div style={{background:C.bg1,borderRadius:9,padding:12,marginBottom:13,fontSize:12}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:C.muted}}>Listing value</span><span style={{color:C.white,fontWeight:800}}>${total}</span></div>
                  <div style={{fontSize:10,color:C.muted,marginTop:3}}>Platform fee: 0.5% · Buyer pays exact amount</div>
                </div>}
                <Btn ch="LIST ON MARKETPLACE →" full v="p" sz="lg" ld={ld} dis={!amt||Number(amt)<=0||Number(amt)>max} onClick={doList}/>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
function App2({user,setUser,onLogout}) {
  const [page,setPage]=useState("home");
  const [showKYC,setShowKYC]=useState(false);
  const [toast,setToast]=useState(null);
  const [infoModal,setInfoModal]=useState(false);

  const notify=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};
  const kycC={not_started:C.muted,pending:C.gold,approved:C.green,rejected:C.red};

  if(showKYC)return<KYC user={user} onDone={st=>{const u={...user,kycStatus:st};setUser(u);USERS[user.email]=u;setShowKYC(false);notify("KYC submitted!");}} onSkip={()=>setShowKYC(false)}/>;

  const NAV=[{id:"home",ic:"◈",lb:"Home"},{id:"ico",ic:"🚀",lb:"Buy BRX"},{id:"market",ic:"🏪",lb:"Market"},{id:"portfolio",ic:"◎",lb:"Portfolio"},{id:"account",ic:"⊙",lb:"Account"}];

  return(
    <div style={{minHeight:"100vh",background:C.bg0}}>
      <GS/>
      {infoModal&&<InfoModal onClose={()=>setInfoModal(false)}/>}
      {toast&&<div className="toast" style={{background:toast.type==="success"?"rgba(16,185,129,.15)":"rgba(239,68,68,.15)",border:`1px solid ${toast.type==="success"?C.green:C.red}`,color:toast.type==="success"?C.green:C.red}}>{toast.type==="success"?"✓ ":"⚠ "}{toast.msg}</div>}

      <header className="tnav">
        <div style={{fontSize:17,fontWeight:900,color:C.white,fontFamily:serif,letterSpacing:2}}>BRICK<span style={{color:C.blueL}}>X</span></div>
        <nav className="dtabs">
          {NAV.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{padding:"6px 12px",borderRadius:8,border:"none",fontSize:11,fontWeight:page===n.id?700:400,cursor:"pointer",background:page===n.id?"rgba(26,86,219,.2)":"transparent",color:page===n.id?C.blueL:C.muted,transition:"all .2s",fontFamily:mono}}>{n.ic} {n.lb}</button>)}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div onClick={()=>user.kycStatus!=="approved"&&setShowKYC(true)} style={{cursor:user.kycStatus!=="approved"?"pointer":"default"}}>
            <Bdg ch={user.kycStatus==="approved"?"✓ KYC":user.kycStatus==="pending"?"⏳ KYC":"! KYC"} c={kycC[user.kycStatus]}/>
          </div>
        </div>
      </header>

      {user.kycStatus==="not_started"&&(
        <div style={{background:"rgba(245,158,11,.07)",borderBottom:"1px solid rgba(245,158,11,.18)",padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <div style={{fontSize:12,color:C.gold}}>⚠ Complete KYC to invest</div>
          <Btn ch="Verify →" v="bgold" sz="sm" onClick={()=>setShowKYC(true)}/>
        </div>
      )}
      <div style={{background:"rgba(20,184,166,.05)",borderBottom:"1px solid rgba(20,184,166,.1)",padding:"7px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{fontSize:11,color:C.teal}}>🔒 Fixed Price Model — Returns from yield only</div>
        <Btn ch="?" v="bteal" sz="sm" onClick={()=>setInfoModal(true)}/>
      </div>

      <div className="wrap main">
        {page==="home"&&<Home user={user} onNav={setPage} onKYC={()=>setShowKYC(true)}/>}
        {page==="ico"&&<ICOPage user={user} setUser={setUser} notify={notify} onKYC={()=>setShowKYC(true)}/>}
        {page==="market"&&<Market user={user} setUser={setUser} notify={notify} onKYC={()=>setShowKYC(true)}/>}
        {page==="portfolio"&&<Portfolio user={user} setUser={setUser} notify={notify}/>}
        {page==="account"&&<Account user={user} setUser={setUser} onKYC={()=>setShowKYC(true)} notify={notify} onLogout={onLogout}/>}
      </div>

      <nav className="bnav">
        {NAV.map(n=><button key={n.id} className={page===n.id?"on":""} onClick={()=>setPage(n.id)}><span className="ic">{n.ic}</span>{n.lb}</button>)}
      </nav>
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────
function Home({user,onNav,onKYC}) {
  const hotel=PROPS[0];
  const pct=(ICO.sold/ICO.total)*100;
  const bricks=user.bricks||{};
  const propVal=Object.entries(bricks).reduce((s,[id,t])=>{const p=PROPS.find(x=>x.id===id);return s+(p?t*p.price:0);},0);
  const moYield=Object.entries(bricks).reduce((s,[id,t])=>{const p=PROPS.find(x=>x.id===id);return s+(p?t*p.yieldPT:0);},0);

  return(
    <div className="fu">
      <div style={{marginBottom:16,paddingTop:4}}>
        <div style={{fontSize:10,color:C.blueL,letterSpacing:3,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><Dot c={C.blueL} s={5}/>Hi {user.firstName}</div>
        <div style={{fontSize:25,fontWeight:900,color:C.white,fontFamily:serif,lineHeight:1.15,marginBottom:7}}>Earn from Real Estate.<br/><span style={{color:C.teal}}>Fixed Price.</span><br/><span style={{color:C.blueL}}>Monthly Yield.</span></div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:13}}>Buy property tokens at fixed prices. Earn monthly rental/hotel income. Sell anytime at the same price.</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn ch="🏪 Browse Properties" v="p" sz="md" onClick={()=>onNav("market")}/>
          {user.kycStatus==="not_started"&&<Btn ch="⚠ Complete KYC" v="bgold" sz="md" onClick={onKYC}/>}
        </div>
      </div>

      <div className="g4" style={{marginBottom:12}}>
        {[{lb:"BRX",val:user.brx>0?fN(user.brx):"0",unit:"BRX",c:C.blue},{lb:"USDC",val:`$${fN(user.usdc||50000)}`,unit:"Balance",c:C.green},{lb:"PROPERTIES",val:propVal>0?`$${fN(propVal)}`:"$0",unit:"Fixed value",c:C.teal},{lb:"MO. YIELD",val:moYield>0?`$${moYield.toFixed(2)}`:"$0",unit:"Est/month",c:C.gold}].map(k=>(
          <div key={k.lb} className="card" style={{position:"relative",overflow:"hidden",padding:12}}>
            <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:k.c,borderRadius:"14px 0 0 14px"}}/>
            <div style={{fontSize:9,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{k.lb}</div>
            <div style={{fontSize:17,fontWeight:800,color:C.white,fontFamily:serif,lineHeight:1}}>{k.val}</div>
            <div style={{fontSize:9,color:C.muted,marginTop:3}}>{k.unit}</div>
          </div>
        ))}
      </div>

      {/* Hotel Batam */}
      <div className="card glow" style={{marginBottom:12,borderColor:"rgba(245,158,11,.35)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:3}}>⭐ FLAGSHIP PROJECT</div>
            <div style={{fontSize:19,fontWeight:900,color:C.white,fontFamily:serif,lineHeight:1.1}}>🏨 The Horizon Hotel Batam</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>Nagoya Business District · 4-Star · 120 Rooms</div>
          </div>
          <Bdg ch="ICO Funding" c={C.gold}/>
        </div>
        <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",borderRadius:9,padding:11,marginBottom:11}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:5}}>ICO Fundraising Progress</div>
          <PBar pct={(hotel.sold/hotel.tokens)*10} h={8} c={C.gold}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginTop:4}}>
            <span style={{color:C.gold,fontWeight:700}}>{fU(ICO.raise)} raised</span><span>Target: $3.4M</span>
          </div>
        </div>
        <div className="g4" style={{marginBottom:11}}>
          {[{lb:"Token Price",val:"$10.00",c:C.teal},{lb:"Annual Yield",val:"12.5%",c:C.green},{lb:"Hotel Revenue",val:"70%",c:C.gold},{lb:"Completion",val:"Q4 2028",c:C.purple}].map(k=>(
            <div key={k.lb} style={{background:C.bg1,borderRadius:9,padding:9,textAlign:"center"}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{k.lb}</div>
              <div style={{fontSize:13,fontWeight:800,color:k.c}}>{k.val}</div>
            </div>
          ))}
        </div>
        <p style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:11}}>ICO-funded hotel. Token holders receive 70% of net revenue monthly. Token price locked at $10 forever.</p>
        <div style={{display:"flex",gap:8}}>
          <Btn ch="🏨 Invest in Hotel →" v="bgold" sz="md" onClick={()=>onNav("market")} st={{flex:1}}/>
          <Btn ch="Buy BRX" v="p" sz="md" onClick={()=>onNav("ico")} st={{flex:1}}/>
        </div>
      </div>

      {/* ICO */}
      <div className="card glow" style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
          <div><Lbl ch="BRX ICO ROUND 1" mb={3}/><div style={{fontSize:21,fontWeight:800,color:C.white,fontFamily:serif}}>$0.015 / BRX</div></div>
          <Bdg ch={<><Dot c={C.green} s={5}/> LIVE</>} c={C.green}/>
        </div>
        <PBar pct={pct} h={8}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginTop:4,marginBottom:12}}>
          <span>{fN(ICO.sold)} sold</span><span style={{color:C.blueL,fontWeight:700}}>{pct.toFixed(1)}%</span><span>{fN(ICO.total-ICO.sold)} left</span>
        </div>
        <Btn ch="🚀 BUY BRX TOKENS →" full v="p" sz="lg" onClick={()=>onNav("ico")}/>
        <p style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:7}}>BRX funds hotel construction · Holders earn yield from operations</p>
      </div>

      {/* TVL Chart */}
      <div className="card" style={{marginBottom:12}}>
        <Lbl ch="TVL PROJECTION 2026 ($M)"/>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={TVL} margin={{top:4,right:4,left:-24,bottom:0}}>
            <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={.3}/><stop offset="95%" stopColor={C.blue} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
            <XAxis dataKey="m" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:C.bg2,border:`1px solid ${C.blue}`,borderRadius:8,fontSize:11,color:C.white}}/>
            <Area type="monotone" dataKey="v" stroke={C.blueL} strokeWidth={2} fill="url(#g1)" name="TVL $M"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tokenomics */}
      <div className="card">
        <Lbl ch="BRX TOKENOMICS — 1B SUPPLY"/>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart><Pie data={TKNS} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={2} dataKey="v">{TKNS.map((e,i)=><Cell key={i} fill={e.c}/>)}</Pie></PieChart>
          </ResponsiveContainer>
          <div style={{flex:1}}>
            {TKNS.map(t=>(
              <div key={t.n} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:6,height:6,borderRadius:1,background:t.c,display:"inline-block"}}/>
                  <span style={{fontSize:10,color:C.muted}}>{t.n}</span>
                </div>
                <span style={{fontSize:10,fontWeight:700,color:t.c}}>{t.v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ICO PAGE ──────────────────────────────────────────────────
function ICOPage({user,setUser,notify,onKYC}) {
  const [amt,setAmt]=useState(100);
  const [step,setStep]=useState("form");
  const [ld,setLd]=useState(false);
  const brx=Math.floor(amt/0.015);
  const pct=(ICO.sold/ICO.total)*100;
  const can=user.kycStatus==="approved"||user.kycStatus==="pending";

  const doBuy=()=>{
    setLd(true);
    setTimeout(()=>{
      const tx={id:Date.now(),type:"BRX_PURCHASE",amount:brx,usd:amt,price:0.015,date:new Date().toISOString(),hash:"0x"+Math.random().toString(16).slice(2,18),status:"confirmed"};
      const u={...user,usdc:(user.usdc||50000)-amt,brx:(user.brx||0)+brx,txs:[tx,...(user.txs||[])]};
      setUser(u);USERS[user.email]=u;ICO.sold+=brx;ICO.raise+=amt;
      setLd(false);setStep("success");
    },1700);
  };

  if(step==="success")return(
    <div className="fu"><div className="card glow" style={{textAlign:"center",padding:30}}>
      <div style={{fontSize:52,marginBottom:10}}>🎉</div>
      <div style={{fontSize:21,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:7}}>Purchase Confirmed!</div>
      <p style={{fontSize:12,color:C.muted,marginBottom:18,lineHeight:1.7}}>{brx.toLocaleString()} BRX for ${amt.toLocaleString()} USDC</p>
      {[["BRX Received",`${brx.toLocaleString()}`],["Cost",`$${amt.toLocaleString()}`],["ICO Price","$0.015"],["DEX Est.","$0.030 (+100%)"],["Lock","3 months"],["Network","Polygon"]].map(([k,v])=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
          <span style={{color:C.muted}}>{k}</span><span style={{color:k.includes("DEX")?C.green:C.white,fontWeight:600}}>{v}</span>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:18}}>
        <Btn ch="Buy More" full v="o" onClick={()=>setStep("form")}/>
        <Btn ch="Done ✓" full v="p" onClick={()=>setStep("form")}/>
      </div>
    </div></div>
  );

  return(
    <div className="fu">
      <div style={{marginBottom:13,paddingTop:4}}>
        <div style={{fontSize:10,color:C.green,letterSpacing:3,marginBottom:5,display:"flex",gap:5,alignItems:"center"}}><Dot c={C.green} s={5}/>ICO ROUND 1 — LIVE</div>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif}}>Buy BRX Token</div>
        <div style={{fontSize:11,color:C.muted,marginTop:2}}>BRX funds Hotel Batam · Holders earn 70% of hotel revenue</div>
      </div>

      <div className="hscroll" style={{marginBottom:13}}>
        {[{n:"Seed",p:.008,s:"closed",pc:100},{n:"Round 1",p:.015,s:"live",pc:pct},{n:"Round 2",p:.022,s:"upcoming",pc:0},{n:"DEX",p:.030,s:"upcoming",pc:0}].map((r,i)=>(
          <div key={i} style={{flexShrink:0,width:128,background:C.bg2,border:`1px solid ${r.s==="live"?C.borderH:C.border}`,borderRadius:13,padding:13}}>
            {r.s==="live"&&<div style={{marginBottom:5}}><Bdg ch={<><Dot c={C.green} s={4}/>LIVE</>} c={C.green}/></div>}
            <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{r.n}</div>
            <div style={{fontSize:17,fontWeight:800,fontFamily:serif,color:r.s==="live"?C.blueL:C.white}}>${r.p.toFixed(3)}</div>
            {r.pc>0&&<div style={{marginTop:7}}><PBar pct={r.pc} h={4} c={r.s==="closed"?C.green:C.blue}/></div>}
            <div style={{marginTop:5}}><Bdg ch={r.s} c={r.s==="live"?C.green:r.s==="closed"?C.muted:C.dim}/></div>
          </div>
        ))}
      </div>

      <div className="card glow" style={{marginBottom:13}}>
        {!can&&<div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:11,marginBottom:13,fontSize:12,color:C.gold}}>⚠ KYC required — <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={onKYC}>Verify now →</span></div>}
        {step==="form"&&<>
          <Lbl ch="INVESTMENT AMOUNT (USDC)"/>
          <input type="range" min={10} max={50000} value={amt} step={10} onChange={e=>setAmt(Number(e.target.value))} style={{marginBottom:9}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:13}}>
            <span style={{color:C.white,fontWeight:800}}>${amt.toLocaleString()}</span>
            <span style={{color:C.blueL}}>{brx.toLocaleString()} BRX</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:13}}>
            {[100,500,1000,5000].map(n=><Btn key={n} ch={`$${n>=1000?n/1000+"K":n}`} v={amt===n?"p":"g"} sz="sm" onClick={()=>setAmt(n)}/>)}
          </div>
          <div style={{background:C.bg1,borderRadius:11,padding:13,marginBottom:13}}>
            {[["Price","$0.015 / BRX"],["You pay",`$${amt.toLocaleString()}`],["You receive",`${brx.toLocaleString()} BRX`],["DEX est.","$0.030 (+100%)"],["Lock","3 months"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
                <span style={{color:C.muted}}>{k}</span><span style={{color:k.includes("DEX")?C.green:C.white,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <Btn ch={can?`BUY ${brx.toLocaleString()} BRX →`:"🔒 COMPLETE KYC FIRST"} full v="p" sz="lg" onClick={()=>can?setStep("confirm"):onKYC()}/>
        </>}
        {step==="confirm"&&<>
          <div style={{fontSize:15,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:13}}>Confirm Purchase</div>
          <div style={{background:C.bg1,borderRadius:11,padding:13,marginBottom:13}}>
            {[["Tokens",`${brx.toLocaleString()} BRX`],["Cost",`$${amt.toLocaleString()} USDC`],["Price","$0.015"],["Network","Polygon"],["Gas","~$0.01"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:13}}>
                <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn ch="Cancel" v="o" onClick={()=>setStep("form")}/>
            <Btn ch="CONFIRM →" full v="s" sz="lg" ld={ld} onClick={doBuy}/>
          </div>
        </>}
      </div>

      <div className="card">
        <Lbl ch="ROUND 1 STATS"/>
        <div style={{fontSize:26,fontWeight:800,color:C.white,fontFamily:serif}}>${(ICO.raise/1000).toFixed(0)}K</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:9}}>raised of $1,500,000 target</div>
        <PBar pct={(ICO.sold/ICO.total)*100} h={8}/>
        <div className="g2" style={{marginTop:11,gap:8}}>
          {[["Accepted","USDC, USDT"],["Min Buy","$10"],["Audit","CertiK (sched.)"],["1 BRX","= 1 Vote"]].map(([k,v])=>(
            <div key={k} style={{background:C.bg1,borderRadius:8,padding:9}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{k}</div>
              <div style={{fontSize:11,fontWeight:700,color:C.white}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MARKET PAGE ───────────────────────────────────────────────
function Market({user,setUser,notify,onKYC}) {
  const [tab,setTab]=useState("invest");
  const [selProp,setSelProp]=useState(null);
  const [buyModal,setBuyModal]=useState(null);
  const [sellModal,setSellModal]=useState(false);
  const [filter,setFilter]=useState("All");

  if(selProp)return<PropDetail prop={selProp} user={user} setUser={setUser} notify={notify} onKYC={onKYC} onBack={()=>setSelProp(null)} onSwap={l=>setBuyModal(l)}/>;

  const types=["All","Hotel","Residential","Commercial","Hospitality"];
  const filtered=filter==="All"?PROPS:PROPS.filter(p=>p.type===filter);

  return(
    <div className="fu">
      {buyModal&&<BuyModal listing={buyModal} user={user} setUser={setUser} notify={notify} onClose={()=>setBuyModal(null)}/>}
      {sellModal&&<SellModal user={user} setUser={setUser} notify={notify} onClose={()=>setSellModal(false)}/>}
      <div style={{marginBottom:14,paddingTop:4,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif,marginBottom:3}}>🏪 Property Market</div>
          <div style={{fontSize:11,color:C.muted}}>Fixed prices · Monthly yield · Swap anytime</div>
        </div>
        <Btn ch="📢 Sell" v="bgold" sz="sm" onClick={()=>setSellModal(true)}/>
      </div>
      <div style={{background:"rgba(20,184,166,.06)",border:"1px solid rgba(20,184,166,.15)",borderRadius:10,padding:"9px 13px",marginBottom:13,fontSize:11,color:C.teal}}>🔒 Token prices permanently fixed · Returns from property/hotel yield only · Sell at same price</div>
      <div className="tabs">
        {[{k:"invest",l:"INVEST"},{k:"listings",l:"MARKETPLACE"},{k:"all",l:"ALL PROJECTS"}].map(t=>(
          <button key={t.k} className="tbtn" style={{background:tab===t.k?"rgba(26,86,219,.2)":"rgba(255,255,255,.03)",color:tab===t.k?C.blueL:C.muted}} onClick={()=>setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      {tab==="invest"&&(
        <div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
            {types.map(t=><button key={t} onClick={()=>setFilter(t)} style={{padding:"5px 13px",borderRadius:100,border:`1px solid ${filter===t?C.blue:C.border}`,background:filter===t?"rgba(26,86,219,.15)":"transparent",color:filter===t?C.blueL:C.muted,fontSize:11,fontFamily:mono,cursor:"pointer"}}>{t}</button>)}
          </div>
          <div className="g2" style={{gap:13}}>
            {filtered.map(p=>{
              const pc=(p.sold/p.tokens)*100;
              return(
                <div key={p.id} className="prop-card" onClick={()=>setSelProp(p)}>
                  <div style={{background:"rgba(26,86,219,.06)",height:95,display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,position:"relative"}}>
                    {p.emoji}
                    <div style={{position:"absolute",top:9,right:9}}><Bdg ch={p.status} c={p.status==="Live"?C.green:p.status==="ICO Funding"?C.gold:C.purple}/></div>
                    {LISTINGS.filter(l=>l.pid===p.id).length>0&&<div style={{position:"absolute",bottom:9,left:9}}><span style={{background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.3)",color:C.green,borderRadius:100,padding:"2px 8px",fontSize:9,fontWeight:700}}>{LISTINGS.filter(l=>l.pid===p.id).length} for sale</span></div>}
                  </div>
                  <div style={{padding:13}}>
                    <div style={{fontSize:13,fontWeight:800,color:C.white,marginBottom:2}}>{p.name}</div>
                    <div style={{fontSize:10,color:C.muted,marginBottom:9}}>📍 {p.loc}</div>
                    <div className="g2" style={{gap:7,marginBottom:9}}>
                      <div style={{background:C.bg1,borderRadius:8,padding:7,textAlign:"center"}}><div style={{fontSize:9,color:C.muted,marginBottom:1}}>FIXED PRICE</div><div style={{fontSize:13,fontWeight:800,color:C.teal}}>${p.price.toFixed(2)}</div></div>
                      <div style={{background:C.bg1,borderRadius:8,padding:7,textAlign:"center"}}><div style={{fontSize:9,color:C.muted,marginBottom:1}}>YIELD</div><div style={{fontSize:13,fontWeight:800,color:C.green}}>{p.yield}%</div></div>
                    </div>
                    <PBar pct={pc} h={5}/>
                    <div style={{fontSize:9,color:C.muted,marginTop:3}}>{pc.toFixed(0)}% of 1M tokens sold</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab==="listings"&&(
        <div>
          <div style={{fontSize:12,color:C.muted,marginBottom:11}}>{LISTINGS.length} listings — all at fixed token prices</div>
          {LISTINGS.length===0?<div className="card" style={{textAlign:"center",padding:36}}><div style={{fontSize:36,marginBottom:8}}>🏪</div><div style={{fontSize:13,color:C.muted}}>No listings right now</div><Btn ch="List My Tokens" v="p" sz="md" st={{marginTop:14}} onClick={()=>setSellModal(true)}/></div>:(
            <div style={{display:"flex",flexDirection:"column",gap:11}}>
              {LISTINGS.map(l=>{
                const mo=(l.tokens*l.price*l.yield/100/12).toFixed(2);
                return(
                  <div key={l.id} className="card" style={{padding:15}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:11}}>
                      <div style={{display:"flex",gap:9,alignItems:"center"}}>
                        <span style={{fontSize:26}}>{l.emoji}</span>
                        <div><div style={{fontSize:13,fontWeight:700,color:C.white}}>{l.name}</div><div style={{fontSize:10,color:C.muted}}>{l.seller} · {l.ago}</div></div>
                      </div>
                      <span style={{background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.3)",color:C.green,borderRadius:100,padding:"2px 9px",fontSize:9,fontWeight:700}}>FOR SALE</span>
                    </div>
                    <div className="g4" style={{marginBottom:11}}>
                      {[["TOKENS",`${l.tokens.toLocaleString()}`],["FIXED PRICE",`$${l.price.toFixed(2)}`],["TOTAL",`$${l.total.toLocaleString()}`],["MO. YIELD",`$${mo}`]].map(([k,v])=>(
                        <div key={k} style={{background:C.bg1,borderRadius:8,padding:8,textAlign:"center"}}>
                          <div style={{fontSize:8,color:C.muted,marginBottom:1}}>{k}</div>
                          <div style={{fontSize:12,fontWeight:800,color:k.includes("YIELD")?C.green:C.white}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:11,color:C.muted}}>{l.yield}% APY · Fixed price · Yield included</div>
                      <Btn ch="BUY →" v="s" sz="sm" onClick={()=>setBuyModal(l)}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{marginTop:18}}><Btn ch="📢 List Your Tokens" full v="p" sz="lg" onClick={()=>setSellModal(true)}/><p style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:7}}>0.5% fee · Instant settlement · Buyer gets yield rights</p></div>
        </div>
      )}

      {tab==="all"&&(
        <div>
          {PROPS.map(p=>(
            <div key={p.id} className="card" style={{marginBottom:11,cursor:"pointer",padding:15}} onClick={()=>setSelProp(p)}>
              <div style={{display:"flex",gap:11,alignItems:"center",marginBottom:9}}>
                <span style={{fontSize:30}}>{p.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.white}}>{p.name}</div>
                    <Bdg ch={p.status} c={p.status==="Live"?C.green:p.status==="ICO Funding"?C.gold:C.purple}/>
                  </div>
                  <div style={{fontSize:10,color:C.muted}}>{p.loc} · {p.type}</div>
                </div>
              </div>
              <div className="g4">
                {[{lb:"Fixed Price",val:`$${p.price.toFixed(2)}`,c:C.teal},{lb:"Yield/yr",val:`${p.yield}%`,c:C.green},{lb:"Total Value",val:fU(p.value),c:C.white},{lb:"Holders",val:p.holders.toLocaleString(),c:C.muted}].map(k=>(
                  <div key={k.lb} style={{textAlign:"center"}}><div style={{fontSize:9,color:C.muted,marginBottom:1}}>{k.lb}</div><div style={{fontSize:12,fontWeight:700,color:k.c}}>{k.val}</div></div>
                ))}
              </div>
              <div style={{marginTop:9}}><PBar pct={(p.sold/p.tokens)*100} h={4}/></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PROPERTY DETAIL ───────────────────────────────────────────
function PropDetail({prop,user,setUser,notify,onKYC,onBack,onSwap}) {
  const [amt,setAmt]=useState(prop.price*10);
  const [ld,setLd]=useState(false);
  const tokens=Math.floor(amt/prop.price);
  const mo=(tokens*prop.yieldPT).toFixed(2);
  const yr=(tokens*prop.price*prop.yield/100).toFixed(2);
  const can=user.kycStatus==="approved"||user.kycStatus==="pending";

  const doBuy=()=>{
    if(!can){onKYC();return;}
    if(amt>user.usdc){notify("Insufficient balance","error");return;}
    setLd(true);
    setTimeout(()=>{
      const tx={id:Date.now(),type:"BRICK_PURCHASE",prop:prop.name,tokens,usd:amt,price:prop.price,date:new Date().toISOString(),hash:"0x"+Math.random().toString(16).slice(2,18),status:"confirmed"};
      const bricks={...(user.bricks||{})};bricks[prop.id]=(bricks[prop.id]||0)+tokens;
      const u={...user,usdc:user.usdc-amt,bricks,txs:[tx,...(user.txs||[])]};
      setUser(u);USERS[user.email]=u;setLd(false);
      notify(`Bought ${tokens.toLocaleString()} BRICK tokens!`);
    },1700);
  };

  const listings=LISTINGS.filter(l=>l.pid===prop.id);

  return(
    <div className="fu">
      <Btn ch="← Back" v="g" sz="sm" onClick={onBack} st={{marginBottom:14}}/>
      <div style={{background:"rgba(26,86,219,.06)",borderRadius:14,height:120,display:"flex",alignItems:"center",justifyContent:"center",fontSize:58,marginBottom:14,position:"relative"}}>
        {prop.emoji}
        <div style={{position:"absolute",top:11,right:11}}><Bdg ch={prop.status} c={prop.status==="Live"?C.green:prop.status==="ICO Funding"?C.gold:C.purple}/></div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif,marginBottom:3}}>{prop.name}</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:7}}>📍 {prop.loc}</div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.7}}>{prop.desc}</p>
      </div>

      <div className="g2" style={{marginBottom:13}}>
        <div style={{background:"rgba(20,184,166,.08)",border:"1px solid rgba(20,184,166,.2)",borderRadius:11,padding:13,textAlign:"center"}}>
          <div style={{fontSize:9,color:C.teal,letterSpacing:1,marginBottom:3}}>🔒 FIXED TOKEN PRICE</div>
          <div style={{fontSize:24,fontWeight:900,color:C.white,fontFamily:serif}}>${prop.price.toFixed(2)}</div>
          <div style={{fontSize:9,color:C.muted}}>Permanent · Never changes</div>
        </div>
        <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:11,padding:13,textAlign:"center"}}>
          <div style={{fontSize:9,color:C.green,letterSpacing:1,marginBottom:3}}>💰 ANNUAL YIELD</div>
          <div style={{fontSize:24,fontWeight:900,color:C.green,fontFamily:serif}}>{prop.yield}%</div>
          <div style={{fontSize:9,color:C.muted}}>Monthly distribution</div>
        </div>
      </div>

      <div className="card" style={{marginBottom:13}}>
        <Lbl ch="PROPERTY STATS"/>
        <div className="g4" style={{gap:8}}>
          {[{lb:"Total Value",val:fU(prop.value)},{lb:"Monthly Rent",val:fU(prop.monthlyRent)},{lb:"Holders",val:prop.holders.toString()},{lb:"Tokens Sold",val:fN(prop.sold)}].map(k=>(
            <div key={k.lb} style={{background:C.bg1,borderRadius:8,padding:9,textAlign:"center"}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:1}}>{k.lb}</div>
              <div style={{fontSize:12,fontWeight:800,color:C.white}}>{k.val}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:11}}><PBar pct={(prop.sold/prop.tokens)*100} h={7}/><div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.muted,marginTop:3}}><span>{fN(prop.sold)} sold</span><span>{((prop.sold/prop.tokens)*100).toFixed(1)}%</span><span>{fN(prop.tokens-prop.sold)} left</span></div></div>
      </div>

      {prop.highlights?.length>0&&(
        <div className="card" style={{marginBottom:13}}>
          <Lbl ch="HIGHLIGHTS"/>
          {prop.highlights.map((h,i)=><div key={i} style={{display:"flex",gap:7,marginBottom:7,fontSize:12}}><span style={{color:C.green}}>✓</span><span style={{color:C.off}}>{h}</span></div>)}
        </div>
      )}

      {prop.phases?.length>0&&(
        <div className="card" style={{marginBottom:13}}>
          <Lbl ch="PROJECT PHASES"/>
          {prop.phases.map((ph,i)=>(
            <div key={i} style={{display:"flex",gap:9,marginBottom:11,alignItems:"center"}}>
              <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,background:ph.done?C.green:ph.active?"rgba(26,86,219,.3)":"rgba(255,255,255,.05)",border:`1px solid ${ph.done?C.green:ph.active?C.blue:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9}}>
                {ph.done?"✓":ph.active?<Dot c={C.blue} s={5}/>:i+1}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:ph.done?C.white:ph.active?C.blueL:C.muted,fontWeight:ph.active?700:400}}>{ph.n}{ph.active&&" (Active)"}</span>
                </div>
                {ph.active&&ph.pct!==undefined&&<div style={{marginTop:3}}><PBar pct={ph.pct} h={4} c={C.gold}/></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {prop.history?.length>0&&(
        <div className="card" style={{marginBottom:13}}>
          <Lbl ch="YIELD HISTORY ($ per token/month)"/>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={prop.history} margin={{top:4,right:4,left:-24,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)"/>
              <XAxis dataKey="m" tick={{fill:C.muted,fontSize:8}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:8}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:C.bg2,border:`1px solid ${C.blue}`,borderRadius:8,fontSize:11,color:C.white}} formatter={v=>[`$${v}`,""]}/>
              <Bar dataKey="v" fill={C.green} radius={[4,4,0,0]} name="$/token"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {listings.length>0&&(
        <div className="card" style={{marginBottom:13}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}><Lbl ch="MARKETPLACE LISTINGS" mb={0}/><span style={{fontSize:10,color:C.muted}}>{listings.length} available</span></div>
          {listings.map(l=>(
            <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
              <div><div style={{fontSize:12,color:C.white,fontWeight:700}}>{l.tokens.toLocaleString()} tokens</div><div style={{fontSize:10,color:C.muted}}>@ ${l.price.toFixed(2)} · ${l.total.toLocaleString()} total</div></div>
              <Btn ch="Buy →" v="s" sz="sm" onClick={()=>onSwap(l)}/>
            </div>
          ))}
        </div>
      )}

      <div className="card glow" style={{marginBottom:13}}>
        <Lbl ch="INVESTMENT CALCULATOR"/>
        <input type="range" min={prop.price} max={50000} value={amt} step={prop.price} onChange={e=>setAmt(Number(e.target.value))} style={{marginBottom:9}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:13}}>
          <span style={{color:C.white,fontWeight:800}}>${amt.toLocaleString()}</span>
          <span style={{color:C.teal}}>{tokens.toLocaleString()} BRICK</span>
        </div>
        <div className="g2" style={{marginBottom:13,gap:8}}>
          {[{lb:"Monthly Yield",val:`$${mo}`,c:C.green},{lb:"Annual Yield",val:`$${yr}`,c:C.blueL},{lb:"Token Price",val:`$${prop.price.toFixed(2)}`,c:C.teal},{lb:"Resale Value",val:`$${amt.toLocaleString()}`,c:C.muted}].map(k=>(
            <div key={k.lb} style={{background:C.bg1,borderRadius:8,padding:9,textAlign:"center"}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{k.lb}</div>
              <div style={{fontSize:13,fontWeight:800,color:k.c}}>{k.val}</div>
            </div>
          ))}
        </div>
        <Btn ch={can?`BUY ${tokens.toLocaleString()} BRICK — $${amt.toLocaleString()}`:"🔒 COMPLETE KYC TO BUY"} full v="s" sz="lg" ld={ld} onClick={doBuy}/>
        <p style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:7}}>Price always ${prop.price.toFixed(2)} · Sell anytime at same price</p>
      </div>
    </div>
  );
}

// ── PORTFOLIO PAGE ────────────────────────────────────────────
function Portfolio({user,setUser,notify}) {
  const [sellModal,setSellModal]=useState(false);
  const txs=user.txs||[];
  const bricks=user.bricks||{};
  const propVal=Object.entries(bricks).reduce((s,[id,t])=>{const p=PROPS.find(x=>x.id===id);return s+(p?t*p.price:0);},0);
  const moYield=Object.entries(bricks).reduce((s,[id,t])=>{const p=PROPS.find(x=>x.id===id);return s+(p?t*p.yieldPT:0);},0);

  return(
    <div className="fu">
      {sellModal&&<SellModal user={user} setUser={setUser} notify={notify} onClose={()=>setSellModal(false)}/>}
      <div style={{marginBottom:14,paddingTop:4,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div><div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif}}>Portfolio</div><div style={{fontSize:11,color:C.muted}}>{user.email}</div></div>
        <Btn ch="📢 Sell" v="bgold" sz="sm" onClick={()=>setSellModal(true)}/>
      </div>

      <div className="g4" style={{marginBottom:12}}>
        {[{lb:"BRX",val:`${fN(user.brx||0)} BRX`,c:C.blue},{lb:"USDC",val:`$${fN(user.usdc||50000)}`,c:C.green},{lb:"PROPERTIES",val:propVal>0?`$${fN(propVal)}`:"$0",c:C.teal},{lb:"MO. YIELD",val:moYield>0?`$${moYield.toFixed(2)}`:"$0",c:C.gold}].map(k=>(
          <div key={k.lb} className="card" style={{position:"relative",overflow:"hidden",padding:12}}>
            <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:k.c,borderRadius:"14px 0 0 14px"}}/>
            <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{k.lb}</div>
            <div style={{fontSize:16,fontWeight:800,color:C.white,fontFamily:serif}}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <Lbl ch="BRICK HOLDINGS"/>
        {Object.keys(bricks).length===0?<div style={{textAlign:"center",padding:"26px 0"}}><div style={{fontSize:36,marginBottom:7}}>🏠</div><div style={{fontSize:12,color:C.muted}}>No tokens yet. Browse marketplace.</div></div>:(
          <div>
            {Object.entries(bricks).filter(([,t])=>t>0).map(([id,tokens])=>{
              const p=PROPS.find(x=>x.id===id);if(!p)return null;
              const val=(tokens*p.price).toFixed(2);const mo=(tokens*p.yieldPT).toFixed(2);
              return(
                <div key={id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
                  <div style={{display:"flex",gap:9,alignItems:"center"}}>
                    <span style={{fontSize:22}}>{p.emoji}</span>
                    <div><div style={{fontSize:12,fontWeight:700,color:C.white}}>{p.name}</div><div style={{fontSize:10,color:C.muted}}>{tokens.toLocaleString()} tokens · ${p.price.toFixed(2)} each</div></div>
                  </div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:13,color:C.teal,fontWeight:700}}>${val}</div><div style={{fontSize:10,color:C.green}}>+${mo}/mo</div></div>
                </div>
              );
            })}
            <div style={{marginTop:13,padding:11,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:9}}>
              <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Total Monthly Yield</div>
              <div style={{fontSize:20,fontWeight:800,color:C.green,fontFamily:serif}}>${moYield.toFixed(2)}</div>
              <div style={{fontSize:10,color:C.muted}}>Distributed monthly in USDC · Auto-credited</div>
            </div>
            <Btn ch="📢 List on Marketplace" full v="bgold" sz="md" st={{marginTop:11}} onClick={()=>setSellModal(true)}/>
          </div>
        )}
      </div>

      {(user.brx||0)>0&&(
        <div className="card" style={{marginBottom:12}}>
          <Lbl ch="BRX HOLDINGS"/>
          <div style={{textAlign:"center",padding:"14px 0"}}>
            <div style={{fontSize:26,fontWeight:900,color:C.white,fontFamily:serif}}>{fN(user.brx)} BRX</div>
            <div style={{fontSize:11,color:C.muted,marginTop:3}}>ICO: ${(user.brx*0.015).toFixed(2)} · DEX est: ${(user.brx*0.030).toFixed(2)}</div>
          </div>
          {[["Status","Locked (Pre-TGE)"],["Lock","3 months from TGE"],["Vesting","12 months linear"]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
              <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:600}}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <Lbl ch="TRANSACTIONS"/>
        {txs.length===0?<div style={{textAlign:"center",padding:"26px 0",color:C.muted}}><div style={{fontSize:32,marginBottom:7}}>📋</div>No transactions yet</div>:(
          <div className="sy" style={{maxHeight:300}}>
            {txs.map((tx,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
                <div>
                  <div style={{marginBottom:3}}><Bdg ch={tx.type.replace("_"," ")} c={tx.type==="BRX_PURCHASE"?C.blue:tx.type==="BRICK_PURCHASE"?C.teal:C.gold}/></div>
                  <div style={{fontSize:11,color:C.white,fontWeight:700}}>{(tx.amount||tx.tokens||0).toLocaleString()} {tx.type.includes("BRX")?"BRX":"BRICK"}</div>
                  <div style={{fontSize:9,color:C.dim}}>{new Date(tx.date).toLocaleString()}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,color:C.green,fontWeight:800}}>${tx.usd}</div>
                  <Bdg ch={tx.status} c={tx.status==="listed"?C.gold:C.green}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ACCOUNT PAGE ──────────────────────────────────────────────
function Account({user,setUser,onKYC,notify,onLogout}) {
  const kycC={not_started:C.muted,pending:C.gold,approved:C.green,rejected:C.red};
  return(
    <div className="fu">
      <div style={{marginBottom:14,paddingTop:4}}>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif}}>Account</div>
        <div style={{fontSize:11,color:C.muted}}>{user.email}</div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:"flex",gap:11,alignItems:"center",marginBottom:13}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:"rgba(26,86,219,.2)",border:`2px solid ${C.blue}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:C.blueL}}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div><div style={{fontSize:14,fontWeight:800,color:C.white}}>{user.firstName} {user.lastName}</div><div style={{fontSize:11,color:C.muted}}>{user.country}</div></div>
        </div>
        {[["Email",user.email],["Phone",user.phone||"—"],["Country",user.country],["Member Since",new Date(user.createdAt||Date.now()).toLocaleDateString()]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
            <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:600,textAlign:"right",maxWidth:"60%",wordBreak:"break-all"}}>{v}</span>
          </div>
        ))}
      </div>

      <div className="card glow" style={{marginBottom:12}}>
        <Lbl ch="KYC / AML VERIFICATION"/>
        <div style={{background:`${kycC[user.kycStatus]}10`,border:`1px solid ${kycC[user.kycStatus]}33`,borderRadius:11,padding:18,textAlign:"center",marginBottom:13}}>
          <div style={{fontSize:34,marginBottom:5}}>{user.kycStatus==="not_started"?"⭕":user.kycStatus==="pending"?"⏳":user.kycStatus==="approved"?"✅":"❌"}</div>
          <div style={{fontSize:14,fontWeight:800,color:kycC[user.kycStatus],marginBottom:3}}>
            {user.kycStatus==="not_started"?"Not Started":user.kycStatus==="pending"?"Under Review":user.kycStatus==="approved"?"Verified ✓":"Rejected"}
          </div>
          <div style={{fontSize:11,color:C.muted}}>{user.kycStatus==="not_started"?"Complete KYC to unlock token purchases.":user.kycStatus==="pending"?"Review takes 5–30 minutes.":user.kycStatus==="approved"?"You can buy tokens and invest.":"Please resubmit with clearer documents."}</div>
        </div>
        {[{l:"Account Created",done:true},{l:"Email Verified",done:true},{l:"ID Document",done:user.kycStatus!=="not_started"},{l:"Selfie Verified",done:user.kycStatus!=="not_started"},{l:"Address",done:user.kycStatus!=="not_started"},{l:"KYC Approved",done:user.kycStatus==="approved"}].map((item,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
            <div style={{width:19,height:19,borderRadius:"50%",flexShrink:0,background:item.done?`${C.green}20`:"rgba(255,255,255,.04)",border:`1px solid ${item.done?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:item.done?C.green:C.muted}}>{item.done?"✓":i+1}</div>
            <span style={{fontSize:12,color:item.done?C.white:C.muted}}>{item.l}</span>
          </div>
        ))}
        <div style={{marginTop:11}}>
          {user.kycStatus==="not_started"&&<Btn ch="START KYC →" full v="p" sz="lg" onClick={onKYC}/>}
          {user.kycStatus==="pending"&&<div style={{textAlign:"center"}}><Bdg ch="⏳ Under Review" c={C.gold}/><div style={{marginTop:9}}><Btn ch="[Demo] Approve KYC" v="g" sz="sm" onClick={()=>{const u={...user,kycStatus:"approved"};setUser(u);USERS[user.email]=u;notify("KYC Approved! ✓");}}/></div></div>}
          {user.kycStatus==="approved"&&<div style={{textAlign:"center"}}><Bdg ch="✅ FULLY VERIFIED" c={C.green}/></div>}
          {user.kycStatus==="rejected"&&<Btn ch="RESUBMIT KYC →" full v="r" sz="lg" onClick={onKYC}/>}
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <Lbl ch="HOW RETURNS WORK"/>
        {[["🔒","Fixed Price","Token prices never change — zero speculation"],["💰","Yield = Return","Monthly property/hotel income distributed to holders"],["🔄","Sell Anytime","List tokens at exact same price on marketplace"],["🏨","Hotel Batam","70% of hotel revenue → BRICK holders monthly"],].map(({0:ic,1:t,2:d})=>(
          <div key={t} style={{display:"flex",gap:11,padding:"9px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
            <span style={{fontSize:18,flexShrink:0}}>{ic}</span>
            <div><div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:2}}>{t}</div><div style={{fontSize:11,color:C.muted}}>{d}</div></div>
          </div>
        ))}
      </div>

      <Btn ch="Sign Out" full v="o" sz="lg" onClick={onLogout} st={{borderColor:C.red,color:C.red,marginBottom:20}}/>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────
function KYCPrompt({user,onKYC,onSkip}) {
  return(
    <div style={{minHeight:"100vh",background:C.bg0,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <GS/>
      <div style={{width:"100%",maxWidth:390}} className="fu">
        <div className="card glow" style={{textAlign:"center",padding:30}}>
          <div style={{fontSize:46,marginBottom:11}}>🎉</div>
          <div style={{fontSize:21,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:7}}>Welcome, {user.firstName}!</div>
          <p style={{fontSize:12,color:C.muted,marginBottom:20,lineHeight:1.7}}>Complete KYC to start investing in tokenized real estate and earn monthly yield.</p>
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            <Btn ch="🪪 Complete KYC (5 mins)" full v="p" sz="lg" onClick={onKYC}/>
            <Btn ch="Explore first" full v="g" onClick={onSkip}/>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [state,setState]=useState("auth");
  const [user,setUser]=useState(null);
  const handleAuth=u=>{setUser(u);setState(u.kycStatus==="not_started"?"kyc_prompt":"app");};
  const handleLogout=()=>{setUser(null);setState("auth");};
  const updateUser=useCallback(updater=>{
    setUser(p=>{const next=typeof updater==="function"?updater(p):updater;USERS[next.email]=next;return next;});
  },[]);
  return(
    <>
      <GS/>
      {state==="auth"&&<Auth onAuth={handleAuth}/>}
      {state==="kyc_prompt"&&user&&<KYCPrompt user={user} onKYC={()=>setState("kyc")} onSkip={()=>setState("app")}/>}
      {state==="kyc"&&user&&<KYC user={user} onDone={st=>{const u={...user,kycStatus:st};setUser(u);USERS[user.email]=u;setState("app");}} onSkip={()=>setState("app")}/>}
      {state==="app"&&user&&<App2 user={user} setUser={updateUser} onLogout={handleLogout}/>}
    </>
  );
}
