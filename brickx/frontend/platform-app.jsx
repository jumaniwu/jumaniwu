import { Component, useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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
      border-radius:14px;overflow:hidden;transition:all .3s}
    .prop-card:hover{border-color:${C.borderH}}
    .hscroll{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
    .hscroll::-webkit-scrollbar{display:none}
    .tabs{display:flex;gap:3px;overflow-x:auto;scrollbar-width:none;margin-bottom:14px}
    .tabs::-webkit-scrollbar{display:none}
    .tbtn{flex-shrink:0;padding:7px 13px;border-radius:8px;border:none;
      font-size:11px;font-weight:600;transition:all .2s;
      letter-spacing:.7px;font-family:${mono};white-space:nowrap}
  `}</style>
);

// ── API LAYER ─────────────────────────────────────────────────
const API_URL = (typeof window!=='undefined' && window.BRICKX_API_URL) || 'https://brickx-api.railway.app';
const TOKEN_KEY = 'brickx_token';
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };

async function api(path,{method='GET',body,auth=true}={}) {
  const headers = {'Content-Type':'application/json'};
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`,{method,headers,body:body?JSON.stringify(body):undefined});
  } catch {
    throw new Error('Network error — please check your connection and try again');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON response */ }
  if (!res.ok) throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
  return data;
}

// Generic loader hook: loading + error + retry on every call
function useLoad(loader, enabled=true) {
  const [st,setSt]=useState({data:null,ld:enabled,err:null});
  const [tick,setTick]=useState(0);
  useEffect(()=>{
    if(!enabled){setSt({data:null,ld:false,err:null});return;}
    let on=true;
    setSt(s=>({...s,ld:true,err:null}));
    loader().then(d=>{if(on)setSt({data:d,ld:false,err:null});})
      .catch(e=>{if(on)setSt({data:null,ld:false,err:e.message});});
    return()=>{on=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[tick,enabled]);
  return {...st,reload:()=>setTick(t=>t+1)};
}

// ── STATIC CONFIG (display only — live numbers come from the API) ──
const TKNS=[
  {n:"Ecosystem",v:35,c:"#1A56DB"},{n:"ICO Public",v:15,c:"#3B82F6"},
  {n:"Team",v:12,c:"#6366F1"},{n:"Partners",v:10,c:"#8B5CF6"},
  {n:"Seed",v:8,c:"#0EA5E9"},{n:"Marketing",v:8,c:"#F59E0B"},
  {n:"DEX Liq.",v:7,c:"#10B981"},{n:"DAO",v:5,c:"#64748B"},
];
const COUNTRIES=["Indonesia","Malaysia","Singapore","Philippines","Thailand","Vietnam","India","Australia","United States","Other"];
const CURRENCIES=["USDT/Polygon","USDC/Polygon","ETH","BNB"];
const ROUND_ORDER=["seed","round1","round2","dex"];
const ROUND_LABEL={seed:"Seed",round1:"Round 1",round2:"Round 2",dex:"DEX Listing"};
const ORDER_BADGE={pending_payment:{l:"PENDING PAYMENT",c:C.gold},confirmed:{l:"CONFIRMED",c:C.green},distributed:{l:"DISTRIBUTED",c:C.teal}};
const WALLET_RX=/^0x[a-fA-F0-9]{40}$/;
const DIVIDEND_LINE="Annual dividend · 70% of audited NOI · paid each June · Dec 31 snapshot";

const fN=n=>n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(0)}K`:String(n);
const fU=n=>`$${n>=1e6?(n/1e6).toFixed(2)+"M":n>=1000?(n/1000).toFixed(1)+"K":Number(n).toLocaleString()}`;
const roundPrice=(info,round)=>{
  if(!info)return null;
  return {seed:info.seedPrice,round1:info.round1Price,round2:info.round2Price,dex:info.dexTargetPrice}[round]??null;
};

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
    <div className="pf" style={{width:`${Math.min(pct||0,100)}%`,height:h,background:`linear-gradient(90deg,${c},${C.accent})`}}/>
  </div>
);
const Loading=({msg="Loading…"})=>(
  <div className="card" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:28}}>
    <Spin/><span style={{fontSize:12,color:C.muted}}>{msg}</span>
  </div>
);
const ErrBox=({msg,onRetry})=>(
  <div className="card" style={{textAlign:"center",padding:24,borderColor:"rgba(239,68,68,.3)"}}>
    <div style={{fontSize:26,marginBottom:7}}>⚠</div>
    <div style={{fontSize:12,color:C.red,marginBottom:12,lineHeight:1.6}}>{msg}</div>
    {onRetry&&<Btn ch="Retry ↻" v="o" sz="sm" onClick={onRetry}/>}
  </div>
);
const FormErr=({msg})=>msg?(
  <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.3)",borderRadius:9,padding:"10px 12px",marginBottom:13,fontSize:12,color:C.red}}>⚠ {msg}</div>
):null;

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

function CopyBtn({text,notify}) {
  const copy=async()=>{
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)await navigator.clipboard.writeText(text);
      else{
        const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);
        ta.select();document.execCommand("copy");document.body.removeChild(ta);
      }
      notify&&notify("Copied to clipboard");
    }catch{notify&&notify("Copy failed — copy manually","error");}
  };
  return <Btn ch="⧉ Copy" v="bteal" sz="sm" onClick={copy}/>;
}

// ── ERROR BOUNDARY ────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return{error};}
  componentDidCatch(error,info){ if(typeof console!=='undefined')console.error("BRICKX app error:",error,info); }
  render(){
    if(this.state.error)return(
      <div style={{minHeight:"100vh",background:C.bg0,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <GS/>
        <div className="card glow" style={{textAlign:"center",maxWidth:400,padding:30}}>
          <div style={{fontSize:40,marginBottom:10}}>⚠</div>
          <div style={{fontSize:17,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:8}}>Something went wrong</div>
          <p style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:16}}>{String(this.state.error?.message||this.state.error)}</p>
          <Btn ch="Reload App ↻" full v="p" sz="lg" onClick={()=>{this.setState({error:null});if(typeof window!=='undefined')window.location.reload();}}/>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ── AUTH ──────────────────────────────────────────────────────
function Auth({onAuth}) {
  const [mode,setMode]=useState("login");
  const [step,setStep]=useState(1);
  const [ld,setLd]=useState(false);
  const [errs,setErrs]=useState({});
  const [f,setF]=useState({email:"",pw:"",pw2:"",fn:"",ln:"",country:"Indonesia",ref:""});
  const s=(k,v)=>{setF(p=>({...p,[k]:v}));setErrs(p=>({...p,[k]:"",form:""}));};

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
    setErrs(e);return !Object.keys(e).length;
  };

  const doLogin=async()=>{
    if(!chk1())return;
    setLd(true);
    try{
      const d=await api('/api/auth/login',{method:'POST',body:{email:f.email,password:f.pw},auth:false});
      setToken(d.token);
      onAuth(d.user);
    }catch(e){setErrs({form:e.message});}
    setLd(false);
  };
  const doReg=async()=>{
    if(!chk2())return;
    setLd(true);
    try{
      const d=await api('/api/auth/register',{method:'POST',auth:false,body:{
        firstName:f.fn.trim(),lastName:f.ln.trim(),email:f.email,password:f.pw,
        country:f.country,referralCode:f.ref.trim()||undefined,
      }});
      setToken(d.token);
      onAuth(d.user);
    }catch(e){setErrs({form:e.message});}
    setLd(false);
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <GS/>
      <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100vw",height:"50vh",background:"radial-gradient(ellipse at top,rgba(26,86,219,.1) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{width:"100%",maxWidth:400}} className="fu">
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:34,fontWeight:900,color:C.white,fontFamily:serif,letterSpacing:3}}>BRICK<span style={{color:C.blueL}}>X</span></div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginTop:3}}>REAL ESTATE TOKENIZATION PROTOCOL</div>
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
          <FormErr msg={errs.form}/>
          {mode==="login"&&<>
            <Field label="Email" type="email" val={f.email} set={v=>s("email",v)} ph="you@email.com" icon="✉" err={errs.email} req/>
            <Field label="Password" type="password" val={f.pw} set={v=>s("pw",v)} ph="••••••••" icon="🔒" err={errs.pw} req/>
            <Btn ch="SIGN IN →" full v="p" sz="lg" ld={ld} onClick={doLogin} st={{marginTop:4}}/>
          </>}
          {mode==="register"&&step===1&&<>
            <div style={{fontSize:11,color:C.blueL,fontWeight:700,marginBottom:12}}>Step 1/2 — Credentials</div>
            <Field label="Email" type="email" val={f.email} set={v=>s("email",v)} ph="you@email.com" icon="✉" err={errs.email} req/>
            <Field label="Password" type="password" val={f.pw} set={v=>s("pw",v)} ph="Min 8 characters" icon="🔒" err={errs.pw} req/>
            <Field label="Confirm Password" type="password" val={f.pw2} set={v=>s("pw2",v)} ph="Repeat password" icon="🔒" err={errs.pw2} req/>
            <Field label="Referral Code (optional)" val={f.ref} set={v=>s("ref",v)} ph="BRX-XXXXX" icon="🎁"/>
            <Btn ch="NEXT →" full v="p" sz="lg" onClick={()=>chk1()&&setStep(2)}/>
          </>}
          {mode==="register"&&step===2&&<>
            <div style={{fontSize:11,color:C.blueL,fontWeight:700,marginBottom:12}}>Step 2/2 — Personal Info</div>
            <div className="g2">
              <Field label="First Name" val={f.fn} set={v=>s("fn",v)} ph="John" err={errs.fn} req/>
              <Field label="Last Name" val={f.ln} set={v=>s("ln",v)} ph="Doe" err={errs.ln} req/>
            </div>
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

// ── KYC (Sumsub-backed) ───────────────────────────────────────
const KYC_C={not_started:C.muted,pending:C.gold,approved:C.green,rejected:C.red};
const KYC_LBL={not_started:"Not Started",pending:"Under Review",approved:"Verified ✓",rejected:"Rejected"};

function KYCScreen({user,onStatus,onBack}) {
  const [ld,setLd]=useState(false);
  const [err,setErr]=useState(null);
  const [session,setSession]=useState(null);
  const status=user.kyc_status||"not_started";

  // Poll KYC status every 15s while this screen is mounted
  useEffect(()=>{
    const t=setInterval(async()=>{
      try{
        const d=await api('/api/kyc/status');
        if(d&&d.status&&d.status!==status)onStatus(d.status);
      }catch{/* keep polling */}
    },15000);
    return()=>clearInterval(t);
  },[status,onStatus]);

  const startKyc=async()=>{
    setLd(true);setErr(null);
    try{
      const d=await api('/api/kyc/init',{method:'POST'});
      setSession(d);
    }catch(e){setErr(e.message);}
    setLd(false);
  };

  return(
    <div style={{minHeight:"100vh",background:C.bg0}}>
      <GS/>
      <div style={{background:C.bg1,borderBottom:`1px solid ${C.border}`,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:17,fontWeight:900,color:C.white,fontFamily:serif}}>BRICK<span style={{color:C.blueL}}>X</span> <span style={{fontSize:11,color:C.muted}}>KYC</span></span>
        <Btn ch="← Back" v="g" sz="sm" onClick={onBack}/>
      </div>
      <div style={{padding:"18px 16px",maxWidth:500,margin:"0 auto"}}>
        <div className="card fu" style={{marginBottom:13}}>
          <Lbl ch="VERIFICATION STATUS"/>
          <div style={{background:`${KYC_C[status]}10`,border:`1px solid ${KYC_C[status]}33`,borderRadius:11,padding:18,textAlign:"center"}}>
            <div style={{fontSize:34,marginBottom:5}}>{status==="not_started"?"⭕":status==="pending"?"⏳":status==="approved"?"✅":"❌"}</div>
            <div style={{fontSize:14,fontWeight:800,color:KYC_C[status],marginBottom:3}}>{KYC_LBL[status]}</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.6}}>
              {status==="not_started"&&"Identity verification is required before investing."}
              {status==="pending"&&"Your documents are being reviewed. This page refreshes automatically every 15 seconds."}
              {status==="approved"&&"You are fully verified and can invest in the ICO."}
              {status==="rejected"&&"Verification was rejected. Please start a new session and resubmit clearer documents."}
            </div>
          </div>
        </div>

        {status!=="approved"&&(
          <div className="card fu" style={{marginBottom:13}}>
            <Lbl ch="WHY KYC?"/>
            <div style={{fontSize:17,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:8}}>Verify to Invest</div>
            <p style={{fontSize:12,color:C.muted,lineHeight:1.7,marginBottom:18}}>Required for AML compliance. Verification is handled securely by our identity partner (Sumsub). Takes ~5 minutes.</p>
            <div className="g2" style={{marginBottom:18}}>
              {[["🪪","Govt ID","Passport / National ID"],["🤳","Live Selfie","With your ID"],["🏠","Address","Proof of address"],["🔒","Secure","Handled by Sumsub"]].map(([ic,ti,de])=>(
                <div key={ti} style={{background:C.bg1,borderRadius:11,padding:13,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:22,marginBottom:5}}>{ic}</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:2}}>{ti}</div>
                  <div style={{fontSize:10,color:C.muted}}>{de}</div>
                </div>
              ))}
            </div>
            {err&&<FormErr msg={err}/>}
            {session?(
              <div style={{background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.25)",borderRadius:11,padding:14,textAlign:"center"}}>
                <div style={{fontSize:26,marginBottom:6}}>📧</div>
                <div style={{fontSize:13,fontWeight:700,color:C.green,marginBottom:4}}>Verification session created</div>
                <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>Complete your verification via the emailed link. Status updates here automatically.</div>
                {session.applicantId&&<div style={{fontSize:9,color:C.dim,marginTop:7,wordBreak:"break-all"}}>Applicant ID: {session.applicantId}</div>}
              </div>
            ):(
              <Btn ch={status==="rejected"?"RESTART VERIFICATION →":"START VERIFICATION →"} full v="p" sz="lg" ld={ld} onClick={startKyc}/>
            )}
          </div>
        )}

        {status==="approved"&&<Btn ch="CONTINUE →" full v="s" sz="lg" onClick={onBack}/>}
      </div>
    </div>
  );
}

// ── INFO MODAL ────────────────────────────────────────────────
function InfoModal({onClose}) {
  return(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:C.white,fontFamily:serif}}>⚡ How BRICKX Works</div>
          <Btn ch="✕" v="g" sz="sm" onClick={onClose}/>
        </div>
        <div style={{background:"rgba(20,184,166,.08)",border:"1px solid rgba(20,184,166,.3)",borderRadius:10,padding:12,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:C.teal}}>🔒 BRICK Fixed at $10.00 · Annual Dividend from Hotel NOI</div>
        </div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.8,marginBottom:14}}>Phase 1: the BRX ICO raises <strong style={{color:C.white}}>$2,000,000</strong> to fund the protocol. Phase 2: BRICKX acquires an operating hotel in Batam, Indonesia and issues BRICK property tokens at a <strong style={{color:C.white}}>permanently fixed $10.00 price</strong>.</p>
        {[["📌","Fixed Price","BRICK token price is $10.00 forever — no speculation"],
          ["💰","Annual Dividend","70% of audited hotel NOI distributed to holders in USDC"],
          ["📅","June Payout","Fiscal close Dec 31 → audit Jan–Mar → announce April → pay June"],
          ["📸","Dec 31 Snapshot","Dividend eligibility based on holdings at the Dec 31 snapshot"],
          ["🏨","Hotel Batam","Existing operating hotel, budget up to $18.5M"],
        ].map(([ic,t,d])=>(
          <div key={t} style={{display:"flex",gap:11,padding:"9px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
            <span style={{fontSize:17,flexShrink:0}}>{ic}</span>
            <div><div style={{fontSize:12,fontWeight:700,color:C.white,marginBottom:2}}>{t}</div><div style={{fontSize:11,color:C.muted}}>{d}</div></div>
          </div>
        ))}
        <div style={{background:"rgba(20,184,166,.07)",border:"1px solid rgba(20,184,166,.2)",borderRadius:11,padding:13,marginTop:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:C.teal,marginBottom:5}}>Example: Project Hotel Batam</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>Buy 1,000 BRICK at <strong style={{color:C.white}}>$10.00 each = $10,000</strong>.<br/>Est. APY ~5.1% → roughly <strong style={{color:C.green}}>~$510/year</strong>, paid once each June in USDC.<br/>Eligibility set by the Dec 31 holder snapshot. <strong style={{color:C.teal}}>Price stays $10.00 forever.</strong></div>
        </div>
        <Btn ch="Got it ✓" full v="p" sz="lg" onClick={onClose}/>
      </div>
    </div>
  );
}

// ── MAIN APP SHELL ────────────────────────────────────────────
function App2({user,refreshUser,onKycStatus,onLogout}) {
  const [page,setPage]=useState("home");
  const [showKYC,setShowKYC]=useState(false);
  const [toast,setToast]=useState(null);
  const [infoModal,setInfoModal]=useState(false);

  const notify=useCallback((msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);},[]);
  const kyc=user.kyc_status||"not_started";

  if(showKYC)return<KYCScreen user={user} onStatus={onKycStatus} onBack={()=>setShowKYC(false)}/>;

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
          <div onClick={()=>kyc!=="approved"&&setShowKYC(true)} style={{cursor:kyc!=="approved"?"pointer":"default"}}>
            <Bdg ch={kyc==="approved"?"✓ KYC":kyc==="pending"?"⏳ KYC":"! KYC"} c={KYC_C[kyc]}/>
          </div>
        </div>
      </header>

      {kyc!=="approved"&&(
        <div style={{background:"rgba(245,158,11,.07)",borderBottom:"1px solid rgba(245,158,11,.18)",padding:"9px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <div style={{fontSize:12,color:C.gold}}>⚠ {kyc==="pending"?"KYC under review — investing unlocks once approved":"Complete KYC to invest"}</div>
          <Btn ch={kyc==="pending"?"Status →":"Verify →"} v="bgold" sz="sm" onClick={()=>setShowKYC(true)}/>
        </div>
      )}
      <div style={{background:"rgba(20,184,166,.05)",borderBottom:"1px solid rgba(20,184,166,.1)",padding:"7px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{fontSize:11,color:C.teal}}>🔒 BRICK fixed at $10.00 — annual dividend each June</div>
        <Btn ch="?" v="bteal" sz="sm" onClick={()=>setInfoModal(true)}/>
      </div>

      <div className="wrap main">
        {page==="home"&&<Home user={user} onNav={setPage} onKYC={()=>setShowKYC(true)}/>}
        {page==="ico"&&<ICOPage user={user} notify={notify} onKYC={()=>setShowKYC(true)} onNav={setPage}/>}
        {page==="market"&&<Market/>}
        {page==="portfolio"&&<Portfolio user={user}/>}
        {page==="account"&&<Account user={user} refreshUser={refreshUser} onKYC={()=>setShowKYC(true)} notify={notify} onLogout={onLogout}/>}
      </div>

      <nav className="bnav">
        {NAV.map(n=><button key={n.id} className={page===n.id?"on":""} onClick={()=>setPage(n.id)}><span className="ic">{n.ic}</span>{n.lb}</button>)}
      </nav>
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────
function Home({user,onNav,onKYC}) {
  const info=useLoad(()=>api('/api/ico/info',{auth:false}));
  const orders=useLoad(()=>api('/api/ico/orders'));
  const i=info.data;
  const o=orders.data;
  const active=i?String(i.activeRound||"").toLowerCase():null;
  const price=i?roundPrice(i,active):null;

  return(
    <div className="fu">
      <div style={{marginBottom:16,paddingTop:4}}>
        <div style={{fontSize:10,color:C.blueL,letterSpacing:3,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><Dot c={C.blueL} s={5}/>Hi {user.first_name}</div>
        <div style={{fontSize:25,fontWeight:900,color:C.white,fontFamily:serif,lineHeight:1.15,marginBottom:7}}>Own Real Estate.<br/><span style={{color:C.teal}}>Fixed Price.</span><br/><span style={{color:C.blueL}}>Annual Dividend.</span></div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:13}}>Phase 1: BRX ICO funds the protocol. Phase 2: BRICK property tokens at a fixed $10.00, paying 70% of audited hotel NOI each June.</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn ch="🚀 Buy BRX" v="p" sz="md" onClick={()=>onNav("ico")}/>
          {user.kyc_status!=="approved"&&<Btn ch="⚠ Complete KYC" v="bgold" sz="md" onClick={onKYC}/>}
        </div>
      </div>

      {info.ld?<Loading msg="Loading ICO stats…"/>:info.err?<ErrBox msg={info.err} onRetry={info.reload}/>:(
        <div className="g4" style={{marginBottom:12}}>
          {[
            {lb:"ICO RAISED",val:fU(i.totalRaised||0),unit:`of ${fU(i.totalTarget||2000000)}`,c:C.blue},
            {lb:"FILLED",val:`${Number(i.percentFilled||0).toFixed(1)}%`,unit:`${ROUND_LABEL[active]||"—"} active`,c:C.green},
            {lb:"MY BRX",val:orders.ld?"…":orders.err?"—":fN(o?.totalBrx||0),unit:"Allocated",c:C.teal},
            {lb:"MY INVESTED",val:orders.ld?"…":orders.err?"—":fU(o?.totalInvested||0),unit:"USD total",c:C.gold},
          ].map(k=>(
            <div key={k.lb} className="card" style={{position:"relative",overflow:"hidden",padding:12}}>
              <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:k.c,borderRadius:"14px 0 0 14px"}}/>
              <div style={{fontSize:9,color:C.muted,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{k.lb}</div>
              <div style={{fontSize:17,fontWeight:800,color:C.white,fontFamily:serif,lineHeight:1}}>{k.val}</div>
              <div style={{fontSize:9,color:C.muted,marginTop:3}}>{k.unit}</div>
            </div>
          ))}
        </div>
      )}

      {/* Flagship — Phase 2 */}
      <div className="card glow" style={{marginBottom:12,borderColor:"rgba(245,158,11,.35)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:9,color:C.gold,letterSpacing:3,marginBottom:3}}>⭐ FLAGSHIP PROJECT · PHASE 2</div>
            <div style={{fontSize:19,fontWeight:900,color:C.white,fontFamily:serif,lineHeight:1.1}}>🏨 Project Hotel Batam</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>Confidential · Existing operating hotel · Batam, Indonesia</div>
          </div>
          <Bdg ch="After ICO" c={C.gold}/>
        </div>
        <div className="g4" style={{marginBottom:11}}>
          {[{lb:"Token Price",val:"$10.00",c:C.teal},{lb:"Est. APY",val:"~5.1%",c:C.green},{lb:"Budget",val:"≤$18.5M",c:C.gold},{lb:"Tokens",val:"1,850,000",c:C.purple}].map(k=>(
            <div key={k.lb} style={{background:C.bg1,borderRadius:9,padding:9,textAlign:"center"}}>
              <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{k.lb}</div>
              <div style={{fontSize:13,fontWeight:800,color:k.c}}>{k.val}</div>
            </div>
          ))}
        </div>
        <p style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:11}}>Acquisition of an existing operating hotel (budget up to $18.5M). {DIVIDEND_LINE}. Property identity disclosed at acquisition.</p>
        <div style={{display:"flex",gap:8}}>
          <Btn ch="🏨 View Property →" v="bgold" sz="md" onClick={()=>onNav("market")} st={{flex:1}}/>
          <Btn ch="Buy BRX" v="p" sz="md" onClick={()=>onNav("ico")} st={{flex:1}}/>
        </div>
      </div>

      {/* ICO progress */}
      {i&&!info.ld&&!info.err&&(
        <div className="card glow" style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
            <div><Lbl ch={`BRX ICO — ${ROUND_LABEL[active]||"…"}`} mb={3}/><div style={{fontSize:21,fontWeight:800,color:C.white,fontFamily:serif}}>{price!=null?`$${Number(price).toFixed(3)} / BRX`:"—"}</div></div>
            <Bdg ch={<><Dot c={C.green} s={5}/> LIVE</>} c={C.green}/>
          </div>
          <PBar pct={i.percentFilled} h={8}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginTop:4,marginBottom:12}}>
            <span style={{color:C.blueL,fontWeight:700}}>{fU(i.totalRaised||0)} raised</span>
            <span>{Number(i.percentFilled||0).toFixed(1)}%</span>
            <span>Target {fU(i.totalTarget||2000000)}</span>
          </div>
          <Btn ch="🚀 BUY BRX TOKENS →" full v="p" sz="lg" onClick={()=>onNav("ico")}/>
          <p style={{fontSize:10,color:C.muted,textAlign:"center",marginTop:7}}>BRX funds the hotel acquisition · 1B fixed supply · Polygon</p>
        </div>
      )}

      {/* Tokenomics */}
      <div className="card">
        <Lbl ch="BRX TOKENOMICS — 1B SUPPLY"/>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <ResponsiveContainer width={110} height={110}>
            <PieChart><Pie data={TKNS} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={2} dataKey="v">{TKNS.map(e=><Cell key={e.n} fill={e.c}/>)}</Pie></PieChart>
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
function ICOPage({user,notify,onKYC,onNav}) {
  const info=useLoad(()=>api('/api/ico/info',{auth:false}));
  const [amt,setAmt]=useState(100);
  const [currency,setCurrency]=useState(CURRENCIES[0]);
  const [step,setStep]=useState("form"); // form | confirm | payment
  const [ld,setLd]=useState(false);
  const [orderErr,setOrderErr]=useState(null);
  const [order,setOrder]=useState(null);

  const i=info.data;
  const active=i?String(i.activeRound||"").toLowerCase():null;
  const price=i?roundPrice(i,active):null;
  const minInv=i?.minInvestment??100;
  const maxInv=i?.maxInvestment??50000;
  const brx=price?Math.floor(amt/price):0;

  const kycOk=user.kyc_status==="approved";
  const walletOk=!!user.wallet_address&&WALLET_RX.test(user.wallet_address);
  const can=kycOk&&walletOk;

  const doBuy=async()=>{
    setLd(true);setOrderErr(null);
    try{
      const d=await api('/api/ico/order',{method:'POST',body:{usdAmount:amt,cryptoCurrency:currency}});
      setOrder(d);setStep("payment");
    }catch(e){setOrderErr(e.message);}
    setLd(false);
  };

  if(info.ld)return<div className="fu"><Loading msg="Loading ICO data…"/></div>;
  if(info.err)return<div className="fu"><ErrBox msg={info.err} onRetry={info.reload}/></div>;

  if(step==="payment"&&order)return(
    <div className="fu"><div className="card glow" style={{padding:24}}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:44,marginBottom:8}}>🧾</div>
        <div style={{fontSize:19,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:5}}>Payment Instructions</div>
        <p style={{fontSize:12,color:C.muted,lineHeight:1.7}}>{order.message||"Complete your payment to confirm the order."}</p>
      </div>
      <div style={{background:C.bg1,borderRadius:11,padding:13,marginBottom:13}}>
        {[["Order ID",order.orderId],["BRX Allocated",`${Number(order.brxAllocated||brx).toLocaleString()} BRX`],["Amount",`$${amt.toLocaleString()}`],["Currency",order.currency||currency]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12,gap:10}}>
            <span style={{color:C.muted,flexShrink:0}}>{k}</span><span style={{color:C.white,fontWeight:600,textAlign:"right",wordBreak:"break-all"}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(26,86,219,.08)",border:`1px solid ${C.borderH}`,borderRadius:11,padding:13,marginBottom:13}}>
        <div style={{fontSize:11,color:C.blueL,fontWeight:700,marginBottom:6}}>Send ${amt.toLocaleString()} in {order.currency||currency} to:</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{flex:1,fontSize:11,color:C.white,wordBreak:"break-all",background:C.bg1,borderRadius:8,padding:"9px 10px"}}>{order.payTo}</div>
          <CopyBtn text={order.payTo} notify={notify}/>
        </div>
      </div>
      <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",borderRadius:9,padding:11,marginBottom:16,fontSize:11,color:C.gold,lineHeight:1.6}}>
        ⏱ Polygon USDT/USDC payments are auto-detected within ~5 minutes. ETH/BNB payments are confirmed manually within 24 hours.
      </div>
      <div style={{display:"flex",gap:8}}>
        <Btn ch="View Orders" full v="o" onClick={()=>onNav("portfolio")}/>
        <Btn ch="Done ✓" full v="p" onClick={()=>{setStep("form");setOrder(null);}}/>
      </div>
    </div></div>
  );

  return(
    <div className="fu">
      <div style={{marginBottom:13,paddingTop:4}}>
        <div style={{fontSize:10,color:C.green,letterSpacing:3,marginBottom:5,display:"flex",gap:5,alignItems:"center"}}><Dot c={C.green} s={5}/>ICO {ROUND_LABEL[active]?ROUND_LABEL[active].toUpperCase():""} — LIVE</div>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif}}>Buy BRX Token</div>
        <div style={{fontSize:11,color:C.muted,marginTop:2}}>BRX funds the Batam hotel acquisition · $2,000,000 total target</div>
      </div>

      <div className="hscroll" style={{marginBottom:13}}>
        {ROUND_ORDER.map(r=>{
          const idx=ROUND_ORDER.indexOf(r), aIdx=ROUND_ORDER.indexOf(active);
          const st=r===active?"live":aIdx>-1&&idx<aIdx?"closed":"upcoming";
          const p=roundPrice(i,r);
          return(
            <div key={r} style={{flexShrink:0,width:128,background:C.bg2,border:`1px solid ${st==="live"?C.borderH:C.border}`,borderRadius:13,padding:13}}>
              {st==="live"&&<div style={{marginBottom:5}}><Bdg ch={<><Dot c={C.green} s={4}/>LIVE</>} c={C.green}/></div>}
              <div style={{fontSize:9,color:C.muted,marginBottom:2}}>{ROUND_LABEL[r]}</div>
              <div style={{fontSize:17,fontWeight:800,fontFamily:serif,color:st==="live"?C.blueL:C.white}}>{p!=null?`$${Number(p).toFixed(3)}`:"—"}</div>
              {st==="live"&&<div style={{marginTop:7}}><PBar pct={i.percentFilled} h={4}/></div>}
              <div style={{marginTop:5}}><Bdg ch={st} c={st==="live"?C.green:st==="closed"?C.muted:C.dim}/></div>
            </div>
          );
        })}
      </div>

      <div className="card glow" style={{marginBottom:13}}>
        {!kycOk&&<div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:11,marginBottom:13,fontSize:12,color:C.gold}}>⚠ KYC approval required — <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={onKYC}>Verify now →</span></div>}
        {kycOk&&!walletOk&&<div style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:11,marginBottom:13,fontSize:12,color:C.gold}}>⚠ Set your Polygon wallet address on the <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={()=>onNav("account")}>Account page →</span> before investing</div>}
        {step==="form"&&<>
          <Lbl ch="INVESTMENT AMOUNT (USD)"/>
          <input type="range" min={minInv} max={maxInv} value={amt} step={50} onChange={e=>setAmt(Number(e.target.value))} style={{marginBottom:9}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:14,marginBottom:13}}>
            <span style={{color:C.white,fontWeight:800}}>${amt.toLocaleString()}</span>
            <span style={{color:C.blueL}}>{brx.toLocaleString()} BRX</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:13}}>
            {[100,1000,5000,50000].map(n=><Btn key={n} ch={`$${n>=1000?n/1000+"K":n}`} v={amt===n?"p":"g"} sz="sm" onClick={()=>setAmt(n)}/>)}
          </div>
          <SelField label="Pay With" val={currency} set={setCurrency} opts={CURRENCIES}/>
          <div style={{background:C.bg1,borderRadius:11,padding:13,marginBottom:13}}>
            {[["Price",price!=null?`$${Number(price).toFixed(3)} / BRX`:"—"],["You pay",`$${amt.toLocaleString()} (${currency})`],["You receive",`${brx.toLocaleString()} BRX`],["Min / Max",`$${minInv.toLocaleString()} / $${maxInv.toLocaleString()}`],["Network","Polygon"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
                <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
          <Btn ch={can?`BUY ${brx.toLocaleString()} BRX →`:!kycOk?"🔒 COMPLETE KYC FIRST":"🔒 SET WALLET FIRST"} full v="p" sz="lg"
            dis={can&&(amt<minInv||amt>maxInv)}
            onClick={()=>can?setStep("confirm"):(!kycOk?onKYC():onNav("account"))}/>
        </>}
        {step==="confirm"&&<>
          <div style={{fontSize:15,fontWeight:800,color:C.white,fontFamily:serif,marginBottom:13}}>Confirm Order</div>
          <FormErr msg={orderErr}/>
          <div style={{background:C.bg1,borderRadius:11,padding:13,marginBottom:13}}>
            {[["Tokens",`${brx.toLocaleString()} BRX`],["Amount",`$${amt.toLocaleString()}`],["Pay with",currency],["Price",price!=null?`$${Number(price).toFixed(3)}`:"—"],["Round",ROUND_LABEL[active]||"—"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:13}}>
                <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:700}}>{v}</span>
              </div>
            ))}
          </div>
          <p style={{fontSize:10,color:C.muted,marginBottom:13,lineHeight:1.6}}>You will receive payment instructions next. BRX is allocated once your payment is confirmed.</p>
          <div style={{display:"flex",gap:8}}>
            <Btn ch="Cancel" v="o" onClick={()=>{setStep("form");setOrderErr(null);}}/>
            <Btn ch="CREATE ORDER →" full v="s" sz="lg" ld={ld} onClick={doBuy}/>
          </div>
        </>}
      </div>

      <div className="card">
        <Lbl ch="ICO STATS"/>
        <div style={{fontSize:26,fontWeight:800,color:C.white,fontFamily:serif}}>{fU(i.totalRaised||0)}</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:9}}>raised of {fU(i.totalTarget||2000000)} total target</div>
        <PBar pct={i.percentFilled} h={8}/>
        <div className="g2" style={{marginTop:11,gap:8}}>
          {[["Accepted","USDT · USDC · ETH · BNB"],["Min / Max",`$${minInv.toLocaleString()} / $${maxInv.toLocaleString()}`],["BRX Supply","1,000,000,000 fixed"],["1 BRX","= 1 Vote"]].map(([k,v])=>(
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
function Market() {
  const [tab,setTab]=useState("properties");
  const props=useLoad(()=>api('/api/marketplace/properties',{auth:false}));
  const sched=useLoad(()=>api('/api/dividend/schedule',{auth:false}));
  const list=props.data?.properties||[];

  return(
    <div className="fu">
      <div style={{marginBottom:14,paddingTop:4}}>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif,marginBottom:3}}>🏪 Property Market</div>
        <div style={{fontSize:11,color:C.muted}}>BRICK $10.00 fixed · {DIVIDEND_LINE}</div>
      </div>
      <div style={{background:"rgba(20,184,166,.06)",border:"1px solid rgba(20,184,166,.15)",borderRadius:10,padding:"9px 13px",marginBottom:13,fontSize:11,color:C.teal}}>🔒 Token price permanently fixed at $10.00 · Returns come from the annual NOI dividend only</div>
      <div className="tabs">
        {[{k:"properties",l:"PROPERTIES"},{k:"listings",l:"LISTINGS"}].map(t=>(
          <button key={t.k} className="tbtn" style={{background:tab===t.k?"rgba(26,86,219,.2)":"rgba(255,255,255,.03)",color:tab===t.k?C.blueL:C.muted}} onClick={()=>setTab(t.k)}>{t.l}</button>
        ))}
      </div>

      {tab==="properties"&&(
        props.ld?<Loading msg="Loading properties…"/>:
        props.err?<ErrBox msg={props.err} onRetry={props.reload}/>:
        list.length===0?(
          <div className="card" style={{textAlign:"center",padding:36}}>
            <div style={{fontSize:36,marginBottom:8}}>🏨</div>
            <div style={{fontSize:13,color:C.muted,lineHeight:1.7}}>The flagship property listing will appear here.<br/>Token sale opens after ICO complete.</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:13}}>
            {list.map(p=>(
              <div key={p.id} className="prop-card">
                <div style={{background:"rgba(26,86,219,.06)",height:95,display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,position:"relative"}}>
                  🏨
                  <div style={{position:"absolute",top:9,right:9}}><Bdg ch={p.status||"Upcoming"} c={C.gold}/></div>
                </div>
                <div style={{padding:15}}>
                  <div style={{fontSize:15,fontWeight:800,color:C.white,marginBottom:2,fontFamily:serif}}>{p.display_name}</div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:9}}>📍 {p.location}</div>
                  {p.description&&<p style={{fontSize:11,color:C.muted,lineHeight:1.7,marginBottom:11}}>{p.description}</p>}
                  <div className="g4" style={{marginBottom:11}}>
                    {[
                      {lb:"FIXED PRICE",val:`$${Number(p.token_price_usd??10).toFixed(2)}`,c:C.teal},
                      {lb:"EST. APY",val:`~${Number(p.annual_yield_pct??5.1).toFixed(1)}%`,c:C.green},
                      {lb:"TOTAL TOKENS",val:Number(p.total_tokens||0).toLocaleString(),c:C.white},
                      {lb:"DIVIDEND",val:"Each June",c:C.gold},
                    ].map(k=>(
                      <div key={k.lb} style={{background:C.bg1,borderRadius:8,padding:8,textAlign:"center"}}>
                        <div style={{fontSize:8,color:C.muted,marginBottom:1}}>{k.lb}</div>
                        <div style={{fontSize:12,fontWeight:800,color:k.c}}>{k.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:9,padding:10,marginBottom:11,fontSize:11,color:C.green,lineHeight:1.6}}>💰 {DIVIDEND_LINE}</div>
                  <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",borderRadius:9,padding:10,fontSize:11,color:C.gold,textAlign:"center"}}>🔓 Token sale opens after ICO complete</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab==="listings"&&(
        <div className="card" style={{textAlign:"center",padding:36}}>
          <div style={{fontSize:36,marginBottom:8}}>🏪</div>
          <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:5}}>Secondary marketplace opens in Phase 2</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>Once BRICK tokens are issued, holders can list them here at the fixed $10.00 price (0.5% platform fee).</div>
        </div>
      )}

      <div className="card" style={{marginTop:13}}>
        <Lbl ch="DIVIDEND SCHEDULE"/>
        {sched.ld?<div style={{fontSize:11,color:C.muted}}>Loading schedule…</div>:
         sched.err?<div style={{fontSize:11,color:C.muted}}>Fiscal close Dec 31 → audit Jan–Mar → announce April → pay June.</div>:(
          <div style={{fontSize:11,color:C.muted,lineHeight:1.8}}>
            {[["Fiscal close","December 31"],["Audit","January – March"],["Announcement","April"],["Payment","June (USDC)"],["Holder share","70% of audited NOI"],["Eligibility","Dec 31 snapshot"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
                <span>{k}</span><span style={{color:C.white,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PORTFOLIO PAGE ────────────────────────────────────────────
function Portfolio({user}) {
  const orders=useLoad(()=>api('/api/ico/orders'));
  const divs=useLoad(()=>api('/api/dividend/portfolio'));
  const o=orders.data;
  const d=divs.data;
  const orderList=o?.orders||[];
  const holdings=d?.holdings||[];
  const history=d?.dividendHistory||[];

  return(
    <div className="fu">
      <div style={{marginBottom:14,paddingTop:4}}>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif}}>Portfolio</div>
        <div style={{fontSize:11,color:C.muted}}>{user.email}</div>
      </div>

      {orders.ld?<Loading msg="Loading ICO orders…"/>:orders.err?<ErrBox msg={orders.err} onRetry={orders.reload}/>:(
        <>
          <div className="g4" style={{marginBottom:12}}>
            {[
              {lb:"TOTAL INVESTED",val:fU(o?.totalInvested||0),c:C.blue},
              {lb:"TOTAL BRX",val:fN(o?.totalBrx||0),c:C.teal},
              {lb:"ORDERS",val:String(orderList.length),c:C.gold},
              {lb:"BRICK VALUE",val:divs.ld?"…":divs.err?"—":fU(d?.portfolioValueUSD||0),c:C.green},
            ].map(k=>(
              <div key={k.lb} className="card" style={{position:"relative",overflow:"hidden",padding:12}}>
                <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:k.c,borderRadius:"14px 0 0 14px"}}/>
                <div style={{fontSize:9,color:C.muted,marginBottom:4}}>{k.lb}</div>
                <div style={{fontSize:16,fontWeight:800,color:C.white,fontFamily:serif}}>{k.val}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{marginBottom:12}}>
            <Lbl ch="ICO ORDERS"/>
            {orderList.length===0?(
              <div style={{textAlign:"center",padding:"26px 0",color:C.muted}}><div style={{fontSize:32,marginBottom:7}}>📋</div>No orders yet — buy BRX in the ICO.</div>
            ):(
              <div style={{maxHeight:340,overflowY:"auto"}}>
                {orderList.map(ord=>{
                  const b=ORDER_BADGE[ord.status]||{l:String(ord.status||"").toUpperCase(),c:C.muted};
                  return(
                    <div key={ord.order_id||ord.orderId||ord.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
                      <div>
                        <div style={{fontSize:11,color:C.white,fontWeight:700}}>{Number(ord.brx_amount||ord.brxAllocated||0).toLocaleString()} BRX</div>
                        <div style={{fontSize:9,color:C.dim}}>{ord.crypto_currency||ord.currency||""}{ord.created_at?` · ${new Date(ord.created_at).toLocaleDateString()}`:""}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:13,color:C.green,fontWeight:800}}>{fU(Number(ord.usd_amount||ord.usdAmount||0))}</div>
                        <Bdg ch={b.l} c={b.c}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <div className="card" style={{marginBottom:12}}>
        <Lbl ch="SEED VESTING"/>
        {[["Lock","12 months from TGE"],["Vesting","24 months linear after lock"],["Applies to","Seed round BRX"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12}}>
            <span style={{color:C.muted}}>{k}</span><span style={{color:C.white,fontWeight:600}}>{v}</span>
          </div>
        ))}
      </div>

      {divs.ld?<Loading msg="Loading dividend portfolio…"/>:divs.err?<ErrBox msg={divs.err} onRetry={divs.reload}/>:(
        <>
          <div className="card" style={{marginBottom:12}}>
            <Lbl ch="BRICK HOLDINGS"/>
            {holdings.length===0?(
              <div style={{textAlign:"center",padding:"26px 0"}}>
                <div style={{fontSize:36,marginBottom:7}}>🏨</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>No BRICK tokens yet.<br/>Token sale opens after ICO complete.</div>
              </div>
            ):(
              <div>
                {holdings.map(h=>(
                  <div key={h.property_id||h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
                    <div style={{display:"flex",gap:9,alignItems:"center"}}>
                      <span style={{fontSize:22}}>🏨</span>
                      <div>
                        <div style={{fontSize:12,fontWeight:700,color:C.white}}>{h.display_name||h.property_name||"Project Hotel Batam (Confidential)"}</div>
                        <div style={{fontSize:10,color:C.muted}}>{Number(h.tokens||h.token_amount||0).toLocaleString()} tokens · $10.00 each</div>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:13,color:C.teal,fontWeight:700}}>{fU(Number(h.tokens||h.token_amount||0)*10)}</div>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:13,padding:11,background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:9}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:3}}>Total Dividends Received</div>
                  <div style={{fontSize:20,fontWeight:800,color:C.green,fontFamily:serif}}>{fU(d?.totalDividendReceived||0)}</div>
                  <div style={{fontSize:10,color:C.muted}}>{DIVIDEND_LINE}</div>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <Lbl ch="DIVIDEND HISTORY"/>
            {history.length===0?(
              <div style={{textAlign:"center",padding:"22px 0",color:C.muted,fontSize:12,lineHeight:1.7}}>
                <div style={{fontSize:30,marginBottom:7}}>💰</div>
                No dividends yet. First distribution follows the first full fiscal year: snapshot Dec 31, audited Jan–Mar, paid in June.
              </div>
            ):(
              history.map(rec=>(
                <div key={rec.receipt_id||rec.id||`${rec.year}-${rec.property_id}`} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid rgba(255,255,255,.04)`}}>
                  <div>
                    <div style={{fontSize:12,color:C.white,fontWeight:700}}>FY {rec.fiscal_year||rec.year||"—"} dividend</div>
                    <div style={{fontSize:10,color:C.muted}}>{rec.paid_at?new Date(rec.paid_at).toLocaleDateString():"June payout"} · USDC</div>
                  </div>
                  <div style={{fontSize:13,color:C.green,fontWeight:800}}>{fU(Number(rec.amount_usd||rec.amount||0))}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── ACCOUNT PAGE ──────────────────────────────────────────────
function Account({user,refreshUser,onKYC,notify,onLogout}) {
  const kyc=user.kyc_status||"not_started";
  const [wallet,setWallet]=useState(user.wallet_address||"");
  const [wErr,setWErr]=useState(null);
  const [wLd,setWLd]=useState(false);

  const saveWallet=async()=>{
    setWErr(null);
    if(!WALLET_RX.test(wallet.trim())){setWErr("Invalid address — must match 0x + 40 hex characters");return;}
    setWLd(true);
    try{
      await api('/api/auth/wallet',{method:'PUT',body:{walletAddress:wallet.trim()}});
      await refreshUser();
      notify("Wallet address saved");
    }catch(e){setWErr(e.message);}
    setWLd(false);
  };

  return(
    <div className="fu">
      <div style={{marginBottom:14,paddingTop:4}}>
        <div style={{fontSize:21,fontWeight:900,color:C.white,fontFamily:serif}}>Account</div>
        <div style={{fontSize:11,color:C.muted}}>{user.email}</div>
      </div>
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:"flex",gap:11,alignItems:"center",marginBottom:13}}>
          <div style={{width:42,height:42,borderRadius:"50%",background:"rgba(26,86,219,.2)",border:`2px solid ${C.blue}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:C.blueL}}>
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div><div style={{fontSize:14,fontWeight:800,color:C.white}}>{user.first_name} {user.last_name}</div><div style={{fontSize:11,color:C.muted}}>{user.country}</div></div>
        </div>
        {[["Email",user.email],["Country",user.country||"—"],["Referral Code",user.referral_code||"—"],["Wallet",user.wallet_address||"Not set"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid rgba(255,255,255,.04)`,fontSize:12,gap:10}}>
            <span style={{color:C.muted,flexShrink:0}}>{k}</span><span style={{color:C.white,fontWeight:600,textAlign:"right",maxWidth:"65%",wordBreak:"break-all"}}>{v}</span>
          </div>
        ))}
      </div>

      <div className="card glow" style={{marginBottom:12}}>
        <Lbl ch="POLYGON WALLET"/>
        <p style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:11}}>Your BRX allocation and future BRICK dividends are sent to this Polygon address. Required before investing.</p>
        <Field label="Wallet Address" val={wallet} set={v=>{setWallet(v);setWErr(null);}} ph="0x…" icon="🔗" err={wErr}/>
        <Btn ch={user.wallet_address?"UPDATE WALLET →":"SAVE WALLET →"} full v="p" sz="lg" ld={wLd} onClick={saveWallet}/>
      </div>

      <div className="card glow" style={{marginBottom:12}}>
        <Lbl ch="KYC / AML VERIFICATION"/>
        <div style={{background:`${KYC_C[kyc]}10`,border:`1px solid ${KYC_C[kyc]}33`,borderRadius:11,padding:18,textAlign:"center",marginBottom:13}}>
          <div style={{fontSize:34,marginBottom:5}}>{kyc==="not_started"?"⭕":kyc==="pending"?"⏳":kyc==="approved"?"✅":"❌"}</div>
          <div style={{fontSize:14,fontWeight:800,color:KYC_C[kyc],marginBottom:3}}>{KYC_LBL[kyc]}</div>
          <div style={{fontSize:11,color:C.muted}}>{kyc==="not_started"?"Complete KYC to unlock investing.":kyc==="pending"?"Your verification is being reviewed.":kyc==="approved"?"You can invest in the ICO.":"Please restart verification."}</div>
        </div>
        <div>
          {kyc==="approved"
            ?<div style={{textAlign:"center"}}><Bdg ch="✅ FULLY VERIFIED" c={C.green}/></div>
            :<Btn ch={kyc==="pending"?"VIEW KYC STATUS →":"START KYC →"} full v="p" sz="lg" onClick={onKYC}/>}
        </div>
      </div>

      <div className="card" style={{marginBottom:12}}>
        <Lbl ch="HOW RETURNS WORK"/>
        {[["🔒","Fixed Price","BRICK token price is $10.00 forever — zero speculation"],
          ["💰","Annual Dividend","70% of audited hotel NOI distributed to holders in USDC"],
          ["📅","Paid Each June","Fiscal close Dec 31 · audit Jan–Mar · announce April · pay June"],
          ["📸","Dec 31 Snapshot","Dividend eligibility based on the Dec 31 holder snapshot"]].map(([ic,t,d])=>(
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
function Root() {
  const [boot,setBoot]=useState(true);
  const [user,setUser]=useState(null);

  // Session restore on mount
  useEffect(()=>{
    let on=true;
    (async()=>{
      if(!getToken()){if(on)setBoot(false);return;}
      try{
        const d=await api('/api/auth/me');
        if(on)setUser(d.user);
      }catch{setToken(null);}
      if(on)setBoot(false);
    })();
    return()=>{on=false;};
  },[]);

  const refreshUser=useCallback(async()=>{
    try{
      const d=await api('/api/auth/me');
      setUser(d.user);
      return d.user;
    }catch{return null;}
  },[]);

  const handleKycStatus=useCallback(status=>{
    setUser(u=>u?{...u,kyc_status:status}:u);
    refreshUser();
  },[refreshUser]);

  const handleLogout=useCallback(()=>{setToken(null);setUser(null);},[]);

  if(boot)return(
    <div style={{minHeight:"100vh",background:C.bg0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:14}}>
      <GS/>
      <div style={{fontSize:30,fontWeight:900,color:C.white,fontFamily:serif,letterSpacing:3}}>BRICK<span style={{color:C.blueL}}>X</span></div>
      <Spin/>
      <div style={{fontSize:11,color:C.muted}}>Restoring session…</div>
    </div>
  );

  if(!user)return<Auth onAuth={setUser}/>;
  return<App2 user={user} refreshUser={refreshUser} onKycStatus={handleKycStatus} onLogout={handleLogout}/>;
}

export default function App() {
  return(
    <ErrorBoundary>
      <Root/>
    </ErrorBoundary>
  );
}
