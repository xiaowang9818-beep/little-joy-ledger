/* 小确幸记账 v2：账户、转账、预算、周期账单、筛选、备份与可爱主题 */
(() => {
  'use strict';

  const hadThemePreference=localStorage.getItem('theme')!==null;
  if(!hadThemePreference)theme.mode='light';

  const FEATURE_KEYS={accounts:'financeAccounts',categories:'customCategories',budgets:'budgets',recurring:'recurringRules',plans:'personalPlans',repaymentPlans:'repaymentPlans',plannerPrefs:'plannerPrefs',goals:'growthGoals',inspirations:'growthInspirations',diaries:'growthDiaries',focusSessions:'growthFocusSessions',focusPrefs:'growthFocusPrefs'};
  let financeAccounts=readStoredJson(FEATURE_KEYS.accounts,[]);
  let customCategories=readStoredJson(FEATURE_KEYS.categories,[]);
  let budgets=readStoredJson(FEATURE_KEYS.budgets,[]);
  let recurringRules=readStoredJson(FEATURE_KEYS.recurring,[]);
  let personalPlans=readStoredJson(FEATURE_KEYS.plans,[]);
  let repaymentPlans=readStoredJson(FEATURE_KEYS.repaymentPlans,[]);
  let plannerPrefs=Object.assign({viewDate:today(),notifyEnabled:false,sound:true,pushEnabled:false},readStoredJson(FEATURE_KEYS.plannerPrefs,{})||{});
  let growthGoals=readStoredJson(FEATURE_KEYS.goals,[]);
  let growthInspirations=readStoredJson(FEATURE_KEYS.inspirations,[]);
  let growthDiaries=readStoredJson(FEATURE_KEYS.diaries,[]);
  let growthFocusSessions=readStoredJson(FEATURE_KEYS.focusSessions,[]);
  let growthFocusPrefs=Object.assign({duration:25,breakDuration:5,task:'',active:null},readStoredJson(FEATURE_KEYS.focusPrefs,{})||{});
  if(!Array.isArray(financeAccounts))financeAccounts=[];
  if(!Array.isArray(customCategories))customCategories=[];
  if(!Array.isArray(budgets))budgets=[];
  if(!Array.isArray(recurringRules))recurringRules=[];
  if(!Array.isArray(personalPlans))personalPlans=[];
  if(!Array.isArray(repaymentPlans))repaymentPlans=[];
  if(!Array.isArray(growthGoals))growthGoals=[];
  if(!Array.isArray(growthInspirations))growthInspirations=[];
  if(!Array.isArray(growthDiaries))growthDiaries=[];
  if(!Array.isArray(growthFocusSessions))growthFocusSessions=[];

  let editingTxId=null;
  let txAccountId='';
  let categoryChoices=[];
  let editingDebtId=null;
  let debtFilterV2='active';
  let debtViewModeV1='records';
  let editingRepaymentPlanIdV1='';
  let repaymentPlanDebtIdsV1=[];
  let repaymentPlanReturnV1=null;
  let repaymentPlanCustomDraftV1={};
  let selectedRepaymentPlanYearV1=new Date().getFullYear();
  let txAiConfidence=null;
  let aiBatchItems=[];
  let aiBatchWorking=false;
  let aiBatchTicker=null;
  const txFilter={q:'',type:'all',account:'all',month:'all'};
  let planMode='growth';
  let growthFilterV5='inspiration';
  let growthGoalFilterV1='active';
  let growthTimerV5=null;
  let plannerAlertOccurrence=null;
  let plannerReminderBusy=false;

  const AUTH_KEYS={
    session:'xqxAuthSession',user:'xqxAuthUser',mode:'xqxAuthMode',active:'xqxActiveProfile',lastSync:'xqxLastAccountSync'
  };
  const AUTH_PROFILE_PREFIX='xqxProfile:';
  let authSessionToken=localStorage.getItem(AUTH_KEYS.session)||'';
  let authUser=readStoredJson(AUTH_KEYS.user,null);
  let authMode=authSessionToken&&authUser&&authUser.id?'account':(localStorage.getItem(AUTH_KEYS.mode)||'new');
  let authBusy=false;
  let authSessionVersion=0;
  let authProfileWriteSuspended=false;
  let selectedAuthAvatar='🍓';
  let cuteConfirmActionV2=null;
  let autoSyncTimerV2=null;
  let autoSyncPendingV2=false;

  const CUTE_THEMES=[
    {id:'strawberry',name:'草莓奶昔',note:'甜甜元气',icon:'heart',main:'#ff7197',accent:'#ff9eb2',a:'#fff3f7',b:'#f8f1ff',pattern:'✿'},
    {id:'peach',name:'蜜桃气泡',note:'温柔暖橙',icon:'sun',main:'#ff8d70',accent:'#ffb37d',a:'#fff5ef',b:'#fff0f4',pattern:'♡'},
    {id:'mint',name:'薄荷兔兔',note:'清爽治愈',icon:'rabbit',main:'#46bfa4',accent:'#7bd6c2',a:'#effcf8',b:'#f3f7ff',pattern:'❀'},
    {id:'lavender',name:'葡萄独角兽',note:'梦幻软紫',icon:'spark',main:'#9575de',accent:'#c08dea',a:'#f8f3ff',b:'#f1f5ff',pattern:'✦'},
    {id:'ocean',name:'海盐鲸鱼',note:'清透蓝调',icon:'waves',main:'#4ca5e8',accent:'#76c8e8',a:'#eff9ff',b:'#f2f3ff',pattern:'⌁'},
    {id:'honey',name:'蜂蜜小熊',note:'温暖奶油',icon:'gift',main:'#d99b2b',accent:'#efbe63',a:'#fff9e9',b:'#fff3e9',pattern:'✺'},
    {id:'premium-moon-cat',name:'月光猫咖',note:'夜色猫爪与月光',icon:'moon',main:'#7768d8',accent:'#d2a8ff',a:'#f3f0ff',b:'#eaf5ff',pattern:'☾',premium:true},
    {id:'premium-sakura-post',name:'樱花邮局',note:'寄出一封春日信',icon:'mail',main:'#ec6f9f',accent:'#ffb7c9',a:'#fff0f6',b:'#fff8ed',pattern:'〒',premium:true},
    {id:'premium-forest-spirit',name:'森林精灵',note:'叶影、蘑菇与萤火',icon:'leaf',main:'#3d9a73',accent:'#9bcb72',a:'#eef9f0',b:'#fff8dc',pattern:'✿',premium:true},
    {id:'premium-caramel-pudding',name:'奶油布丁',note:'焦糖色的软绵午后',icon:'cake',main:'#c98b39',accent:'#f0c86e',a:'#fff9e8',b:'#fff1df',pattern:'⌁',premium:true},
    {id:'premium-cloud-sheep',name:'云朵绵羊',note:'天空、绒毛与好梦',icon:'cloud',main:'#669fd6',accent:'#b2d9ef',a:'#eef8ff',b:'#f6f0ff',pattern:'☁',premium:true},
    {id:'premium-galaxy-unicorn',name:'银河独角兽',note:'星河流光限定款',icon:'spark',main:'#7651c9',accent:'#ee79c9',a:'#f5efff',b:'#eaf2ff',pattern:'✦',premium:true},
    {id:'premium-sea-jellyfish',name:'海盐水母',note:'透明海浪与微光',icon:'waves',main:'#348fc2',accent:'#66d5ca',a:'#ebfbff',b:'#edf3ff',pattern:'≈',premium:true},
    {id:'premium-black-gold-cat',name:'黑金招财猫',note:'低调好运与金箔',icon:'money',main:'#9d722b',accent:'#e5bd62',a:'#171512',b:'#252016',pattern:'✶',premium:true,darkPreferred:true},
    {id:'premium-gingerbread',name:'圣诞姜饼屋',note:'冬日糖霜限定款',icon:'home',main:'#b74945',accent:'#4e9d73',a:'#fff4ec',b:'#eef8f1',pattern:'❄',premium:true},
    {id:'premium-koi-new-year',name:'新年锦鲤',note:'红金好彩头限定款',icon:'fish',main:'#d8423c',accent:'#e6ad39',a:'#fff0e8',b:'#fff8d9',pattern:'福',premium:true},
    {id:'premium-zodiac-golden-dragon',name:'金龙献瑞',note:'祥龙腾云，金彩纳福',icon:'flame',main:'#b53430',accent:'#d7a23d',a:'#fff3df',b:'#fff9dc',pattern:'龙',premium:true},
    {id:'premium-zodiac-jade-rabbit',name:'玉兔望月',note:'玉色月华与桂影',icon:'rabbit',main:'#4f8d78',accent:'#b995c9',a:'#effaf6',b:'#f7f0fb',pattern:'月',premium:true},
    {id:'premium-dunhuang-flying-apsara',name:'敦煌飞天',note:'飞天飘带与千年壁画',icon:'wind',main:'#b65d3c',accent:'#d2a643',a:'#fff2df',b:'#f7ead4',pattern:'飞',premium:true},
    {id:'premium-blue-white-porcelain',name:'青花瓷韵',note:'青花缠枝与温润瓷白',icon:'vase',main:'#2e6095',accent:'#72a8c7',a:'#eef7fb',b:'#fafbf6',pattern:'瓷',premium:true}
  ];
  const PREMIUM_THEME_IDS=new Set(CUTE_THEMES.filter(x=>x.premium).map(x=>x.id));
  const ENTITLEMENT_LABELS={'ai.receipt':'AI 单张识票','ai.batch_receipt':'AI 批量识票','ai.voice':'AI 语音记账','ai.writing':'AI 灵感与日记','theme.premium':'14 个限定主题'};
  let membershipStateV3={loaded:false,catalogLoaded:false,user:null,subscription:null,entitlements:{},usage:{},plans:[],themes:[],featureFlags:{},aiStatus:null,fetchedAt:0};
  let paywallResumeV3=null;
  let selectedPaymentPlanIndexV4=-1;
  let paymentCatalogVerifiedAtV4=0;
  let paymentCatalogLoadingV4=false;
  let paymentCatalogErrorV4='';
  const MEMBER_CONTACT_WECHAT_V4='NJYX9818';
  const MEMBERSHIP_FRESH_MS_V4=5*60*1000;

  const coreSave=save;
  const coreApplyTheme=applyTheme;
  const coreApplyRemote=applyRemote;
  const coreCollectState=collectState;
  const coreOpenSettings=openSettings;
  const coreOpenDay=openDay;
  const corePerformLedgerDelete=performLedgerDelete;
  const coreDeleteTx=deleteTx;
  const coreApiAuth=apiAuth;
  const coreAppendApiAuth=appendApiAuth;
  const coreDoSync=doSync;
  const coreShareLedger=shareLedger;
  const coreJoinLedger=joinLedger;

  apiAuth=function(extra){
    const payload=coreApiAuth(extra);
    if(authSessionToken)payload.sessionToken=authSessionToken;
    return payload;
  };
  appendApiAuth=function(fd){coreAppendApiAuth(fd);if(authSessionToken)fd.append('sessionToken',authSessionToken);};

  function entitlementEnabledV3(value){
    if(value===true)return true;
    if(typeof value==='number')return value>0;
    if(!value||typeof value!=='object')return false;
    if(value.enabled===false||value.active===false||value.granted===false)return false;
    return value.enabled===true||value.active===true||value.granted===true||Number(value.limit)>0||Number(value.remaining)>0;
  }
  function entitlementCacheKeyV3(){return 'xqxPremiumEntitlements:'+(authUser&&authUser.id||'guest');}
  function readThemeEntitlementCacheV3(){
    return false;
  }
  function membershipSubscriptionWindowValidV4(){
    const s=membershipStateV3.subscription;if(!s)return true;
    if(['expired','cancelled','canceled','inactive','suspended'].includes(String(s.status||'').toLowerCase()))return false;
    const raw=s.endsAt||s.endAt||s.expiresAt;if(!raw)return true;
    const expires=new Date(raw).getTime();return Number.isFinite(expires)&&expires>Date.now();
  }
  function hasEntitlementV3(key){
    if(authMode!=='account'||!authUser||!authUser.id)return false;
    const stateUserId=membershipStateV3.user&&membershipStateV3.user.id;
    const stateFresh=stateUserId===authUser.id&&Date.now()-Number(membershipStateV3.fetchedAt||0)<=MEMBERSHIP_FRESH_MS_V4;
    if(stateFresh&&membershipSubscriptionWindowValidV4()&&entitlementEnabledV3(membershipStateV3.entitlements&&membershipStateV3.entitlements[key]))return true;
    return key==='theme.premium'&&readThemeEntitlementCacheV3();
  }
  function publicFeatureEnabledV3(key){
    const flag=membershipStateV3.featureFlags&&membershipStateV3.featureFlags[key];
    return !flag||flag.enabled!==false;
  }
  function aiFeatureAvailableV3(){return publicFeatureEnabledV3('paid_ai');}
  function themePublishedV3(id){
    if(PREMIUM_THEME_IDS.has(id)&&!publicFeatureEnabledV3('premium_themes'))return false;
    return !membershipStateV3.catalogLoaded||(membershipStateV3.themes||[]).some(item=>item&&item.id===id&&item.enabled!==false);
  }
  function usageSummaryV3(key){
    const raw=membershipStateV3.usage&&membershipStateV3.usage[key]||{};
    const used=Number(raw.used??raw.count??0),limit=Number(raw.limit??raw.monthlyLimit??0),remaining=Number(raw.remaining??(limit?Math.max(0,limit-used):0));
    return {used,limit,remaining};
  }
  async function membershipFetchV3(path,extra={}){
    const response=await fetch(authBaseV2()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth(extra))});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||data.detail||('会员服务返回 HTTP '+response.status));error.status=response.status;error.code=data.code||'';throw error;}
    return data;
  }
  async function refreshMembershipV3(silent=true){
    try{
      const data=await membershipFetchV3('/api/bootstrap');
      membershipStateV3=Object.assign({loaded:true,catalogLoaded:true,user:null,subscription:null,entitlements:{},usage:{},plans:[],themes:[],featureFlags:{},aiStatus:null,fetchedAt:Date.now()},data||{},{loaded:true,catalogLoaded:true,fetchedAt:Date.now()});
      if(authMode==='account'&&authUser&&authUser.id)localStorage.removeItem(entitlementCacheKeyV3());
      if(PREMIUM_THEME_IDS.has(theme.preset)&&(!hasEntitlementV3('theme.premium')||!themePublishedV3(theme.preset))){theme.preset='strawberry';theme.color=CUTE_THEMES[0].main;localStorage.setItem('theme',JSON.stringify(theme));applyTheme();renderCurrent();if(!silent)toast('当前限定主题暂不可用，已切回免费主题',4500);}
      renderMembershipUiV3();renderThemeUI();return membershipStateV3;
    }catch(error){
      membershipStateV3.loaded=true;renderMembershipUiV3();if(!silent)toast('会员状态暂时无法刷新：'+(error.message||error),4500);return membershipStateV3;
    }
  }
  function subscriptionActiveV3(){
    const stateUserId=membershipStateV3.user&&membershipStateV3.user.id;
    if(authMode!=='account'||!authUser||stateUserId!==authUser.id||Date.now()-Number(membershipStateV3.fetchedAt||0)>MEMBERSHIP_FRESH_MS_V4)return false;
    const s=membershipStateV3.subscription;if(!s)return false;
    return !['expired','cancelled','canceled','inactive','suspended'].includes(String(s.status||'').toLowerCase())&&(!s.endsAt&&!s.endAt&&!s.expiresAt||new Date(s.endsAt||s.endAt||s.expiresAt).getTime()>Date.now());
  }
  function subscriptionTrialV4(){const s=membershipStateV3.subscription||{};return subscriptionActiveV3()&&(s.isTrial===true||String(s.source||'').toLowerCase()==='trial'||String(s.planId||'').startsWith('trial_'));}
  function formatSubscriptionDateV3(){
    const s=membershipStateV3.subscription||{},raw=s.endsAt||s.endAt||s.expiresAt;if(!raw)return subscriptionActiveV3()?'长期有效':'尚未开通';
    const d=new Date(raw);return Number.isNaN(d.getTime())?'尚未开通':d.toLocaleDateString('zh-CN');
  }
  function planPriceV3(plan){const cents=Number(plan.priceCents??plan.amountCents??0);return cents>0?'¥'+(cents/100).toFixed(cents%100?2:0):'后台开通';}
  function paymentCatalogReadyV4(){
    const stateUserId=membershipStateV3.user&&membershipStateV3.user.id;
    if(authMode!=='account'||!authUser||stateUserId!==authUser.id||!membershipStateV3.catalogLoaded)return false;
    if(paymentCatalogVerifiedAtV4!==Number(membershipStateV3.fetchedAt||0)||Date.now()-paymentCatalogVerifiedAtV4>2*60*1000)return false;
    return (membershipStateV3.plans||[]).some(plan=>plan&&plan.active!==false&&plan.enabled!==false&&Number(plan.priceCents??plan.amountCents)>0);
  }
  function paymentPlansV4(){
    if(!paymentCatalogReadyV4())return [];
    return (membershipStateV3.plans||[]).filter(plan=>plan&&plan.active!==false&&plan.enabled!==false&&Number(plan.priceCents??plan.amountCents)>0);
  }
  function paymentPlanBadgeV4(plan){const days=Number(plan.durationDays||0);return days>=360?'最划算':days>=80&&days<360?'热门':'';}
  function paymentPlanPeriodV4(plan){const days=Number(plan.durationDays||0);return days>=360?'约 12 个月':days>=80?'约 3 个月':days>0?days+' 天':'以后台为准';}
  function selectedPaymentPlanV4(){const plans=paymentPlansV4();return plans[selectedPaymentPlanIndexV4]||plans[0]||null;}
  function updatePaymentSelectionV4(){
    const plan=selectedPaymentPlanV4(),label=plan?`${plan.name||'会员套餐'} ${planPriceV3(plan)}`:'请先选择套餐';
    document.querySelectorAll('[data-payment-selection-v4]').forEach(node=>{node.textContent=label;});
    const identity=document.getElementById('member_payment_identity_v4');
    if(identity)identity.innerHTML=authMode==='account'&&authUser?`开通账号：<b>${esc(authUser.email||authUser.displayName||'当前登录账号')}</b><br>付款后请把这个注册邮箱和套餐名称一起发给微信。`:'<b>请先用邮箱注册账号再付款</b><br>注册即送 3 天体验，付款时需要提供注册邮箱才能人工开通。';
  }
  function renderPaymentPlansV4(resetSelection=false){
    const plans=paymentPlansV4(),box=document.getElementById('member_payment_plans_v4');if(!box)return;
    const checkout=document.getElementById('member_payment_checkout_v4'),unavailable=document.getElementById('member_payment_unavailable_v4'),register=document.getElementById('member_payment_register_v4');
    const ready=paymentCatalogReadyV4();if(register)register.hidden=authMode==='account';
    if(!ready){
      selectedPaymentPlanIndexV4=-1;box.innerHTML='<div class="member-payment-plan-empty-v4">套餐价格需要联网登录后实时获取。</div>';if(checkout)checkout.hidden=true;
      if(unavailable){unavailable.hidden=false;unavailable.innerHTML=authMode!=='account'?'<b>请先注册或登录</b><span>注册即送 3 天体验；登录并在线读取最新套餐、金额和收款码后才能付款。</span>':paymentCatalogLoadingV4?'<b>正在在线核对最新价格与收款码…</b><span>完成前请不要付款。</span>':`<b>付款服务暂不可用，请不要付款</b><span>${esc(paymentCatalogErrorV4||'无法在线确认最新套餐或收款信息，请恢复网络后重试。')}</span>`;}
      document.querySelectorAll('[data-payment-private-src-v4]').forEach(image=>image.removeAttribute('src'));updatePaymentSelectionV4();return;
    }
    if(checkout)checkout.hidden=false;if(unavailable)unavailable.hidden=true;
    document.querySelectorAll('[data-payment-private-src-v4]').forEach(image=>{if(!image.getAttribute('src'))image.setAttribute('src',image.dataset.paymentPrivateSrcV4);});
    if(resetSelection||selectedPaymentPlanIndexV4<0||selectedPaymentPlanIndexV4>=plans.length){const quarter=plans.findIndex(plan=>Number(plan.durationDays)>=80&&Number(plan.durationDays)<360);selectedPaymentPlanIndexV4=quarter>=0?quarter:0;}
    box.innerHTML=plans.map((plan,index)=>`<button type="button" class="member-payment-plan-v4 ${index===selectedPaymentPlanIndexV4?'on':''}" data-plan-index="${index}" aria-pressed="${index===selectedPaymentPlanIndexV4?'true':'false'}" onclick="selectMemberPaymentPlanV4(${index})"><b>${esc(plan.name||'限定会员')}</b><strong><i>¥</i>${(Number(plan.priceCents??plan.amountCents??0)/100).toFixed(2)}</strong><small>${esc(paymentPlanPeriodV4(plan))}</small>${paymentPlanBadgeV4(plan)?`<em>${paymentPlanBadgeV4(plan)}</em>`:''}</button>`).join('');
    updatePaymentSelectionV4();
  }
  window.selectMemberPaymentPlanV4=function(index){if(!paymentCatalogReadyV4()){toast('请先联网登录并获取最新套餐');return;}selectedPaymentPlanIndexV4=Number(index);document.querySelectorAll('.member-payment-plan-v4').forEach((node,i)=>{const on=i===selectedPaymentPlanIndexV4;node.classList.toggle('on',on);node.setAttribute('aria-pressed',on?'true':'false');});updatePaymentSelectionV4();};
  window.switchMemberPaymentMethodV4=function(method){
    const next=method==='alipay'?'alipay':'wechat';
    document.querySelectorAll('.member-payment-method-v4').forEach(node=>{const on=node.dataset.method===next;node.classList.toggle('on',on);node.setAttribute('aria-selected',on?'true':'false');});
    document.querySelectorAll('.member-payment-qr-v4').forEach(node=>{const on=node.dataset.methodPanel===next;node.classList.toggle('on',on);node.hidden=!on;});
  };
  async function copyPaymentTextV4(text){
    try{await navigator.clipboard.writeText(text);return true;}catch(_){
      const input=document.createElement('textarea');input.value=text;input.setAttribute('readonly','');input.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(input);input.select();let ok=false;try{ok=document.execCommand('copy');}catch(__){}input.remove();return ok;
    }
  }
  window.copyMemberWechatV4=async function(){if(!paymentCatalogReadyV4()){paymentCatalogErrorV4='在线核对已过期，请重新打开付款页。';renderPaymentPlansV4(false);toast('请先联网刷新最新套餐和收款信息，不要按旧信息付款',5500);return;}const ok=await copyPaymentTextV4(MEMBER_CONTACT_WECHAT_V4);toast(ok?'微信号已复制：'+MEMBER_CONTACT_WECHAT_V4+'，请发送付款截图、注册邮箱和所选套餐':'复制失败，请手动记下微信号：'+MEMBER_CONTACT_WECHAT_V4,6500);};
  window.memberPaymentRegisterV4=function(){hideMask('maskMemberPaymentV4');openAuthGateV2('register');};
  async function verifyPaymentCatalogV4(silent=true){
    paymentCatalogVerifiedAtV4=0;paymentCatalogErrorV4='';
    if(authMode!=='account'||!authUser){paymentCatalogLoadingV4=false;renderPaymentPlansV4(false);return false;}
    paymentCatalogLoadingV4=true;renderPaymentPlansV4(false);const startedAt=Date.now();const state=await refreshMembershipV3(silent);paymentCatalogLoadingV4=false;
    const matched=state&&state.catalogLoaded&&state.user&&state.user.id===authUser.id&&Number(state.fetchedAt||0)>=startedAt;
    const active=matched&&(state.plans||[]).some(plan=>plan&&plan.active!==false&&plan.enabled!==false&&Number(plan.priceCents??plan.amountCents)>0);
    if(matched&&active){paymentCatalogVerifiedAtV4=Number(state.fetchedAt);paymentCatalogErrorV4='';const verifiedAt=paymentCatalogVerifiedAtV4;setTimeout(()=>{if(paymentCatalogVerifiedAtV4===verifiedAt&&Date.now()-verifiedAt>2*60*1000){paymentCatalogErrorV4='在线核对已过期，请重新打开付款页。';renderPaymentPlansV4(false);}},121000);}else paymentCatalogErrorV4=matched?'当前没有可购买的在线套餐，请联系人工客服。':'无法在线确认账号、套餐或收款信息。';
    renderPaymentPlansV4(true);return paymentCatalogReadyV4();
  }
  window.refreshPaymentEntitlementV4=async function(){
    if(authMode!=='account'){toast('请先注册或登录邮箱账号，注册即送 3 天会员体验',5000);memberPaymentRegisterV4();return;}
    await verifyPaymentCatalogV4(false);
    if(subscriptionActiveV3()||hasEntitlementV3('theme.premium')||hasEntitlementV3('ai.receipt')){hideMask('maskMemberPaymentV4');toast('会员权益已到账 ✓',4500);}else toast('暂未到账：人工审核不是自动到账，请勿重复付款，可微信联系 '+MEMBER_CONTACT_WECHAT_V4,6500);
  };
  window.openMemberPaymentV4=function(){
    hideMask('maskPaywallV3');paymentCatalogVerifiedAtV4=0;paymentCatalogErrorV4='';paymentCatalogLoadingV4=authMode==='account';renderPaymentPlansV4(true);switchMemberPaymentMethodV4('wechat');showMask('maskMemberPaymentV4');
    if(authMode==='account')verifyPaymentCatalogV4(true);
  };
  function renderMembershipUiV3(){
    const member=subscriptionActiveV3()||hasEntitlementV3('theme.premium')||hasEntitlementV3('ai.receipt');
    const trial=subscriptionTrialV4();
    const status=document.getElementById('member_status_card_v3');
    if(status){
      const ai=usageSummaryV3('ai.receipt'),label=authMode!=='account'?'游客免费版':member?(trial?'3 天体验会员':'限定会员'):'注册免费版';
      status.className='member-status-card-v3 '+(member?'is-member':'');status.innerHTML=`<span class="member-crown-v3">${trial?'🎁':member?'👑':authMode==='account'?'🌱':'👋'}</span><div><b>${label}</b><small>${authMode!=='account'?'基础记账可直接使用；AI 与限定主题需注册开通':member?(trial?'体验有效期至 ':'有效期至 ')+formatSubscriptionDateV3()+(ai.limit?' · AI 剩余 '+ai.remaining+' 次':''): '云同步已开启；AI 与限定主题尚未开通'}</small></div><button type="button" onclick="openMemberCenterV3()">${member?'查看权益':'了解会员'}</button>`;
    }
    const center=document.getElementById('member_center_body_v3');if(center){
      const aiReceipt=usageSummaryV3('ai.receipt'),aiBatch=usageSummaryV3('ai.batch_receipt'),memberLabel=authMode!=='account'?'游客模式':subscriptionActiveV3()?(trial?'3 天体验会员':'限定会员'):'注册免费用户';
      center.innerHTML=`<div class="member-hero-v3"><span>${trial?'🎁':subscriptionActiveV3()?'👑':'🌷'}</span><div><small>当前身份</small><b>${memberLabel}</b><p>${subscriptionActiveV3()?(trial?'3 天体验有效期至 ':'会员有效期至 ')+formatSubscriptionDateV3():authMode==='account'?'管理员开通后立即生效':'不注册也能使用手动记账、借还、计划与导出'}</p></div></div>
        <div class="member-benefits-v3"><div class="${hasEntitlementV3('ai.receipt')?'owned':''}">🧾<b>AI 单张识票</b><span>${hasEntitlementV3('ai.receipt')?(aiReceipt.limit?'剩余 '+aiReceipt.remaining+' / '+aiReceipt.limit+' 次':'已开通'):'未开通'}</span></div><div class="${hasEntitlementV3('ai.batch_receipt')?'owned':''}">✨<b>AI 批量识票</b><span>${hasEntitlementV3('ai.batch_receipt')?(aiBatch.limit?'剩余 '+aiBatch.remaining+' / '+aiBatch.limit+' 次':'已开通'):'未开通'}</span></div><div class="${hasEntitlementV3('ai.voice')?'owned':''}">🎤<b>AI 语音记账</b><span>${hasEntitlementV3('ai.voice')?'已开通':'未开通'}</span></div><div class="${hasEntitlementV3('ai.writing')?'owned':''}">💡<b>AI 灵感与日记</b><span>${hasEntitlementV3('ai.writing')?(usageSummaryV3('ai.writing').limit?'剩余 '+usageSummaryV3('ai.writing').remaining+' / '+usageSummaryV3('ai.writing').limit+' 次':'已开通'):'未开通'}</span></div><div class="${hasEntitlementV3('theme.premium')?'owned':''}">🎨<b>14 个限定主题</b><span>${hasEntitlementV3('theme.premium')?'全部可用':'可预览'}</span></div></div>
        <div class="member-plan-list-v3">${(membershipStateV3.plans||[]).filter(p=>p&&p.active!==false&&p.enabled!==false).map(p=>`<div><span><b>${esc(p.name||p.title||'限定会员')}</b><small>${esc(p.description||p.note||'AI 识别与限定主题')}</small></span><strong>${planPriceV3(p)}</strong></div>`).join('')||'<div><span><b>会员套餐由管理员配置</b><small>当前采用手动收款和手动开通</small></span><strong>筹备中</strong></div>'}</div>
        <div class="member-manual-note-v3">🎁 新用户邮箱注册成功即送 3 天会员体验；体验到期不会自动续费或扣款。</div>
        <button type="button" class="member-pay-entry-v4" onclick="openMemberPaymentV4()">💳 查看价格与扫码开通</button>`;
    }
    const service=document.getElementById('platform_ai_summary_v3');if(service){const online=membershipStateV3.aiStatus&&membershipStateV3.aiStatus.online;service.className='platform-ai-summary-v3 '+(online?'online':membershipStateV3.aiStatus?'offline':'pending');service.innerHTML=`<i></i><span><b>${online?'平台 AI 在线':membershipStateV3.aiStatus?'平台 AI 暂不可用':'正在检查平台 AI'}</b><small>${authMode!=='account'?'注册并开通会员后可使用':hasEntitlementV3('ai.receipt')?'你的 AI 权益已开通':'当前账号尚未开通 AI 权益'}</small></span><button type="button" onclick="openMemberCenterV3()">会员与额度</button>`;}
    const paymentMask=document.getElementById('maskMemberPaymentV4');if(paymentMask&&paymentMask.classList.contains('show'))renderPaymentPlansV4(false);
  }
  window.openMemberCenterV3=function(){renderMembershipUiV3();showMask('maskMemberCenterV3');refreshMembershipV3(true);};
  window.refreshMemberCenterV3=function(){refreshMembershipV3(false);};
  window.openMemberPaywallV3=function(feature='ai.receipt',themeId=''){
    const box=document.getElementById('paywall_content_v3'),item=CUTE_THEMES.find(x=>x.id===themeId),label=ENTITLEMENT_LABELS[feature]||'限定会员功能';
    if(box)box.innerHTML=`<div class="paywall-art-v3">${item?item.emoji:feature==='theme.premium'?'🎨':'✨'}<i>✦</i></div><h3>${item?'解锁「'+esc(item.name)+'」':esc(label)}</h3><p>${authMode!=='account'?'基础功能无需注册；仅 AI 和限定主题需要邮箱注册并由管理员开通。':'这个账号还没有对应会员权益。管理员完成手动开通后，点“刷新权益”即可使用。'}</p>${item?`<div class="paywall-theme-preview-v3" style="--p-a:${item.main};--p-b:${item.accent}"><span>${item.pattern}</span><b>${esc(item.name)}</b><small>${esc(item.note)}</small></div>`:''}`;
    document.getElementById('paywall_login_v3').style.display=authMode==='account'?'none':'block';const refresh=document.getElementById('paywall_refresh_v3');refresh.style.display=authMode==='account'?'block':'none';refresh.dataset.feature=feature;showMask('maskPaywallV3');
  };
  window.requireEntitlementV3=function(feature,resumeAction,themeId=''){
    if(feature==='theme.premium'&&!publicFeatureEnabledV3('premium_themes')){paywallResumeV3=null;toast('限定主题正在维护，暂时不能切换',4500);return false;}
    if(feature.startsWith('ai.')&&!aiFeatureAvailableV3()){paywallResumeV3=null;toast('平台 AI 正在维护，请稍后再试',4500);return false;}
    if(hasEntitlementV3(feature)){if(typeof resumeAction==='function')resumeAction();return true;}
    paywallResumeV3=typeof resumeAction==='function'?resumeAction:null;openMemberPaywallV3(feature,themeId);return false;
  };
  window.paywallLoginV3=function(){hideMask('maskPaywallV3');openAuthGateV2('register');};
  window.paywallRefreshV3=async function(){await refreshMembershipV3(false);const feature=document.getElementById('paywall_refresh_v3').dataset.feature;if(!feature||hasEntitlementV3(feature)){const fn=paywallResumeV3;paywallResumeV3=null;hideMask('maskPaywallV3');if(fn)fn();}else toast('暂未查到这项权益，请确认管理员已开通当前账号',4500);};
  function requireAccountV3(action){if(authMode==='account'&&authUser&&authSessionToken){action();return true;}toast('云同步和共享免费开放，请先注册或登录邮箱账号',4500);openAuthGateV2('register');return false;}
  doSync=function(){requireAccountV3(()=>coreDoSync());};
  shareLedger=function(id){requireAccountV3(()=>coreShareLedger(id));};
  joinLedger=function(){requireAccountV3(()=>coreJoinLedger());};

  function saveFeatureData(showError=true){
    try{
      localStorage.setItem(FEATURE_KEYS.accounts,JSON.stringify(financeAccounts));
      localStorage.setItem(FEATURE_KEYS.categories,JSON.stringify(customCategories));
      localStorage.setItem(FEATURE_KEYS.budgets,JSON.stringify(budgets));
      localStorage.setItem(FEATURE_KEYS.recurring,JSON.stringify(recurringRules));
      localStorage.setItem(FEATURE_KEYS.plans,JSON.stringify(personalPlans));
      localStorage.setItem(FEATURE_KEYS.repaymentPlans,JSON.stringify(repaymentPlans));
      localStorage.setItem(FEATURE_KEYS.plannerPrefs,JSON.stringify(plannerPrefs));
      localStorage.setItem(FEATURE_KEYS.goals,JSON.stringify(growthGoals));
      localStorage.setItem(FEATURE_KEYS.inspirations,JSON.stringify(growthInspirations));
      localStorage.setItem(FEATURE_KEYS.diaries,JSON.stringify(growthDiaries));
      localStorage.setItem(FEATURE_KEYS.focusSessions,JSON.stringify(growthFocusSessions));
      localStorage.setItem(FEATURE_KEYS.focusPrefs,JSON.stringify(growthFocusPrefs));
      localStorage.setItem('schemaVersion','7');
      return true;
    }catch(_){if(showError)toast('保存失败：本机存储空间不足，请先导出完整备份',4500);return false;}
  }
  save=function(showError=true){
    const ok=coreSave(showError)&&saveFeatureData(showError);
    if(ok&&!authProfileWriteSuspended)persistActiveProfileV2();
    if(ok&&showError)scheduleAutoSyncV2();
    return ok;
  };

  function scheduleAutoSyncV2(delay=900){
    if(!(authMode==='account'||liveLedgers().some(l=>l.shared))||!syncUrl)return;
    autoSyncPendingV2=true;clearTimeout(autoSyncTimerV2);autoSyncTimerV2=setTimeout(async()=>{
      if(!autoSyncPendingV2)return;try{await exchangeSyncState();autoSyncPendingV2=false;}catch(_){autoSyncTimerV2=setTimeout(()=>scheduleAutoSyncV2(900),20000);}
    },delay);
  }
  window.cuteConfirmV2=function(options,action){
    const o=typeof options==='string'?{text:options}:options||{};cuteConfirmActionV2=typeof action==='function'?action:null;
    document.getElementById('cute_confirm_icon_v2').textContent=o.icon||'🗑️';document.getElementById('cute_confirm_title_v2').textContent=o.title||'请确认';document.getElementById('cute_confirm_text_v2').textContent=o.text||'';document.getElementById('cute_confirm_ok_v2').textContent=o.okText||'确认';showMask('maskCuteConfirmV2');
  };
  window.cancelCuteConfirmV2=function(){cuteConfirmActionV2=null;hideMask('maskCuteConfirmV2');};
  window.acceptCuteConfirmV2=function(){const action=cuteConfirmActionV2;cuteConfirmActionV2=null;hideMask('maskCuteConfirmV2');if(action)action();};

  function liveAccounts(){return active(financeAccounts).filter(a=>a.ledger===currentLedger&&!a.archived);}
  function ledgerCategories(type){
    const base=(type==='in'?CATS_IN:CATS_OUT).map(c=>({name:c.k,emoji:c.e,color:CAT_COLOR[c.k]||theme.color,builtin:true}));
    const extra=active(customCategories).filter(c=>c.ledger===currentLedger&&c.type===type).map(c=>({name:c.name,emoji:c.emoji||'✨',color:c.color||theme.color,id:c.id}));
    const seen=new Set();return [...base,...extra].filter(c=>{if(seen.has(c.name))return false;seen.add(c.name);return true;});
  }
  function findAccountById(id){return liveAccounts().find(a=>a.id===id);}
  function findAccountForTx(t){return findAccountById(t.accountId)||liveAccounts().find(a=>a.name===t.account);}
  function accountBalance(a){
    let n=Number(a.openingBalance)||0;
    inLedger(transactions).forEach(t=>{
      if(t.type==='transfer'){
        if(t.fromAccountId===a.id)n-=Number(t.amount)||0;
        if(t.toAccountId===a.id)n+=Number(t.amount)||0;
        return;
      }
      if(t.type==='debt_in'||t.type==='debt_out'){
        if(t.accountId===a.id)n+=(t.type==='debt_in'?1:-1)*(Number(t.amount)||0);
        return;
      }
      const matched=t.accountId===a.id||(!t.accountId&&t.account===a.name);
      if(matched)n+=(t.type==='in'?1:-1)*(Number(t.amount)||0);
    });
    return n;
  }
  function typeLabel(t){return t==='in'?'收入':t==='out'?'支出':t==='transfer'?'转账':t==='debt_in'?'借还入账':t==='debt_out'?'借还出账':'其他';}
  function typeSymbol(t){return t==='in'||t==='debt_in'?'+':t==='out'||t==='debt_out'?'-':'';}
  function txCategoryColor(k){const extra=active(customCategories).find(c=>c.name===k);return (extra&&extra.color)||CAT_COLOR[k]||'#8a9099';}

  function ensureFeatureData(){
    const defaults=[['现金','👛'],['微信','💚'],['支付宝','💙'],['储蓄卡','💳'],['信用卡','💸'],['花呗','🌸'],['其他','📦']];
    liveLedgers().forEach(l=>{
      const has=active(financeAccounts).some(a=>a.ledger===l.id);
      if(!has)defaults.forEach(([name,emoji],i)=>financeAccounts.push({id:'ac_'+uid(),ledger:l.id,owner:deviceId,name,emoji,openingBalance:0,order:i,createdAt:Date.now(),updatedAt:Date.now()}));
    });
    transactions.forEach(t=>{
      if(isDeleted(t)||t.type==='transfer'||t.accountId)return;
      const a=active(financeAccounts).find(x=>x.ledger===t.ledger&&x.name===t.account);
      if(a){t.accountId=a.id;markUpdated(t);}
    });
    active(debts).forEach(normalizeDebtV2);
    active(customCategories).forEach(c=>{if(c.name)CAT_COLOR[c.name]=c.color||theme.color;});
    save(false);
  }

  applyTheme=function(){
    const requested=CUTE_THEMES.find(x=>x.id===(theme.preset||'strawberry'))||CUTE_THEMES[0];
    const preset=requested.premium&&(!hasEntitlementV3('theme.premium')||!themePublishedV3(requested.id))?CUTE_THEMES[0]:requested;
    if(theme.preset!=='custom')theme.color=preset.main;
    coreApplyTheme();
    const dark=theme.mode==='dark'||(theme.mode==='auto'&&isSystemDark());
    const r=document.documentElement.style;
    r.setProperty('--theme-accent',preset.main);
    r.setProperty('--theme-accent-2',preset.accent);
    r.setProperty('--theme-bg-a',dark?'#17131c':preset.a);
    r.setProperty('--theme-bg-b',dark?'#10141b':preset.b);
    r.setProperty('--theme-pattern',JSON.stringify(preset.pattern));
    document.body.dataset.cuteTheme=preset.id;
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme.color;
  };
  renderThemeUI=function(){
    document.querySelectorAll('#theme_mode div').forEach(d=>d.classList.toggle('on',d.dataset.m===theme.mode));
    const box=document.getElementById('theme_colors');
    box.className='theme-presets';
    const card=t=>{const locked=t.premium&&!hasEntitlementV3('theme.premium');return `<div class="theme-card ${(theme.preset||'strawberry')===t.id?'on':''} ${t.premium?'premium':''} ${locked?'locked':''}" onclick="setCuteTheme('${t.id}')">
      <span class="theme-dot" style="--theme-card-main:${t.main};--theme-card-accent:${t.accent};background:linear-gradient(145deg,${t.main},${t.accent})">${uiIconMarkupV1(t.icon,'theme-art-icon-v4')}</span>
      <span><span class="theme-name">${t.name}${t.premium?'<em>限定</em>':''}</span><span class="theme-note">${t.note}</span></span>${locked?'<i class="theme-lock-v3">🔒</i>':'<i class="theme-lock-v3 owned">✓</i>'}</div>`;};
    const premiumThemes=CUTE_THEMES.filter(t=>t.premium&&themePublishedV3(t.id));box.innerHTML=`<div class="theme-group-title-v3"><span>免费主题</span><small>无需登录，直接使用</small></div><div class="theme-grid-v3">${CUTE_THEMES.filter(t=>!t.premium).map(card).join('')}</div><div class="theme-group-title-v3 premium"><span>限定主题 · ${premiumThemes.length} 款</span><small>${hasEntitlementV3('theme.premium')?'已全部解锁':'可预览，会员解锁'}</small></div><div class="theme-grid-v3">${premiumThemes.map(card).join('')||'<div class="section-note">限定主题正在准备中</div>'}</div>`;
  };
  window.setCuteTheme=function(id){
    const p=CUTE_THEMES.find(x=>x.id===id);if(!p)return;
    if(p.premium&&!themePublishedV3(id)){toast('这个限定主题暂未上架');return;}if(p.premium&&!hasEntitlementV3('theme.premium')){requireEntitlementV3('theme.premium',()=>setCuteTheme(id),id);return;}
    theme.preset=id;theme.color=p.main;localStorage.setItem('theme',JSON.stringify(theme));applyTheme();renderThemeUI();renderCurrent();toast('已换成「'+p.name+'」');
  };

  function injectFeatureSheets(){
    document.body.insertAdjacentHTML('beforeend',`
      <div class="mask" id="maskTransfer"><div class="sheet"><h3>🔄 账户转账</h3>
        <div class="field"><label>转出账户</label><select id="tr_from" class="inp"></select></div>
        <div class="field"><label>转入账户</label><select id="tr_to" class="inp"></select></div>
        <div class="field"><label>转账金额（元）</label><input id="tr_amount" type="number" inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label>日期</label><input id="tr_date" type="date"></div>
        <div class="field"><label>备注（可选）</label><input id="tr_remark" placeholder="如：转入储蓄卡"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskTransfer')">取消</div><div class="btn btn-primary" onclick="submitTransfer()">确认转账</div></div>
      </div></div>
      <div class="mask" id="maskBudgetV2"><div class="sheet"><h3>🎯 设置月度预算</h3>
        <div class="field"><label>月份</label><input id="bu_month" type="month"></div>
        <div class="field"><label>预算范围</label><select id="bu_category" class="inp"></select></div>
        <div class="field"><label>预算金额（元）</label><input id="bu_amount" type="number" inputmode="decimal" placeholder="如：3000"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskBudgetV2')">取消</div><div class="btn btn-primary" onclick="submitBudget()">保存预算</div></div>
      </div></div>
      <div class="mask" id="maskRecurring"><div class="sheet"><h3 id="rr_sheet_title">🗓️ 新建周期账单</h3><input id="rr_id" type="hidden">
        <div class="seg" id="rr_type"><div class="on" data-v="out" onclick="pickRuleType('out')">支出</div><div data-v="in" onclick="pickRuleType('in')">收入</div></div>
        <div class="field" style="margin-top:14px"><label>名称</label><input id="rr_name" placeholder="如：每月房租"></div>
        <div class="field"><label>金额（元）</label><input id="rr_amount" type="number" inputmode="decimal" placeholder="0.00"></div>
        <div class="field"><label>分类</label><select id="rr_category" class="inp"></select></div>
        <div class="field"><label>账户</label><select id="rr_account" class="inp"></select></div>
        <div class="field"><label>重复周期</label><select id="rr_cadence" class="inp"><option value="monthly">每月</option><option value="weekly">每周</option></select></div>
        <div class="field"><label>下一次日期</label><input id="rr_next" type="date"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskRecurring')">取消</div><div class="btn btn-primary" id="rr_save_btn" onclick="submitRecurring()">保存计划</div></div>
      </div></div>
      <div class="mask" id="maskPersonalPlanV2"><div class="sheet planner-editor"><h3 id="pp_sheet_title">🌤️ 新建个人计划</h3>
        <input id="pp_id" type="hidden">
        <div class="field"><label>计划名称</label><input id="pp_title" maxlength="60" placeholder="如：健身跑步、开发项目、早点睡觉"></div>
        <div class="field"><label>计划分类</label><div class="planner-category-grid" id="pp_categories"></div></div>
        <div class="field"><label>优先级</label><div class="planner-priority-grid" id="pp_priorities" role="radiogroup" aria-label="计划优先级"></div><small class="planner-priority-hint" id="pp_priority_hint"></small></div>
        <div class="field"><label>日期</label><input id="pp_date" type="date"></div>
        <div class="field-row2"><div class="field"><label>开始时间</label><input id="pp_start" type="time"></div><div class="field"><label>结束时间</label><input id="pp_end" type="time"></div></div>
        <div class="field-row2"><div class="field"><label>提醒</label><select id="pp_remind" class="inp"><option value="0">准时提醒</option><option value="5">提前 5 分钟</option><option value="15">提前 15 分钟</option><option value="30">提前 30 分钟</option><option value="60">提前 1 小时</option><option value="-1">不提醒</option></select></div><div class="field"><label>重复</label><select id="pp_repeat" class="inp" onchange="updatePersonalPlanRepeatUi()"><option value="none">仅一次</option><option value="daily">每天</option><option value="weekdays">工作日</option><option value="weekly">每周</option><option value="custom">自定义星期</option></select></div></div>
        <div class="field" id="pp_repeat_days_field" style="display:none"><label>重复星期</label><div class="planner-weekdays" id="pp_repeat_days"><span data-day="1">一</span><span data-day="2">二</span><span data-day="3">三</span><span data-day="4">四</span><span data-day="5">五</span><span data-day="6">六</span><span data-day="0">日</span></div></div>
        <div class="field" id="pp_repeat_until_field" style="display:none"><label>重复结束日期（可不填）</label><input id="pp_repeat_until" type="date"></div>
        <div class="field"><label>详细备忘</label><textarea id="pp_note" rows="3" maxlength="500" placeholder="记录地点、目标、准备事项或其他备注"></textarea></div>
        <div class="planner-conflict" id="pp_conflict" style="display:none"></div>
        <div class="planner-notify-hint" id="pp_notify_hint"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskPersonalPlanV2')">取消</div><div class="btn btn-primary" onclick="submitPersonalPlan()">保存计划</div></div>
      </div></div>
      <div class="mask" id="maskGrowthGoalV1"><div class="sheet growth-editor-v5"><div class="focus-modal-status-v5" hidden><div><span>🍅 正在专注</span><strong data-focus-modal-clock>00:00</strong><small data-focus-modal-task></small></div><div><button type="button" data-focus-modal-toggle onclick="toggleFocusPauseOverlayV5()">暂停</button><button type="button" onclick="hideMask('maskGrowthGoalV1');setGrowthFilterV5('focus')">查看计时</button></div></div><h3 id="goal_title_v1">🎯 新建目标</h3><input id="goal_id_v1" type="hidden">
        <div class="field"><label>目标名称</label><input id="goal_name_v1" maxlength="120" placeholder="如：今年买车、明天完成项目方案"></div>
        <div class="field-row2"><div class="field"><label>目标类型</label><select id="goal_kind_v1" class="inp" onchange="updateGrowthGoalKindV1()"><option value="progress">完成进度</option><option value="money">金额目标</option></select></div><div class="field"><label>时间范围</label><select id="goal_scope_v1" class="inp" onchange="updateGrowthGoalScopeV1()"><option value="today">今天</option><option value="tomorrow">明天</option><option value="year">今年</option><option value="custom">自定义日期</option></select></div></div>
        <div class="field-row2"><div class="field"><label id="goal_value_label_v1">目标进度</label><input id="goal_value_v1" type="number" inputmode="decimal" min="1" placeholder="100"></div><div class="field"><label>单位</label><input id="goal_unit_v1" maxlength="16" placeholder="%"></div></div>
        <div class="field" id="goal_due_field_v1"><label>完成期限</label><input id="goal_due_v1" type="date"></div>
        <div class="field"><label>优先级</label><select id="goal_priority_v1" class="inp"><option value="P0">P0 · 必须完成</option><option value="P1">P1 · 很重要</option><option value="P2">P2 · 普通目标</option><option value="P3">P3 · 有空完成</option></select></div>
        <div class="field"><label>目标说明（可选）</label><textarea id="goal_note_v1" rows="3" maxlength="1000" placeholder="为什么要完成、准备怎么做、需要什么资源…"></textarea></div>
        <div class="growth-private-note-v5">🔒 目标默认仅自己可见，不进入共享账本。</div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskGrowthGoalV1')">取消</div><div class="btn btn-primary" onclick="saveGrowthGoalV1()">保存目标</div></div>
      </div></div>
      <div class="mask" id="maskGoalProgressV1"><div class="sheet"><h3>📈 更新目标进度</h3><input id="goal_progress_id_v1" type="hidden"><div class="goal-progress-info-v1" id="goal_progress_info_v1"></div><div class="field"><label id="goal_progress_label_v1">当前进度</label><input id="goal_progress_value_v1" type="number" inputmode="decimal" min="0"></div><div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskGoalProgressV1')">取消</div><div class="btn btn-primary" onclick="saveGrowthGoalProgressV1()">保存进度</div></div></div></div>
      <div class="mask" id="maskInspirationV5"><div class="sheet growth-editor-v5"><div class="focus-modal-status-v5" hidden><div><span>🍅 正在专注</span><strong data-focus-modal-clock>00:00</strong><small data-focus-modal-task></small></div><div><button type="button" data-focus-modal-toggle onclick="toggleFocusPauseOverlayV5()">暂停</button><button type="button" onclick="hideMask('maskInspirationV5');setGrowthFilterV5('focus')">查看计时</button></div></div><h3 id="inspiration_title_v5">💡 编辑灵感</h3>
        <input id="inspiration_id_v5" type="hidden">
        <div class="field"><label>灵感内容</label><textarea id="inspiration_content_v5" rows="6" maxlength="3000" placeholder="记录项目想法、突然想到的事情或一句提醒…"></textarea></div>
        <div class="ai-writing-bar-v1"><button type="button" id="ai_inspiration_btn_v1" onclick="runAiWritingV1('inspiration')">AI 帮我发散</button><small>生成方向、下一步和关键词</small></div>
        <div class="ai-writing-result-v1" id="ai_inspiration_result_v1" hidden><header><b>AI 灵感建议</b><button type="button" onclick="applyAiWritingV1('inspiration')">追加到原文</button></header><div data-ai-writing-copy></div><small>采用前请自行核对；AI 不会自动保存。</small></div>
        <div class="field"><label>标签（可选）</label><input id="inspiration_tags_v5" maxlength="120" autocomplete="off" placeholder="如：项目、产品、生活，用逗号分隔"></div>
        <label class="growth-pin-row-v5"><input id="inspiration_pinned_v5" type="checkbox">置顶这条灵感</label>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskInspirationV5')">取消</div><div class="btn btn-primary" onclick="saveInspirationV5()">保存灵感</div></div>
      </div></div>
      <div class="mask diary-mask-v6" id="maskDiaryV5"><div class="sheet growth-editor-v5 diary-editor-v6">
        <header class="diary-editor-head-v6"><button type="button" class="diary-back-v6" onclick="hideMask('maskDiaryV5')">返回</button><div><h3 id="diary_title_v5">写今日日记</h3><input id="diary_date_v5" type="date" aria-label="日记日期"></div><button type="button" class="diary-head-save-v6" onclick="saveDiaryV5()">保存</button></header>
        <div class="diary-editor-scroll-v6"><div class="focus-modal-status-v5" hidden><div><span>正在专注</span><strong data-focus-modal-clock>00:00</strong><small data-focus-modal-task></small></div><div><button type="button" data-focus-modal-toggle onclick="toggleFocusPauseOverlayV5()">暂停</button><button type="button" onclick="hideMask('maskDiaryV5');setGrowthFilterV5('focus')">查看计时</button></div></div>
        <input id="diary_id_v5" type="hidden"><input id="diary_category_v6" type="hidden" value="daily">
        <div class="diary-title-field-v6"><input id="diary_heading_v5" maxlength="40" autocomplete="off" placeholder="今天的一句话（可选）"><small><span id="diary_heading_count_v6">0</span>/40</small></div>
        <div class="diary-body-field-v6"><label for="diary_content_v5">日记正文</label><textarea id="diary_content_v5" rows="8" maxlength="10000" placeholder="今天发生了什么？有什么感受或值得记住的事？"></textarea><small><span id="diary_content_count_v6">0</span> 字</small></div>
        <section class="diary-media-v6" aria-labelledby="diary_media_title_v6"><button type="button" class="diary-upload-v6" onclick="document.getElementById('diary_images_v6').click()">${window.uiIconMarkupV1?window.uiIconMarkupV1('image'):''}<span><b id="diary_media_title_v6">添加图片</b><small>最多 4 张，仅保存压缩预览图</small></span></button><input id="diary_images_v6" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onchange="addDiaryImagesV6(event)"><div class="diary-image-list-v6" id="diary_image_list_v6"></div></section>
        <section class="diary-category-v6"><h4>分类</h4><div role="radiogroup" aria-label="日记分类"><button type="button" data-diary-category="daily" onclick="setDiaryCategoryV6('daily')">日常</button><button type="button" data-diary-category="work" onclick="setDiaryCategoryV6('work')">工作</button><button type="button" data-diary-category="growth" onclick="setDiaryCategoryV6('growth')">成长</button><button type="button" data-diary-category="travel" onclick="setDiaryCategoryV6('travel')">旅行</button></div></section>
        <details class="diary-outline-v6" open><summary><span>写作大纲</span><small>点击后插入正文</small></summary><div><button type="button" onclick="insertDiaryOutlineV6('发生了什么')"><b>1</b>发生了什么</button><button type="button" onclick="insertDiaryOutlineV6('我的感受')"><b>2</b>我的感受</button><button type="button" onclick="insertDiaryOutlineV6('得到的启发')"><b>3</b>得到的启发</button><button type="button" onclick="insertDiaryOutlineV6('下一步')"><b>4</b>下一步</button></div></details>
        <section class="diary-meta-v6"><h4>心情</h4><div id="diary_mood_choices_v6" role="radiogroup" aria-label="心情"><button type="button" data-value="happy" onclick="pickDiaryMetaV6('mood','happy')">愉快</button><button type="button" data-value="calm" onclick="pickDiaryMetaV6('mood','calm')">平静</button><button type="button" data-value="excited" onclick="pickDiaryMetaV6('mood','excited')">兴奋</button><button type="button" data-value="tired" onclick="pickDiaryMetaV6('mood','tired')">疲惫</button><button type="button" data-value="sad" onclick="pickDiaryMetaV6('mood','sad')">低落</button></div><h4>天气</h4><div id="diary_weather_choices_v6" role="radiogroup" aria-label="天气"><button type="button" data-value="sunny" onclick="pickDiaryMetaV6('weather','sunny')">晴朗</button><button type="button" data-value="cloudy" onclick="pickDiaryMetaV6('weather','cloudy')">多云</button><button type="button" data-value="rainy" onclick="pickDiaryMetaV6('weather','rainy')">下雨</button><button type="button" data-value="windy" onclick="pickDiaryMetaV6('weather','windy')">有风</button><button type="button" data-value="snowy" onclick="pickDiaryMetaV6('weather','snowy')">下雪</button></div><select id="diary_mood_v5" hidden><option value="happy">愉快</option><option value="calm">平静</option><option value="excited">兴奋</option><option value="tired">疲惫</option><option value="sad">低落</option></select><select id="diary_weather_v5" hidden><option value="sunny">晴朗</option><option value="cloudy">多云</option><option value="rainy">下雨</option><option value="windy">有风</option><option value="snowy">下雪</option></select></section>
        <div class="ai-writing-bar-v1 diary-ai-v6"><button type="button" id="ai_diary_btn_v1" onclick="runAiWritingV1('diary')">AI 优化表达</button><small>保留事实和情绪，让表达更清晰动人</small></div>
        <div class="ai-writing-result-v1" id="ai_diary_result_v1" hidden><header><b>AI 优化预览</b><button type="button" onclick="applyAiWritingV1('diary')">采用优化稿</button></header><div data-ai-writing-copy></div><small>采用前请自行核对；原文不会自动覆盖。</small></div>
        <div class="growth-private-note-v5 diary-private-v6">仅自己可见，不会进入共享账本</div>
        <button type="button" class="diary-save-v6" onclick="saveDiaryV5()">保存日记</button></div>
      </div></div>
      <div class="mask" id="maskPlannerAlertV2"><div class="sheet planner-alert-sheet"><div class="planner-alert-icon" id="planner_alert_icon">⏰</div><h3 id="planner_alert_title">计划提醒</h3><div class="planner-alert-time" id="planner_alert_time"></div><div class="planner-alert-note" id="planner_alert_note"></div>
        <div class="planner-snooze"><span onclick="snoozePersonalPlan(5)">延后 5 分钟</span><span onclick="snoozePersonalPlan(10)">延后 10 分钟</span><span onclick="snoozePersonalPlan(30)">延后 30 分钟</span></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="dismissPlannerAlert()">知道了</div><div class="btn btn-primary" onclick="completePlannerAlert()">✓ 标记完成</div></div>
      </div></div>
      <div class="mask" id="maskAccountV2"><div class="sheet"><h3 id="account_sheet_title">💳 新建账户</h3>
        <input id="ac_id" type="hidden"><div class="field"><label>账户名称</label><input id="ac_name" maxlength="30" placeholder="如：工资卡"></div>
        <div class="field"><label>图标 Emoji</label><input id="ac_emoji" maxlength="8" placeholder="💳"></div>
        <div class="field"><label>初始余额（元）</label><input id="ac_opening" type="number" inputmode="decimal" placeholder="0.00"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskAccountV2')">取消</div><div class="btn btn-primary" onclick="submitAccount()">保存账户</div></div><div class="btn btn-ghost danger-text" id="ac_delete_btn_v2" style="display:none;text-align:center;margin-top:8px" onclick="deleteFinanceAccountV2()">删除这个账户</div>
      </div></div>
      <div class="mask" id="maskCategoryV2"><div class="sheet"><h3>✨ 新建自定义分类</h3>
        <div class="seg" id="cc_type"><div class="on" data-v="out" onclick="pickCategoryType('out')">支出分类</div><div data-v="in" onclick="pickCategoryType('in')">收入分类</div></div>
        <div class="field" style="margin-top:14px"><label>分类名称</label><input id="cc_name" maxlength="12" placeholder="如：宠物"></div>
        <div class="field"><label>图标 Emoji</label><input id="cc_emoji" maxlength="8" placeholder="🐱"></div>
        <div class="field"><label>分类颜色</label><input id="cc_color" type="color" value="#ff7197" style="height:48px;padding:6px"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskCategoryV2')">取消</div><div class="btn btn-primary" onclick="submitCategory()">保存分类</div></div>
      </div></div>
      <div class="mask" id="maskDataV2"><div class="sheet"><h3>🧰 数据工具箱</h3>
        <div class="settings-tools">
          <div class="settings-tool" onclick="exportFullBackup()">📦<br>完整备份</div><div class="settings-tool" onclick="openRestoreFile()">♻️<br>恢复备份</div>
          <div class="settings-tool" onclick="exportCsvV2()">📄<br>导出 CSV</div><div class="settings-tool" onclick="openCsvFile()">📥<br>导入 CSV</div>
        </div><div class="section-note">完整备份包含账单、账本、账户、预算、计划、灵感、日记、专注记录、借还和托管，但不会导出设备密钥或 AI Key。</div>
        <div class="sheet-btns" style="margin-top:14px"><div class="btn btn-cancel" onclick="hideMask('maskDataV2')">关闭</div></div>
      </div></div>
      <div class="mask" id="maskAiBatchV2"><div class="sheet"><h3>✨ AI 图片记账工作台</h3>
        <div class="hint2">可以一次选择多张小票、发票、支付截图、借条或还款凭证。AI 会依次区分账单、借款和还款，并提取金额、对象、日期、利息和期数；结果可修改后分类入账或导出。</div>
        <div class="vision-heartbeat pending" id="ai_batch_heartbeat" data-vision-heartbeat><i></i><span class="vh-main">视觉模型待检测</span><span class="vh-detail">正在检查连接</span></div>
        <div class="batch-toolbar"><div class="btn btn-primary" onclick="chooseAiBatchFiles()">🖼️ 选择图片</div><div class="btn btn-line" onclick="retryAiBatchErrors()">↻ 重试失败</div><div class="btn btn-ghost" onclick="clearAiBatch()">清空</div></div>
        <div class="batch-summary" id="ai_batch_summary_v2"><div>图片<b>0</b></div><div>识别成功<b>0</b></div><div>合计金额<b>¥0.00</b></div></div>
        <div class="batch-list" id="ai_batch_list_v2"><div class="ai-empty"><div class="big">🧾</div>请选择需要识别的账单图片</div></div>
        <div class="batch-export-row"><div class="btn btn-primary" onclick="commitAiBatch()">✓ 批量入账</div><div class="btn btn-line" onclick="exportAiBatch('excel')">导出 Excel</div><div class="btn btn-line" onclick="exportAiBatch('pdf')">导出 PDF</div></div>
        <div class="sheet-btns" style="margin-top:9px"><div class="btn btn-cancel" onclick="hideMask('maskAiBatchV2')">关闭</div></div>
      </div></div>
      <div class="mask" id="maskDebtDetailV2"><div class="sheet"><div id="debt_detail_content_v2"></div></div></div>
      <div class="mask" id="maskCuteConfirmV2"><div class="sheet compact-sheet"><div class="danger-confirm-icon" id="cute_confirm_icon_v2">🗑️</div><h3 id="cute_confirm_title_v2" style="text-align:center">请确认</h3><div class="danger-confirm-text" id="cute_confirm_text_v2"></div><div class="sheet-btns"><div class="btn btn-cancel" onclick="cancelCuteConfirmV2()">取消</div><div class="btn ledger-danger-btn" id="cute_confirm_ok_v2" onclick="acceptCuteConfirmV2()">确认</div></div></div></div>
      <div class="auth-gate-v2" id="auth_gate_v2" style="display:none">
        <div class="auth-card-v2">
          <div class="auth-mascot-v2" aria-hidden="true"><span>🍓</span><i>✦</i></div>
          <div class="auth-brand-v2"><b>小确幸记账</b><span>让每一笔生活，都有可爱的归处</span></div>
          <div class="auth-loading-v2" id="auth_loading_v2" style="display:none"><i></i><span>正在确认账号状态…</span></div>
          <div id="auth_forms_v2">
            <div class="auth-tabs-v2"><button type="button" class="on" data-mode="login" onclick="switchAuthModeV2('login')">邮箱登录</button><button type="button" data-mode="register" onclick="switchAuthModeV2('register')">注册账号</button></div>
            <form class="auth-pane-v2 on" id="auth_login_pane_v2" onsubmit="submitAuthV2('login');return false">
              <label>邮箱地址<input id="auth_login_email_v2" type="email" autocomplete="email" maxlength="160" placeholder="name@example.com" required></label>
              <label>登录密码<input id="auth_login_password_v2" type="password" autocomplete="current-password" maxlength="128" placeholder="请输入密码" required></label>
              <label class="auth-check-v2" id="auth_login_merge_row_v2"><input id="auth_login_merge_v2" type="checkbox"><span>把当前本机数据合并到这个账号</span></label>
              <button class="auth-primary-v2" id="auth_login_submit_v2" type="submit">登录并同步</button>
            </form>
            <form class="auth-pane-v2" id="auth_register_pane_v2" onsubmit="submitAuthV2('register');return false">
              <label>怎么称呼你<input id="auth_register_name_v2" maxlength="40" autocomplete="name" placeholder="如：小草莓" required></label>
              <label>邮箱地址<input id="auth_register_email_v2" type="email" autocomplete="email" maxlength="160" placeholder="name@example.com" required></label>
              <label>设置密码<input id="auth_register_password_v2" type="password" autocomplete="new-password" maxlength="128" placeholder="至少 8 位，需包含字母和数字" required></label>
              <label>确认密码<input id="auth_register_confirm_v2" type="password" autocomplete="new-password" maxlength="128" placeholder="再输入一次密码" required></label>
              <label class="auth-check-v2"><input id="auth_register_merge_v2" type="checkbox" checked><span>把当前本机账目带入新账号</span></label>
              <button class="auth-primary-v2" id="auth_register_submit_v2" type="submit">创建账号</button>
            </form>
            <div class="auth-error-v2" id="auth_error_v2" role="alert"></div>
            <div class="auth-divider-v2"><span>其他登录方式</span></div>
            <div class="auth-reserved-v2"><button type="button" disabled><b>💬 微信扫码</b><span>接口预留 · 暂未开放</span></button><button type="button" disabled><b>📱 手机验证码</b><span>接口预留 · 暂未开放</span></button></div>
            <button class="auth-guest-v2" type="button" onclick="continueGuestV2()">暂不登录，仅在本机使用</button>
            <p class="auth-privacy-v2">邮箱账号用于多设备同步与数据隔离。密码只保存为加密校验值，平台 AI 密钥只保存在管理服务器，不会发送到浏览器。</p>
          </div>
        </div>
      </div>
      <div class="mask" id="maskAccountCenterV2"><div class="sheet account-center-v2">
        <div class="account-head-v2"><div class="account-avatar-v2" id="account_avatar_preview_v2">🍓</div><div><h3>个人与数据中心</h3><p id="account_identity_v2">未登录</p></div><span class="account-state-v2" id="account_state_v2">本机模式</span></div>
        <div class="member-status-card-v3" id="member_status_card_v3"></div>
        <div id="account_logged_content_v2">
          <div class="account-section-v2"><div class="account-section-title-v2"><b>个人资料</b><span>仅显示你愿意填写的信息</span></div>
            <div class="avatar-picks-v2" id="account_avatar_picks_v2"></div>
            <div class="field-row2"><div class="field"><label>昵称</label><input id="account_display_name_v2" maxlength="40"></div><div class="field"><label>邮箱</label><input id="account_email_v2" disabled></div></div>
            <div class="field"><label>个人简介（可选）</label><textarea id="account_bio_v2" class="inp account-bio-v2" maxlength="500" rows="2" placeholder="写一句属于你的小介绍"></textarea></div>
            <div class="field"><label>时区</label><select id="account_timezone_v2" class="inp"><option value="Asia/Shanghai">中国标准时间（上海）</option><option value="Asia/Hong_Kong">香港时间</option><option value="Asia/Tokyo">东京时间</option><option value="Europe/London">伦敦时间</option><option value="America/New_York">纽约时间</option><option value="America/Los_Angeles">洛杉矶时间</option></select></div>
            <div class="btn btn-primary account-wide-btn-v2" onclick="saveAccountProfileV2()">保存个人资料</div>
          </div>
          <div class="account-section-v2"><div class="account-section-title-v2"><b>我的数据</b><span id="account_last_sync_v2">尚未同步</span></div>
            <div class="account-stats-v2" id="account_stats_v2"></div>
            <div class="account-tools-v2"><button type="button" onclick="syncAccountNowV2()">☁️<b>立即同步</b><span>上传并拉取</span></button><button type="button" onclick="exportAccountDataV2()">📦<b>账号导出</b><span>服务器完整副本</span></button><button type="button" onclick="exportFullBackup()">💾<b>本机备份</b><span>可随时恢复</span></button><button type="button" onclick="openDataTools();hideMask('maskAccountCenterV2')">🧰<b>数据工具</b><span>Excel / PDF / CSV</span></button></div>
          </div>
          <div class="account-section-v2"><div class="account-section-title-v2"><b>账号安全</b><span>修改后其他设备会退出</span></div>
            <div class="field"><label>当前密码</label><input id="account_current_password_v2" type="password" autocomplete="current-password" maxlength="128"></div>
            <div class="field-row2"><div class="field"><label>新密码</label><input id="account_new_password_v2" type="password" autocomplete="new-password" maxlength="128" placeholder="至少 8 位"></div><div class="field"><label>确认新密码</label><input id="account_confirm_password_v2" type="password" autocomplete="new-password" maxlength="128"></div></div>
            <div class="btn btn-line account-wide-btn-v2" onclick="changeAccountPasswordV2()">修改密码</div>
          </div>
          <div class="account-device-v2" id="account_device_v2"></div>
          <div class="account-danger-row-v2"><button type="button" onclick="logoutAccountV2()">退出登录</button><button type="button" class="danger" onclick="openDeleteAccountV2()">删除账号</button></div>
        </div>
        <div id="account_guest_content_v2" style="display:none"><div class="account-guest-card-v2"><span>🔐</span><b>登录后开启云端数据隔离</b><p>可以跨设备同步账单、借还、灵感、日记、专注记录和个人计划，并在这里管理资料与安全设置。</p><button type="button" onclick="hideMask('maskAccountCenterV2');openAuthGateV2('login')">登录 / 注册</button></div></div>
        <div class="account-inline-status-v2" id="account_inline_status_v2"></div>
        <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskAccountCenterV2')">关闭</div></div>
      </div></div>
      <div class="mask" id="maskMemberCenterV3"><div class="sheet member-center-v3"><div class="member-sheet-title-v3"><div><small>Little Joy Membership</small><h3>👑 会员与权益中心</h3></div><button type="button" onclick="refreshMemberCenterV3()">↻ 刷新</button></div><div id="member_center_body_v3"></div><div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskMemberCenterV3')">关闭</div></div></div></div>
      <div class="mask" id="maskPaywallV3"><div class="sheet compact-sheet paywall-v3"><div id="paywall_content_v3"></div><div class="paywall-feature-list-v3"><span>✓ 普通记账永久免费</span><span>✓ 新用户注册送 3 天体验</span><span>✓ 平台密钥不会发送到浏览器</span></div><button type="button" class="auth-primary-v2" id="paywall_login_v3" onclick="paywallLoginV3()">邮箱注册并领取 3 天体验</button><button type="button" class="auth-primary-v2" id="paywall_refresh_v3" onclick="paywallRefreshV3()">我已开通，刷新权益</button><button type="button" class="auth-guest-v2 paywall-payment-entry-v4" onclick="openMemberPaymentV4()">查看价格与扫码付款</button><button type="button" class="auth-guest-v2" onclick="hideMask('maskPaywallV3')">继续使用免费功能</button></div></div>
      <div class="mask" id="maskMemberPaymentV4"><div class="sheet member-payment-v4" role="dialog" aria-modal="true" aria-labelledby="member_payment_title_v4">
        <div class="member-payment-head-v4"><div><small>Little Joy Membership</small><h3 id="member_payment_title_v4">👑 会员扫码开通</h3></div><button type="button" class="member-payment-close-v4" aria-label="关闭付款页面" onclick="hideMask('maskMemberPaymentV4')">×</button></div>
        <div class="member-payment-body-v4">
          <div class="member-trial-v4"><span>🎁 新用户礼遇</span><b>注册即送 3 天会员体验</b><p>含 3 次 AI 单张识票、1 次批量识票、3 次语音记账和全部限定主题；仅赠送一次，到期不会自动续费或扣款。</p></div>
          <section class="member-payment-section-v4"><div class="member-payment-section-title-v4"><b>① 选择套餐</b><small>价格以在线页面为准</small></div><div class="member-payment-plans-v4" id="member_payment_plans_v4"></div><div class="member-payment-identity-v4" id="member_payment_identity_v4"></div><div class="member-payment-unavailable-v4" id="member_payment_unavailable_v4" role="status"></div><button type="button" class="member-payment-secondary-v4" id="member_payment_register_v4" onclick="memberPaymentRegisterV4()">先免费注册，领取 3 天体验</button></section>
          <div id="member_payment_checkout_v4" hidden>
          <section class="member-payment-section-v4"><div class="member-payment-section-title-v4"><b>② 选择付款方式</b><small>请按套餐金额付款</small></div>
            <div class="member-payment-methods-v4" role="tablist" aria-label="付款方式"><button type="button" class="member-payment-method-v4 on" data-method="wechat" role="tab" aria-selected="true" onclick="switchMemberPaymentMethodV4('wechat')">🟢 微信支付</button><button type="button" class="member-payment-method-v4" data-method="alipay" role="tab" aria-selected="false" onclick="switchMemberPaymentMethodV4('alipay')">🔵 支付宝</button></div>
            <div class="member-payment-qr-v4 on" data-method-panel="wechat"><img data-payment-private-src-v4="assets/payment/wechat-pay.jpg" alt="宁创科技微信收款二维码" width="828" height="1124"><p>使用微信扫一扫，支付 <b data-payment-selection-v4 aria-live="polite">所选套餐</b></p><div class="member-payment-check-v4"><i>🔎</i><span>付款前请核对收款方为 <b>宁创科技</b>；金额或套餐不确定时，请先添加微信确认。</span></div></div>
            <div class="member-payment-qr-v4" data-method-panel="alipay" hidden><img data-payment-private-src-v4="assets/payment/alipay.jpg" alt="宁创科技支付宝收款二维码" width="853" height="1280"><p>使用支付宝扫一扫，支付 <b data-payment-selection-v4 aria-live="polite">所选套餐</b></p><div class="member-payment-check-v4"><i>🔎</i><span>付款前请核对收款方为 <b>宁创科技</b>；金额或套餐不确定时，请先添加微信确认。</span></div></div>
          </section>
          <section class="member-payment-section-v4"><div class="member-payment-section-title-v4"><b>③ 付款后联系人工开通</b><small>不是自动到账</small></div>
            <ol class="member-payment-steps-v4"><li>在上方选择微信或支付宝，并按所选套餐金额完成付款。</li><li>添加个人微信 <b>NJYX9818</b>，私聊发送：<b>付款截图、注册邮箱、所选套餐</b>。</li><li>等待人工核对并开通；权益未到账前请勿重复付款，可回来点击“刷新权益”。</li></ol>
            <div class="member-payment-contact-v4"><img data-payment-private-src-v4="assets/payment/wechat-contact.jpg" alt="宁创科技个人微信二维码" width="888" height="1131" loading="lazy"><div><small>人工开通与售后微信</small><b>NJYX9818</b><p>添加后请发送付款凭证截图、注册邮箱和套餐名称。</p><button type="button" class="member-payment-copy-v4" onclick="copyMemberWechatV4()">复制微信号</button></div></div>
            <details class="member-payment-contact-zoom-v4"><summary>放大个人微信二维码</summary><img data-payment-private-src-v4="assets/payment/wechat-contact.jpg" alt="放大的宁创科技个人微信二维码" width="888" height="1131" loading="lazy"></details>
          </section>
          <div class="member-payment-privacy-v4"><i>🔐</i><span>付款凭证可能含个人信息，请只通过上述个人微信私聊发送，不要发到群聊。记账本页面不会上传、保存或自动审核你的付款截图。</span></div>
          <div class="member-payment-actions-v4"><button type="button" class="member-payment-primary-v4" onclick="copyMemberWechatV4()">复制微信号并发送凭证</button><button type="button" class="member-payment-secondary-v4" onclick="refreshPaymentEntitlementV4()">我已付款，刷新权益</button></div>
          </div>
        </div>
      </div></div>
      <div class="mask" id="maskDeleteAccountV2"><div class="sheet compact-sheet delete-account-v2"><div class="danger-confirm-icon">🧹</div><h3>删除账号与云端数据</h3><p>此操作会注销所有登录设备，并删除属于该账号的云端账本、账单、借还、灵感、日记、专注记录和计划。共享账本会按服务器规则处理，操作无法撤销。</p><div class="field"><label>登录密码</label><input id="delete_account_password_v2" type="password" autocomplete="current-password"></div><div class="field"><label>输入“删除”确认</label><input id="delete_account_phrase_v2" maxlength="8" placeholder="删除"></div><div class="auth-error-v2" id="delete_account_error_v2"></div><div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskDeleteAccountV2')">取消</div><div class="btn ledger-danger-btn" onclick="deleteAccountV2()">永久删除</div></div></div></div>
      <input id="restore_file_v2" type="file" accept="application/json,.json" hidden onchange="restoreFullBackup(event)">
      <input id="csv_file_v2" type="file" accept="text/csv,.csv" hidden onchange="importCsvV2(event)">
      <input id="ai_batch_files_v2" type="file" accept="image/*" multiple hidden onchange="onAiBatchFiles(event)">
    `);
  }

  function enhanceStaticUi(){
    document.title='小确幸记账 · 可爱全功能版';
    const topRight=document.querySelector('.topbar .right');
    if(topRight&&!document.getElementById('account_chip_v2'))topRight.insertAdjacentHTML('afterbegin','<span class="account-chip-v2 guest" id="account_chip_v2" onclick="openAccountCenterV2()" title="个人与数据中心"><i>👤</i><span>未登录</span></span>');
    document.querySelector('.tabbar').innerHTML=`
      <div class="tab on" data-tab="tx" onclick="showTab('tx')"><span class="ic">🏡</span>首页</div>
      <div class="tab" data-tab="stats" onclick="showTab('stats')"><span class="ic">📊</span>统计</div>
      <div class="tab" data-tab="plan" onclick="showTab('plan')"><span class="ic">🌱</span>成长</div>
      <div class="tab" data-tab="debt" onclick="showTab('debt')"><span class="ic">🤝</span>借还</div>
      <div class="tab" data-tab="escrow" onclick="showTab('escrow')"><span class="ic">🎁</span>托管</div>`;
    const settingsSheet=document.querySelector('#maskSettings .sheet');
    const themeLabel=document.querySelector('#theme_colors').previousElementSibling;if(themeLabel)themeLabel.textContent='可爱主题';
    const aiSettingsField=document.getElementById('llm_status')&&document.getElementById('llm_status').closest('.field');
    if(aiSettingsField){aiSettingsField.innerHTML=`<label>✨ 平台 AI 会员服务</label><div class="platform-ai-summary-v3 pending" id="platform_ai_summary_v3"><i></i><span><b>正在检查平台 AI</b><small>密钥和模型由管理员统一保护与配置</small></span><button type="button" onclick="openMemberCenterV3()">会员与额度</button></div><div class="llm-status pending" id="platform_llm_status_v3"><i></i><span>正在检查服务</span></div><div class="platform-ai-safe-v3">🔐 浏览器不再保存 API Key、接口地址或模型名。识别请求经平台服务端校验会员和额度后再调用模型。</div><div class="btnrow"><div class="btn btn-line" onclick="testLlm()">检查 AI 状态</div><div class="btn btn-primary" onclick="openMemberCenterV3()">查看会员权益</div></div>`;document.getElementById('platform_llm_status_v3').id='llm_status';}
    const settingsButtonRows=settingsSheet.querySelectorAll('.sheet-btns');
    const closeRow=settingsButtonRows[settingsButtonRows.length-1];
    closeRow.insertAdjacentHTML('beforebegin',`<div class="field"><label>实用工具</label><div class="settings-tools">
      <div class="settings-tool" onclick="openAccountCenterV2();hideMask('maskSettings')">👤<br>个人与数据</div>
      <div class="settings-tool" onclick="openMemberCenterV3();hideMask('maskSettings')">👑<br>会员与权益</div>
      <div class="settings-tool" onclick="showTab('plan');hideMask('maskSettings')">🌱<br>成长与计划</div>
      <div class="settings-tool" onclick="openDataTools()">🧰<br>备份与导入</div>
      <div class="settings-tool" onclick="openAccount()">💳<br>新建账户</div>
      <div class="settings-tool" onclick="openCategory()">✨<br>新建分类</div>
    </div></div>`);
    const txTitle=document.querySelector('#maskTx h3');txTitle.id='tx_sheet_title';
    const txSave=document.querySelector('#maskTx .btn-primary');txSave.id='tx_save_btn';
    const txDateField=document.getElementById('t_date').closest('.field');
    txDateField.insertAdjacentHTML('beforebegin',`<div class="field ai-single-meta"><div><label>商家 / 名称</label><input id="t_merchant" maxlength="80" placeholder="AI 会自动识别，也可手动填写"></div><span class="confidence" id="t_ai_confidence" style="display:none">AI 置信度</span></div>`);
    const photoQuick=document.querySelector('#maskTx .quick2 .qb:nth-child(2)');if(photoQuick)photoQuick.innerHTML='📷 拍照 / AI 识别';
    document.querySelector('#maskDebt .sheet').innerHTML=`<h3 id="debt_sheet_title">🤝 新建借还</h3>
      <div class="seg" id="debt_dir"><div class="on" data-d="lent" onclick="setDebtDir('lent',this)">💚 我借给别人</div><div data-d="borrowed" onclick="setDebtDir('borrowed',this)">❤️ 我向别人借</div></div>
      <div class="field-row2" style="margin-top:14px"><div class="field"><label>对方称呼 *</label><input id="d_person" maxlength="40" placeholder="如：小王"></div><div class="field"><label>关系</label><input id="d_relationship" maxlength="30" placeholder="朋友 / 同事"></div></div>
      <div class="field"><label>联系方式（可选）</label><input id="d_contact" maxlength="80" placeholder="手机号、微信号等"></div>
      <div class="field-row2"><div class="field"><label>本金（元）*</label><input id="d_amount" type="number" inputmode="decimal" placeholder="0.00" oninput="updateDebtPreview()"></div><div class="field"><label>手续费（元）</label><input id="d_fee" type="number" inputmode="decimal" value="0" oninput="updateDebtPreview()"></div></div>
      <div class="field-row2"><div class="field"><label>利息方式</label><select id="d_interest_type" class="inp" onchange="updateDebtPreview()"><option value="none">免息</option><option value="fixed">一次性利率</option><option value="annual">年化单利</option></select></div><div class="field"><label>利率（%）</label><input id="d_interest_rate" type="number" inputmode="decimal" value="0" oninput="updateDebtPreview()"></div></div>
      <div class="field-row2"><div class="field"><label>借款/出借日期</label><input id="d_date" type="date" onchange="updateDebtPreview()"></div><div class="field"><label>首次/约定还款日</label><input id="d_first_due" type="date" onchange="updateDebtPreview()"></div></div>
      <div class="field-row2"><div class="field"><label>还款期数</label><input id="d_installments" type="number" min="1" max="120" value="1" oninput="updateDebtPreview()"></div><div class="field"><label>还款频率</label><select id="d_frequency" class="inp" onchange="updateDebtPreview()"><option value="once">一次性</option><option value="monthly">每月</option><option value="weekly">每周</option></select></div></div>
      <div class="field"><label>借款用途 / 事项</label><input id="d_purpose" maxlength="100" placeholder="如：周转、购置、代付"></div>
      <div class="field"><label>详细备注</label><input id="d_remark" maxlength="300" placeholder="约定、凭证位置等"></div>
      <div class="field-row2"><div class="field"><label>资金账户</label><select id="d_account" class="inp"></select></div><div class="field"><label>同步账户余额</label><select id="d_track" class="inp"><option value="yes">是，记录资金流</option><option value="no">否，仅做备忘</option></select></div></div>
      <div class="debt-preview" id="debt_preview_v2">填写本金后显示应还总额</div>
      <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskDebt')">取消</div><div class="btn btn-primary" id="debt_save_btn" onclick="submitDebt()">保存借还</div></div>`;
    document.querySelector('#maskRepay .sheet').innerHTML=`<h3>💰 记录一笔还款</h3>
      <div class="debt-preview" id="debt_repay_info">请选择借还记录</div>
      <div class="field-row2"><div class="field"><label>本次金额（元）*</label><input id="debt_repay_amount" type="number" inputmode="decimal" placeholder="0.00" oninput="updateRepayPreview()"></div><div class="field"><label>还款日期</label><input id="debt_repay_date" type="date"></div></div>
      <div class="field-row2"><div class="field"><label>收款/付款账户</label><select id="debt_repay_account" class="inp"></select></div><div class="field"><label>还款方式</label><select id="debt_repay_method" class="inp"><option value="bank">银行转账</option><option value="wechat">微信</option><option value="alipay">支付宝</option><option value="cash">现金</option><option value="other">其他</option></select></div></div>
      <div class="field"><label>备注 / 流水号</label><input id="debt_repay_remark" maxlength="160" placeholder="如：第1期、转账尾号1234"></div>
      <div class="field"><label>同步账户余额</label><select id="debt_repay_track" class="inp"><option value="yes">是，记录资金流</option><option value="no">否，仅做备忘</option></select></div>
      <div class="debt-preview" id="repay_breakdown_v2">输入金额后显示本金、利息与费用分配</div>
      <div class="sheet-btns"><div class="btn btn-cancel" onclick="cancelRepayV1()">取消</div><div class="btn btn-primary" onclick="submitRepay()">保存还款</div></div>`;
    document.body.insertAdjacentHTML('beforeend',`<div class="mask" id="maskRepaymentPlanV1"><div class="sheet repayment-plan-editor-v1"><h3 id="rp_plan_title_v1">🎯 新建还款计划</h3>
      <div class="field-row2"><div class="field"><label>计划年份</label><input id="rp_plan_year_v1" type="number" min="2020" max="2100" oninput="renderRepaymentPlanPreviewV1()"></div><div class="field"><label>年度目标（元）</label><input id="rp_plan_target_v1" type="number" inputmode="decimal" min="0.01" placeholder="50000" oninput="renderRepaymentPlanPreviewV1()"></div></div>
      <div class="field-row2"><div class="field"><label>开始月份</label><select id="rp_plan_start_month_v1" class="inp" onchange="renderRepaymentPlanPreviewV1()">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1} 月</option>`).join('')}</select></div><div class="field"><label>计划期数</label><select id="rp_plan_installments_v1" class="inp" onchange="renderRepaymentPlanPreviewV1()">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1} 期</option>`).join('')}</select></div></div>
      <div class="field"><label>还款策略</label><select id="rp_plan_strategy_v1" class="inp" onchange="renderRepaymentPlanPreviewV1()"><option value="equal">平均分配</option><option value="snowball">雪球法（先还小额）</option><option value="custom">自定义每月金额</option></select></div>
      <div class="field"><label>关联“我欠别人”的债务</label><div class="repayment-debt-picker-v1" id="rp_plan_debts_v1"></div></div>
      <div class="field" id="rp_custom_months_field_v1" style="display:none"><label>每月计划金额</label><div class="repayment-custom-months-v1" id="rp_custom_months_v1"></div></div>
      <div class="field-row2"><div class="field"><label>每月提醒日</label><select id="rp_plan_reminder_v1" class="inp">${Array.from({length:28},(_,i)=>`<option value="${i+1}">${i+1} 日</option>`).join('')}</select></div><div class="field"><label>默认付款账户</label><select id="rp_plan_account_v1" class="inp"></select></div></div>
      <div class="field"><label>备注（可选）</label><textarea id="rp_plan_note_v1" rows="2" maxlength="300" placeholder="例如：年终前还清，预留利息和手续费"></textarea></div>
      <div class="repayment-plan-preview-v1" id="rp_plan_preview_v1"></div>
      <div class="sheet-btns"><div class="btn btn-cancel" onclick="hideMask('maskRepaymentPlanV1')">取消</div><div class="btn btn-primary" onclick="saveRepaymentPlanV1()">保存计划</div></div>
    </div></div>`);
  }

  function renderCurrent(){
    if(currentTab==='tx')renderTx();else if(currentTab==='stats')renderStats();else if(currentTab==='plan')renderPlan();else if(currentTab==='debt')renderDebt();else goList();
  }
  showTab=function(tab){
    currentTab=tab;
    document.querySelectorAll('.tabbar .tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===tab));
    if(tab==='tx')renderTx();else if(tab==='stats')renderStats();else if(tab==='plan')renderPlan();else if(tab==='debt')renderDebt();else{currentId=null;goList();}
  };
  switchLedger=function(id){
    if(!liveLedgers().some(l=>l.id===id))return;currentLedger=id;localStorage.setItem('currentLedger',id);txFilter.account='all';renderCurrent();
  };

  catEmoji=function(k){
    const c=ledgerCategories('out').concat(ledgerCategories('in')).find(x=>x.name===k);return c?c.emoji:(k==='账户转账'?'🔄':'📦');
  };
  renderCatGrid=function(){
    const g=document.getElementById('tx_cats');categoryChoices=ledgerCategories(txType);
    if(!categoryChoices.some(c=>c.name===txCat))txCat=categoryChoices[0]&&categoryChoices[0].name||'其他';
    g.innerHTML=categoryChoices.map((c,i)=>`<div class="c ${c.name===txCat?'on':''}" onclick="pickCatByIndex(${i})"><span class="e">${esc(c.emoji)}</span>${esc(c.name)}</div>`).join('');
  };
  window.pickCatByIndex=function(i){const c=categoryChoices[i];if(!c)return;txCat=c.name;renderCatGrid();};
  renderAccountChips=function(){
    const box=document.getElementById('tx_accounts');const list=liveAccounts();
    if(!list.some(a=>a.id===txAccountId)){const byName=list.find(a=>a.name===txAccount);txAccountId=(byName||list[0]||{}).id||'';}
    const current=findAccountById(txAccountId);if(current)txAccount=current.name;
    box.innerHTML=list.map(a=>`<span class="${a.id===txAccountId?'on':''}" onclick="pickFinanceAccount('${a.id}')">${esc(a.emoji||'💳')} ${esc(a.name)}</span>`).join('')+`<span onclick="openAccount()">＋ 新账户</span>`;
  };
  window.pickFinanceAccount=function(id){const a=findAccountById(id);if(!a)return;txAccountId=id;txAccount=a.name;renderAccountChips();};

  openTx=function(id){
    const existing=id&&transactions.find(x=>x.id===id&&!isDeleted(x));editingTxId=existing?existing.id:null;
    if(existing&&(existing.linkedDebtId||!['in','out'].includes(existing.type))){editingTxId=null;if(existing.linkedDebtId&&typeof openDebtDetail==='function')openDebtDetail(existing.linkedDebtId);else toast('这类流水不能用普通记账编辑，请从对应功能进入');return;}
    txType=existing&&existing.type!=='transfer'?existing.type:'out';
    txCat=existing?existing.category:ledgerCategories('out')[0].name;
    txPhoto=existing?existing.photo:null;
    txAiConfidence=existing&&Number.isFinite(Number(existing.aiConfidence))?Number(existing.aiConfidence):null;
    const acc=existing&&findAccountForTx(existing);txAccountId=acc?acc.id:(liveAccounts()[0]&&liveAccounts()[0].id||'');txAccount=acc?acc.name:(liveAccounts()[0]&&liveAccounts()[0].name||'');
    document.getElementById('tx_sheet_title').textContent=existing?'✏️ 编辑账单':'🌷 记一笔';
    document.getElementById('tx_save_btn').textContent=existing?'保存修改':'保存账单';
    document.querySelectorAll('#tx_type div').forEach(d=>d.classList.toggle('on',d.dataset.t===txType));
    document.getElementById('t_amount').value=existing?existing.amount:'';
    document.getElementById('t_date').value=existing?existing.date:today();
    document.getElementById('t_remark').value=existing?existing.remark||'':'';
    document.getElementById('t_merchant').value=existing?existing.merchant||'':'';
    renderSingleAiConfidenceV2();
    document.getElementById('photoPrev').innerHTML=txPhoto?`<img src="${safePhotoUrl(txPhoto)}"><span class="del" onclick="clearPhoto()">移除</span>`:'';
    document.getElementById('ai_error_box').style.display='none';
    renderCatGrid();renderAccountChips();renderVisionHeartbeat();showMask('maskTx');
  };
  submitTx=function(){
    const amt=parseFloat(document.getElementById('t_amount').value),date=document.getElementById('t_date').value||today(),remark=document.getElementById('t_remark').value.trim(),merchant=document.getElementById('t_merchant').value.trim();
    if(!(amt>0)){toast('请输入正确金额');return;}
    const acc=findAccountById(txAccountId);if(!acc){toast('请先选择账户');return;}
    if(editingTxId){
      const t=transactions.find(x=>x.id===editingTxId&&!isDeleted(x));if(!t)return;
      Object.assign(t,{type:txType,amount:amt,category:txCat,account:acc.name,accountId:acc.id,date,merchant,remark,photo:txPhoto,aiConfidence:txAiConfidence});markUpdated(t);
    }else transactions.push({id:uid(),ledger:currentLedger,owner:deviceId,type:txType,amount:amt,category:txCat,account:acc.name,accountId:acc.id,date,merchant,remark,photo:txPhoto,aiConfidence:txAiConfidence,createdAt:Date.now(),updatedAt:Date.now()});
    if(!save())return;hideMask('maskTx');renderTx();toast(editingTxId?'修改已保存':'记账成功，真棒 ✨');editingTxId=null;
  };

  function filteredTransactions(){
    const q=txFilter.q.trim().toLowerCase();
    return inLedger(transactions).filter(t=>{
      if(txFilter.type==='debt'&&!['debt_in','debt_out'].includes(t.type))return false;
      if(txFilter.type!=='all'&&txFilter.type!=='debt'&&t.type!==txFilter.type)return false;
      if(txFilter.account!=='all'&&t.accountId!==txFilter.account&&t.fromAccountId!==txFilter.account&&t.toAccountId!==txFilter.account)return false;
      if(txFilter.month!=='all'&&ym(t.date)!==txFilter.month)return false;
      if(q&&!`${t.category||''} ${t.merchant||''} ${t.remark||''} ${t.account||''}`.toLowerCase().includes(q))return false;
      return true;
    });
  }
  function budgetMini(month,out){
    const total=active(budgets).find(b=>b.ledger===currentLedger&&b.month===month&&b.category==='__all__');
    if(!total)return `<div class="budget-mini" onclick="showTab('plan')"><div class="budget-mini-head"><b>🎯 本月还没设预算</b><span>去设置 ›</span></div><div class="prog"><i style="width:0;background:var(--brand)"></i></div></div>`;
    const pct=Math.min(100,out/total.amount*100),over=out>total.amount;
    return `<div class="budget-mini" onclick="showTab('plan')"><div class="budget-mini-head"><b>🎯 本月预算 ${over?'已超支':'进行中'}</b><span>¥${fmt(out)} / ¥${fmt(total.amount)}</span></div><div class="prog"><i style="width:${pct}%;background:${over?'var(--red)':pct>80?'var(--orange)':'var(--brand)'}"></i></div></div>`;
  }
  renderTx=function(){
    const ledger=curLedger();document.getElementById('title').textContent='小确幸 · '+ledger.name;
    const top=document.getElementById('topAct');top.style.display='block';top.textContent='数据';top.onclick=openDataTools;
    const m=ym(today()),all=inLedger(transactions),money=all.filter(t=>t.type!=='transfer');
    const inc=money.filter(t=>t.type==='in'&&ym(t.date)===m).reduce((s,t)=>s+t.amount,0),out=money.filter(t=>t.type==='out'&&ym(t.date)===m).reduce((s,t)=>s+t.amount,0);
    const balance=liveAccounts().reduce((s,a)=>s+accountBalance(a),0);
    const preset=CUTE_THEMES.find(x=>x.id===(theme.preset||'strawberry'))||CUTE_THEMES[0];
    const months=[...new Set(all.map(t=>ym(t.date)))].sort().reverse();
    const accountOpts=liveAccounts().map(a=>`<option value="${a.id}" ${txFilter.account===a.id?'selected':''}>${esc(a.name)}</option>`).join('');
    let html=renderLedgerBar()+`<div class="cute-hero"><div class="hero-top"><div><div class="hero-eyebrow">全部账户余额</div><div class="hero-money">¥${fmt(balance)}</div></div><div class="hero-mascot">${uiIconMarkupV1(preset.icon,'theme-hero-icon-v4')}</div></div>
      <div class="hero-foot"><span>本月收入<b>+ ¥${fmt(inc)}</b></span><span>本月支出<b>- ¥${fmt(out)}</b></span><span>本月结余<b>${inc-out>=0?'+ ':''}¥${fmt(inc-out)}</b></span></div></div>
      <div class="ai-scan-hero ${hasEntitlementV3('ai.batch_receipt')?'':'member-locked-v3'}" onclick="openAiBatch()"><span class="ai-scan-icon">🧾</span><span class="ai-scan-main"><b>AI 图片自动分类</b><small>多张上传 · 自动区分账单、借款和还款</small><span class="vision-heartbeat mini pending" data-vision-heartbeat><i></i><span class="vh-main">视觉模型待检测</span><span class="vh-detail">正在检查连接</span></span></span><span class="ai-scan-go">${hasEntitlementV3('ai.batch_receipt')?'开始识别':'🔒 会员'}</span></div>
      <div class="quick-menu"><div class="qm" onclick="openTx()"><span class="qi">✍️</span>手动记账</div><div class="qm ${hasEntitlementV3('ai.batch_receipt')?'':'member-locked-v3'}" onclick="openAiBatch()"><span class="qi">✨</span>AI 识票${hasEntitlementV3('ai.batch_receipt')?'':' 🔒'}</div><div class="qm" onclick="openTransfer()"><span class="qi">🔄</span>账户转账</div><div class="qm" onclick="openExport()"><span class="qi">📤</span>导出报表</div></div>
      ${renderTodayPlannerMiniV2()}${budgetMini(m,out)}${renderReminderBar()}
      <div class="filter-box"><div class="search-line"><span>🔎</span><input value="${esc(txFilter.q)}" oninput="setTxSearch(this.value)" placeholder="搜索分类、备注或账户"><select class="filter-select" onchange="setTxMonthFilter(this.value)"><option value="all">全部月份</option>${months.map(x=>`<option value="${x}" ${txFilter.month===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="filter-chips"><span class="filter-chip ${txFilter.type==='all'?'on':''}" onclick="setTxTypeFilter('all')">全部</span><span class="filter-chip ${txFilter.type==='out'?'on':''}" onclick="setTxTypeFilter('out')">支出</span><span class="filter-chip ${txFilter.type==='in'?'on':''}" onclick="setTxTypeFilter('in')">收入</span><span class="filter-chip ${txFilter.type==='transfer'?'on':''}" onclick="setTxTypeFilter('transfer')">转账</span><span class="filter-chip ${txFilter.type==='debt'?'on':''}" onclick="setTxTypeFilter('debt')">借还资金</span><select class="filter-select" onchange="setTxAccountFilter(this.value)"><option value="all">全部账户</option>${accountOpts}</select></div></div>`;
    const list=filteredTransactions().sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.createdAt||0)-(a.createdAt||0));
    if(!list.length)html+=`<div class="empty"><div class="big">🌱</div>${all.length?'没有符合条件的账单':'还没有账单，记录第一笔小确幸吧'}</div>`;
    const groups={};list.forEach(t=>(groups[t.date]||(groups[t.date]=[])).push(t));
    Object.entries(groups).forEach(([date,items])=>{
      const dIn=items.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0),dOut=items.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0);
      html+=`<div class="daygroup"><span>${date}</span><span>收 ${fmt(dIn)} · 支 ${fmt(dOut)}</span></div>`;
      items.forEach((t,i)=>{
        const transfer=t.type==='transfer',debtFlow=['debt_in','debt_out'].includes(t.type),editable=['in','out'].includes(t.type);const from=findAccountById(t.fromAccountId),to=findAccountById(t.toAccountId);
        const sub=transfer?`${from?from.name:'未知'} → ${to?to.name:'未知'}${t.remark?' · '+esc(t.remark):''}`:`${t.merchant?esc(t.merchant)+' · ':''}${esc(t.remark||'暂无备注')}${t.account?` · ${esc(t.account)}`:''}`;
        html+=`<div class="tx ${i===0?'first':''} ${i===items.length-1?'last':''}"><div class="ic" style="background:${hexToRgba(txCategoryColor(t.category),.13)}">${transfer?'🔄':debtFlow?'🤝':catEmoji(t.category)}</div>
          <div class="info"><div class="nm">${transfer?'账户转账':esc(t.category)} ${t.photo?'📷':''}</div><div class="mt">${sub}</div></div>
          <div style="text-align:right"><div class="amt ${t.type} ${transfer?'transfer-amt':''}">${transfer?'¥':typeSymbol(t.type)+'¥'}${fmt(t.amount)}</div><div class="tx-actions">${editable?`<span class="mini-act edit" onclick="openTx('${t.id}')">编辑</span>`:''}${debtFlow?`<span class="mini-act edit" onclick="openDebtDetail('${t.linkedDebtId}')">详情</span>`:`<span class="mini-act" onclick="deleteTx('${t.id}')">删除</span>`}</div></div></div>`;
      });
    });
    document.getElementById('view').innerHTML=html;setFab('记一笔',openTx);renderVisionHeartbeat();
  };
  window.setTxSearch=function(v){txFilter.q=v;renderTx();const input=document.querySelector('.search-line input');if(input){input.focus();input.setSelectionRange(v.length,v.length);}};
  window.setTxTypeFilter=function(v){txFilter.type=v;renderTx();};
  window.setTxAccountFilter=function(v){txFilter.account=v;renderTx();};
  window.setTxMonthFilter=function(v){txFilter.month=v;renderTx();};

  // ================= AI 图片自动分类工作台 =================
  function renderSingleAiConfidenceV2(){const el=document.getElementById('t_ai_confidence');if(!el)return;if(Number.isFinite(txAiConfidence)){el.style.display='inline-block';el.textContent='AI 置信度 '+Math.round(txAiConfidence*100)+'%';}else el.style.display='none';}
  function compressAiImageV2(file){
    return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('读取图片失败'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('图片格式不支持'));img.onload=()=>{const make=(max,quality)=>{const scale=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',quality);};resolve({image:make(1200,.76),thumb:make(420,.56)});};img.src=reader.result;};reader.readAsDataURL(file);});
  }
  const AI_DOC_TYPES_V2={expense:'消费账单',income:'收入账单',loan_out:'我借出',loan_in:'我借入',repayment_received:'收到还款',repayment_paid:'偿还借款',unknown:'待人工确认'};
  function aiDebtDirectionV2(doc){return doc==='loan_out'||doc==='repayment_received'?'lent':doc==='loan_in'||doc==='repayment_paid'?'borrowed':'';}
  function findAiDebtMatchV2(person,doc){
    const direction=aiDebtDirectionV2(doc),name=String(person||'').trim();if(!direction)return '';
    const candidates=inLedger(debts).map(normalizeDebtV2).filter(d=>!d.done&&d.direction===direction&&(!name||d.person===name||d.person.includes(name)||name.includes(d.person)));
    return candidates.length===1?candidates[0].id:'';
  }
  function normalizeAiResultV2(r,item){
    const allowed=Object.keys(AI_DOC_TYPES_V2);let doc=String(r&&r.documentType||'').trim();if(!allowed.includes(doc))doc=r&&r.type==='in'?'income':r&&r.type==='out'?'expense':'unknown';
    const type=doc==='income'?'in':doc==='expense'?'out':(r&&r.type==='in'?'in':'out'),cat=findCat(r&&r.category)||'其他',confidence=Math.max(0,Math.min(1,Number(r&&r.confidence)||0));
    const itemName=String(r&&r.itemName||'').trim(),extra=String(r&&r.remark||'').trim(),person=String(r&&r.person||r&&r.merchant||r&&r.name||r&&r.payee||'').trim();
    const amount=roundMoneyV2(Math.abs(Number(r&&r.amount)||Number(r&&r.principal)||0));
    return Object.assign(item,{status:'done',documentType:doc,merchant:String(r&&r.merchant||r&&r.name||r&&r.payee||'').trim(),person,itemName,amount,principal:roundMoneyV2(Math.abs(Number(r&&r.principal)||amount)),type,category:cat,date:r&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)?r.date:today(),remark:[itemName,extra].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · '),confidence,error:'',interestType:['none','fixed','annual'].includes(r&&r.interestType)?r.interestType:'none',interestRate:Math.max(0,Number(r&&r.interestRate)||0),fee:roundMoneyV2(Math.max(0,Number(r&&r.fee)||0)),firstDueDate:r&&/^\d{4}-\d{2}-\d{2}$/.test(r.firstDueDate)?r.firstDueDate:'',installments:Math.max(1,parseInt(r&&r.installments)||1),frequency:['once','monthly','weekly'].includes(r&&r.frequency)?r.frequency:'once',purpose:String(r&&r.purpose||'').trim(),debtId:findAiDebtMatchV2(person,doc)});
  }
  function aiBatchReadyV2(){return aiBatchItems.filter(x=>x.status==='done'&&x.documentType!=='unknown'&&Number(x.amount)>0);}
  function aiCategoryOptionsV2(item){return ledgerCategories(item.type||'out').map(c=>`<option value="${esc(c.name)}" ${c.name===item.category?'selected':''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('');}
  function aiAccountOptionsV2(item){return liveAccounts().map(a=>`<option value="${a.id}" ${a.id===item.accountId?'selected':''}>${esc(a.name)}</option>`).join('');}
  function aiDocOptionsV2(item){return Object.entries(AI_DOC_TYPES_V2).map(([v,n])=>`<option value="${v}" ${v===item.documentType?'selected':''}>${n}</option>`).join('');}
  function aiDebtOptionsV2(item){const direction=aiDebtDirectionV2(item.documentType);return `<option value="">请选择对应借还记录</option>`+inLedger(debts).map(normalizeDebtV2).filter(d=>!d.done&&d.direction===direction).map(d=>`<option value="${d.id}" ${d.id===item.debtId?'selected':''}>${esc(d.person)} · 剩余 ¥${fmt(debtRemainingV2(d))}</option>`).join('');}
  function aiBatchDurationV2(item){const ms=item.status==='working'&&item.startedAt?Date.now()-item.startedAt:Number(item.durationMs)||0;return ms?visionDuration(ms):'';}
  window.renderAiBatchV2=function(){
    const list=document.getElementById('ai_batch_list_v2'),summary=document.getElementById('ai_batch_summary_v2');if(!list||!summary)return;const ok=aiBatchReadyV2(),total=ok.reduce((s,x)=>s+Number(x.amount||0),0);
    summary.innerHTML=`<div>图片<b>${aiBatchItems.length}</b></div><div>识别成功<b>${ok.length}</b></div><div>合计金额<b>¥${fmt(total)}</b></div>`;
    if(!aiBatchItems.length){list.innerHTML=`<div class="ai-empty"><div class="big">🧾</div>请选择需要识别的账单图片</div>`;return;}
    list.innerHTML=aiBatchItems.map(item=>{const elapsed=aiBatchDurationV2(item),stateText={queued:'等待识别',working:'AI 正在识别'+(elapsed?' · 已运行 '+elapsed:''),done:(item.documentType==='unknown'?'无法确定类型，请人工选择':'识别完成，可修改')+(elapsed?' · 耗时 '+elapsed:''),error:'识别失败'+(elapsed?' · 耗时 '+elapsed:'')+'：'+(item.error||'未知错误')}[item.status]||item.status;const isDebt=['loan_out','loan_in'].includes(item.documentType),isRepay=['repayment_received','repayment_paid'].includes(item.documentType),isBill=['expense','income'].includes(item.documentType);return `<div class="batch-item ${item.status}"><div class="batch-item-top"><img class="batch-thumb" src="${safePhotoUrl(item.thumb)}"><div class="batch-item-main"><div class="batch-item-name">${esc(item.fileName)}</div><div class="batch-item-state ${item.status==='done'?'ok':item.status==='error'?'error':''}">${esc(stateText)}</div></div>${item.status==='done'?`<span class="confidence">${item.confidence?Math.round(item.confidence*100)+'%':'待校对'}</span>`:''}</div>
        ${item.status==='done'?`<div class="batch-edit-grid"><select class="wide" onchange="updateAiBatchField('${item.id}','documentType',this.value)">${aiDocOptionsV2(item)}</select><input value="${esc(isBill?(item.merchant||''):(item.person||''))}" placeholder="${isBill?'商家 / 名称':'借还对象'}" onchange="updateAiBatchField('${item.id}','${isBill?'merchant':'person'}',this.value)"><input type="number" value="${item.amount||''}" placeholder="本次金额" onchange="updateAiBatchField('${item.id}','amount',this.value)">${isBill?`<select onchange="updateAiBatchField('${item.id}','category',this.value)">${aiCategoryOptionsV2(item)}</select>`:''}<input type="date" value="${item.date||today()}" onchange="updateAiBatchField('${item.id}','date',this.value)"><select onchange="updateAiBatchField('${item.id}','accountId',this.value)">${aiAccountOptionsV2(item)}</select>${isDebt?`<input type="date" value="${item.firstDueDate||''}" title="约定还款日" onchange="updateAiBatchField('${item.id}','firstDueDate',this.value)"><select onchange="updateAiBatchField('${item.id}','interestType',this.value)"><option value="none" ${item.interestType==='none'?'selected':''}>无利息</option><option value="fixed" ${item.interestType==='fixed'?'selected':''}>固定利率</option><option value="annual" ${item.interestType==='annual'?'selected':''}>年化利率</option></select><input type="number" value="${item.interestRate||0}" placeholder="利率 %" onchange="updateAiBatchField('${item.id}','interestRate',this.value)"><input type="number" value="${item.fee||0}" placeholder="手续费" onchange="updateAiBatchField('${item.id}','fee',this.value)"><input type="number" min="1" value="${item.installments||1}" placeholder="期数" onchange="updateAiBatchField('${item.id}','installments',this.value)"><select onchange="updateAiBatchField('${item.id}','frequency',this.value)"><option value="once" ${item.frequency==='once'?'selected':''}>一次性</option><option value="monthly" ${item.frequency==='monthly'?'selected':''}>每月</option><option value="weekly" ${item.frequency==='weekly'?'selected':''}>每周</option></select>`:''}${isRepay?`<select class="wide" onchange="updateAiBatchField('${item.id}','debtId',this.value)">${aiDebtOptionsV2(item)}</select>`:''}<input class="wide" value="${esc(item.remark||item.purpose||'')}" placeholder="事项摘要 / 用途 / 备注" onchange="updateAiBatchField('${item.id}','remark',this.value)"></div>`:''}
        <div class="batch-item-foot"><span>${item.status==='error'?`<b onclick="retryOneAiBatch('${item.id}')">重新识别</b>`:'AI 结果请在入账前核对'}</span><span class="remove" onclick="removeAiBatchItem('${item.id}')">移除</span></div></div>`;}).join('');
  };
  function reallyOpenAiBatchV3(){renderAiBatchV2();renderVisionHeartbeat();showMask('maskAiBatchV2');}
  window.openAiBatch=function(){requireEntitlementV3('ai.batch_receipt',reallyOpenAiBatchV3);};
  window.chooseAiBatchFiles=function(){requireEntitlementV3('ai.batch_receipt',()=>document.getElementById('ai_batch_files_v2').click());};
  window.onAiBatchFiles=async function(event){
    const files=[...(event.target.files||[])].slice(0,20);event.target.value='';if(!files.length)return;if(aiBatchItems.length+files.length>20){toast('每批最多处理 20 张图片');return;}
    for(const file of files){try{const img=await compressAiImageV2(file);aiBatchItems.push({id:'ai_'+uid(),fileName:file.name||'账单图片',image:img.image,thumb:img.thumb,status:'queued',documentType:'unknown',merchant:'',person:'',amount:0,principal:0,type:'out',category:'其他',date:today(),remark:'',confidence:0,interestType:'none',interestRate:0,fee:0,firstDueDate:'',installments:1,frequency:'once',debtId:'',accountId:liveAccounts()[0]&&liveAccounts()[0].id||''});}catch(e){aiBatchItems.push({id:'ai_'+uid(),fileName:file.name||'图片',thumb:'',status:'error',error:e.message||String(e)});}}
    renderAiBatchV2();processAiBatchV2();
  };
  async function processAiBatchV2(){
    if(aiBatchWorking)return;aiBatchWorking=true;
    if(aiBatchTicker)clearInterval(aiBatchTicker);aiBatchTicker=setInterval(()=>{if(aiBatchWorking)renderAiBatchV2();},500);
    try{
      for(const item of aiBatchItems){
        if(item.status!=='queued')continue;
        item.status='working';item.startedAt=Date.now();item.durationMs=0;renderAiBatchV2();
        try{const result=await callVisionModel(item.image,{capability:'ai.batch_receipt'});if(!result)throw new Error('模型没有返回识别结果');normalizeAiResultV2(result,item);}
        catch(e){item.status='error';item.error=(e.message||String(e)).slice(0,240);}
        item.durationMs=Math.max(0,Date.now()-item.startedAt);item.finishedAt=Date.now();renderAiBatchV2();
      }
    }
    finally{aiBatchWorking=false;if(aiBatchTicker){clearInterval(aiBatchTicker);aiBatchTicker=null;}renderAiBatchV2();}
  }
  window.updateAiBatchField=function(id,key,value){const item=aiBatchItems.find(x=>x.id===id);if(!item)return;if(['amount','interestRate','fee'].includes(key))item[key]=roundMoneyV2(Math.abs(Number(value)||0));else if(key==='installments')item[key]=Math.max(1,parseInt(value)||1);else item[key]=value;if(key==='documentType'){item.type=value==='income'?'in':'out';item.debtId=findAiDebtMatchV2(item.person,value);}if(key==='person'&&['repayment_received','repayment_paid'].includes(item.documentType))item.debtId=findAiDebtMatchV2(item.person,item.documentType);renderAiBatchV2();};
  window.removeAiBatchItem=function(id){const item=aiBatchItems.find(x=>x.id===id);if(aiBatchWorking&&item&&item.status==='working'){toast('这张图片正在识别，完成后才能移除');return;}aiBatchItems=aiBatchItems.filter(x=>x.id!==id);renderAiBatchV2();};
  window.retryOneAiBatch=function(id){const item=aiBatchItems.find(x=>x.id===id);if(!item||!item.image)return;item.status='queued';item.error='';item.startedAt=0;item.durationMs=0;renderAiBatchV2();processAiBatchV2();};
  window.retryAiBatchErrors=function(){aiBatchItems.forEach(x=>{if(x.status==='error'&&x.image){x.status='queued';x.error='';x.startedAt=0;x.durationMs=0;}});renderAiBatchV2();processAiBatchV2();};
  window.clearAiBatch=function(){if(aiBatchWorking){toast('正在识别，请稍候');return;}if(!aiBatchItems.length){renderAiBatchV2();return;}cuteConfirmV2({title:'清空本批识别结果？',text:'尚未入账的图片和识别结果不会保留。',okText:'清空本批'},()=>{aiBatchItems=[];renderAiBatchV2();toast('本批内容已清空');});};
  function aiBatchTransactionsV2(){return aiBatchReadyV2().map(item=>{const account=findAccountById(item.accountId)||liveAccounts()[0],bill=['expense','income'].includes(item.documentType);return {id:uid(),ledger:currentLedger,owner:deviceId,type:bill?(item.documentType==='income'?'in':'out'):(['loan_in','repayment_received'].includes(item.documentType)?'debt_in':'debt_out'),amount:item.amount,category:bill?(item.category||'其他'):AI_DOC_TYPES_V2[item.documentType],account:account&&account.name||'',accountId:account&&account.id||'',date:item.date||today(),merchant:bill?(item.merchant||''):(item.person||''),remark:item.remark||'',photo:item.thumb||null,aiConfidence:item.confidence,aiSource:'batch-image',documentType:item.documentType,createdAt:Date.now(),updatedAt:Date.now()};});}
  window.commitAiBatch=function(){
    const ready=aiBatchReadyV2();if(!ready.length){toast('没有可入账的识别结果；请先确认单据类型和金额');return;}let count=0;const errors=[];
    ready.forEach(item=>{const account=findAccountById(item.accountId)||liveAccounts()[0];if(!account){errors.push(item.fileName+'：未选择账户');return;}const doc=item.documentType;
      if(doc==='expense'||doc==='income'){transactions.push({id:uid(),ledger:currentLedger,owner:deviceId,type:doc==='income'?'in':'out',amount:item.amount,category:item.category||'其他',account:account.name,accountId:account.id,date:item.date||today(),merchant:item.merchant||'',remark:item.remark||'',photo:item.thumb||null,aiConfidence:item.confidence,aiSource:'batch-image',createdAt:Date.now(),updatedAt:Date.now()});count++;return;}
      if(doc==='loan_out'||doc==='loan_in'){const d={id:uid(),ledger:currentLedger,owner:deviceId,person:item.person||item.merchant||'待补充对象',direction:doc==='loan_out'?'lent':'borrowed',principal:item.amount,fee:item.fee||0,interestType:item.interestType||'none',interestRate:item.interestRate||0,date:item.date||today(),firstDueDate:item.firstDueDate||'',installments:item.installments||1,frequency:item.frequency||'once',purpose:item.purpose||item.remark||'',remark:item.remark||'',accountId:account.id,trackAccount:true,repayments:[],repaid:0,done:false,aiConfidence:item.confidence,aiSource:'batch-image',createdAt:Date.now(),updatedAt:Date.now()};debts.push(d);normalizeDebtV2(d);upsertDebtFlowV2(d,null);count++;return;}
      const d=debts.find(x=>x.id===item.debtId&&!isDeleted(x));if(!d){errors.push(item.fileName+'：还款未匹配到借还记录');return;}const left=debtRemainingV2(d);if(item.amount>left+.005){errors.push(item.fileName+'：还款超过剩余 ¥'+fmt(left));return;}const allocation=repaymentAllocationV2(d,item.amount),rp={id:uid(),amount:item.amount,date:item.date||today(),accountId:account.id,method:'other',remark:item.remark||'AI 图片识别还款',trackAccount:true,feePart:allocation.fee,interestPart:allocation.interest,principalPart:allocation.principal,createdAt:Date.now()};d.repayments.push(rp);recomputeDebtV2(d);markUpdated(d);upsertDebtFlowV2(d,rp);count++;
    });
    if(!count){toast(errors[0]||'没有可入账的识别结果',6500);return;}if(!save())return;aiBatchItems=errors.length?aiBatchItems.filter(x=>errors.some(e=>e.startsWith(x.fileName+'：'))):[];renderTx();if(errors.length){renderAiBatchV2();toast(`已分类入账 ${count} 笔，另有 ${errors.length} 笔需补充信息`,6500);}else{hideMask('maskAiBatchV2');toast(`已分类入账 ${count} 笔`,4500);}
  };
  window.exportAiBatch=async function(format){
    const records=aiBatchTransactionsV2();if(!records.length){toast('没有可导出的识别结果');return;}try{if(format==='excel'){toast('正在生成 Excel…');await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');exportExcel(records,'ai');}else{toast('正在生成 PDF…');await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');await exportPDF(records,'ai');}}catch(e){toast('导出失败：首次导出需要联网加载组件',4500);}
  };
  function applyAiDebtToFormV2(item){
    if(item.documentType==='loan_out'||item.documentType==='loan_in'){hideMask('maskTx');openDebt();setDebtDir(item.documentType==='loan_out'?'lent':'borrowed');const values={d_person:item.person||item.merchant,d_amount:item.amount,d_fee:item.fee||0,d_interest_rate:item.interestRate||0,d_date:item.date||today(),d_first_due:item.firstDueDate||'',d_installments:item.installments||1,d_purpose:item.purpose||item.remark||'',d_remark:item.remark||''};Object.entries(values).forEach(([id,v])=>document.getElementById(id).value=v||'');document.getElementById('d_interest_type').value=item.interestType||'none';document.getElementById('d_frequency').value=item.frequency||'once';updateDebtPreview();toast('已识别为借款，请核对详细资料后保存',6500);return true;}
    if(item.documentType==='repayment_received'||item.documentType==='repayment_paid'){const id=findAiDebtMatchV2(item.person,item.documentType);if(!id){hideMask('maskTx');showTab('debt');toast('已识别为还款，但没有唯一匹配的借还记录；请进入对应记录手动还款',7000);return true;}hideMask('maskTx');repayDebt(id);document.getElementById('debt_repay_amount').value=item.amount||'';document.getElementById('debt_repay_date').value=item.date||today();document.getElementById('debt_repay_remark').value=item.remark||'AI 图片识别还款';updateRepayPreview();toast('已识别并匹配还款记录，请核对后保存',6500);return true;}return false;
  }
  recognizeFromPhoto=async function(b64){
    toast('AI 正在识别名称、金额、账单与借还款类型…');
    try{const r=await callVisionModel(b64);if(!r)throw new Error('模型没有返回结果');const item=normalizeAiResultV2(r,{accountId:txAccountId||liveAccounts()[0]&&liveAccounts()[0].id||''});if(applyAiDebtToFormV2(item))return;if(item.documentType==='unknown')toast('AI 无法确定单据类型，已按普通账单回填，请重点核对',6500);if(item.amount)document.getElementById('t_amount').value=item.amount;txType=item.documentType==='income'?'in':'out';setTxType(txType,document.querySelector('#tx_type div[data-t='+txType+']'));const cat=findCat(item.category);if(cat){txCat=cat;renderCatGrid();}document.getElementById('t_date').value=item.date||today();document.getElementById('t_merchant').value=item.merchant||'';if(item.remark)document.getElementById('t_remark').value=item.remark;txAiConfidence=item.confidence;renderSingleAiConfidenceV2();renderVisionHeartbeat();toast(`已识别：${item.merchant||cat||'账单'} ¥${item.amount||''}`);}catch(e){showAiError(e.message||String(e));renderVisionHeartbeat();toast('识别失败：'+(e.message||e),5000);}
  };

  // 平台 AI：客户端不再持有服务商 Key、接口地址或模型名。
  llmCfg=Object.assign({},LLM_DEFAULTS,{enabled:true,provider:'platform'});
  localStorage.setItem('llmCfg',JSON.stringify(llmCfg));
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key||!key.startsWith(AUTH_PROFILE_PREFIX))continue;
    try{const profile=JSON.parse(localStorage.getItem(key)||'null');if(profile&&profile.llmCfg){profile.llmCfg={enabled:true,provider:'platform'};localStorage.setItem(key,JSON.stringify(profile));}}catch(_){}
  }
  window.startPaidPhotoRecognitionV3=function(image){requireEntitlementV3('ai.receipt',()=>recognizeFromPhoto(image));};
  renderLlmUI=function(){renderMembershipUiV3();pingLlm(true);};
  saveLlm=function(runHealth=true){syncUrl=document.getElementById('s_sync').value.trim();localStorage.setItem('syncUrl',syncUrl);toast('服务地址已保存');if(runHealth)pingLlm(false);};
  setLlmEnabled=function(){toast('平台 AI 由管理员统一配置，无需在本机开关');};
  setLlmPreset=function(){};
  fetchModels=function(){toast('模型由管理员后台统一配置，不会暴露给普通用户');};
  testLlm=async function(){const ok=await pingLlm(false);if(ok)toast(hasEntitlementV3('ai.receipt')?'平台 AI 在线，你的权益可用 ✓':'平台 AI 在线；开通会员后即可识别',4500);};
  pingLlm=async function(silent=true){
    if(llmHeartAbort){try{llmHeartAbort.abort();}catch(_){}}
    if(!syncUrl){setLlmStatus('err','平台服务地址未设置');return false;}
    if(!aiFeatureAvailableV3()){membershipStateV3.aiStatus={online:false,maintenance:true};setLlmStatus('err','平台 AI 维护中');renderMembershipUiV3();if(!silent)toast('平台 AI 正在维护，请稍后再试');return false;}
    const ac=new AbortController();llmHeartAbort=ac;const timeout=setTimeout(()=>ac.abort(),8000),preserveWorking=visionHeartbeat.state==='work';
    try{
      if(!preserveWorking)setLlmStatus('','正在检查平台 AI');
      const response=await fetch(syncUrl.replace(/\/$/,'')+'/api/ai/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth({})),cache:'no-store',signal:ac.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){if(response.status===401||response.status===403){membershipStateV3.aiStatus={online:true,requiresAccount:true};visionHeartbeat.lastServiceAt=Date.now();if(!preserveWorking)setLlmStatus('','平台在线，登录后可用');renderMembershipUiV3();return true;}throw new Error(data.error||data.detail||('HTTP '+response.status));}
      membershipStateV3.aiStatus=data;membershipStateV3.entitlements=Object.assign({},membershipStateV3.entitlements,data.entitlements||{});membershipStateV3.usage=Object.assign({},membershipStateV3.usage,data.usage||{});visionHeartbeat.lastServiceAt=Date.now();
      const visionCapability=data.capabilities&&data.capabilities.vision,configured=!visionCapability||visionCapability.configured!==false,online=configured&&(visionCapability?visionCapability.online!==false:data.online!==false);if(!preserveWorking)setLlmStatus(!configured?'pending':online?'ok':'err',!configured?'平台在线 · 后台未配置视觉模型':online?(hasEntitlementV3('ai.receipt')?'平台 AI 在线 · 权益可用':'平台 AI 在线 · 等待开通'):'图片识别线路暂不可用');renderMembershipUiV3();if(!silent&&!configured)toast('转发服务在线，但管理员还没有配置视觉模型');else if(!silent&&!online)toast('平台图片识别暂不可用，请联系管理员');return online;
    }catch(error){if(error.name==='AbortError'&&llmHeartAbort!==ac)return false;membershipStateV3.aiStatus={online:false,error:error.message||String(error)};if(!preserveWorking)setLlmStatus('err','平台 AI 离线');renderMembershipUiV3();if(!silent)toast('平台 AI 检查失败：'+(error.name==='AbortError'?'连接超时':(error.message||error)));return false;}
    finally{clearTimeout(timeout);if(llmHeartAbort===ac)llmHeartAbort=null;}
  };
  callVisionModel=async function(imgB64,options={}){
    const capability=options.capability||'ai.receipt',operation=options.probe?'视觉服务检查':capability==='ai.batch_receipt'?'批量图片识别':'图片识别';
    if(!aiFeatureAvailableV3()){requireEntitlementV3(capability);const error=new Error('平台 AI 正在维护，请稍后再试');error.code='AI_MAINTENANCE';throw error;}
    if(!hasEntitlementV3(capability)){requireEntitlementV3(capability);const error=new Error(authMode==='account'?'当前账号尚未开通这项 AI 权益':'请先注册并开通 AI 会员');error.code='ENTITLEMENT_REQUIRED';throw error;}
    if(!syncUrl)throw new Error('平台服务地址未设置');
    const requestId='ai_'+Date.now().toString(36)+'_'+secureToken().slice(0,16),payload=apiAuth({requestId,capability,image:imgB64});
    const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),90000),startedAt=startVisionHeartbeat(operation);
    try{
      const response=await fetch(syncUrl.replace(/\/$/,'')+'/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ac.signal}),text=await response.text();
      if(!response.ok){const error=parseLlmHttpError(response.status,text);if([401,402,403].includes(response.status)){refreshMembershipV3(true);requireEntitlementV3(capability);error.message=response.status===401?'登录已过期，请重新登录':'会员权益或 AI 额度不可用';}if(response.status===429)error.message='本月 AI 额度已用完或请求太频繁';throw error;}
      let data={};try{data=JSON.parse(text||'{}');}catch(_){throw new Error('平台 AI 返回格式错误');}
      let parsed=data.result&&typeof data.result==='object'?data.result:data.data&&data.data.result&&typeof data.data.result==='object'?data.data.result:null;
      if(!parsed){const content=extractTextFromLlm(data);if(!content)throw new Error('模型没有返回识别结果');parsed=parseFirstJsonObject(content);}
      if(options.probe&&parsed.ok!==true)throw new Error('视觉服务没有确认图片输入');finishVisionHeartbeat(true,operation,'',startedAt);refreshMembershipV3(true);return parsed;
    }catch(error){finishVisionHeartbeat(false,operation,error.name==='AbortError'?'请求超时':(error.message||error),startedAt);throw error;}
    finally{clearTimeout(timeout);}
  };
  startVoice=function(){requireEntitlementV3('ai.voice',()=>{showMask('maskVoice');resetVoiceUI();});};
  beginRecording=async function(event){
    if(event&&event.preventDefault)event.preventDefault();if(mediaRecorder&&mediaRecorder.state==='recording')return;if(!aiFeatureAvailableV3()||!hasEntitlementV3('ai.voice')){requireEntitlementV3('ai.voice',()=>startVoice());return;}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true}),types=['audio/webm','audio/mp4','audio/aac'].filter(t=>MediaRecorder.isTypeSupported(t)),mime=types[0];mediaRecorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);audioChunks=[];mediaRecorder.ondataavailable=event=>{if(event.data&&event.data.size>0)audioChunks.push(event.data);};discardRecording=false;mediaRecorder.onstop=()=>{if(discardRecording){audioChunks=[];resetVoiceUI();return;}processVoiceRecording();};mediaRecorder.start();recordStartTime=Date.now();document.getElementById('voiceStatus').textContent='正在录音…';document.getElementById('voiceSub').textContent='松开手指结束';document.getElementById('voiceHint').textContent='录音会安全发送到平台 AI，不会暴露模型密钥';document.getElementById('voiceMicBtn').classList.add('recording');}catch(error){toast('无法录音：'+(error.message||error));}
  };
  processVoiceRecording=async function(){
    if(!mediaRecorder)return;const blob=new Blob(audioChunks,{type:mediaRecorder.mimeType});document.getElementById('voiceStatus').textContent='AI 识别中…';document.getElementById('voiceSub').textContent='正在通过会员服务处理';
    try{const fd=new FormData();fd.append('file',blob,'audio.'+extForMime(mediaRecorder.mimeType));fd.append('requestId','stt_'+Date.now().toString(36)+'_'+secureToken().slice(0,16));fd.append('capability','ai.voice');appendApiAuth(fd);const response=await fetch(syncUrl.replace(/\/$/,'')+'/api/stt',{method:'POST',body:fd}),data=await response.json().catch(()=>({}));if(!response.ok){if([401,402,403].includes(response.status)){refreshMembershipV3(true);requireEntitlementV3('ai.voice');}throw new Error(data.error||data.detail||('HTTP '+response.status));}const text=data.text||data.transcript||data.result||'';hideMask('maskVoice');if(text)applyVoice(typeof text==='string'?text:JSON.stringify(text));else toast('未能识别到文字');refreshMembershipV3(true);}catch(error){toast('识别失败：'+(error.message||error),5000);resetVoiceUI();}
  };

  window.openTransfer=function(){
    const list=liveAccounts();if(list.length<2){toast('至少需要两个账户才能转账');openAccount();return;}
    const opts=list.map(a=>`<option value="${a.id}">${esc(a.emoji||'💳')} ${esc(a.name)}（¥${fmt(accountBalance(a))}）</option>`).join('');
    document.getElementById('tr_from').innerHTML=opts;document.getElementById('tr_to').innerHTML=opts;document.getElementById('tr_to').selectedIndex=1;
    document.getElementById('tr_amount').value='';document.getElementById('tr_date').value=today();document.getElementById('tr_remark').value='';showMask('maskTransfer');
  };
  window.submitTransfer=function(){
    const from=document.getElementById('tr_from').value,to=document.getElementById('tr_to').value,amount=parseFloat(document.getElementById('tr_amount').value),date=document.getElementById('tr_date').value||today(),remark=document.getElementById('tr_remark').value.trim();
    if(from===to){toast('转出和转入账户不能相同');return;}if(!(amount>0)){toast('请输入正确金额');return;}
    const fa=findAccountById(from),ta=findAccountById(to);if(!fa||!ta)return;
    const record={id:uid(),ledger:currentLedger,owner:deviceId,type:'transfer',amount,category:'账户转账',account:fa.name+' → '+ta.name,fromAccountId:from,toAccountId:to,date,remark,createdAt:Date.now(),updatedAt:Date.now()};transactions.push(record);
    if(!save()){transactions=transactions.filter(x=>x!==record);return;}hideMask('maskTransfer');renderTx();toast('转账已记录，不计入收支');
  };

  // ================= 详细借还管理 =================
  function roundMoneyV2(n){return Math.round((Number(n)||0)*100)/100;}
  function dateValueV2(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);}
  function dateDiffV2(a,b){const x=dateValueV2(a),y=dateValueV2(b);return x&&y?Math.round((y-x)/86400000):0;}
  function addDebtPeriodV2(s,n,frequency){
    const x=dateValueV2(s);if(!x)return '';
    if(frequency==='weekly')x.setDate(x.getDate()+n*7);else if(frequency==='monthly'){const day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));}
    return dateStr(x);
  }
  function debtLastDueV2(d){const first=d.firstDueDate||d.dueDate||'';if(!first)return '';return addDebtPeriodV2(first,Math.max(0,(Number(d.installments)||1)-1),d.frequency||'once');}
  function calculateDebtInterestV2(d){
    const principal=Math.max(0,Number(d.principal)||0),rate=Math.max(0,Number(d.interestRate)||0);
    if(d.interestType==='fixed')return roundMoneyV2(principal*rate/100);
    if(d.interestType==='annual'){const days=Math.max(0,dateDiffV2(d.date||today(),debtLastDueV2(d)||d.firstDueDate||d.date||today()));return roundMoneyV2(principal*rate/100*days/365);}
    return 0;
  }
  function normalizeDebtV2(d){
    if(!d||isDeleted(d))return d;let changed=false;
    if(!Number.isFinite(Number(d.principal))){d.principal=Number(d.amount)||0;changed=true;}else d.principal=Number(d.principal);
    if(!d.interestType){d.interestType='none';changed=true;}if(!Number.isFinite(Number(d.interestRate))){d.interestRate=0;changed=true;}if(!Number.isFinite(Number(d.fee))){d.fee=0;changed=true;}
    if(!Number.isFinite(Number(d.installments))||Number(d.installments)<1){d.installments=1;changed=true;}if(!d.frequency){d.frequency='once';changed=true;}
    if(d.firstDueDate===undefined){d.firstDueDate=d.dueDate||'';changed=true;}if(d.relationship===undefined){d.relationship='';changed=true;}if(d.contact===undefined){d.contact='';changed=true;}if(d.purpose===undefined){d.purpose=d.remark||'';changed=true;}
    if(d.trackAccount===undefined){d.trackAccount=false;changed=true;}if(!Array.isArray(d.repayments)){d.repayments=[];changed=true;}
    d.interestAmount=calculateDebtInterestV2(d);d.amount=roundMoneyV2(d.principal+d.interestAmount+(Number(d.fee)||0));
    recomputeDebtV2(d);if(changed)markUpdated(d);return d;
  }
  function recomputeDebtV2(d){
    if(!d)return;d.principal=Math.max(0,Number(d.principal)||Number(d.amount)||0);d.fee=Math.max(0,Number(d.fee)||0);d.interestAmount=calculateDebtInterestV2(d);d.amount=roundMoneyV2(d.principal+d.interestAmount+d.fee);
    let feeLeft=d.fee,interestLeft=d.interestAmount,principalLeft=d.principal,totalPaid=0;
    d.repayments=(d.repayments||[]).filter(r=>r&&!r.deleted&&Number(r.amount)>0).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.createdAt||0)-(b.createdAt||0));
    d.repayments.forEach(r=>{let pay=Math.min(Number(r.amount)||0,Math.max(0,d.amount-totalPaid));r.amount=roundMoneyV2(pay);r.feePart=roundMoneyV2(Math.min(pay,feeLeft));pay-=r.feePart;feeLeft-=r.feePart;r.interestPart=roundMoneyV2(Math.min(pay,interestLeft));pay-=r.interestPart;interestLeft-=r.interestPart;r.principalPart=roundMoneyV2(Math.min(pay,principalLeft));principalLeft-=r.principalPart;totalPaid=roundMoneyV2(totalPaid+r.amount);r.remaining=roundMoneyV2(Math.max(0,d.amount-totalPaid));});
    d.repaid=roundMoneyV2(Math.min(totalPaid,d.amount));d.done=d.amount>0&&d.repaid>=d.amount-0.005;return d;
  }
  function debtRemainingV2(d){recomputeDebtV2(d);return roundMoneyV2(Math.max(0,d.amount-d.repaid));}
  function debtRemainingPartsV2(d){
    recomputeDebtV2(d);const paid=(k)=>(d.repayments||[]).reduce((s,r)=>s+(Number(r[k])||0),0);
    return {principal:roundMoneyV2(Math.max(0,d.principal-paid('principalPart'))),interest:roundMoneyV2(Math.max(0,d.interestAmount-paid('interestPart'))),fee:roundMoneyV2(Math.max(0,d.fee-paid('feePart')))};
  }
  function buildDebtScheduleV2(d){
    recomputeDebtV2(d);const n=Math.max(1,Math.min(120,Number(d.installments)||1)),first=d.firstDueDate||'';let allocated=0,paid=d.repaid;const rows=[];
    for(let i=0;i<n;i++){const target=i===n-1?roundMoneyV2(d.amount-allocated):roundMoneyV2(d.amount/n);allocated=roundMoneyV2(allocated+target);const paidPart=roundMoneyV2(Math.min(target,Math.max(0,paid)));paid=roundMoneyV2(Math.max(0,paid-paidPart));const due=first?addDebtPeriodV2(first,i,d.frequency||'once'):'';const done=paidPart>=target-0.005,overdue=!done&&due&&due<today();rows.push({index:i+1,due,target,paid:paidPart,done,overdue});}
    return rows;
  }
  function debtStateV2(d){
    recomputeDebtV2(d);if(d.done)return {key:'done',label:'已结清',cls:'done'};const next=buildDebtScheduleV2(d).find(x=>!x.done);if(next&&next.overdue)return {key:'overdue',label:'逾期 '+Math.max(1,dateDiffV2(next.due,today()))+' 天',cls:'overdue'};if(next&&next.due){const days=dateDiffV2(today(),next.due);if(days>=0&&days<=7)return {key:'soon',label:days===0?'今天到期':days+' 天后到期',cls:'soon'};}return {key:'active',label:'进行中',cls:''};
  }
  function debtMethodTextV2(m){return {bank:'银行转账',wechat:'微信',alipay:'支付宝',cash:'现金',other:'其他'}[m]||'未填写';}
  function debtFrequencyTextV2(d){const n=Number(d.installments)||1;if(n<=1)return '一次性';return (d.frequency==='weekly'?'每周':'每月')+' · '+n+' 期';}
  function upsertDebtFlowV2(d,repayment){
    const isRepay=!!repayment,track=isRepay?repayment.trackAccount:d.trackAccount,accountId=isRepay?repayment.accountId:d.accountId;
    let flow=isRepay?(repayment.flowTxId&&transactions.find(t=>t.id===repayment.flowTxId&&!isDeleted(t))):(d.initialFlowTxId&&transactions.find(t=>t.id===d.initialFlowTxId&&!isDeleted(t)));
    if(!track||!accountId){if(flow)markDeleted(flow);return;}
    const account=active(financeAccounts).find(a=>a.id===accountId);if(!account)return;
    const incoming=isRepay?d.direction==='lent':d.direction==='borrowed',amount=isRepay?repayment.amount:d.principal,date=isRepay?repayment.date:d.date;
    const category=isRepay?(d.direction==='lent'?'收到还款':'偿还借款'):(d.direction==='lent'?'借出款项':'借款入账');
    if(!flow){flow={id:uid(),ledger:d.ledger,owner:deviceId,createdAt:Date.now()};transactions.push(flow);if(isRepay)repayment.flowTxId=flow.id;else d.initialFlowTxId=flow.id;}
    Object.assign(flow,{type:incoming?'debt_in':'debt_out',amount:roundMoneyV2(amount),category,account:account.name,accountId:account.id,date,remark:`${d.person} · ${isRepay?(repayment.remark||'还款'):(d.purpose||d.remark||'借还资金')}`,linkedDebtId:d.id,linkedRepaymentId:isRepay?repayment.id:'',debtFlowRole:isRepay?'repayment':'initial'});markUpdated(flow);
  }
  function removeDebtFlowsV2(d,repaymentId){active(transactions).filter(t=>t.linkedDebtId===d.id&&(!repaymentId||t.linkedRepaymentId===repaymentId)).forEach(markDeleted);}

  // ================= 年度还款计划 =================
  function debtModeSwitchV1(){return `<div class="debt-mode-switch-v1"><button type="button" class="${debtViewModeV1==='records'?'on':''}" onclick="setDebtViewModeV1('records')">借还记录</button><button type="button" class="${debtViewModeV1==='plan'?'on':''}" onclick="setDebtViewModeV1('plan')">还款计划</button></div>`;}
  window.setDebtViewModeV1=function(mode){debtViewModeV1=mode==='plan'?'plan':'records';renderDebt();};
  function liveRepaymentPlansV1(){return active(repaymentPlans).filter(p=>p.ledger===currentLedger).sort((a,b)=>Number(b.year)-Number(a.year));}
  function repaymentPlanDebtsV1(plan){const ids=new Set(plan&&Array.isArray(plan.debtIds)?plan.debtIds:[]);return inLedger(debts).map(normalizeDebtV2).filter(d=>d.direction==='borrowed'&&ids.has(d.id));}
  function repaymentPlanStartDateV1(plan){return `${Number(plan.year)}-${String(Math.max(1,Math.min(12,Number(plan.startMonth)||1))).padStart(2,'0')}-01`;}
  function repaymentPlanMonthKeyV1(year,month){return `${year}-${String(month).padStart(2,'0')}`;}
  function repaymentPlanActualV1(plan,debtId='',month=''){
    const start=repaymentPlanStartDateV1(plan),end=`${Number(plan.year)}-12-31`,ids=new Set(plan.debtIds||[]);let total=0;
    inLedger(debts).filter(d=>ids.has(d.id)&&(!debtId||d.id===debtId)).forEach(d=>(d.repayments||[]).forEach(r=>{if(r.date>=start&&r.date<=end&&(!month||String(r.date||'').slice(0,7)===month))total+=Number(r.amount)||0;}));return roundMoneyV2(total);
  }
  function repaymentPlanScheduleV1(plan){
    const debtsList=repaymentPlanDebtsV1(plan),startMonth=Math.max(1,Math.min(12,Number(plan.startMonth)||1)),periods=Math.max(1,Math.min(13-startMonth,Number(plan.installments)||13-startMonth)),start=repaymentPlanStartDateV1(plan);
    const balances=debtsList.map(d=>{const paid=(d.repayments||[]).filter(r=>r.date>=start&&r.date<=`${plan.year}-12-31`).reduce((s,r)=>s+(Number(r.amount)||0),0);return {debt:d,base:roundMoneyV2(debtRemainingV2(d)+paid),remaining:roundMoneyV2(debtRemainingV2(d)+paid)};}).filter(x=>x.base>0);
    const debtTotal=roundMoneyV2(balances.reduce((s,x)=>s+x.base,0)),goal=Math.max(0,Number(plan.targetAmount)||0),scheduledTarget=roundMoneyV2(Math.min(goal,debtTotal));let allocatedTotal=0;const rows=[];
    for(let i=0;i<periods;i++){
      const month=startMonth+i,key=repaymentPlanMonthKeyV1(plan.year,month),leftTarget=roundMoneyV2(Math.max(0,scheduledTarget-allocatedTotal));let monthGoal=plan.strategy==='custom'?Math.max(0,Number((plan.customMonths||{})[key])||0):(i===periods-1?leftTarget:roundMoneyV2(scheduledTarget/periods));monthGoal=roundMoneyV2(Math.min(monthGoal,leftTarget,balances.reduce((s,x)=>s+x.remaining,0)));const allocations=[];
      if(monthGoal>0&&plan.strategy==='equal'){
        const pool=balances.filter(x=>x.remaining>0),poolTotal=pool.reduce((s,x)=>s+x.remaining,0);let used=0;pool.forEach((x,index)=>{let amount=index===pool.length-1?roundMoneyV2(monthGoal-used):roundMoneyV2(Math.min(x.remaining,monthGoal*x.remaining/poolTotal));amount=Math.min(amount,x.remaining,roundMoneyV2(monthGoal-used));if(amount>0){x.remaining=roundMoneyV2(x.remaining-amount);used=roundMoneyV2(used+amount);allocations.push({debtId:x.debt.id,person:x.debt.person,amount});}});
      }else if(monthGoal>0){let rest=monthGoal;[...balances].sort((a,b)=>a.base-b.base||String(a.debt.person).localeCompare(String(b.debt.person),'zh-CN')).forEach(x=>{const amount=roundMoneyV2(Math.min(rest,x.remaining));if(amount>0){x.remaining=roundMoneyV2(x.remaining-amount);rest=roundMoneyV2(rest-amount);allocations.push({debtId:x.debt.id,person:x.debt.person,amount});}});}
      const planned=roundMoneyV2(allocations.reduce((s,x)=>s+x.amount,0)),actual=repaymentPlanActualV1(plan,'',key);allocatedTotal=roundMoneyV2(allocatedTotal+planned);rows.push({month,key,planned,actual,allocations});
    }
    return {rows,debtTotal,scheduledTarget,buffer:roundMoneyV2(Math.max(0,goal-debtTotal)),plannedTotal:allocatedTotal,actualTotal:repaymentPlanActualV1(plan),balances};
  }
  function repaymentPlanStrategyTextV1(v){return {equal:'平均分配',snowball:'雪球法',custom:'自定义金额'}[v]||'平均分配';}
  function repaymentPlanProgressV1(plan,schedule){const goal=Math.max(0,Number(plan.targetAmount)||0),actual=schedule.actualTotal;return goal?Math.min(100,actual/goal*100):0;}
  function repaymentPlanMonthStatusV1(row){const current=today().slice(0,7);if(row.actual>=row.planned-.005&&row.planned>0)return {cls:'done',text:'已完成'};if(row.key<current)return {cls:'late',text:'未达计划'};if(row.key===current)return {cls:'current',text:'本月进行中'};return {cls:'future',text:'待开始'};}
  function renderRepaymentPlanDashboardV1(){
    const plans=liveRepaymentPlansV1();if(!plans.length)return `<div class="repayment-plan-empty-v1"><div>🎯</div><h2>制定第一份年度还款计划</h2><p>关联“我欠别人”的债务，设置年度目标，系统会自动拆分到每个月。</p><button type="button" onclick="openRepaymentPlanV1()">＋ 新建还款计划</button></div>`;
    let plan=plans.find(p=>Number(p.year)===Number(selectedRepaymentPlanYearV1))||plans[0];selectedRepaymentPlanYearV1=Number(plan.year);const schedule=repaymentPlanScheduleV1(plan),progress=repaymentPlanProgressV1(plan,schedule),goal=Math.max(0,Number(plan.targetAmount)||0),remaining=Math.max(0,goal-schedule.actualTotal),debtsList=repaymentPlanDebtsV1(plan),monthlyAverage=schedule.rows.length?roundMoneyV2(schedule.scheduledTarget/schedule.rows.length):0;
    const years=plans.map(p=>`<button type="button" class="${p.id===plan.id?'on':''}" onclick="selectRepaymentPlanYearV1(${Number(p.year)})">${Number(p.year)} 年</button>`).join('');
    const debtCards=debtsList.map(d=>{const left=debtRemainingV2(d),paid=repaymentPlanActualV1(plan,d.id),pct=d.amount?Math.min(100,d.repaid/d.amount*100):0;return `<div class="repayment-plan-debt-v1"><span>${d.done?'✅':'💳'}</span><div><b>${esc(d.person)}</b><small>计划期内已还 ¥${fmt(paid)} · 当前剩余 ¥${fmt(left)}</small><i><em style="width:${pct}%"></em></i></div></div>`;}).join('');
    const months=schedule.rows.map(row=>{const status=repaymentPlanMonthStatusV1(row),ratio=row.planned?Math.min(100,row.actual/row.planned*100):0;return `<article class="repayment-plan-month-v1 ${status.cls}"><header><div><b>${row.month} 月</b><span class="repayment-plan-state-v1">${status.text}</span></div><strong>计划 ¥${fmt(row.planned)} · 已还 ¥${fmt(row.actual)}</strong></header><div class="repayment-plan-month-progress-v1"><i style="width:${ratio}%"></i></div><div class="repayment-plan-allocations-v1">${row.allocations.length?row.allocations.map(a=>{const d=debtsList.find(x=>x.id===a.debtId),pay=Math.min(a.amount,d?debtRemainingV2(d):0);return `<div><span>${esc(a.person)}</span><b>¥${fmt(a.amount)}</b>${pay>0?`<button type="button" onclick="repayFromPlanV1('${plan.id}','${a.debtId}','${row.key}',${pay})">去还款</button>`:'<em>已结清</em>'}</div>`;}).join(''):'<div class="repayment-plan-zero-v1">本月未安排金额</div>'}</div></article>`;}).join('');
    return `<div class="repayment-plan-years-v1">${years}</div><section class="repayment-plan-hero-v1"><div class="repayment-plan-hero-head-v1"><span>${plan.year} 年还款目标</span><div><button onclick="openRepaymentPlanV1('${plan.id}')">编辑</button><button class="danger-text" onclick="deleteRepaymentPlanV1('${plan.id}')">删除</button></div></div><strong>¥${fmt(goal)}</strong><div class="repayment-plan-progress-v1"><i style="width:${progress}%"></i></div><div class="repayment-plan-kpis-v1"><span>已经偿还<b>¥${fmt(schedule.actualTotal)}</b></span><span>目标剩余<b>¥${fmt(remaining)}</b></span><span>每期约还<b>¥${fmt(monthlyAverage)}</b></span></div><p>${schedule.buffer>0?`目标比关联债务多 ¥${fmt(schedule.buffer)}，可作为利息、手续费或缓冲金。`:`${repaymentPlanStrategyTextV1(plan.strategy)} · 每月 ${plan.reminderDay||1} 日提醒`}</p></section><section class="repayment-plan-debts-v1"><div class="feature-title"><span class="bubble">🤝</span>关联欠款 <small>${debtsList.length} 笔 · ¥${fmt(schedule.debtTotal)}</small></div>${debtCards||'<div class="empty">关联债务已全部删除</div>'}</section><section class="repayment-plan-months-v1"><div class="feature-title"><span class="bubble">📅</span>月度还款清单 <small>${schedule.rows.length} 期</small></div>${months}</section>`;
  }
  window.selectRepaymentPlanYearV1=function(year){selectedRepaymentPlanYearV1=Number(year)||new Date().getFullYear();renderDebt();};
  function renderRepaymentPlanDebtPickerV1(){const box=document.getElementById('rp_plan_debts_v1');if(!box)return;const list=inLedger(debts).map(normalizeDebtV2).filter(d=>d.direction==='borrowed'&&!d.done);box.innerHTML=list.length?list.map(d=>`<button type="button" class="${repaymentPlanDebtIdsV1.includes(d.id)?'on':''}" onclick="toggleRepaymentPlanDebtV1('${d.id}')"><span>${repaymentPlanDebtIdsV1.includes(d.id)?'✓':'＋'}</span><b>${esc(d.person)}</b><small>剩余 ¥${fmt(debtRemainingV2(d))}</small></button>`).join(''):'<div class="repayment-plan-no-debt-v1">还没有“我欠别人”的未结清债务，请先新增借还记录。</div>';}
  window.toggleRepaymentPlanDebtV1=function(id){repaymentPlanDebtIdsV1=repaymentPlanDebtIdsV1.includes(id)?repaymentPlanDebtIdsV1.filter(x=>x!==id):[...repaymentPlanDebtIdsV1,id];renderRepaymentPlanDebtPickerV1();renderRepaymentPlanPreviewV1();};
  function repaymentPlanDraftFromFormV1(){const year=Math.round(Number(document.getElementById('rp_plan_year_v1').value)||new Date().getFullYear()),startMonth=Math.max(1,Math.min(12,Number(document.getElementById('rp_plan_start_month_v1').value)||1)),installments=Math.max(1,Math.min(13-startMonth,Number(document.getElementById('rp_plan_installments_v1').value)||1));return {year,targetAmount:roundMoneyV2(Number(document.getElementById('rp_plan_target_v1').value)||0),startMonth,installments,strategy:document.getElementById('rp_plan_strategy_v1').value,customMonths:Object.assign({},repaymentPlanCustomDraftV1),reminderDay:Math.max(1,Math.min(28,Number(document.getElementById('rp_plan_reminder_v1').value)||1)),accountId:document.getElementById('rp_plan_account_v1').value,note:document.getElementById('rp_plan_note_v1').value.trim(),debtIds:[...repaymentPlanDebtIdsV1]};}
  function renderRepaymentPlanCustomInputsV1(draft){const field=document.getElementById('rp_custom_months_field_v1'),box=document.getElementById('rp_custom_months_v1');if(!field||!box)return;field.style.display=draft.strategy==='custom'?'block':'none';if(draft.strategy!=='custom')return;box.innerHTML=Array.from({length:draft.installments},(_,i)=>{const month=draft.startMonth+i,key=repaymentPlanMonthKeyV1(draft.year,month);return `<label><span>${month} 月</span><input type="number" inputmode="decimal" min="0" value="${Number(repaymentPlanCustomDraftV1[key])||''}" placeholder="0.00" onchange="setRepaymentPlanCustomMonthV1('${key}',this.value)"></label>`;}).join('');}
  window.setRepaymentPlanCustomMonthV1=function(key,value){repaymentPlanCustomDraftV1[key]=roundMoneyV2(Math.max(0,Number(value)||0));renderRepaymentPlanPreviewV1();};
  window.renderRepaymentPlanPreviewV1=function(){const box=document.getElementById('rp_plan_preview_v1');if(!box)return;const draft=repaymentPlanDraftFromFormV1();renderRepaymentPlanCustomInputsV1(draft);const selected=inLedger(debts).map(normalizeDebtV2).filter(d=>draft.debtIds.includes(d.id)),debtTotal=roundMoneyV2(selected.reduce((s,d)=>s+debtRemainingV2(d),0)),monthly=draft.installments?roundMoneyV2(Math.min(draft.targetAmount,debtTotal)/draft.installments):0,buffer=Math.max(0,draft.targetAmount-debtTotal);box.innerHTML=draft.targetAmount>0?`关联欠款 <b>¥${fmt(debtTotal)}</b> · ${draft.installments} 期${draft.strategy==='custom'?'，按自定义金额执行':`，每期约 ¥${fmt(monthly)}`}<br>${buffer>0?`目标多出的 ¥${fmt(buffer)} 将显示为利息/手续费缓冲，不会产生超额还款。`:'系统会在最后一期自动处理尾差。'}`:'填写年度目标后显示计划预览';};
  window.openRepaymentPlanV1=function(id=''){const plan=id&&repaymentPlans.find(p=>p.id===id&&!isDeleted(p)),now=new Date(),year=plan&&plan.year||now.getFullYear(),startMonth=plan&&plan.startMonth||now.getMonth()+1,installments=plan&&plan.installments||13-startMonth;editingRepaymentPlanIdV1=plan?plan.id:'';repaymentPlanDebtIdsV1=plan&&Array.isArray(plan.debtIds)?[...plan.debtIds]:inLedger(debts).map(normalizeDebtV2).filter(d=>d.direction==='borrowed'&&!d.done).map(d=>d.id);repaymentPlanCustomDraftV1=Object.assign({},plan&&plan.customMonths||{});document.getElementById('rp_plan_title_v1').textContent=plan?'✏️ 编辑还款计划':'🎯 新建还款计划';document.getElementById('rp_plan_year_v1').value=year;document.getElementById('rp_plan_target_v1').value=plan&&plan.targetAmount||'';document.getElementById('rp_plan_start_month_v1').value=startMonth;document.getElementById('rp_plan_installments_v1').value=Math.min(13-startMonth,installments);document.getElementById('rp_plan_strategy_v1').value=plan&&plan.strategy||'equal';document.getElementById('rp_plan_reminder_v1').value=plan&&plan.reminderDay||Math.min(28,now.getDate());document.getElementById('rp_plan_account_v1').innerHTML=liveAccounts().map(a=>`<option value="${a.id}">${esc(a.emoji||'💳')} ${esc(a.name)}</option>`).join('');if(plan&&plan.accountId)document.getElementById('rp_plan_account_v1').value=plan.accountId;document.getElementById('rp_plan_note_v1').value=plan&&plan.note||'';renderRepaymentPlanDebtPickerV1();renderRepaymentPlanPreviewV1();showMask('maskRepaymentPlanV1');};
  window.saveRepaymentPlanV1=function(){const draft=repaymentPlanDraftFromFormV1();if(!(draft.targetAmount>0)){toast('年度还款目标必须大于 0');return;}if(!draft.debtIds.length){toast('请至少关联一笔“我欠别人”的债务');return;}if(draft.strategy==='custom'&&Object.values(draft.customMonths).reduce((s,x)=>s+Number(x||0),0)<=0){toast('请填写至少一个月的计划金额');return;}const duplicate=liveRepaymentPlansV1().find(p=>Number(p.year)===draft.year&&p.id!==editingRepaymentPlanIdV1);if(duplicate){toast(`${draft.year} 年已经有一份还款计划，请直接编辑原计划`);return;}const before=cloneDataV2(repaymentPlans),now=Date.now(),existing=editingRepaymentPlanIdV1&&repaymentPlans.find(p=>p.id===editingRepaymentPlanIdV1&&!isDeleted(p));if(existing){Object.assign(existing,draft);markUpdated(existing);}else repaymentPlans.push(Object.assign({id:'rp_'+uid(),ledger:currentLedger,owner:deviceId,private:true,createdAt:now,updatedAt:now},draft));if(!save()){repaymentPlans=before;return;}selectedRepaymentPlanYearV1=draft.year;editingRepaymentPlanIdV1='';hideMask('maskRepaymentPlanV1');debtViewModeV1='plan';renderDebt();syncPlannerPushScheduleV2();toast('年度还款计划已保存 🎯');};
  window.deleteRepaymentPlanV1=function(id){const index=repaymentPlans.findIndex(p=>p.id===id&&!isDeleted(p)),plan=repaymentPlans[index];if(!plan)return;cuteConfirmV2({title:'删除这份还款计划？',text:`${plan.year} 年目标 ¥${fmt(plan.targetAmount)}。只删除计划，不会删除借还记录和已还款流水。`,okText:'删除计划'},()=>{const before=plan,now=Date.now();repaymentPlans[index]={id:plan.id,ledger:plan.ledger,owner:plan.owner,userId:plan.userId,private:true,deleted:true,deletedAt:now,updatedAt:now};if(!save()){repaymentPlans[index]=before;return;}renderDebt();syncPlannerPushScheduleV2();toast('还款计划已删除');});};
  window.repayFromPlanV1=function(planId,debtId,month,amount){const plan=repaymentPlans.find(p=>p.id===planId&&!isDeleted(p)),d=debts.find(x=>x.id===debtId&&!isDeleted(x));if(!plan||!d)return;repaymentPlanReturnV1={planId,month};repayDebt(debtId);document.getElementById('debt_repay_amount').value=fmt(Math.min(Number(amount)||0,debtRemainingV2(d)));document.getElementById('debt_repay_date').value=today();document.getElementById('debt_repay_remark').value=`还款计划 ${month}`;if(plan.accountId)document.getElementById('debt_repay_account').value=plan.accountId;document.getElementById('debt_repay_track').value='yes';updateRepayPreview();};
  window.cancelRepayV1=function(){repaymentPlanReturnV1=null;repayId=null;hideMask('maskRepay');};
  function checkRepaymentPlanReminderV1(){const month=today().slice(0,7),day=new Date().getDate(),key='xqxRepaymentReminder:'+today();if(localStorage.getItem(key))return;const plan=liveRepaymentPlansV1().find(p=>Number(p.year)===new Date().getFullYear()&&Number(p.reminderDay||1)<=day);if(!plan)return;const row=repaymentPlanScheduleV1(plan).rows.find(x=>x.key===month);if(!row||row.planned<=0||row.actual>=row.planned-.005)return;localStorage.setItem(key,'1');const body=`本月计划还 ¥${fmt(row.planned)}，已还 ¥${fmt(row.actual)}，还差 ¥${fmt(row.planned-row.actual)}`;toast('🎯 '+body,6500);try{if('Notification' in window&&Notification.permission==='granted')new Notification('本月还款计划提醒',{body});}catch(_){}}

  window.setDebtFilterV2=function(v){debtFilterV2=v;renderDebt();};
  renderDebt=function(){
    document.getElementById('title').textContent='借还 · '+curLedger().name;hideTopAct();if(debtViewModeV1==='plan'){setFab('新建计划',()=>openRepaymentPlanV1());document.getElementById('view').innerHTML=renderLedgerBar()+debtModeSwitchV1()+renderRepaymentPlanDashboardV1();checkRepaymentPlanReminderV1();return;}setFab('新增借还',openDebt);
    const all=inLedger(debts).map(normalizeDebtV2),open=all.filter(d=>!d.done),lent=open.filter(d=>d.direction==='lent'),borrowed=open.filter(d=>d.direction==='borrowed');
    const collect=lent.reduce((s,d)=>s+debtRemainingV2(d),0),pay=borrowed.reduce((s,d)=>s+debtRemainingV2(d),0),overdue=open.filter(d=>debtStateV2(d).key==='overdue').length;
    let list=all.filter(d=>debtFilterV2==='all'||(debtFilterV2==='active'&&!d.done)||(debtFilterV2==='done'&&d.done)||(debtFilterV2==='overdue'&&debtStateV2(d).key==='overdue')||d.direction===debtFilterV2);
    list.sort((a,b)=>{const sa=debtStateV2(a).key,sb=debtStateV2(b).key;if(sa!==sb)return sa==='overdue'?-1:sb==='overdue'?1:sa==='done'?1:sb==='done'?-1:0;return (debtLastDueV2(a)||'9999').localeCompare(debtLastDueV2(b)||'9999');});
    let h=renderLedgerBar()+debtModeSwitchV1()+`<div class="debt-summary-hero"><div class="dsh-title">借还净额（应收 - 应付）</div><div class="dsh-money">${collect-pay>=0?'+':'-'} ¥${fmt(Math.abs(collect-pay))}</div><div class="debt-summary-grid"><span>待收回<b>¥${fmt(collect)}</b></span><span>待偿还<b>¥${fmt(pay)}</b></span><span>已逾期<b>${overdue} 笔</b></span></div></div>
      <div class="debt-filters">${[['active','未结清'],['overdue','已逾期'],['lent','我借出'],['borrowed','我借入'],['done','已结清'],['all','全部']].map(x=>`<span class="debt-filter ${debtFilterV2===x[0]?'on':''}" onclick="setDebtFilterV2('${x[0]}')">${x[1]}</span>`).join('')}</div>`;
    if(!list.length)h+=`<div class="empty"><div class="big">🤝</div>${all.length?'当前筛选下没有记录':'还没有借还记录，点下方按钮新建'}</div>`;
    else h+=`<div class="card"><div class="head"><span class="name">借还清单</span><span class="badge b-active">${list.length} 笔</span></div>${list.map(d=>{const left=debtRemainingV2(d),pct=d.amount?Math.min(100,d.repaid/d.amount*100):0,state=debtStateV2(d),next=buildDebtScheduleV2(d).find(x=>!x.done),account=findAccountById(d.accountId);return `<div class="debt-v2 ${state.cls}" onclick="openDebtDetail('${d.id}')"><div class="debt-v2-head"><div class="debt-avatar">${d.direction==='lent'?'💚':'❤️'}</div><div class="debt-v2-main"><div class="debt-v2-name">${esc(d.person)} <span class="debt-status ${state.cls}">${state.label}</span></div><div class="debt-v2-meta">${d.direction==='lent'?'我借给对方':'我向对方借'} · ${esc(d.purpose||d.remark||'未填写用途')}</div></div><div class="debt-v2-money">剩余<b>¥${fmt(left)}</b></div></div><div class="prog"><i style="width:${pct}%;background:${state.key==='overdue'?'var(--red)':'var(--brand)'}"></i></div><div class="debt-v2-foot"><span>${next&&next.due?'下期 '+next.due:'未设还款日'} · ${account?esc(account.name):'不关联账户'}</span><span class="debt-v2-actions">${left>0?`<span class="primary" onclick="event.stopPropagation();repayDebt('${d.id}')">记还款</span>`:''}<span onclick="event.stopPropagation();openDebt('${d.id}')">编辑</span></span></div></div>`;}).join('')}</div>`;
    document.getElementById('view').innerHTML=h;
  };

  openDebt=function(id){
    const d=id&&debts.find(x=>x.id===id&&!isDeleted(x));editingDebtId=d?d.id:null;if(d)normalizeDebtV2(d);debtDir=d?d.direction:'lent';
    document.getElementById('debt_sheet_title').textContent=d?'✏️ 编辑借还':'🤝 新建借还';document.getElementById('debt_save_btn').textContent=d?'保存修改':'保存借还';
    document.querySelectorAll('#debt_dir div').forEach(x=>x.classList.toggle('on',x.dataset.d===debtDir));
    const values={d_person:d&&d.person||'',d_relationship:d&&d.relationship||'',d_contact:d&&d.contact||'',d_amount:d&&d.principal||'',d_fee:d&&d.fee||0,d_interest_rate:d&&d.interestRate||0,d_date:d&&d.date||today(),d_first_due:d&&d.firstDueDate||'',d_installments:d&&d.installments||1,d_purpose:d&&d.purpose||'',d_remark:d&&d.remark||''};
    Object.entries(values).forEach(([key,val])=>document.getElementById(key).value=val);document.getElementById('d_interest_type').value=d&&d.interestType||'none';document.getElementById('d_frequency').value=d&&d.frequency||'once';document.getElementById('d_track').value=d?(d.trackAccount?'yes':'no'):'yes';
    const accounts=liveAccounts();document.getElementById('d_account').innerHTML=accounts.map(a=>`<option value="${a.id}">${esc(a.emoji||'💳')} ${esc(a.name)}（¥${fmt(accountBalance(a))}）</option>`).join('');if(d&&d.accountId)document.getElementById('d_account').value=d.accountId;
    updateDebtPreview();hideMask('maskDebtDetailV2');showMask('maskDebt');
  };
  setDebtDir=function(d){debtDir=d;document.querySelectorAll('#debt_dir div').forEach(x=>x.classList.toggle('on',x.dataset.d===d));updateDebtPreview();};
  function debtDraftFromFormV2(){return {principal:parseFloat(document.getElementById('d_amount').value)||0,fee:parseFloat(document.getElementById('d_fee').value)||0,interestType:document.getElementById('d_interest_type').value,interestRate:parseFloat(document.getElementById('d_interest_rate').value)||0,date:document.getElementById('d_date').value||today(),firstDueDate:document.getElementById('d_first_due').value,installments:Math.max(1,parseInt(document.getElementById('d_installments').value)||1),frequency:document.getElementById('d_frequency').value};}
  window.updateDebtPreview=function(){
    const el=document.getElementById('debt_preview_v2');if(!el)return;const d=debtDraftFromFormV2();const interest=calculateDebtInterestV2(d),total=roundMoneyV2(d.principal+interest+d.fee),last=debtLastDueV2(d),per=d.installments?roundMoneyV2(total/d.installments):total;
    el.innerHTML=d.principal>0?`${debtDir==='lent'?'对方应还':'我应还'} <b>¥${fmt(total)}</b><br>本金 ¥${fmt(d.principal)} ＋ 利息 ¥${fmt(interest)} ＋ 费用 ¥${fmt(d.fee)}<br>${d.installments} 期，每期约 ¥${fmt(per)}${last?' · 最后一期 '+last:''}`:'填写本金后显示应还总额';
  };
  submitDebt=function(){
    const person=document.getElementById('d_person').value.trim(),draft=debtDraftFromFormV2(),relationship=document.getElementById('d_relationship').value.trim(),contact=document.getElementById('d_contact').value.trim(),purpose=document.getElementById('d_purpose').value.trim(),remark=document.getElementById('d_remark').value.trim(),accountId=document.getElementById('d_account').value,trackAccount=document.getElementById('d_track').value==='yes';
    if(!person){toast('请填写对方称呼');return;}if(!(draft.principal>0)){toast('本金必须大于 0');return;}if(draft.interestType==='annual'&&!draft.firstDueDate){toast('年化利息需要填写约定还款日');return;}if(draft.installments>1&&draft.frequency==='once'){toast('多期还款请选择每月或每周');return;}if(draft.firstDueDate&&draft.firstDueDate<draft.date){toast('还款日不能早于借款日期');return;}
    const beforeDebts=cloneDataV2(debts),beforeTx=cloneDataV2(transactions);let d=editingDebtId&&debts.find(x=>x.id===editingDebtId&&!isDeleted(x));if(!d){d={id:uid(),ledger:currentLedger,owner:deviceId,repayments:[],repaid:0,done:false,createdAt:Date.now()};debts.push(d);}
    const interestAmount=calculateDebtInterestV2(draft),total=roundMoneyV2(draft.principal+interestAmount+draft.fee);if(total<(Number(d.repaid)||0)-0.005){toast('应还总额不能低于已经偿还的金额');return;}
    Object.assign(d,draft,{person,direction:debtDir,relationship,contact,purpose,remark,accountId,trackAccount,interestAmount,amount:total});recomputeDebtV2(d);markUpdated(d);upsertDebtFlowV2(d,null);if(!save()){debts=beforeDebts;transactions=beforeTx;return;}editingDebtId=null;hideMask('maskDebt');renderDebt();toast('借还资料已保存');
  };

  repayDebt=function(id){
    const d=debts.find(x=>x.id===id&&!isDeleted(x));if(!d)return;normalizeDebtV2(d);const left=debtRemainingV2(d);if(left<=0){toast('这笔借还已经结清');return;}repayId=id;
    const parts=debtRemainingPartsV2(d);document.getElementById('debt_repay_info').innerHTML=`<b>${esc(d.person)}</b> · ${d.direction==='lent'?'对方还给我':'我还给对方'}<br>剩余 ¥${fmt(left)}（本金 ${fmt(parts.principal)} / 利息 ${fmt(parts.interest)} / 费用 ${fmt(parts.fee)}）`;
    document.getElementById('debt_repay_amount').value='';document.getElementById('debt_repay_date').value=today();document.getElementById('debt_repay_remark').value='';document.getElementById('debt_repay_track').value=d.trackAccount?'yes':'no';
    document.getElementById('debt_repay_account').innerHTML=liveAccounts().map(a=>`<option value="${a.id}">${esc(a.emoji||'💳')} ${esc(a.name)}</option>`).join('');if(d.accountId)document.getElementById('debt_repay_account').value=d.accountId;updateRepayPreview();hideMask('maskDebtDetailV2');showMask('maskRepay');
  };
  function repaymentAllocationV2(d,amount){const parts=debtRemainingPartsV2(d);let v=Math.min(Number(amount)||0,debtRemainingV2(d));const fee=Math.min(v,parts.fee);v-=fee;const interest=Math.min(v,parts.interest);v-=interest;const principal=Math.min(v,parts.principal);return {fee:roundMoneyV2(fee),interest:roundMoneyV2(interest),principal:roundMoneyV2(principal)};}
  window.updateRepayPreview=function(){const d=debts.find(x=>x.id===repayId&&!isDeleted(x)),el=document.getElementById('repay_breakdown_v2');if(!d||!el)return;const amount=parseFloat(document.getElementById('debt_repay_amount').value)||0,a=repaymentAllocationV2(d,amount);el.innerHTML=amount>0?`本次将分配：费用 <b>¥${fmt(a.fee)}</b> · 利息 <b>¥${fmt(a.interest)}</b> · 本金 <b>¥${fmt(a.principal)}</b>`:'输入金额后显示本金、利息与费用分配';};
  submitRepay=function(){
    const d=debts.find(x=>x.id===repayId&&!isDeleted(x));if(!d)return;const amount=roundMoneyV2(parseFloat(document.getElementById('debt_repay_amount').value)),date=document.getElementById('debt_repay_date').value||today(),accountId=document.getElementById('debt_repay_account').value,method=document.getElementById('debt_repay_method').value,remark=document.getElementById('debt_repay_remark').value.trim(),trackAccount=document.getElementById('debt_repay_track').value==='yes',left=debtRemainingV2(d);
    if(!(amount>0)){toast('请输入正确的还款金额');return;}if(amount>left+0.005){toast('本次还款不能超过剩余 ¥'+fmt(left));return;}const allocation=repaymentAllocationV2(d,amount);
    const beforeDebts=cloneDataV2(debts),beforeTx=cloneDataV2(transactions),returnPlan=repaymentPlanReturnV1,r={id:uid(),amount,date,accountId,method,remark,trackAccount,repaymentPlanId:returnPlan&&returnPlan.planId||'',planMonth:returnPlan&&returnPlan.month||'',feePart:allocation.fee,interestPart:allocation.interest,principalPart:allocation.principal,createdAt:Date.now()};d.repayments.push(r);recomputeDebtV2(d);markUpdated(d);upsertDebtFlowV2(d,r);const id=d.id;if(!save()){debts=beforeDebts;transactions=beforeTx;return;}repayId=null;repaymentPlanReturnV1=null;hideMask('maskRepay');if(returnPlan){debtViewModeV1='plan';renderDebt();syncPlannerPushScheduleV2();}else{renderDebt();openDebtDetail(id);}toast(d.done?'已全部结清 🎉':'还款已记录 ¥'+fmt(amount));
  };

  window.openDebtDetail=function(id){
    const d=debts.find(x=>x.id===id&&!isDeleted(x));if(!d)return;normalizeDebtV2(d);const left=debtRemainingV2(d),state=debtStateV2(d),parts=debtRemainingPartsV2(d),account=findAccountById(d.accountId),schedule=buildDebtScheduleV2(d),logs=[...(d.repayments||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||0)-(a.createdAt||0));
    const scheduleHtml=schedule.map(s=>`<div class="schedule-row ${s.done?'done':s.overdue?'overdue':''}"><span class="num">${s.done?'✓':s.index}</span><span>${s.due||'未设日期'}<br><small>${s.done?'已完成':s.overdue?'已逾期':'待还款'}</small></span><b>¥${fmt(s.target)}${s.paid?`<br><small>已还 ${fmt(s.paid)}</small>`:''}</b></div>`).join('');
    const logsHtml=logs.length?logs.map(r=>{const a=findAccountById(r.accountId);return `<div class="repay-v2"><div class="rv-icon">💰</div><div class="rv-main">${r.date} · ${debtMethodTextV2(r.method)}<small>本金 ${fmt(r.principalPart)} / 利息 ${fmt(r.interestPart)} / 费用 ${fmt(r.feePart)}${r.remark?' · '+esc(r.remark):''}${a?' · '+esc(a.name):''}</small></div><div class="rv-side">¥${fmt(r.amount)}<small onclick="deleteDebtRepayment('${d.id}','${r.id}')">删除</small></div></div>`;}).join(''):`<div class="repay-empty">暂无还款流水</div>`;
    document.getElementById('debt_detail_content_v2').innerHTML=`<div class="debt-detail-top"><div class="avatar">${d.direction==='lent'?'💚':'❤️'}</div><h2>${esc(d.person)}</h2><p>${d.direction==='lent'?'我借给对方':'我向对方借'} · <span class="debt-status ${state.cls}">${state.label}</span></p></div>
      <div class="detail-money-box"><div>应还总额<b>¥${fmt(d.amount)}</b></div><div>已还金额<b>¥${fmt(d.repaid)}</b></div><div>剩余金额<b>¥${fmt(left)}</b></div></div><div class="prog"><i style="width:${d.amount?Math.min(100,d.repaid/d.amount*100):0}%;background:${state.key==='overdue'?'var(--red)':'var(--brand)'}"></i></div>
      <div class="debt-info-grid"><div class="info-box">本金<b>¥${fmt(d.principal)}</b></div><div class="info-box">利息 / 费用<b>¥${fmt(d.interestAmount)} / ¥${fmt(d.fee)}</b></div><div class="info-box">未还构成<b>本 ${fmt(parts.principal)} · 息 ${fmt(parts.interest)} · 费 ${fmt(parts.fee)}</b></div><div class="info-box">还款计划<b>${debtFrequencyTextV2(d)}</b></div><div class="info-box">起始日期<b>${d.date||'未填写'}</b></div><div class="info-box">最后到期日<b>${debtLastDueV2(d)||'未设置'}</b></div><div class="info-box">关系 / 联系方式<b>${esc([d.relationship,d.contact].filter(Boolean).join(' · ')||'未填写')}</b></div><div class="info-box">关联账户<b>${account?esc(account.name):'不关联账户'}</b></div></div>
      ${(d.purpose||d.remark)?`<div class="debt-preview">${d.purpose?`<b>用途：</b>${esc(d.purpose)}<br>`:''}${d.remark?`<b>备注：</b>${esc(d.remark)}`:''}</div>`:''}
      <div class="feature-title" style="margin-top:12px"><span class="bubble">📅</span>分期计划</div><div class="schedule-list">${scheduleHtml}</div><div class="feature-title" style="margin-top:16px"><span class="bubble">💰</span>还款流水</div>${logsHtml}
      <div class="btnrow" style="margin:16px 0 8px">${left>0?`<div class="btn btn-primary" onclick="repayDebt('${d.id}')">＋ 记录还款</div>`:''}<div class="btn btn-line" onclick="openDebt('${d.id}')">编辑资料</div></div><div class="sheet-btns"><div class="btn btn-ghost danger-text" onclick="deleteDebt('${d.id}')">删除整笔</div><div class="btn btn-cancel" onclick="hideMask('maskDebtDetailV2')">关闭</div></div>`;showMask('maskDebtDetailV2');
  };
  window.deleteDebtRepayment=function(debtId,repaymentId){
    const d=debts.find(x=>x.id===debtId&&!isDeleted(x)),r=d&&(d.repayments||[]).find(x=>x.id===repaymentId);if(!d||!r)return;
    cuteConfirmV2({title:'删除这笔还款？',text:`${r.date} · ¥${fmt(r.amount)}\n关联的账户资金流水也会一并撤销。`,okText:'删除还款'},()=>{const beforeDebts=cloneDataV2(debts),beforeTx=cloneDataV2(transactions);removeDebtFlowsV2(d,repaymentId);d.repayments=d.repayments.filter(x=>x.id!==repaymentId);recomputeDebtV2(d);markUpdated(d);if(!save()){debts=beforeDebts;transactions=beforeTx;return;}renderDebt();openDebtDetail(d.id);toast('还款流水已删除');});
  };
  deleteDebt=function(id){
    const index=debts.findIndex(x=>x.id===id&&!isDeleted(x)),d=debts[index];if(!d)return;
    cuteConfirmV2({title:'删除整笔借还？',text:`与「${d.person}」的借还、全部还款记录和关联账户资金流水都会撤销，并从年度还款计划中移除。`,okText:'删除整笔'},()=>{const beforeDebts=cloneDataV2(debts),beforeTx=cloneDataV2(transactions),beforePlans=cloneDataV2(repaymentPlans);removeDebtFlowsV2(d);const now=Date.now();debts[index]={id:d.id,ledger:d.ledger,owner:d.owner,userId:d.userId,deleted:true,deletedAt:now,updatedAt:now};active(repaymentPlans).forEach(p=>{if(Array.isArray(p.debtIds)&&p.debtIds.includes(d.id)){p.debtIds=p.debtIds.filter(x=>x!==d.id);markUpdated(p);}});if(!save()){debts=beforeDebts;transactions=beforeTx;repaymentPlans=beforePlans;return;}hideMask('maskDebtDetailV2');renderDebt();syncPlannerPushScheduleV2();toast('整笔借还已删除');});
  };
  deleteTx=function(id){
    const index=transactions.findIndex(x=>x.id===id&&!isDeleted(x)),t=transactions[index];if(!t)return;if(t.linkedDebtId){toast('这是借还关联资金，请在「借还详情」中修改');return;}
    cuteConfirmV2({title:'删除这条流水？',text:`${t.date||''} ${t.merchant||t.category||'记账'} · ¥${fmt(t.amount||0)}\n删除后会同步到其他设备。`,okText:'删除流水'},()=>{
      const before=t,now=Date.now();transactions[index]={id:t.id,ledger:t.ledger,owner:t.owner,userId:t.userId,deleted:true,deletedAt:now,updatedAt:now};
      if(!save()){transactions[index]=before;return;}renderTx();toast('已删除');
    });
  };

  // ================= 个人规划 / 日程备忘 =================
  const PLAN_CATEGORIES_V2={
    work:{name:'工作',emoji:'💻',color:'#5b8ff9'},fitness:{name:'运动',emoji:'🏃',color:'#35b78f'},study:{name:'学习',emoji:'📚',color:'#8b6de0'},rest:{name:'休息',emoji:'😴',color:'#7e91ad'},life:{name:'生活',emoji:'🌷',color:'#ff7e9d'},other:{name:'其他',emoji:'✨',color:'#efa83b'}
  };
  let plannerEditingCategory='work';
  const PLAN_PRIORITIES_V3={P0:{label:'P0',name:'紧急重要',hint:'必须优先处理，排在最前面',color:'#ef476f'},P1:{label:'P1',name:'重要',hint:'重要但可以稍后处理',color:'#f59e0b'},P2:{label:'P2',name:'普通',hint:'日常计划，默认优先级',color:'#3b82f6'},P3:{label:'P3',name:'稍后',hint:'不着急，有空时完成',color:'#8b8fa3'}};
  let plannerEditingPriorityV3='P2';
  function plannerCategoryV2(key){return PLAN_CATEGORIES_V2[key]||PLAN_CATEGORIES_V2.other;}
  function plannerPriorityV3(value){return PLAN_PRIORITIES_V3[String(value||'').toUpperCase()]||PLAN_PRIORITIES_V3.P2;}
  function plannerPriorityRankV3(value){return ['P0','P1','P2','P3'].indexOf(plannerPriorityV3(value).label);}
  function plannerAddDateV2(date,days){const p=String(date||today()).split('-').map(Number),d=new Date(p[0],p[1]-1,p[2]);d.setDate(d.getDate()+days);return dateStr(d);}
  function plannerDateTimeV2(date,time){const p=String(date).split('-').map(Number),t=String(time||'00:00').split(':').map(Number);return new Date(p[0],p[1]-1,p[2],t[0]||0,t[1]||0,0,0).getTime();}
  function plannerOccurrenceIntervalV2(plan,date){const start=plannerDateTimeV2(date,plan.startTime),rawEnd=plannerDateTimeV2(date,plan.endTime);return {start,end:rawEnd<=start?rawEnd+86400000:rawEnd};}
  function plannerOccursOnV2(plan,date){
    if(!plan||isDeleted(plan)||date<plan.date||(plan.repeatUntil&&date>plan.repeatUntil))return false;
    if(plan.repeat==='none'||!plan.repeat)return date===plan.date;
    const day=new Date(date+'T12:00:00').getDay();
    if(plan.repeat==='daily')return true;
    if(plan.repeat==='weekdays')return day>=1&&day<=5;
    if(plan.repeat==='weekly')return day===new Date(plan.date+'T12:00:00').getDay();
    if(plan.repeat==='custom')return (plan.repeatDays||[]).map(Number).includes(day);
    return false;
  }
  function plannerStateForV2(plan,date,create=true){plan.stateByDate=plan.stateByDate&&typeof plan.stateByDate==='object'?plan.stateByDate:{};if(plan.stateByDate[date])return plan.stateByDate[date];return create?(plan.stateByDate[date]={}):{};}
  function plannerOccurrencesV2(date){return active(personalPlans).filter(p=>plannerOccursOnV2(p,date)).map(p=>({plan:p,date,interval:plannerOccurrenceIntervalV2(p,date),state:plannerStateForV2(p,date,false)})).sort((a,b)=>plannerPriorityRankV3(a.plan.priority)-plannerPriorityRankV3(b.plan.priority)||a.interval.start-b.interval.start||String(a.plan.title||'').localeCompare(String(b.plan.title||''),'zh-CN'));}
  function plannerRepeatTextV2(p){if(p.repeat==='daily')return '每天';if(p.repeat==='weekdays')return '工作日';if(p.repeat==='weekly')return '每周';if(p.repeat==='custom')return '每周 '+(p.repeatDays||[]).map(x=>'日一二三四五六'[Number(x)]).join('、');return '仅一次';}
  function plannerTimeTextV2(p){return `${p.startTime}–${p.endTime}${p.endTime<=p.startTime?'（次日）':''}`;}
  function plannerStatusV2(o){
    if(o.state.completed)return {key:'done',label:'已完成'};
    const now=Date.now();if(o.date===today()&&now>=o.interval.start&&now<o.interval.end)return {key:'doing',label:'进行中'};
    if(o.date===today()&&now>=o.interval.end)return {key:'missed',label:'已结束'};
    return {key:'upcoming',label:o.date===today()?'待开始':'已安排'};
  }
  function plannerConflictV2(candidate,excludeId){
    const repeat=candidate.repeat||'none',limit=repeat==='none'?1:62;
    for(let i=0;i<limit;i++){
      const date=plannerAddDateV2(candidate.date,i);if(candidate.repeatUntil&&date>candidate.repeatUntil)break;if(!plannerOccursOnV2(candidate,date))continue;
      const a=plannerOccurrenceIntervalV2(candidate,date);
      for(const p of active(personalPlans)){
        if(p.id===excludeId)continue;
        for(const base of [plannerAddDateV2(date,-1),date,plannerAddDateV2(date,1)]){
          if(!plannerOccursOnV2(p,base))continue;const b=plannerOccurrenceIntervalV2(p,base);
          if(a.start<b.end&&b.start<a.end)return {plan:p,date};
        }
      }
    }
    return null;
  }
  const GROWTH_MOODS_V5={happy:'愉快',calm:'平静',excited:'兴奋',tired:'疲惫',sad:'低落'};
  const GROWTH_WEATHER_V5={sunny:'晴朗',cloudy:'多云',rainy:'下雨',windy:'有风',snowy:'下雪'};
  function growthOwnerV5(){return {owner:deviceId,userId:authMode==='account'&&authUser&&authUser.id||undefined,private:true};}
  function growthDayV5(ts){return dateStr(new Date(Number(ts)||Date.now()));}
  function growthTimeV5(ts){return new Date(Number(ts)||Date.now()).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});}
  function growthDayTitleV5(date){const d=new Date(date+'T12:00:00'),label=date===today()?'今天':date===plannerAddDateV2(today(),-1)?'昨天':`${d.getMonth()+1}月${d.getDate()}日`;return `${label} <span>${date} · 星期${'日一二三四五六'[d.getDay()]}</span>`;}
  function growthGoalScopeDueV1(scope){if(scope==='today')return today();if(scope==='tomorrow')return plannerAddDateV2(today(),1);if(scope==='year')return `${new Date().getFullYear()}-12-31`;return today();}
  function growthGoalScopeTextV1(goal){if(goal.scope==='today')return '今天';if(goal.scope==='tomorrow')return '明天';if(goal.scope==='year')return `${String(goal.dueDate||'').slice(0,4)||new Date().getFullYear()} 年目标`;return `截至 ${goal.dueDate}`;}
  function growthGoalValueTextV1(goal,value){const n=Math.max(0,Number(value)||0),unit=goal.unit|| (goal.kind==='money'?'元':'%');return goal.kind==='money'?`¥${fmt(n)}`:`${Math.round(n*100)/100}${esc(unit)}`;}
  function growthGoalPercentV1(goal){if(goal.completed)return 100;const target=Math.max(.01,Number(goal.targetValue)||100);return Math.min(100,Math.max(0,(Number(goal.currentValue)||0)/target*100));}
  function growthGoalStatusV1(goal){if(goal.completed)return {key:'done',label:'已完成'};if(goal.dueDate<today())return {key:'overdue',label:'已逾期'};if(goal.dueDate===today())return {key:'today',label:'今天到期'};if(goal.dueDate===plannerAddDateV2(today(),1))return {key:'soon',label:'明天到期'};return {key:'active',label:'进行中'};}
  function growthGoalCardV1(goal){const pct=growthGoalPercentV1(goal),status=growthGoalStatusV1(goal),priority=plannerPriorityV3(goal.priority),remaining=goal.completed?0:Math.max(0,(Number(goal.targetValue)||0)-(Number(goal.currentValue)||0));return `<article class="growth-goal-card-v1 ${status.key}" style="--goal-priority:${priority.color}"><header><span class="growth-goal-priority-v1">${priority.label}</span><div><small>${esc(growthGoalScopeTextV1(goal))}</small><h3>${esc(goal.title)}</h3></div><em>${status.label}</em></header>${goal.note?`<p>${esc(goal.note)}</p>`:''}<div class="growth-goal-values-v1"><span>当前<b>${growthGoalValueTextV1(goal,goal.completed?goal.targetValue:goal.currentValue)}</b></span><span>目标<b>${growthGoalValueTextV1(goal,goal.targetValue)}</b></span><span>还差<b>${growthGoalValueTextV1(goal,remaining)}</b></span></div><div class="growth-goal-progress-v1"><i style="width:${pct}%"></i></div><div class="growth-goal-foot-v1"><strong>${Math.round(pct)}%</strong><div>${!goal.completed?`<button class="primary" onclick="openGrowthGoalProgressV1('${goal.id}')">更新进度</button><button onclick="toggleGrowthGoalCompleteV1('${goal.id}')">✓ 完成</button>`:`<button onclick="toggleGrowthGoalCompleteV1('${goal.id}')">恢复</button>`}<button onclick="openGrowthGoalV1('${goal.id}')">编辑</button><button class="danger-text" onclick="deleteGrowthGoalV1('${goal.id}')">删除</button></div></div></article>`;}
  function renderGrowthGoalsV1(){document.getElementById('title').textContent='目标 · '+curLedger().name;hideTopAct();setFab('新建目标',()=>openGrowthGoalV1());const all=active(growthGoals),open=all.filter(x=>!x.completed),done=all.filter(x=>x.completed),dueSoon=open.filter(x=>x.dueDate<=plannerAddDateV2(today(),1)).length,year=open.filter(x=>String(x.dueDate||'').startsWith(String(new Date().getFullYear()))).length,list=all.filter(x=>growthGoalFilterV1==='all'||(growthGoalFilterV1==='done'&&x.completed)||(growthGoalFilterV1==='active'&&!x.completed)).sort((a,b)=>Number(a.completed)-Number(b.completed)||plannerPriorityRankV3(a.priority)-plannerPriorityRankV3(b.priority)||(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));document.getElementById('view').innerHTML=`${renderLedgerBar()}<div class="growth-page-title-v5"><h1>我的目标</h1><span>把今天的行动和今年的愿望，都变成看得见的进度</span></div>${growthTabsV5()}<section class="growth-goal-hero-v1"><div><small>正在努力</small><strong>${open.length}</strong><span>个目标</span></div><div><small>临期 / 已逾期</small><strong>${dueSoon}</strong><span>项</span></div><div><small>本年目标</small><strong>${year}</strong><span>项</span></div></section><div class="growth-goal-templates-v1"><button onclick="openGrowthGoalV1('','car')">🚗 今年买车</button><button onclick="openGrowthGoalV1('','house')">🏠 买房目标</button><button onclick="openGrowthGoalV1('','today')">☀️ 今天目标</button><button onclick="openGrowthGoalV1('','tomorrow')">🌙 明天目标</button></div><div class="growth-goal-filters-v1">${[['active','进行中',open.length],['done','已完成',done.length],['all','全部',all.length]].map(x=>`<button class="${growthGoalFilterV1===x[0]?'on':''}" onclick="setGrowthGoalFilterV1('${x[0]}')">${x[1]} <b>${x[2]}</b></button>`).join('')}</div><section class="growth-goal-list-v1">${list.length?list.map(growthGoalCardV1).join(''):`<div class="growth-empty-v5"><b>${growthGoalFilterV1==='done'?'还没有完成的目标':'还没有目标'}</b><span>从今天的小目标开始，或者写下今年想实现的大愿望。</span></div>`}</section>`;checkGrowthGoalRemindersV1();}
  window.setGrowthGoalFilterV1=function(filter){growthGoalFilterV1=['active','done','all'].includes(filter)?filter:'active';renderGrowthGoalsV1();};
  window.updateGrowthGoalScopeV1=function(setDate=true){const scope=document.getElementById('goal_scope_v1').value,due=document.getElementById('goal_due_v1'),field=document.getElementById('goal_due_field_v1');field.style.display=scope==='custom'?'block':'none';if(scope!=='custom'&&setDate!==false)due.value=growthGoalScopeDueV1(scope);};
  window.updateGrowthGoalKindV1=function(){const kind=document.getElementById('goal_kind_v1').value,label=document.getElementById('goal_value_label_v1'),unit=document.getElementById('goal_unit_v1'),value=document.getElementById('goal_value_v1');label.textContent=kind==='money'?'目标金额':'目标进度';if(!unit.value||unit.value==='%'||unit.value==='元')unit.value=kind==='money'?'元':'%';if(!value.value)value.value=kind==='money'?'':'100';};
  window.openGrowthGoalV1=function(id='',template=''){const goal=id&&growthGoals.find(x=>x.id===id&&!isDeleted(x)),presets={car:{title:'今年买车',kind:'money',scope:'year',unit:'元'},house:{title:'买房目标',kind:'money',scope:'year',unit:'元'},today:{title:'',kind:'progress',scope:'today',unit:'%'},tomorrow:{title:'',kind:'progress',scope:'tomorrow',unit:'%'}},preset=presets[template]||{},scope=goal&&goal.scope||preset.scope||'year';document.getElementById('goal_id_v1').value=goal?goal.id:'';document.getElementById('goal_title_v1').textContent=goal?'✏️ 编辑目标':'🎯 新建目标';document.getElementById('goal_name_v1').value=goal?goal.title:preset.title||'';document.getElementById('goal_kind_v1').value=goal?goal.kind:preset.kind||'progress';document.getElementById('goal_scope_v1').value=scope;document.getElementById('goal_value_v1').value=goal?goal.targetValue:(preset.kind==='money'?'':100);document.getElementById('goal_unit_v1').value=goal?goal.unit:preset.unit||'%';document.getElementById('goal_due_v1').value=goal?goal.dueDate:growthGoalScopeDueV1(scope);document.getElementById('goal_priority_v1').value=goal?goal.priority||'P2':'P1';document.getElementById('goal_note_v1').value=goal?goal.note||'':'';updateGrowthGoalKindV1();updateGrowthGoalScopeV1(false);showMask('maskGrowthGoalV1');updateFocusModalStatusV5();if(growthFocusPrefs.active)startFocusTickerV5();setTimeout(()=>document.getElementById('goal_name_v1').focus(),100);};
  window.saveGrowthGoalV1=function(){const id=document.getElementById('goal_id_v1').value,title=document.getElementById('goal_name_v1').value.trim(),kind=document.getElementById('goal_kind_v1').value,scope=document.getElementById('goal_scope_v1').value,targetValue=roundMoneyV2(Number(document.getElementById('goal_value_v1').value)),unit=document.getElementById('goal_unit_v1').value.trim()||(kind==='money'?'元':'%'),dueDate=document.getElementById('goal_due_v1').value,priority=document.getElementById('goal_priority_v1').value,note=document.getElementById('goal_note_v1').value.trim();if(!title){toast('请填写目标名称');return;}if(!(targetValue>0)){toast(kind==='money'?'请填写目标金额':'目标进度必须大于 0');return;}if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)){toast('请选择完成期限');return;}const before=cloneDataV2(growthGoals),now=Date.now(),goal=id&&growthGoals.find(x=>x.id===id&&!isDeleted(x));if(goal)Object.assign(goal,{title,kind,scope,targetValue,unit,dueDate,priority,note,updatedAt:now});else growthGoals.push(Object.assign({id:'gg_'+uid(),title,kind,scope,targetValue,currentValue:0,unit,dueDate,priority,note,completed:false,completedAt:0,createdAt:now,updatedAt:now},growthOwnerV5()));if(!save()){growthGoals=before;return;}hideMask('maskGrowthGoalV1');growthFilterV5='goal';planMode='goal';renderPlan();syncPlannerPushScheduleV2();toast(goal?'目标已更新':'目标已经建立 🎯');};
  window.openGrowthGoalProgressV1=function(id){const goal=growthGoals.find(x=>x.id===id&&!isDeleted(x));if(!goal)return;document.getElementById('goal_progress_id_v1').value=goal.id;document.getElementById('goal_progress_info_v1').innerHTML=`<b>${esc(goal.title)}</b><span>目标 ${growthGoalValueTextV1(goal,goal.targetValue)}</span>`;document.getElementById('goal_progress_label_v1').textContent=`当前进度（${goal.unit||''}）`;document.getElementById('goal_progress_value_v1').value=Number(goal.currentValue)||0;showMask('maskGoalProgressV1');setTimeout(()=>document.getElementById('goal_progress_value_v1').focus(),100);};
  window.saveGrowthGoalProgressV1=function(){const id=document.getElementById('goal_progress_id_v1').value,goal=growthGoals.find(x=>x.id===id&&!isDeleted(x)),value=roundMoneyV2(Number(document.getElementById('goal_progress_value_v1').value));if(!goal||value<0||!Number.isFinite(value)){toast('请输入正确的当前进度');return;}const before=cloneDataV2(goal);goal.currentValue=Math.min(value,Number(goal.targetValue)||value);if(goal.currentValue>=Number(goal.targetValue)-.005){goal.completed=true;goal.completedAt=Date.now();}else{goal.completed=false;goal.completedAt=0;}markUpdated(goal);if(!save()){Object.assign(goal,before);return;}hideMask('maskGoalProgressV1');renderPlan();syncPlannerPushScheduleV2();toast(goal.completed?'目标完成了，太棒了 🎉':'目标进度已更新');};
  window.toggleGrowthGoalCompleteV1=function(id){const goal=growthGoals.find(x=>x.id===id&&!isDeleted(x));if(!goal)return;const before=cloneDataV2(goal);goal.completed=!goal.completed;goal.completedAt=goal.completed?Date.now():0;markUpdated(goal);if(!save()){Object.assign(goal,before);return;}renderPlan();syncPlannerPushScheduleV2();toast(goal.completed?'目标完成了，太棒了 🎉':'目标已恢复为进行中');};
  window.deleteGrowthGoalV1=function(id){const index=growthGoals.findIndex(x=>x.id===id&&!isDeleted(x)),goal=growthGoals[index];if(!goal)return;cuteConfirmV2({title:'删除这个目标？',text:`「${goal.title}」及其进度记录会被移除。`,okText:'删除目标'},()=>{const before=goal,now=Date.now();growthGoals[index]={id:goal.id,owner:goal.owner,userId:goal.userId,private:true,deleted:true,deletedAt:now,updatedAt:now};if(!save()){growthGoals[index]=before;return;}renderPlan();syncPlannerPushScheduleV2();toast('目标已删除');});};
  function checkGrowthGoalRemindersV1(){const key='xqxGoalReminder:'+today();if(localStorage.getItem(key))return;const list=active(growthGoals).filter(x=>!x.completed&&x.dueDate<=plannerAddDateV2(today(),1)).sort((a,b)=>plannerPriorityRankV3(a.priority)-plannerPriorityRankV3(b.priority)||a.dueDate.localeCompare(b.dueDate));if(!list.length)return;localStorage.setItem(key,'1');const first=list[0],more=list.length>1?`，另有 ${list.length-1} 个临近目标`:'';const body=`${first.dueDate<today()?'已逾期':first.dueDate===today()?'今天到期':'明天到期'}：${first.title}${more}`;toast('🎯 '+body,6500);try{if('Notification' in window&&Notification.permission==='granted')new Notification('目标提醒',{body});}catch(_){} }
  function growthTabsV5(){const tabs=[['finance','财务'],['schedule','日程'],['goal','目标'],['inspiration','灵感'],['diary','日记'],['focus','专注']],current=['schedule','finance','goal'].includes(planMode)?planMode:growthFilterV5;return `<div class="growth-tabs-v5" role="tablist">${tabs.map(([key,label])=>`<button type="button" class="${current===key?'on':''}" onclick="setGrowthFilterV5('${key}')">${label}</button>`).join('')}</div>`;}
  function growthQuickCaptureV5(){return `<div class="growth-capture-v5"><textarea id="growth_quick_v5" maxlength="3000" placeholder="记录这一刻的想法…" aria-label="快速记录灵感"></textarea><div><span>随时记录，稍后再整理</span><button type="button" onclick="openInspirationV5()">详细填写</button><button type="button" class="primary" onclick="saveQuickInspirationV5()">保存灵感</button></div></div>`;}
  function growthEntryTimestampV5(item,type){if(type==='diary'&&item.date){const base=new Date(item.date+'T12:00:00').getTime();return Math.max(base,Number(item.updatedAt)||base);}return Number(item.endedAt||item.createdAt||item.updatedAt)||Date.now();}
  function growthEntriesV5(){const items=[];active(growthInspirations).forEach(x=>items.push({type:'inspiration',data:x,ts:growthEntryTimestampV5(x,'inspiration')}));active(growthDiaries).forEach(x=>items.push({type:'diary',data:x,ts:growthEntryTimestampV5(x,'diary')}));active(growthFocusSessions).forEach(x=>items.push({type:'focus',data:x,ts:growthEntryTimestampV5(x,'focus')}));return items.filter(x=>growthFilterV5==='all'||x.type===growthFilterV5).sort((a,b)=>(Number(b.data.pinned)-Number(a.data.pinned))||b.ts-a.ts);}
  function growthTagsHtmlV5(tags){const list=Array.isArray(tags)?tags:[];return list.length?`<div class="growth-tags-v5">${list.slice(0,8).map(x=>`<span># ${esc(x)}</span>`).join('')}</div>`:'';}
  function growthEntryHtmlV5(entry){
    const x=entry.data,time=growthTimeV5(entry.ts);
    if(entry.type==='inspiration')return `<article class="growth-entry-v5 inspiration"><div class="growth-entry-mark-v5">灵</div><div class="growth-entry-main-v5"><div class="growth-entry-meta-v5"><time>${time}</time><b>项目灵感</b>${x.pinned?'<span>置顶</span>':''}</div><h3>${esc((x.content||'').split(/\n/)[0].slice(0,60)||'未命名灵感')}</h3><p>${esc(x.content||'').replace(/\n/g,'<br>')}</p>${growthTagsHtmlV5(x.tags)}<div class="growth-entry-actions-v5"><button onclick="openInspirationV5('${x.id}')">编辑</button><button class="danger-text" onclick="deleteInspirationV5('${x.id}')">删除</button></div></div></article>`;
    if(entry.type==='diary'){const category=DIARY_CATEGORIES_V6[x.category]||DIARY_CATEGORIES_V6.daily,images=Array.isArray(x.images)?x.images.map(safePhotoUrl).filter(Boolean).slice(0,4):[];return `<article class="growth-entry-v5 diary"><div class="growth-entry-mark-v5">记</div><div class="growth-entry-main-v5"><div class="growth-entry-meta-v5"><time>${time}</time><b>${esc(category)}</b><span>${esc(GROWTH_MOODS_V5[x.mood]||'平静')} · ${esc(GROWTH_WEATHER_V5[x.weather]||'多云')}</span></div>${x.heading?`<h3>${esc(x.heading)}</h3>`:''}<p class="diary-copy-v5">${esc(x.content||'').replace(/\n/g,'<br>')}</p>${images.length?`<div class="diary-entry-images-v6">${images.map(src=>`<img src="${src}" alt="日记图片">`).join('')}</div>`:''}<div class="growth-entry-actions-v5"><button onclick="openDiaryV5('${x.id}')">编辑</button><button class="danger-text" onclick="deleteDiaryV5('${x.id}')">删除</button></div></div></article>`;}
    return `<article class="growth-entry-v5 focus"><div class="growth-entry-mark-v5">专</div><div class="growth-entry-main-v5"><div class="growth-entry-meta-v5"><time>${time}</time><b>专注</b><span>已完成</span></div><h3>专注 ${Math.max(1,Math.round(Number(x.durationMinutes)||25))} 分钟 · ${esc(x.task||'专注当下')}</h3>${x.note?`<p>${esc(x.note)}</p>`:''}<div class="growth-entry-actions-v5"><button class="danger-text" onclick="deleteFocusSessionV5('${x.id}')">删除记录</button></div></div></article>`;
  }
  function growthTimelineV5(){
    const entries=growthEntriesV5();if(!entries.length){const copy=growthFilterV5==='diary'?'还没有日记，给今天留下一段文字吧。':growthFilterV5==='focus'?'还没有专注记录，开始第一个番茄钟吧。':'还没有灵感记录，想到什么就马上写下来。';return `<div class="growth-empty-v5"><b>这里还是空的</b><span>${copy}</span></div>`;}
    const groups={};entries.forEach(entry=>{const day=entry.type==='diary'&&entry.data.date||growthDayV5(entry.ts);(groups[day]||(groups[day]=[])).push(entry);});return Object.keys(groups).sort((a,b)=>b.localeCompare(a)).map(day=>`<section class="growth-day-v5"><h2>${growthDayTitleV5(day)}</h2><div class="growth-stream-v5">${groups[day].map(growthEntryHtmlV5).join('')}</div></section>`).join('');
  }
  function renderGrowthHomeV5(){document.getElementById('title').textContent='小确幸 · '+curLedger().name;hideTopAct();setFab(null,null);const diaryAction=growthFilterV5==='diary'?'<button type="button" class="growth-write-diary-v5" onclick="openDiaryV5()">写今日日记</button>':'';document.getElementById('view').innerHTML=`${renderLedgerBar()}<div class="growth-page-title-v5"><h1>灵感与日记</h1><span>捕捉想法，记录生活，也专心完成重要的事</span></div>${growthTabsV5()}${growthFilterV5==='all'||growthFilterV5==='inspiration'?growthQuickCaptureV5():''}${diaryAction}${growthTimelineV5()}<button type="button" class="growth-floating-v5" onclick="openInspirationV5()">记录</button>`;}
  window.setGrowthFilterV5=function(filter){if(!['goal','inspiration','diary','focus','schedule','finance'].includes(filter))return;if(['schedule','finance','goal'].includes(filter)){planMode=filter;growthFilterV5=filter;renderPlan();return;}growthFilterV5=filter;planMode=filter==='focus'?'focus':'growth';renderPlan();};
  const aiWritingDraftV1={inspiration:'',diary:''};
  function resetAiWritingV1(task){aiWritingDraftV1[task]='';const box=document.getElementById('ai_'+task+'_result_v1');if(box){box.hidden=true;const copy=box.querySelector('[data-ai-writing-copy]');if(copy)copy.textContent='';}}
  async function callAiWritingV1(task,content){
    if(!aiFeatureAvailableV3()){toast('平台 AI 正在维护，请稍后再试');return '';}if(!hasEntitlementV3('ai.writing')){requireEntitlementV3('ai.writing');return '';}
    const payload=apiAuth({requestId:'writing_'+Date.now().toString(36)+'_'+secureToken().slice(0,16),task,content}),response=await fetch(syncUrl.replace(/\/$/,'')+'/api/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),raw=await response.text(),data=(()=>{try{return JSON.parse(raw);}catch(_){return {};}})();
    if(!response.ok){if([401,402,403].includes(response.status)){refreshMembershipV3(true);requireEntitlementV3('ai.writing');}if(response.status===429)throw new Error('本月 AI 写作额度已用完');throw new Error(data.error||data.detail||('AI 写作请求失败：HTTP '+response.status));}
    if(!data.text)throw new Error(data.duplicate?'上一次请求已处理，请重新点击生成新的结果':'AI 没有返回可用文字');return String(data.text).trim();
  }
  window.runAiWritingV1=async function(task){const textarea=document.getElementById(task==='diary'?'diary_content_v5':'inspiration_content_v5'),button=document.getElementById('ai_'+task+'_btn_v1'),content=textarea&&textarea.value.trim();if(!content){toast(task==='diary'?'请先写下日记正文':'请先写下你的原始灵感');textarea&&textarea.focus();return;}const oldLabel=button.textContent;button.disabled=true;button.textContent=task==='diary'?'正在优化…':'正在发散…';resetAiWritingV1(task);try{const result=await callAiWritingV1(task,content);if(!result)return;aiWritingDraftV1[task]=result;const box=document.getElementById('ai_'+task+'_result_v1');box.querySelector('[data-ai-writing-copy]').textContent=result;box.hidden=false;box.scrollIntoView({block:'nearest',behavior:'smooth'});toast('AI 建议已生成，请确认后再采用');refreshMembershipV3(true);}catch(error){toast(error.message||'AI 写作暂时不可用',5000);}finally{button.disabled=false;button.textContent=oldLabel;}};
  window.applyAiWritingV1=function(task){const result=aiWritingDraftV1[task];if(!result)return;const textarea=document.getElementById(task==='diary'?'diary_content_v5':'inspiration_content_v5'),limit=task==='diary'?10000:3000;if(task==='diary')textarea.value=result.slice(0,limit);else textarea.value=(textarea.value.trim()+'\n\n'+result).slice(0,limit);textarea.dispatchEvent(new Event('input',{bubbles:true}));toast(task==='diary'?'已采用优化稿，还需点击保存日记':'已追加 AI 建议，还需点击保存灵感');textarea.focus();};
  window.openInspirationV5=function(id=''){const x=id&&growthInspirations.find(v=>v.id===id&&!isDeleted(v));document.getElementById('inspiration_id_v5').value=x?x.id:'';document.getElementById('inspiration_content_v5').value=x?x.content:'';document.getElementById('inspiration_tags_v5').value=x&&Array.isArray(x.tags)?x.tags.join('，'):'';document.getElementById('inspiration_pinned_v5').checked=!!(x&&x.pinned);document.getElementById('inspiration_title_v5').textContent=x?'编辑灵感':'记录新灵感';resetAiWritingV1('inspiration');showMask('maskInspirationV5');updateFocusModalStatusV5();if(growthFocusPrefs.active)startFocusTickerV5();setTimeout(()=>document.getElementById('inspiration_content_v5').focus(),100);};
  function inspirationTagsV5(raw){return [...new Set(String(raw||'').split(/[，,]/).map(x=>x.trim()).filter(Boolean))].slice(0,8);}
  window.saveQuickInspirationV5=function(){const box=document.getElementById('growth_quick_v5'),content=box&&box.value.trim();if(!content){toast('先写下一点想法吧');return;}const now=Date.now();growthInspirations.push(Object.assign({id:'gi_'+uid(),content,tags:[],pinned:false,createdAt:now,updatedAt:now},growthOwnerV5()));if(!save()){growthInspirations.pop();return;}renderPlan();toast('灵感已经收好 ✨');};
  window.saveInspirationV5=function(){const id=document.getElementById('inspiration_id_v5').value,content=document.getElementById('inspiration_content_v5').value.trim(),tags=inspirationTagsV5(document.getElementById('inspiration_tags_v5').value),pinned=document.getElementById('inspiration_pinned_v5').checked;if(!content){toast('请写下灵感内容');return;}const before=cloneDataV2(growthInspirations),now=Date.now(),x=id&&growthInspirations.find(v=>v.id===id&&!isDeleted(v));if(x)Object.assign(x,{content,tags,pinned,updatedAt:now});else growthInspirations.push(Object.assign({id:'gi_'+uid(),content,tags,pinned,createdAt:now,updatedAt:now},growthOwnerV5()));if(!save()){growthInspirations=before;return;}hideMask('maskInspirationV5');growthFilterV5='inspiration';planMode='growth';renderPlan();toast(x?'灵感已更新':'灵感已经收好 ✨');};
  window.deleteInspirationV5=function(id){const index=growthInspirations.findIndex(x=>x.id===id&&!isDeleted(x)),x=growthInspirations[index];if(!x)return;cuteConfirmV2({title:'删除这条灵感？',text:(x.content||'').slice(0,80),okText:'删除灵感'},()=>{const before=x,now=Date.now();growthInspirations[index]={id:x.id,owner:x.owner,userId:x.userId,private:true,deleted:true,deletedAt:now,updatedAt:now};if(!save()){growthInspirations[index]=before;return;}renderPlan();toast('灵感已删除');});};
  const DIARY_CATEGORIES_V6={daily:'日常',work:'工作',growth:'成长',travel:'旅行'};
  let diaryImageDraftsV6=[];
  function updateDiaryCountsV6(){const heading=document.getElementById('diary_heading_v5'),content=document.getElementById('diary_content_v5'),hc=document.getElementById('diary_heading_count_v6'),cc=document.getElementById('diary_content_count_v6');if(hc)hc.textContent=String((heading&&heading.value||'').length);if(cc)cc.textContent=String((content&&content.value||'').length);}
  function syncDiaryMetaV6(){const mood=document.getElementById('diary_mood_v5')&&document.getElementById('diary_mood_v5').value,weather=document.getElementById('diary_weather_v5')&&document.getElementById('diary_weather_v5').value,category=document.getElementById('diary_category_v6')&&document.getElementById('diary_category_v6').value;document.querySelectorAll('#diary_mood_choices_v6 [data-value]').forEach(b=>{const on=b.dataset.value===mood;b.classList.toggle('on',on);b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');});document.querySelectorAll('#diary_weather_choices_v6 [data-value]').forEach(b=>{const on=b.dataset.value===weather;b.classList.toggle('on',on);b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');});document.querySelectorAll('[data-diary-category]').forEach(b=>{const on=b.dataset.diaryCategory===category;b.classList.toggle('on',on);b.setAttribute('role','radio');b.setAttribute('aria-checked',on?'true':'false');});}
  window.pickDiaryMetaV6=function(kind,value){const id=kind==='mood'?'diary_mood_v5':'diary_weather_v5',select=document.getElementById(id);if(!select||![...select.options].some(o=>o.value===value))return;select.value=value;syncDiaryMetaV6();};
  window.setDiaryCategoryV6=function(value){if(!DIARY_CATEGORIES_V6[value])return;document.getElementById('diary_category_v6').value=value;syncDiaryMetaV6();};
  window.insertDiaryOutlineV6=function(title){const allowed=['发生了什么','我的感受','得到的启发','下一步'];if(!allowed.includes(title))return;const textarea=document.getElementById('diary_content_v5'),start=textarea.selectionStart||textarea.value.length,end=textarea.selectionEnd||start,before=textarea.value.slice(0,start),after=textarea.value.slice(end),prefix=before&& !before.endsWith('\n')?'\n\n':'',block=prefix+title+'\n';textarea.value=(before+block+after).slice(0,10000);textarea.focus();textarea.selectionStart=textarea.selectionEnd=Math.min(10000,(before+block).length);updateDiaryCountsV6();};
  function renderDiaryImagesV6(){const list=document.getElementById('diary_image_list_v6');if(!list)return;list.innerHTML=diaryImageDraftsV6.length?diaryImageDraftsV6.map((src,index)=>`<figure><img src="${safePhotoUrl(src)}" alt="日记图片 ${index+1}"><button type="button" onclick="removeDiaryImageV6(${index})" aria-label="移除第 ${index+1} 张图片">移除</button></figure>`).join(''):'<p>还没有添加图片</p>';}
  function compressDiaryImageV6(file){return new Promise((resolve,reject)=>{if(!file||!/^image\/(?:jpeg|png|webp)$/i.test(file.type||'')){reject(new Error('仅支持 JPG、PNG 或 WebP 图片'));return;}if(file.size>12*1024*1024){reject(new Error('单张图片不能超过 12MB'));return;}const reader=new FileReader();reader.onerror=()=>reject(new Error('读取图片失败'));reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('图片格式不支持'));img.onload=()=>{const draw=(max,quality,type)=>{const scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL(type,quality);};let data=draw(420,.62,'image/webp');if(data.length>150000)data=draw(320,.5,'image/jpeg');if(data.length>180000){reject(new Error('图片内容过大，请换一张更简单的图片'));return;}resolve(data);};img.src=String(reader.result||'');};reader.readAsDataURL(file);});}
  window.addDiaryImagesV6=async function(event){const files=Array.from(event.target.files||[]);event.target.value='';if(!files.length)return;const room=Math.max(0,4-diaryImageDraftsV6.length);if(!room){toast('一篇日记最多添加 4 张图片');return;}for(const file of files.slice(0,room)){try{diaryImageDraftsV6.push(await compressDiaryImageV6(file));renderDiaryImagesV6();}catch(error){toast(error.message||'图片处理失败',4000);}}if(files.length>room)toast('最多保留前 4 张图片');};
  window.removeDiaryImageV6=function(index){if(!Number.isInteger(index)||index<0||index>=diaryImageDraftsV6.length)return;diaryImageDraftsV6.splice(index,1);renderDiaryImagesV6();};
  window.openDiaryV5=function(id=''){const x=id&&growthDiaries.find(v=>v.id===id&&!isDeleted(v)),heading=document.getElementById('diary_heading_v5'),content=document.getElementById('diary_content_v5');document.getElementById('diary_id_v5').value=x?x.id:'';document.getElementById('diary_date_v5').value=x?x.date:today();heading.value=x?x.heading||'':'';document.getElementById('diary_mood_v5').value=x?x.mood||'calm':'happy';document.getElementById('diary_weather_v5').value=x?x.weather||'cloudy':'sunny';content.value=x?x.content:'';document.getElementById('diary_category_v6').value=x&&DIARY_CATEGORIES_V6[x.category]?x.category:'daily';diaryImageDraftsV6=x&&Array.isArray(x.images)?x.images.map(safePhotoUrl).filter(Boolean).slice(0,4):[];document.getElementById('diary_title_v5').textContent=x?'编辑日记':'写今日日记';heading.oninput=updateDiaryCountsV6;content.oninput=updateDiaryCountsV6;updateDiaryCountsV6();syncDiaryMetaV6();renderDiaryImagesV6();resetAiWritingV1('diary');showMask('maskDiaryV5');updateFocusModalStatusV5();if(growthFocusPrefs.active)startFocusTickerV5();setTimeout(()=>content.focus(),100);};
  window.saveDiaryV5=function(){const id=document.getElementById('diary_id_v5').value,date=document.getElementById('diary_date_v5').value,heading=document.getElementById('diary_heading_v5').value.trim(),mood=document.getElementById('diary_mood_v5').value,weather=document.getElementById('diary_weather_v5').value,category=document.getElementById('diary_category_v6').value,content=document.getElementById('diary_content_v5').value.trim(),images=diaryImageDraftsV6.map(safePhotoUrl).filter(Boolean).slice(0,4);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!content){toast('请选择日期并写下日记内容');return;}if(!DIARY_CATEGORIES_V6[category]){toast('请选择正确的日记分类');return;}const before=cloneDataV2(growthDiaries),now=Date.now(),x=id&&growthDiaries.find(v=>v.id===id&&!isDeleted(v));if(x)Object.assign(x,{date,heading,mood,weather,category,content,images,updatedAt:now});else growthDiaries.push(Object.assign({id:'gd_'+uid(),date,heading,mood,weather,category,content,images,createdAt:now,updatedAt:now},growthOwnerV5()));if(!save()){growthDiaries=before;return;}hideMask('maskDiaryV5');growthFilterV5='diary';planMode='growth';renderPlan();toast(x?'日记已更新':'今天的日记保存好了');};
  window.deleteDiaryV5=function(id){const index=growthDiaries.findIndex(x=>x.id===id&&!isDeleted(x)),x=growthDiaries[index];if(!x)return;cuteConfirmV2({title:'删除这篇日记？',text:`${x.date} · ${x.heading||'未命名日记'}`,okText:'删除日记'},()=>{const before=x,now=Date.now();growthDiaries[index]={id:x.id,owner:x.owner,userId:x.userId,private:true,deleted:true,deletedAt:now,updatedAt:now};if(!save()){growthDiaries[index]=before;return;}renderPlan();toast('日记已删除');});};
  function focusRemainingV5(){const a=growthFocusPrefs.active;if(!a)return Number(growthFocusPrefs.duration||25)*60;if(a.paused)return Math.max(0,Number(a.remaining)||0);return Math.max(0,Math.ceil((Number(a.endsAt)-Date.now())/1000));}
  function focusClockV5(seconds){const n=Math.max(0,Math.round(seconds)),m=Math.floor(n/60),s=n%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
  function updateFocusModalStatusV5(){const a=growthFocusPrefs.active,seconds=focusRemainingV5();document.querySelectorAll('.focus-modal-status-v5').forEach(box=>{box.hidden=!a;if(!a)return;const clock=box.querySelector('[data-focus-modal-clock]'),task=box.querySelector('[data-focus-modal-task]'),toggle=box.querySelector('[data-focus-modal-toggle]');if(clock)clock.textContent=focusClockV5(seconds);if(task)task.textContent=a.task||'专注当下';if(toggle)toggle.textContent=a.paused?'继续':'暂停';box.classList.toggle('paused',!!a.paused);});}
  function focusTickV5(){const a=growthFocusPrefs.active,seconds=focusRemainingV5(),clock=document.getElementById('focus_clock_v5'),bar=document.getElementById('focus_progress_v5');if(clock)clock.textContent=focusClockV5(seconds);if(bar){const total=Math.max(1,Number(a&&a.duration||growthFocusPrefs.duration||25)*60);bar.value=Math.max(0,total-seconds);bar.max=total;}updateFocusModalStatusV5();if(a&&!a.paused&&seconds<=0){finishFocusV5();updateFocusModalStatusV5();}}
  function startFocusTickerV5(){clearInterval(growthTimerV5);growthTimerV5=setInterval(focusTickV5,1000);focusTickV5();}
  function focusTodayStatsV5(){const list=active(growthFocusSessions).filter(x=>x.date===today()),minutes=list.reduce((s,x)=>s+Number(x.durationMinutes||0),0);return {count:list.length,minutes:Math.round(minutes)};}
  function renderFocusV5(){document.getElementById('title').textContent='小确幸 · '+curLedger().name;hideTopAct();setFab(null,null);const a=growthFocusPrefs.active,seconds=focusRemainingV5(),stats=focusTodayStatsV5(),task=a?a.task:growthFocusPrefs.task||'',duration=Math.max(1,Math.min(180,Math.round(Number(growthFocusPrefs.duration)||25))),recent=active(growthFocusSessions).sort((x,y)=>Number(y.endedAt)-Number(x.endedAt)).slice(0,4);document.getElementById('view').innerHTML=`${renderLedgerBar()}<div class="growth-page-title-v5"><h1>番茄钟</h1><span>一次只做好一件事</span></div>${growthTabsV5()}<section class="focus-hero-v5"><small>今天的重点</small><input id="focus_task_v5" maxlength="120" autocomplete="off" value="${esc(task)}" ${a?'disabled':''} placeholder="准备专注完成什么？"><strong id="focus_clock_v5">${focusClockV5(seconds)}</strong><progress id="focus_progress_v5" value="0" max="${Math.max(1,Number(a&&a.duration||duration)*60)}"></progress><div class="focus-presets-v5">${[25,45,60].map(n=>`<button class="${!a&&duration===n?'on':''}" ${a?'disabled':''} onclick="setFocusDurationV5(${n})">${n} 分钟</button>`).join('')}</div><div class="focus-custom-v1"><label for="focus_custom_minutes_v1">手动设置</label><input id="focus_custom_minutes_v1" type="number" inputmode="numeric" min="1" max="180" step="1" value="${duration}" ${a?'disabled':''} onkeydown="if(event.key==='Enter')setCustomFocusDurationV1()"><span>分钟</span><button type="button" ${a?'disabled':''} onclick="setCustomFocusDurationV1()">应用</button></div><small class="focus-custom-hint-v1">可设置 1–180 分钟，计时开始后将自动锁定</small><div class="focus-controls-v5">${a?`<button class="primary" onclick="toggleFocusPauseV5()">${a.paused?'继续':'暂停'}</button><button onclick="resetFocusV5()">结束</button>`:'<button class="primary" onclick="startFocusV5()">开始专注</button>'}</div><div class="focus-side-actions-v5"><button onclick="openInspirationV5()">记下灵感</button><button onclick="openDiaryV5()">写今日复盘</button></div></section><div class="focus-stats-v5">今日完成 <b>${stats.count}</b> 个番茄 · <b>${stats.minutes}</b> 分钟</div><section class="focus-recent-v5"><h2>最近专注</h2>${recent.length?recent.map(x=>`<div><span>${esc(x.task||'专注当下')}</span><b>${Math.round(Number(x.durationMinutes)||25)} 分钟</b></div>`).join(''):'<p>完成第一个番茄后，记录会出现在这里。</p>'}</section>`;startFocusTickerV5();}
  window.setFocusDurationV5=function(minutes){if(growthFocusPrefs.active)return;const value=Number(minutes);if(![25,45,60].includes(value))return;const before=growthFocusPrefs.duration;growthFocusPrefs.duration=value;if(!save(false)){growthFocusPrefs.duration=before;return;}renderPlan();};
  window.setCustomFocusDurationV1=function(){if(growthFocusPrefs.active){toast('计时进行中，结束后才能修改时长');return;}const input=document.getElementById('focus_custom_minutes_v1'),minutes=Math.round(Number(input&&input.value));if(!Number.isFinite(minutes)||minutes<1||minutes>180){toast('请输入 1–180 分钟的整数');if(input)input.focus();return;}const before=growthFocusPrefs.duration;growthFocusPrefs.duration=minutes;if(!save(false)){growthFocusPrefs.duration=before;return;}renderPlan();toast(`已设置为 ${minutes} 分钟`);};
  window.startFocusV5=function(){if(growthFocusPrefs.active)return;const input=document.getElementById('focus_task_v5'),task=(input&&input.value.trim())||'专注当下',duration=Math.max(1,Math.min(180,Number(growthFocusPrefs.duration)||25)),now=Date.now();growthFocusPrefs.task=task;growthFocusPrefs.active={id:'gf_'+uid(),task,duration,startedAt:now,endsAt:now+duration*60000,remaining:duration*60,paused:false};if(!save()){growthFocusPrefs.active=null;return;}renderPlan();toast('番茄钟开始，先专心做好这一件事');};
  window.toggleFocusPauseV5=function(){const a=growthFocusPrefs.active;if(!a)return;if(a.paused){a.endsAt=Date.now()+Math.max(1,Number(a.remaining)||1)*1000;a.paused=false;}else{a.remaining=focusRemainingV5();a.paused=true;a.endsAt=0;}saveFeatureData(false);persistActiveProfileV2();renderPlan();};
  window.toggleFocusPauseOverlayV5=function(){const a=growthFocusPrefs.active;if(!a)return;if(a.paused){a.endsAt=Date.now()+Math.max(1,Number(a.remaining)||1)*1000;a.paused=false;}else{a.remaining=focusRemainingV5();a.paused=true;a.endsAt=0;}saveFeatureData(false);persistActiveProfileV2();updateFocusModalStatusV5();startFocusTickerV5();};
  window.resetFocusV5=function(){const a=growthFocusPrefs.active;if(!a)return;cuteConfirmV2({title:'结束这次专注？',text:'未完成的番茄不会计入专注统计。',okText:'结束计时',icon:'⏱'},()=>{growthFocusPrefs.active=null;save();renderPlan();toast('本次计时已结束');});};
  function finishFocusV5(){const a=growthFocusPrefs.active;if(!a)return;const now=Date.now(),before=cloneDataV2(growthFocusSessions);growthFocusSessions.push(Object.assign({id:a.id||'gf_'+uid(),task:a.task||'专注当下',durationMinutes:Number(a.duration)||25,date:today(),startedAt:Number(a.startedAt)||now-Number(a.duration||25)*60000,endedAt:now,createdAt:now,updatedAt:now},growthOwnerV5()));growthFocusPrefs.active=null;if(!save()){growthFocusSessions=before;return;}plannerBeepV2();try{navigator.vibrate&&navigator.vibrate([160,80,160]);if('Notification' in window&&Notification.permission==='granted')new Notification('专注完成',{body:'做得很好，休息一下或记录刚才的灵感吧。'});}catch(_){}if(currentTab==='plan')renderPlan();toast('专注完成，已经记入成长时间轴 🎉',5000);}
  window.deleteFocusSessionV5=function(id){const index=growthFocusSessions.findIndex(x=>x.id===id&&!isDeleted(x)),x=growthFocusSessions[index];if(!x)return;cuteConfirmV2({title:'删除这条专注记录？',text:`${x.task||'专注当下'} · ${Math.round(Number(x.durationMinutes)||25)} 分钟`,okText:'删除记录'},()=>{const before=x,now=Date.now();growthFocusSessions[index]={id:x.id,owner:x.owner,userId:x.userId,private:true,deleted:true,deletedAt:now,updatedAt:now};if(!save()){growthFocusSessions[index]=before;return;}renderPlan();toast('专注记录已删除');});};
  function plannerSwitchV2(){return growthTabsV5();}
  window.setPlanModeV2=function(mode){planMode=['growth','focus','goal','schedule','finance'].includes(mode)?mode:'growth';if(['focus','goal'].includes(mode))growthFilterV5=mode;renderPlan();};
  function plannerNotifyStateV2(){
    if(!('Notification' in window))return {cls:'off',title:'当前浏览器不支持系统通知',sub:'应用打开时仍会显示页面内提醒'};
    if(!window.isSecureContext)return {cls:'warn',title:'需要 HTTPS 才能开启系统通知',sub:'本机 localhost 可用；腾讯云部署后请启用 HTTPS'};
    if(Notification.permission==='denied')return {cls:'err',title:'系统通知已被浏览器阻止',sub:'请在浏览器网站设置中重新允许通知'};
    if(Notification.permission==='granted'&&plannerPrefs.notifyEnabled)return {cls:'ok',title:'系统通知已开启',sub:plannerPrefs.pushEnabled?'页面关闭后也可由云端提醒':'应用打开或留在后台时可提醒'};
    return {cls:'warn',title:'系统通知尚未开启',sub:'点击开启后，到时间会显示浏览器通知'};
  }
  function plannerDayLabelV2(date){if(date===today())return '今天';if(date===plannerAddDateV2(today(),1))return '明天';if(date===plannerAddDateV2(today(),-1))return '昨天';const d=new Date(date+'T12:00:00');return `${d.getMonth()+1}月${d.getDate()}日 周${'日一二三四五六'[d.getDay()]}`;}
  function plannerQuickTemplatesV2(){return `<div class="planner-templates"><span onclick="openPersonalPlanV2('', 'fitness')">🏃 健身跑步</span><span onclick="openPersonalPlanV2('', 'project')">💻 开发项目</span><span onclick="openPersonalPlanV2('', 'sleep')">😴 睡觉</span><span onclick="openPersonalPlanV2('', 'other')">✨ 其他事情</span></div>`;}
  function plannerTimelineHtmlV2(date){
    const list=plannerOccurrencesV2(date),now=Date.now();let nextId='';
    const future=list.filter(o=>!o.state.completed&&o.interval.start>now);if(date===today()&&future.length)nextId=future[0].plan.id;
    if(!list.length)return `<div class="planner-empty"><div>🌤️</div><b>${plannerDayLabelV2(date)}还没有计划</b><span>把想做的事情放进时间轴，给自己留出从容的节奏。</span><button onclick="openPersonalPlanV2()">＋ 添加第一项计划</button></div>`;
    return `<div class="planner-timeline">${list.map(o=>{const p=o.plan,c=plannerCategoryV2(p.category),priority=plannerPriorityV3(p.priority),s=plannerStatusV2(o),next=p.id===nextId;return `<div class="planner-item ${s.key} priority-${priority.label.toLowerCase()} ${next?'next':''}" style="--plan-color:${c.color};--priority-color:${priority.color}"><div class="planner-time"><b>${esc(p.startTime)}</b><span>${esc(p.endTime)}${p.endTime<=p.startTime?' 次日':''}</span></div><div class="planner-line"><i></i></div><div class="planner-content"><div class="planner-item-top"><div class="planner-labels"><span class="planner-priority-badge">${priority.label} · ${priority.name}</span><span class="planner-cat">${c.emoji} ${c.name}</span></div><span class="planner-state ${s.key}">${next?'下一个':s.label}</span></div><h3>${esc(p.title)}</h3>${p.note?`<p>${esc(p.note)}</p>`:''}<div class="planner-meta"><span>🔁 ${plannerRepeatTextV2(p)}</span>${Number(p.remindBefore)>=0?`<span>🔔 ${Number(p.remindBefore)===0?'准时':`提前 ${p.remindBefore} 分钟`}</span>`:'<span>🔕 不提醒</span>'}</div><div class="planner-actions"><span class="complete" onclick="togglePersonalPlanCompleteV2('${p.id}','${date}')">${o.state.completed?'↩ 恢复':'✓ 完成'}</span><span onclick="snoozePersonalPlanFromListV2('${p.id}','${date}',10)">⏰ 延后</span><span onclick="openPersonalPlanV2('${p.id}')">编辑</span><span class="danger-text" onclick="deletePersonalPlanV2('${p.id}')">删除</span></div></div></div>`;}).join('')}</div>`;
  }
  function renderSchedulePlanV2(){
    const date=/^\d{4}-\d{2}-\d{2}$/.test(plannerPrefs.viewDate)?plannerPrefs.viewDate:today(),list=plannerOccurrencesV2(date),done=list.filter(o=>o.state.completed).length,notify=plannerNotifyStateV2();
    document.getElementById('title').textContent='个人规划';hideTopAct();setFab('新建计划',()=>openPersonalPlanV2());
    const h=plannerSwitchV2()+`<div class="planner-hero"><div><small>${plannerDayLabelV2(date)} · ${list.length} 项安排</small><h2>把一天过成喜欢的样子 🌷</h2><p>${done?`已经完成 ${done}/${list.length} 项，继续保持自己的节奏。`:'从一件重要的小事开始，慢慢安排今天。'}</p></div><span>${list.length?Math.round(done/list.length*100):0}%</span></div>
      <div class="planner-date-nav"><button onclick="changePlannerDateV2(-1)">‹</button><label><span>${plannerDayLabelV2(date)}</span><input type="date" value="${date}" onchange="setPlannerDateV2(this.value)"></label><button onclick="changePlannerDateV2(1)">›</button><button class="today" onclick="setPlannerDateV2(today())">回到今天</button></div>
      <div class="planner-notify-card ${notify.cls}"><i></i><div><b>${notify.title}</b><span>${notify.sub}</span></div><div class="planner-notify-actions"><button onclick="enablePlannerNotificationsV2()">${('Notification' in window)&&Notification.permission==='granted'?'重新检查':'开启提醒'}</button><button onclick="togglePlannerSoundV2()">${plannerPrefs.sound?'🔊 声音开':'🔇 声音关'}</button></div></div>
      ${plannerQuickTemplatesV2()}${plannerTimelineHtmlV2(date)}`;
    document.getElementById('view').innerHTML=h;
  }
  window.setPlannerDateV2=function(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;plannerPrefs.viewDate=date;saveFeatureData(false);renderPlan();};
  window.changePlannerDateV2=function(days){setPlannerDateV2(plannerAddDateV2(plannerPrefs.viewDate||today(),days));};
  function renderPlannerCategoriesV2(){const box=document.getElementById('pp_categories');if(!box)return;box.innerHTML=Object.entries(PLAN_CATEGORIES_V2).map(([key,c])=>`<span class="${key===plannerEditingCategory?'on':''}" style="--cat-color:${c.color}" onclick="pickPersonalPlanCategoryV2('${key}')">${c.emoji} ${c.name}</span>`).join('');}
  window.pickPersonalPlanCategoryV2=function(key){if(!PLAN_CATEGORIES_V2[key])return;plannerEditingCategory=key;renderPlannerCategoriesV2();};
  function renderPlannerPrioritiesV3(){const box=document.getElementById('pp_priorities'),hint=document.getElementById('pp_priority_hint');if(!box)return;box.innerHTML=Object.values(PLAN_PRIORITIES_V3).map(p=>`<button type="button" role="radio" aria-checked="${p.label===plannerEditingPriorityV3}" class="${p.label===plannerEditingPriorityV3?'on':''}" style="--priority-color:${p.color}" onclick="pickPersonalPlanPriorityV3('${p.label}')"><b>${p.label}</b><span>${p.name}</span></button>`).join('');if(hint)hint.textContent=plannerPriorityV3(plannerEditingPriorityV3).hint;}
  window.pickPersonalPlanPriorityV3=function(priority){if(!PLAN_PRIORITIES_V3[priority])return;plannerEditingPriorityV3=priority;renderPlannerPrioritiesV3();};
  window.updatePersonalPlanRepeatUi=function(){const repeat=document.getElementById('pp_repeat').value,custom=repeat==='custom',repeating=repeat!=='none';document.getElementById('pp_repeat_days_field').style.display=custom?'block':'none';document.getElementById('pp_repeat_until_field').style.display=repeating?'block':'none';};
  window.openPersonalPlanV2=function(id='',template=''){
    const p=id&&personalPlans.find(x=>x.id===id&&!isDeleted(x)),defaults={fitness:{title:'健身跑步',category:'fitness',startTime:'18:00',endTime:'19:00'},project:{title:'开发项目',category:'work',startTime:'09:00',endTime:'12:00'},sleep:{title:'睡觉',category:'rest',startTime:'23:00',endTime:'07:00'},other:{title:'',category:'other',startTime:'19:00',endTime:'20:00'}},d=defaults[template]||{};
    document.getElementById('pp_sheet_title').textContent=p?'✏️ 编辑个人计划':'🌤️ 新建个人计划';document.getElementById('pp_id').value=p?p.id:'';document.getElementById('pp_title').value=p?p.title:(d.title||'');plannerEditingCategory=p?p.category:(d.category||'work');plannerEditingPriorityV3=plannerPriorityV3(p&&p.priority).label;renderPlannerCategoriesV2();renderPlannerPrioritiesV3();
    document.getElementById('pp_date').value=p?p.date:(plannerPrefs.viewDate||today());document.getElementById('pp_start').value=p?p.startTime:(d.startTime||'09:00');document.getElementById('pp_end').value=p?p.endTime:(d.endTime||'10:00');document.getElementById('pp_remind').value=String(p&&p.remindBefore!==undefined?p.remindBefore:15);document.getElementById('pp_repeat').value=p?p.repeat||'none':'none';document.getElementById('pp_repeat_until').value=p?p.repeatUntil||'':'';document.getElementById('pp_note').value=p?p.note||'':'';
    document.querySelectorAll('#pp_repeat_days span').forEach(x=>{x.classList.toggle('on',!!(p&&p.repeatDays||[]).map(Number).includes(Number(x.dataset.day)));x.onclick=()=>x.classList.toggle('on');});document.getElementById('pp_conflict').style.display='none';document.getElementById('pp_conflict').dataset.confirmed='';
    const ns=plannerNotifyStateV2();document.getElementById('pp_notify_hint').innerHTML=`<b>${ns.title}</b><span>${ns.sub}</span>`;updatePersonalPlanRepeatUi();showMask('maskPersonalPlanV2');setTimeout(()=>document.getElementById('pp_title').focus(),120);
  };
  function personalPlanFromFormV2(){return {title:document.getElementById('pp_title').value.trim(),category:plannerEditingCategory,priority:plannerPriorityV3(plannerEditingPriorityV3).label,date:document.getElementById('pp_date').value,startTime:document.getElementById('pp_start').value,endTime:document.getElementById('pp_end').value,remindBefore:Number(document.getElementById('pp_remind').value),repeat:document.getElementById('pp_repeat').value,repeatDays:[...document.querySelectorAll('#pp_repeat_days span.on')].map(x=>Number(x.dataset.day)),repeatUntil:document.getElementById('pp_repeat_until').value,note:document.getElementById('pp_note').value.trim()};}
  window.submitPersonalPlan=function(){
    const id=document.getElementById('pp_id').value,data=personalPlanFromFormV2();if(!data.title||!data.date||!data.startTime||!data.endTime){toast('请填写计划名称、日期和起止时间');return;}if(data.startTime===data.endTime){toast('开始时间和结束时间不能相同');return;}if(data.repeat==='custom'&&!data.repeatDays.length){toast('请至少选择一个重复星期');return;}if(data.repeatUntil&&data.repeatUntil<data.date){toast('重复结束日期不能早于开始日期');return;}
    const conflict=plannerConflictV2(data,id),box=document.getElementById('pp_conflict');if(conflict&&box.dataset.confirmed!=='yes'){box.style.display='block';box.innerHTML=`⚠️ 与 ${esc(conflict.date)} 的「${esc(conflict.plan.title)}」时间重叠。<button onclick="confirmPersonalPlanConflictV2()">仍然保存</button>`;return;}
    const before=cloneDataV2(personalPlans),now=Date.now();if(id){const p=personalPlans.find(x=>x.id===id&&!isDeleted(x));if(!p)return;Object.assign(p,data);markUpdated(p);}else personalPlans.push(Object.assign({id:'pp_'+uid(),owner:deviceId,private:true,stateByDate:{},createdAt:now,updatedAt:now},data));
    if(!save()){personalPlans=before;return;}hideMask('maskPersonalPlanV2');plannerPrefs.viewDate=data.date;renderPlan();syncPlannerPushScheduleV2();toast(id?'计划已更新':'计划已加入时间轴 ✨');
  };
  window.confirmPersonalPlanConflictV2=function(){document.getElementById('pp_conflict').dataset.confirmed='yes';submitPersonalPlan();};
  window.togglePersonalPlanCompleteV2=function(id,date){const p=personalPlans.find(x=>x.id===id&&!isDeleted(x));if(!p)return;const before=cloneDataV2(personalPlans),s=plannerStateForV2(p,date);s.completed=!s.completed;s.completedAt=s.completed?Date.now():0;s.snoozeUntil=0;markUpdated(p);if(!save()){personalPlans=before;return;}renderPlan();syncPlannerPushScheduleV2();toast(s.completed?'完成一项计划，真棒 🎉':'已恢复为待完成');};
  window.deletePersonalPlanV2=function(id){const index=personalPlans.findIndex(x=>x.id===id&&!isDeleted(x)),p=personalPlans[index];if(!p)return;cuteConfirmV2({title:'删除这项计划？',text:`「${p.title}」${p.repeat&&p.repeat!=='none'?'以及后续重复日程都会删除。':'将从日程中移除。'}`,okText:'删除计划'},()=>{const before=p,now=Date.now();personalPlans[index]={id:p.id,owner:p.owner,userId:p.userId,private:true,deleted:true,deletedAt:now,updatedAt:now};if(!save()){personalPlans[index]=before;return;}renderPlan();syncPlannerPushScheduleV2();toast('计划已删除');});};
  window.snoozePersonalPlanFromListV2=function(id,date,minutes){const p=personalPlans.find(x=>x.id===id&&!isDeleted(x));if(!p)return;const before=cloneDataV2(personalPlans),s=plannerStateForV2(p,date);s.snoozeUntil=Date.now()+minutes*60000;s.notifiedAt=0;markUpdated(p);if(!save()){personalPlans=before;return;}syncPlannerPushScheduleV2();toast(`已延后 ${minutes} 分钟提醒`);};
  function plannerBeepV2(){if(!plannerPrefs.sound)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=720;g.gain.setValueAtTime(.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(.16,c.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.45);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.48);setTimeout(()=>c.close(),800);}catch(_){}}
  async function plannerSystemNotifyV2(o){
    if(!plannerPrefs.notifyEnabled||!('Notification' in window)||Notification.permission!=='granted')return;const c=plannerCategoryV2(o.plan.category),body=`${plannerTimeTextV2(o.plan)}${o.plan.note?' · '+o.plan.note:''}`;
    try{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.ready;await reg.showNotification(`${c.emoji} ${o.plan.title}`,{body,tag:`planner-${o.plan.id}-${o.date}`,renotify:false,data:{url:`./index.html?planDate=${encodeURIComponent(o.date)}&planId=${encodeURIComponent(o.plan.id)}`},icon:'./app-icon.svg',badge:'./app-icon.svg'});}else new Notification(`${c.emoji} ${o.plan.title}`,{body,tag:`planner-${o.plan.id}-${o.date}`});}catch(_){ }
  }
  function showPlannerAlertV2(o){plannerAlertOccurrence=o;const c=plannerCategoryV2(o.plan.category);document.getElementById('planner_alert_icon').textContent=c.emoji;document.getElementById('planner_alert_title').textContent=o.plan.title;document.getElementById('planner_alert_time').textContent=`${o.date} · ${plannerTimeTextV2(o.plan)}`;document.getElementById('planner_alert_note').textContent=o.plan.note||'时间到了，准备开始这项计划吧。';showMask('maskPlannerAlertV2');plannerBeepV2();try{navigator.vibrate&&navigator.vibrate([160,80,160]);}catch(_){}}
  window.dismissPlannerAlert=function(){plannerAlertOccurrence=null;hideMask('maskPlannerAlertV2');};
  window.completePlannerAlert=function(){if(!plannerAlertOccurrence)return;const {plan,date}=plannerAlertOccurrence;hideMask('maskPlannerAlertV2');plannerAlertOccurrence=null;togglePersonalPlanCompleteV2(plan.id,date);};
  window.snoozePersonalPlan=function(minutes){if(!plannerAlertOccurrence)return;const {plan,date}=plannerAlertOccurrence;hideMask('maskPlannerAlertV2');plannerAlertOccurrence=null;snoozePersonalPlanFromListV2(plan.id,date,minutes);};
  async function checkPlannerRemindersV2(){
    if(plannerReminderBusy)return;plannerReminderBusy=true;try{const now=Date.now(),dates=[plannerAddDateV2(today(),-1),today()];for(const date of dates){for(const o of plannerOccurrencesV2(date)){if(o.state.completed||Number(o.plan.remindBefore)<0)continue;const trigger=o.state.snoozeUntil||o.interval.start-Number(o.plan.remindBefore||0)*60000;if(now<trigger||now>o.interval.end||o.state.notifiedAt)continue;o.state=plannerStateForV2(o.plan,date);o.state.notifiedAt=now;o.state.snoozeUntil=0;markUpdated(o.plan);save(false);showPlannerAlertV2(o);await plannerSystemNotifyV2(o);return;}}}finally{plannerReminderBusy=false;}
  }
  function urlBase64ToUint8ArrayV2(base64){const padding='='.repeat((4-base64.length%4)%4),raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
  async function subscribePlannerPushV2(){
    if(!syncUrl||!window.isSecureContext||!('serviceWorker' in navigator)||Notification.permission!=='granted')return false;
    try{const k=await fetch(syncUrl.replace(/\/$/,'')+'/api/push/public-key',{cache:'no-store'}).then(r=>r.json());if(!k.enabled||!k.publicKey)return false;const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8ArrayV2(k.publicKey)});const r=await fetch(syncUrl.replace(/\/$/,'')+'/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth({subscription:sub.toJSON()}))});if(!r.ok)return false;plannerPrefs.pushEnabled=true;saveFeatureData(false);await syncPlannerPushScheduleV2();return true;}catch(_){plannerPrefs.pushEnabled=false;saveFeatureData(false);return false;}
  }
  function buildPlannerPushJobsV2(){const jobs=[],now=Date.now();for(let i=0;i<62;i++){const date=plannerAddDateV2(today(),i);for(const o of plannerOccurrencesV2(date)){if(o.state.completed||Number(o.plan.remindBefore)<0)continue;const fireAt=o.state.snoozeUntil||o.interval.start-Number(o.plan.remindBefore||0)*60000;if(fireAt<now-60000)continue;const c=plannerCategoryV2(o.plan.category);jobs.push({id:`${o.plan.id}_${date}`,fireAt,title:`${c.emoji} ${o.plan.title}`,body:`${plannerTimeTextV2(o.plan)}${o.plan.note?' · '+o.plan.note:''}`,url:`/index.html?planDate=${encodeURIComponent(date)}&planId=${encodeURIComponent(o.plan.id)}`});if(jobs.length>=460)return jobs;}}for(const plan of liveRepaymentPlansV1()){const schedule=repaymentPlanScheduleV1(plan);for(const row of schedule.rows){if(row.actual>=row.planned-.005||row.planned<=0)continue;const fireAt=new Date(Number(plan.year),row.month-1,Math.max(1,Math.min(28,Number(plan.reminderDay)||1)),9,0,0,0).getTime();if(fireAt<now-60000)continue;jobs.push({id:`repayment_${plan.id}_${row.key}`,fireAt,title:'🎯 月度还款计划提醒',body:`${row.month} 月计划还 ¥${fmt(row.planned)}，当前已还 ¥${fmt(row.actual)}`,url:'/index.html?tab=debt&debtView=plan'});if(jobs.length>=480)return jobs;}}for(const goal of active(growthGoals).filter(x=>!x.completed)){const d=dateValueV2(goal.dueDate);if(!d)continue;const fireAt=new Date(d.getFullYear(),d.getMonth(),d.getDate(),9,0,0,0).getTime();if(fireAt<now-60000)continue;jobs.push({id:`goal_${goal.id}_${goal.dueDate}`,fireAt,title:'🎯 目标到期提醒',body:`${goal.title} · 当前完成 ${Math.round(growthGoalPercentV1(goal))}%`,url:'/index.html?tab=plan&growthView=goal'});if(jobs.length>=500)return jobs;}return jobs;}
  let plannerPushRetryTimerV2=null;
  async function syncPlannerPushScheduleV2(){
    if(!plannerPrefs.pushEnabled||!syncUrl)return false;let ok=false;try{const r=await fetch(syncUrl.replace(/\/$/,'')+'/api/push/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth({jobs:buildPlannerPushJobsV2()}))});ok=r.ok;}catch(_){ok=false;}
    plannerPrefs.pushPending=!ok;saveFeatureData(false);clearTimeout(plannerPushRetryTimerV2);if(!ok)plannerPushRetryTimerV2=setTimeout(()=>{if(!document.hidden)syncPlannerPushScheduleV2();},30000);return ok;
  }
  window.enablePlannerNotificationsV2=async function(){
    if(!('Notification' in window)){toast('当前浏览器不支持系统通知');return;}if(!window.isSecureContext){toast('系统通知需要 HTTPS；本机 localhost 可以直接使用',6000);return;}let permission=Notification.permission;try{if(permission==='default')permission=await Notification.requestPermission();}catch(_){ }
    plannerPrefs.notifyEnabled=permission==='granted';if(permission==='granted'){const pushed=await subscribePlannerPushV2();toast(pushed?'系统通知和云端推送已开启 ✓':'系统通知已开启；部署到腾讯云后可启用关页推送',5500);}else toast('没有获得通知权限，请在浏览器网站设置中允许通知',6000);saveFeatureData(false);renderPlan();
  };
  window.togglePlannerSoundV2=function(){plannerPrefs.sound=!plannerPrefs.sound;saveFeatureData(false);renderPlan();toast(plannerPrefs.sound?'计划提醒声音已开启':'计划提醒声音已关闭');};
  function renderTodayPlannerMiniV2(){const list=plannerOccurrencesV2(today()),now=Date.now(),activeOne=list.find(o=>!o.state.completed&&now>=o.interval.start&&now<o.interval.end),next=activeOne||list.find(o=>!o.state.completed&&o.interval.start>now),done=list.filter(o=>o.state.completed).length;if(!list.length)return `<div class="planner-mini" onclick="showTab('plan')"><span class="pm-icon">🌤️</span><div><b>今天还没有日程</b><small>安排健身、工作、学习或休息计划</small></div><span class="pm-go">去规划 ›</span></div>`;const o=next||list[list.length-1],c=plannerCategoryV2(o.plan.category);return `<div class="planner-mini ${activeOne?'doing':''}" onclick="showTab('plan')"><span class="pm-icon" style="background:${c.color}22">${c.emoji}</span><div><b>${activeOne?'正在进行':'下一项'} · ${esc(o.plan.title)}</b><small>${plannerTimeTextV2(o.plan)} · 今日完成 ${done}/${list.length}</small></div><span class="pm-go">查看 ›</span></div>`;}

  function monthExpense(month,category){return inLedger(transactions).filter(t=>t.type==='out'&&ym(t.date)===month&&(category==='__all__'||t.category===category)).reduce((s,t)=>s+t.amount,0);}
  function budgetRows(month){
    const list=active(budgets).filter(b=>b.ledger===currentLedger&&b.month===month).sort((a,b)=>a.category==='__all__'?-1:b.category==='__all__'?1:a.category.localeCompare(b.category));
    if(!list.length)return `<div class="cute-row"><div class="cr-icon">🌱</div><div class="cr-main"><div class="cr-title">还没有预算</div><div class="cr-sub">先给这个月定一个轻松的小目标吧</div></div></div>`;
    return list.map(b=>{const used=monthExpense(month,b.category),pct=Math.min(100,used/b.amount*100),over=used>b.amount;return `<div class="cute-row"><div class="cr-icon">${b.category==='__all__'?'🎯':catEmoji(b.category)}</div><div class="cr-main"><div class="cr-title">${b.category==='__all__'?'总预算':esc(b.category)}</div><div class="cr-sub">已用 ¥${fmt(used)} / ¥${fmt(b.amount)}</div><div class="prog"><i style="width:${pct}%;background:${over?'var(--red)':pct>80?'var(--orange)':'var(--brand)'}"></i></div></div><div class="cr-side ${over?'danger-text':''}">${over?'超 '+fmt(used-b.amount):Math.round(pct)+'%'}</div><span class="mini-act" onclick="deleteBudget('${b.id}')">删除</span></div>`;}).join('');
  }
  function recurringNextText(r){return `${r.cadence==='weekly'?'每周':'每月'} · 下次 ${r.nextDate}`;}
  function renderFinancePlanV2(){
    document.getElementById('title').textContent='计划 · '+curLedger().name;hideTopAct();setFab(null,null);
    const month=ym(today()),due=active(recurringRules).filter(r=>r.ledger===currentLedger&&r.enabled!==false&&r.nextDate<=today()).length;
    const accounts=liveAccounts(),archivedAccounts=active(financeAccounts).filter(a=>a.ledger===currentLedger&&a.archived);
    let h=renderLedgerBar()+`<div class="plan-head"><div><small>让每一笔钱都有去处</small><h2>我的财务花园 🌷</h2></div><span class="badge b-active">${month}</span></div>
      <div class="card"><div class="head"><div class="feature-title"><span class="bubble">🎯</span>月度预算</div><span class="inline-add" onclick="openBudget()">＋ 设置</span></div><div class="cute-list">${budgetRows(month)}</div></div>
      <div class="card"><div class="head"><div class="feature-title"><span class="bubble">🗓️</span>周期账单</div><span class="inline-add" onclick="openRecurring()">＋ 新建</span></div>`;
    const rules=active(recurringRules).filter(r=>r.ledger===currentLedger);
    h+=`<div class="cute-list">${rules.length?rules.map(r=>`<div class="cute-row ${r.enabled===false?'muted':''}"><div class="cr-icon">${catEmoji(r.category)}</div><div class="cr-main"><div class="cr-title">${esc(r.name)} ${r.enabled===false?'<small>已暂停</small>':''}</div><div class="cr-sub">${recurringNextText(r)}</div></div><div class="cr-side"><b class="amt ${r.type}">${typeSymbol(r.type)}¥${fmt(r.amount)}</b><br><span class="mini-act" onclick="openRecurring('${r.id}')">编辑</span> <span class="mini-act" onclick="toggleRecurringV2('${r.id}')">${r.enabled===false?'启用':'暂停'}</span> <span class="mini-act danger-text" onclick="deleteRecurring('${r.id}')">删除</span></div></div>`).join(''):`<div class="cute-row"><div class="cr-icon">⏰</div><div class="cr-main"><div class="cr-title">没有周期账单</div><div class="cr-sub">房租、工资、订阅都可以提前安排</div></div></div>`}</div>`;
    if(due)h+=`<div class="btn btn-primary" style="text-align:center;padding:11px;border-radius:15px;margin-top:10px" onclick="generateDueTransactions()">生成 ${due} 项到期账单</div>`;
    h+=`</div><div class="card"><div class="head"><div class="feature-title"><span class="bubble">💳</span>我的账户</div><span class="inline-add" onclick="openAccount()">＋ 新建</span></div><div class="account-grid">${accounts.map(a=>`<div class="account-card" onclick="openAccount('${a.id}')"><div class="an">${esc(a.emoji||'💳')} ${esc(a.name)}</div><div class="av">¥${fmt(accountBalance(a))}</div><div class="as">初始余额 ¥${fmt(a.openingBalance||0)} · 点此编辑</div></div>`).join('')}</div>${archivedAccounts.length?`<div class="archived-accounts-v2"><b>已归档账户</b>${archivedAccounts.map(a=>`<span>${esc(a.emoji||'💳')} ${esc(a.name)} <button onclick="restoreFinanceAccountV2('${a.id}')">恢复</button></span>`).join('')}</div>`:''}</div>
      <div class="card"><div class="head"><div class="feature-title"><span class="bubble">✨</span>自定义分类</div><span class="inline-add" onclick="openCategory()">＋ 新建</span></div><div class="acclist">${active(customCategories).filter(c=>c.ledger===currentLedger).map(c=>`<span>${esc(c.emoji)} ${esc(c.name)} <b class="danger-text" onclick="deleteCategory('${c.id}')">×</b></span>`).join('')||'<span>还没有自定义分类</span>'}</div></div>`;
    document.getElementById('view').innerHTML=plannerSwitchV2()+h;
  }
  window.renderPlan=function(){clearInterval(growthTimerV5);if(planMode==='finance')renderFinancePlanV2();else if(planMode==='schedule')renderSchedulePlanV2();else if(planMode==='goal')renderGrowthGoalsV1();else if(planMode==='focus')renderFocusV5();else renderGrowthHomeV5();};

  window.openBudget=function(){
    document.getElementById('bu_month').value=ym(today());document.getElementById('bu_amount').value='';
    document.getElementById('bu_category').innerHTML=`<option value="__all__">全部支出（总预算）</option>`+ledgerCategories('out').map(c=>`<option value="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join('');showMask('maskBudgetV2');
  };
  window.submitBudget=function(){
    const month=document.getElementById('bu_month').value||ym(today()),category=document.getElementById('bu_category').value,amount=parseFloat(document.getElementById('bu_amount').value);if(!(amount>0)){toast('请输入预算金额');return;}
    const before=cloneDataV2(budgets);
    let b=active(budgets).find(x=>x.ledger===currentLedger&&x.month===month&&x.category===category);
    if(b){b.amount=amount;markUpdated(b);}else budgets.push({id:'bu_'+uid(),ledger:currentLedger,owner:deviceId,month,category,amount,createdAt:Date.now(),updatedAt:Date.now()});
    if(!save()){budgets=before;return;}hideMask('maskBudgetV2');renderPlan();toast('预算已保存');
  };
  window.deleteBudget=function(id){const index=budgets.findIndex(x=>x.id===id&&!isDeleted(x)),b=budgets[index];if(!b)return;cuteConfirmV2({title:'删除这项预算？',text:`${b.month} · ${b.category==='__all__'?'总预算':b.category} · ¥${fmt(b.amount)}`,okText:'删除预算'},()=>{const before=b,now=Date.now();budgets[index]={id:b.id,ledger:b.ledger,owner:b.owner,userId:b.userId,deleted:true,deletedAt:now,updatedAt:now};if(!save()){budgets[index]=before;return;}renderPlan();toast('预算已删除');});};

  let newRuleType='out';
  window.pickRuleType=function(type){newRuleType=type;document.querySelectorAll('#rr_type div').forEach(x=>x.classList.toggle('on',x.dataset.v===type));fillRuleCategories();};
  function fillRuleCategories(){document.getElementById('rr_category').innerHTML=ledgerCategories(newRuleType).map(c=>`<option value="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join('');}
  window.openRecurring=function(id=''){
    const r=id&&recurringRules.find(x=>x.id===id&&!isDeleted(x));document.getElementById('rr_id').value=r?r.id:'';document.getElementById('rr_sheet_title').textContent=r?'✏️ 编辑周期账单':'🗓️ 新建周期账单';document.getElementById('rr_save_btn').textContent=r?'保存修改':'保存计划';newRuleType=r?r.type:'out';pickRuleType(newRuleType);document.getElementById('rr_name').value=r?r.name:'';document.getElementById('rr_amount').value=r?r.amount:'';document.getElementById('rr_next').value=r?r.nextDate:today();document.getElementById('rr_cadence').value=r?r.cadence:'monthly';
    document.getElementById('rr_account').innerHTML=liveAccounts().map(a=>`<option value="${a.id}">${esc(a.emoji)} ${esc(a.name)}</option>`).join('');if(r){document.getElementById('rr_category').value=r.category;document.getElementById('rr_account').value=r.accountId;}showMask('maskRecurring');
  };
  window.submitRecurring=function(){
    const id=document.getElementById('rr_id').value,name=document.getElementById('rr_name').value.trim(),amount=parseFloat(document.getElementById('rr_amount').value),category=document.getElementById('rr_category').value,accountId=document.getElementById('rr_account').value,cadence=document.getElementById('rr_cadence').value,nextDate=document.getElementById('rr_next').value;
    if(!name||!(amount>0)||!nextDate){toast('请把名称、金额和日期填写完整');return;}const a=findAccountById(accountId);if(!a)return;
    const before=cloneDataV2(recurringRules),existing=id&&recurringRules.find(x=>x.id===id&&!isDeleted(x));if(existing){Object.assign(existing,{name,amount,type:newRuleType,category,accountId,account:a.name,cadence,nextDate});markUpdated(existing);}else recurringRules.push({id:'rr_'+uid(),ledger:currentLedger,owner:deviceId,name,amount,type:newRuleType,category,accountId,account:a.name,cadence,nextDate,enabled:true,createdAt:Date.now(),updatedAt:Date.now()});if(!save()){recurringRules=before;return;}hideMask('maskRecurring');renderPlan();toast(existing?'周期计划已更新':'周期计划已建立');
  };
  window.toggleRecurringV2=function(id){const r=recurringRules.find(x=>x.id===id&&!isDeleted(x));if(!r)return;const before=r.enabled;r.enabled=r.enabled===false;markUpdated(r);if(!save()){r.enabled=before;return;}renderPlan();toast(r.enabled?'周期计划已启用':'周期计划已暂停');};
  window.deleteRecurring=function(id){const index=recurringRules.findIndex(x=>x.id===id&&!isDeleted(x)),r=recurringRules[index];if(!r)return;cuteConfirmV2({title:'删除周期计划？',text:`「${r.name}」不会再自动生成账单，已经生成的账单会保留。`,okText:'删除计划'},()=>{const before=r,now=Date.now();recurringRules[index]={id:r.id,ledger:r.ledger,owner:r.owner,userId:r.userId,deleted:true,deletedAt:now,updatedAt:now};if(!save()){recurringRules[index]=before;return;}renderPlan();toast('周期计划已删除');});};
  function nextRuleDate(date,cadence){
    const [y,m,d]=date.split('-').map(Number);const x=new Date(y,m-1,d);
    if(cadence==='weekly')x.setDate(x.getDate()+7);else{const nextMonthIndex=m;const last=new Date(y,nextMonthIndex+1,0).getDate();x.setFullYear(y,nextMonthIndex,Math.min(d,last));}
    return dateStr(x);
  }
  window.generateDueTransactions=function(){
    const beforeTx=cloneDataV2(transactions),beforeRules=cloneDataV2(recurringRules);let count=0;const now=today();active(recurringRules).filter(r=>r.ledger===currentLedger&&r.enabled!==false).forEach(r=>{
      let guard=0;while(r.nextDate<=now&&guard++<36){
        if(!active(transactions).some(t=>t.recurringId===r.id&&t.date===r.nextDate))transactions.push({id:uid(),ledger:r.ledger,owner:deviceId,type:r.type,amount:r.amount,category:r.category,account:r.account,accountId:r.accountId,date:r.nextDate,remark:r.name,recurringId:r.id,createdAt:Date.now(),updatedAt:Date.now()}),count++;
        r.nextDate=nextRuleDate(r.nextDate,r.cadence);markUpdated(r);
      }
    });if(!save()){transactions=beforeTx;recurringRules=beforeRules;return;}renderPlan();toast(count?'已生成 '+count+' 笔到期账单':'没有待生成的账单');
  };

  window.openAccount=function(id){
    const a=id&&financeAccounts.find(x=>x.id===id&&!isDeleted(x));document.getElementById('account_sheet_title').textContent=a?'✏️ 编辑账户':'💳 新建账户';
    document.getElementById('ac_id').value=a?a.id:'';document.getElementById('ac_name').value=a?a.name:'';document.getElementById('ac_emoji').value=a?a.emoji||'💳':'💳';document.getElementById('ac_opening').value=a?a.openingBalance||0:'';document.getElementById('ac_delete_btn_v2').style.display=a?'block':'none';showMask('maskAccountV2');
  };
  window.submitAccount=function(){
    const id=document.getElementById('ac_id').value,name=document.getElementById('ac_name').value.trim(),emoji=document.getElementById('ac_emoji').value.trim()||'💳',openingBalance=parseFloat(document.getElementById('ac_opening').value)||0;if(!name){toast('请输入账户名称');return;}
    const duplicate=active(financeAccounts).find(a=>a.ledger===currentLedger&&a.name===name&&a.id!==id);if(duplicate){toast('已有同名账户（可能在已归档账户中）');return;}const beforeAccounts=cloneDataV2(financeAccounts),beforeTx=cloneDataV2(transactions),beforeRules=cloneDataV2(recurringRules);
    if(id){const a=financeAccounts.find(x=>x.id===id&&!isDeleted(x));if(a){const old=a.name;a.name=name;a.emoji=emoji;a.openingBalance=openingBalance;markUpdated(a);transactions.forEach(t=>{if(t.accountId===id){t.account=name;markUpdated(t);}else if(t.account===old&&!t.accountId){t.account=name;markUpdated(t);}});recurringRules.forEach(r=>{if(!isDeleted(r)&&r.accountId===id){r.account=name;markUpdated(r);}});active(transactions).filter(t=>t.type==='transfer'&&(t.fromAccountId===id||t.toAccountId===id)).forEach(t=>{const from=active(financeAccounts).find(x=>x.id===t.fromAccountId),to=active(financeAccounts).find(x=>x.id===t.toAccountId);t.account=(from?from.name:'未知')+' → '+(to?to.name:'未知');markUpdated(t);});}}
    else financeAccounts.push({id:'ac_'+uid(),ledger:currentLedger,owner:deviceId,name,emoji,openingBalance,createdAt:Date.now(),updatedAt:Date.now()});
    if(!save()){financeAccounts=beforeAccounts;transactions=beforeTx;recurringRules=beforeRules;return;}hideMask('maskAccountV2');renderCurrent();toast('账户已保存');
  };
  window.deleteFinanceAccountV2=function(){
    const id=document.getElementById('ac_id').value,a=financeAccounts.find(x=>x.id===id&&!isDeleted(x));if(!a)return;if(liveAccounts().length<=1){toast('至少保留一个可用账户');return;}const refs=active(transactions).filter(t=>t.accountId===id||t.fromAccountId===id||t.toAccountId===id).length+active(debts).filter(d=>d.accountId===id||(d.repayments||[]).some(r=>r.accountId===id)).length+active(recurringRules).filter(r=>r.accountId===id).length;
    cuteConfirmV2({title:refs?'归档这个账户？':'删除这个账户？',text:refs?`「${a.name}」已有 ${refs} 条关联记录。为保证历史账目准确，将安全归档而不是抹去。`:`「${a.name}」没有关联记录，可以安全删除。`,okText:refs?'归档账户':'删除账户'},()=>{const before=cloneDataV2(financeAccounts);if(refs){a.archived=true;markUpdated(a);}else{const index=financeAccounts.indexOf(a),now=Date.now();financeAccounts[index]={id:a.id,ledger:a.ledger,owner:a.owner,userId:a.userId,deleted:true,deletedAt:now,updatedAt:now};}if(!save()){financeAccounts=before;return;}hideMask('maskAccountV2');renderPlan();toast(refs?'账户已归档，历史账目保持不变':'账户已删除');});
  };
  window.restoreFinanceAccountV2=function(id){const a=financeAccounts.find(x=>x.id===id&&!isDeleted(x)&&x.archived);if(!a)return;if(liveAccounts().some(x=>x.name===a.name)){toast('已有同名账户，请先改名后再恢复');return;}a.archived=false;markUpdated(a);if(!save()){a.archived=true;return;}renderPlan();toast('账户已恢复');};

  let newCategoryType='out';
  window.pickCategoryType=function(type){newCategoryType=type;document.querySelectorAll('#cc_type div').forEach(x=>x.classList.toggle('on',x.dataset.v===type));};
  window.openCategory=function(){pickCategoryType('out');document.getElementById('cc_name').value='';document.getElementById('cc_emoji').value='✨';document.getElementById('cc_color').value=theme.color;showMask('maskCategoryV2');};
  window.submitCategory=function(){
    const name=document.getElementById('cc_name').value.trim(),emoji=document.getElementById('cc_emoji').value.trim()||'✨',color=document.getElementById('cc_color').value;if(!name){toast('请输入分类名称');return;}
    if(ledgerCategories(newCategoryType).some(c=>c.name===name)){toast('这个分类已经存在');return;}
    const c={id:'cc_'+uid(),ledger:currentLedger,owner:deviceId,type:newCategoryType,name,emoji,color,createdAt:Date.now(),updatedAt:Date.now()};customCategories.push(c);CAT_COLOR[name]=color;if(!save()){customCategories=customCategories.filter(x=>x!==c);return;}hideMask('maskCategoryV2');renderCurrent();toast('新分类已添加');
  };
  window.deleteCategory=function(id){const index=customCategories.findIndex(x=>x.id===id&&!isDeleted(x)),c=customCategories[index];if(!c)return;cuteConfirmV2({title:'删除自定义分类？',text:`「${c.name}」会从选择菜单移除，已有账单仍保留分类名称。`,okText:'删除分类'},()=>{const before=c,now=Date.now();customCategories[index]={id:c.id,ledger:c.ledger,owner:c.owner,userId:c.userId,deleted:true,deletedAt:now,updatedAt:now};if(!save()){customCategories[index]=before;return;}renderPlan();toast('分类已删除');});};

  closeEscrow=function(){const e=escrows.find(x=>x.id===currentId&&!isDeleted(x));if(!e)return;cuteConfirmV2({title:'关闭这项托管？',text:'关闭后不再计入进行中统计，但历史明细仍会保留。',okText:'确认关闭',icon:'📦'},()=>{const before=cloneDataV2(e);e.status='closed';markUpdated(e);if(!save()){Object.assign(e,before);return;}goDetail(e.id);toast('托管已关闭');});};
  deleteUsage=function(uid){const index=usages.findIndex(x=>x.id===uid&&!isDeleted(x)),u=usages[index];if(!u)return;cuteConfirmV2({title:'删除这条托管明细？',text:`${u.date||''} · ${u.type==='rest'?'休息日':'¥'+fmt(u.amount||0)}`,okText:'删除明细'},()=>{const beforeUsages=cloneDataV2(usages),beforeEscrows=cloneDataV2(escrows),now=Date.now();usages[index]={id:u.id,ledger:u.ledger,owner:u.owner,userId:u.userId,escrowId:u.escrowId,deleted:true,deletedAt:now,updatedAt:now};const e=escrows.find(x=>x.id===u.escrowId&&!isDeleted(x));if(e){recompute(e);markUpdated(e);}if(!save()){usages=beforeUsages;escrows=beforeEscrows;return;}if(e)goDetail(e.id);else goList();toast('明细已删除');});};
  deleteEscrow=function(id){const index=escrows.findIndex(x=>x.id===id&&!isDeleted(x)),e=escrows[index];if(!e)return;const related=active(usages).filter(u=>u.escrowId===id);cuteConfirmV2({title:'删除整项托管？',text:`「${e.proxyName}」以及关联的 ${related.length} 条明细都会删除。`,okText:'删除托管'},()=>{const beforeEscrows=cloneDataV2(escrows),beforeUsages=cloneDataV2(usages),now=Date.now();related.forEach(u=>{const i=usages.indexOf(u);usages[i]={id:u.id,ledger:u.ledger,owner:u.owner,userId:u.userId,escrowId:u.escrowId,deleted:true,deletedAt:now,updatedAt:now};});escrows[index]={id:e.id,ledger:e.ledger,owner:e.owner,userId:e.userId,deleted:true,deletedAt:now,updatedAt:now};if(!save()){escrows=beforeEscrows;usages=beforeUsages;return;}goList();toast('托管已删除');});};

  openSettings=function(){coreOpenSettings();renderThemeUI();};
  window.openDataTools=function(){showMask('maskDataV2');};
  function downloadBlob(content,type,name){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  window.exportFullBackup=function(){
    const data={app:'小确幸记账',schemaVersion:7,exportedAt:new Date().toISOString(),currentLedger,theme,reminder,transactions:active(transactions),escrows:active(escrows),usages:active(usages),debts:active(debts),ledgers:active(ledgers),accounts:active(financeAccounts),categories:active(customCategories),budgets:active(budgets),recurringRules:active(recurringRules),personalPlans:active(personalPlans),repaymentPlans:active(repaymentPlans),plannerPrefs,goals:active(growthGoals),inspirations:active(growthInspirations),diaries:active(growthDiaries),focusSessions:active(growthFocusSessions),focusPrefs:growthFocusPrefs};
    downloadBlob(JSON.stringify(data,null,2),'application/json;charset=utf-8','小确幸记账_完整备份_'+today()+'.json');toast('完整备份已导出');
  };
  window.openRestoreFile=function(){document.getElementById('restore_file_v2').click();};
  const BACKUP_ID_RE_V2=/^[A-Za-z0-9_-]{1,128}$/;
  const BACKUP_MEMBER_RE_V2=/^(?:user:)?[A-Za-z0-9_-]{1,128}$/;
  const BACKUP_COLOR_RE_V2=/^#[0-9a-fA-F]{6}$/;
  const BACKUP_DATE_RE_V2=/^\d{4}-\d{2}-\d{2}$/;
  const BACKUP_TIME_RE_V2=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const BACKUP_KEYS_V2={
    ledgers:['id','name','icon','color','shared','owner','deviceId','userId','ownerUserId','members','shareCode','createdAt','updatedAt','deleted','deletedAt'],
    transactions:['id','ledger','owner','deviceId','userId','type','amount','category','account','accountId','fromAccountId','toAccountId','date','merchant','remark','photo','photoOmittedFromLocalProfile','aiConfidence','aiSource','documentType','recurringId','linkedDebtId','linkedRepaymentId','debtFlowRole','createdAt','updatedAt','importedAt','deleted','deletedAt'],
    escrows:['id','ledger','owner','deviceId','userId','proxyName','totalAmount','dailyLimit','totalDays','startDate','endDate','status','remaining','usedAmount','usedDays','restDays','remark','createdAt','updatedAt','deleted','deletedAt'],
    usages:['id','ledger','owner','deviceId','userId','escrowId','date','type','amount','remainingAfter','remark','createdAt','updatedAt','deleted','deletedAt'],
    debts:['id','ledger','owner','deviceId','userId','person','direction','principal','amount','fee','interestType','interestRate','interestAmount','date','dueDate','firstDueDate','installments','frequency','purpose','remark','relationship','contact','accountId','trackAccount','repayments','repaid','done','initialFlowTxId','aiConfidence','aiSource','createdAt','updatedAt','deleted','deletedAt'],
    accounts:['id','ledger','owner','deviceId','userId','name','emoji','openingBalance','order','archived','createdAt','updatedAt','deleted','deletedAt'],
    categories:['id','ledger','owner','deviceId','userId','type','name','emoji','color','createdAt','updatedAt','deleted','deletedAt'],
    budgets:['id','ledger','owner','deviceId','userId','month','category','amount','createdAt','updatedAt','deleted','deletedAt'],
    recurringRules:['id','ledger','owner','deviceId','userId','name','amount','type','category','account','accountId','cadence','nextDate','enabled','createdAt','updatedAt','deleted','deletedAt'],
    personalPlans:['id','ledger','owner','deviceId','userId','private','title','category','priority','date','startTime','endTime','remindBefore','repeat','repeatDays','repeatUntil','note','stateByDate','createdAt','updatedAt','deleted','deletedAt'],
    repaymentPlans:['id','ledger','owner','deviceId','userId','private','year','targetAmount','startMonth','installments','strategy','customMonths','reminderDay','accountId','note','debtIds','createdAt','updatedAt','deleted','deletedAt'],
    goals:['id','owner','deviceId','userId','private','title','kind','scope','targetValue','currentValue','unit','dueDate','priority','note','completed','completedAt','createdAt','updatedAt','deleted','deletedAt'],
    inspirations:['id','owner','deviceId','userId','private','content','tags','pinned','createdAt','updatedAt','deleted','deletedAt'],
    diaries:['id','owner','deviceId','userId','private','date','heading','mood','weather','category','content','images','createdAt','updatedAt','deleted','deletedAt'],
    focusSessions:['id','owner','deviceId','userId','private','task','durationMinutes','date','startedAt','endedAt','note','createdAt','updatedAt','deleted','deletedAt']
  };
  function rejectBackupV2(message){throw new Error('备份文件不安全或格式不正确：'+message);}
  function backupPlainObjectV2(value,label){
    if(!value||typeof value!=='object'||Array.isArray(value))rejectBackupV2(label+' 必须是对象');
    for(const key of Object.keys(value))if(key==='__proto__'||key==='prototype'||key==='constructor')rejectBackupV2(label+' 含有危险字段');
    return value;
  }
  function backupPickV2(value,label,keys){
    const raw=backupPlainObjectV2(value,label),allowed=new Set(keys),out={};
    for(const key of Object.keys(raw)){if(!allowed.has(key))rejectBackupV2(label+' 含有未知字段 '+key);out[key]=raw[key];}
    return out;
  }
  function backupStringV2(value,label,max,allowEmpty=true){if(typeof value!=='string'||value.length>max||(!allowEmpty&&!value.trim()))rejectBackupV2(label+' 文本无效');return value;}
  function backupIdV2(value,label,allowEmpty=true){if(value===''&&allowEmpty)return '';if(typeof value!=='string'||!BACKUP_ID_RE_V2.test(value))rejectBackupV2(label+' 标识无效');return value;}
  function backupNumberV2(value,label,min,max,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))rejectBackupV2(label+' 数值超出范围');return value;}
  function backupBooleanV2(value,label){if(typeof value!=='boolean')rejectBackupV2(label+' 必须为布尔值');return value;}
  function backupEnumV2(value,label,allowed){if(typeof value!=='string'||!allowed.includes(value))rejectBackupV2(label+' 枚举值无效');return value;}
  function backupDateV2(value,label,allowEmpty=true){if(value===''&&allowEmpty)return '';if(typeof value!=='string'||!BACKUP_DATE_RE_V2.test(value)){rejectBackupV2(label+' 日期无效');}const d=new Date(value+'T12:00:00');if(Number.isNaN(d.getTime())||dateStr(d)!==value)rejectBackupV2(label+' 日期不存在');return value;}
  function backupPhotoV2(value,label){if(value===null||value==='')return value;if(typeof value!=='string'||value.length>8*1024*1024||!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(value))rejectBackupV2(label+' 图片格式无效');return value;}
  function backupRecordV2(raw,collection,index){
    const label=collection+'['+index+']',out=backupPickV2(raw,label,BACKUP_KEYS_V2[collection]);
    if(!Object.prototype.hasOwnProperty.call(out,'id'))rejectBackupV2(label+' 缺少 id');out.id=backupIdV2(out.id,label+'.id',false);
    for(const key of ['ledger','owner','deviceId','userId','ownerUserId','escrowId','accountId','fromAccountId','toAccountId','recurringId','linkedDebtId','linkedRepaymentId','initialFlowTxId'])if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupIdV2(out[key],label+'.'+key,true);
    for(const key of ['createdAt','updatedAt','deletedAt','importedAt','startedAt','endedAt','completedAt'])if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupNumberV2(out[key],label+'.'+key,0,Number.MAX_SAFE_INTEGER,true);
    for(const key of ['deleted','shared','archived','enabled','private','trackAccount','done','completed','photoOmittedFromLocalProfile','pinned'])if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupBooleanV2(out[key],label+'.'+key);
    const textLimits={name:120,proxyName:120,person:120,title:160,heading:80,task:120,content:10000,unit:16,icon:32,emoji:32,category:120,account:120,merchant:240,remark:2000,note:2000,purpose:1000,relationship:120,contact:240,aiSource:80,shareCode:32};
    for(const [key,max] of Object.entries(textLimits))if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupStringV2(out[key],label+'.'+key,max);
    for(const key of ['date','startDate','endDate','dueDate','firstDueDate','nextDate','repeatUntil'])if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupDateV2(out[key],label+'.'+key,true);
    const moneyFields=['amount','principal','fee','interestAmount','repaid','totalAmount','dailyLimit','remaining','usedAmount','remainingAfter','targetAmount'];
    for(const key of moneyFields)if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupNumberV2(out[key],label+'.'+key,0,1e12);
    if(Object.prototype.hasOwnProperty.call(out,'openingBalance'))out.openingBalance=backupNumberV2(out.openingBalance,label+'.openingBalance',-1e12,1e12);
    if(Object.prototype.hasOwnProperty.call(out,'interestRate'))out.interestRate=backupNumberV2(out.interestRate,label+'.interestRate',0,100000);
    if(Object.prototype.hasOwnProperty.call(out,'aiConfidence'))out.aiConfidence=backupNumberV2(out.aiConfidence,label+'.aiConfidence',0,1);
    for(const key of ['totalDays','usedDays','restDays','installments'])if(Object.prototype.hasOwnProperty.call(out,key))out[key]=backupNumberV2(out[key],label+'.'+key,key==='installments'||key==='totalDays'?1:0,key==='installments'?120:100000,true);
    if(Object.prototype.hasOwnProperty.call(out,'order'))out.order=backupNumberV2(out.order,label+'.order',-100000,100000,true);
    if(Object.prototype.hasOwnProperty.call(out,'photo'))out.photo=backupPhotoV2(out.photo,label+'.photo');
    if(Object.prototype.hasOwnProperty.call(out,'color')&&(typeof out.color!=='string'||!BACKUP_COLOR_RE_V2.test(out.color)))rejectBackupV2(label+'.color 颜色无效');
    if(Object.prototype.hasOwnProperty.call(out,'members')){if(!Array.isArray(out.members)||out.members.length>500||out.members.some(x=>typeof x!=='string'||!BACKUP_MEMBER_RE_V2.test(x)))rejectBackupV2(label+'.members 成员无效');out.members=[...new Set(out.members)];}
    if(out.deleted===true)return out;
    if(collection==='ledgers'){backupStringV2(out.name,label+'.name',120,false);backupEnumV2(out.shared===true?'yes':'no',label+'.shared',['yes','no']);}
    if(collection==='transactions'){out.type=backupEnumV2(out.type,label+'.type',['out','in','transfer','debt_in','debt_out']);backupNumberV2(out.amount,label+'.amount',0.01,1e12);backupDateV2(out.date,label+'.date',false);if(out.documentType!==undefined)backupEnumV2(out.documentType,label+'.documentType',['expense','income','loan_out','loan_in','repayment_received','repayment_paid','unknown']);if(out.debtFlowRole!==undefined)backupEnumV2(out.debtFlowRole,label+'.debtFlowRole',['initial','repayment']);}
    if(collection==='escrows'){backupStringV2(out.proxyName,label+'.proxyName',120,false);out.status=backupEnumV2(out.status,label+'.status',['active','low','depleted','closed']);backupNumberV2(out.totalAmount,label+'.totalAmount',0.01,1e12);backupNumberV2(out.dailyLimit,label+'.dailyLimit',0.01,1e12);backupDateV2(out.startDate,label+'.startDate',false);backupDateV2(out.endDate,label+'.endDate',false);}
    if(collection==='usages'){out.type=backupEnumV2(out.type,label+'.type',['consume','rest']);backupDateV2(out.date,label+'.date',false);}
    if(collection==='debts'){backupStringV2(out.person,label+'.person',120,false);out.direction=backupEnumV2(out.direction,label+'.direction',['lent','borrowed']);if(out.interestType!==undefined)backupEnumV2(out.interestType,label+'.interestType',['none','fixed','annual']);if(out.frequency!==undefined)backupEnumV2(out.frequency,label+'.frequency',['once','monthly','weekly']);if(!Array.isArray(out.repayments)||out.repayments.length>10000)rejectBackupV2(label+'.repayments 无效');out.repayments=out.repayments.map((r,i)=>backupRepaymentV2(r,label+'.repayments['+i+']'));}
    if(collection==='accounts')backupStringV2(out.name,label+'.name',120,false);
    if(collection==='categories'){out.type=backupEnumV2(out.type,label+'.type',['out','in']);backupStringV2(out.name,label+'.name',120,false);}
    if(collection==='budgets'){if(typeof out.month!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(out.month))rejectBackupV2(label+'.month 月份无效');backupStringV2(out.category,label+'.category',120,false);backupNumberV2(out.amount,label+'.amount',0.01,1e12);}
    if(collection==='recurringRules'){backupStringV2(out.name,label+'.name',120,false);out.type=backupEnumV2(out.type,label+'.type',['out','in']);out.cadence=backupEnumV2(out.cadence,label+'.cadence',['monthly','weekly']);backupDateV2(out.nextDate,label+'.nextDate',false);backupNumberV2(out.amount,label+'.amount',0.01,1e12);}
    if(collection==='personalPlans'){backupStringV2(out.title,label+'.title',160,false);out.category=backupEnumV2(out.category,label+'.category',['work','fitness','study','rest','life','other']);out.priority=backupEnumV2(out.priority||'P2',label+'.priority',['P0','P1','P2','P3']);backupDateV2(out.date,label+'.date',false);if(typeof out.startTime!=='string'||!BACKUP_TIME_RE_V2.test(out.startTime)||typeof out.endTime!=='string'||!BACKUP_TIME_RE_V2.test(out.endTime))rejectBackupV2(label+' 时间无效');out.remindBefore=backupNumberV2(out.remindBefore,label+'.remindBefore',-1,1440,true);out.repeat=backupEnumV2(out.repeat,label+'.repeat',['none','daily','weekdays','weekly','custom']);if(!Array.isArray(out.repeatDays)||out.repeatDays.length>7||out.repeatDays.some(x=>!Number.isInteger(x)||x<0||x>6))rejectBackupV2(label+'.repeatDays 无效');out.repeatDays=[...new Set(out.repeatDays)];out.stateByDate=backupPlanStateV2(out.stateByDate,label+'.stateByDate');}
    if(collection==='repaymentPlans'){out.year=backupNumberV2(out.year,label+'.year',2000,2200,true);out.targetAmount=backupNumberV2(out.targetAmount,label+'.targetAmount',0.01,1e12);out.startMonth=backupNumberV2(out.startMonth,label+'.startMonth',1,12,true);out.installments=backupNumberV2(out.installments,label+'.installments',1,12,true);out.strategy=backupEnumV2(out.strategy,label+'.strategy',['equal','snowball','custom']);out.reminderDay=backupNumberV2(out.reminderDay,label+'.reminderDay',1,28,true);if(!Array.isArray(out.debtIds)||!out.debtIds.length||out.debtIds.length>500||out.debtIds.some(x=>typeof x!=='string'||!BACKUP_ID_RE_V2.test(x)))rejectBackupV2(label+'.debtIds 无效');out.debtIds=[...new Set(out.debtIds)];const custom=backupPlainObjectV2(out.customMonths||{},label+'.customMonths'),customKeys=Object.keys(custom);if(customKeys.length>12)rejectBackupV2(label+'.customMonths 条目过多');out.customMonths={};for(const month of customKeys){if(!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(month))rejectBackupV2(label+'.customMonths 月份无效');out.customMonths[month]=backupNumberV2(custom[month],label+'.customMonths.'+month,0,1e12);} }
    if(collection==='goals'){backupStringV2(out.title,label+'.title',160,false);out.kind=backupEnumV2(out.kind,label+'.kind',['progress','money']);out.scope=backupEnumV2(out.scope,label+'.scope',['today','tomorrow','year','custom']);out.targetValue=backupNumberV2(out.targetValue,label+'.targetValue',0.01,1e12);out.currentValue=backupNumberV2(out.currentValue,label+'.currentValue',0,1e12);backupStringV2(out.unit,label+'.unit',16,false);backupDateV2(out.dueDate,label+'.dueDate',false);out.priority=backupEnumV2(out.priority||'P2',label+'.priority',['P0','P1','P2','P3']);}
    if(collection==='inspirations'){backupStringV2(out.content,label+'.content',3000,false);if(!Array.isArray(out.tags)||out.tags.length>8||out.tags.some(x=>typeof x!=='string'||!x.trim()||x.length>30))rejectBackupV2(label+'.tags 无效');out.tags=[...new Set(out.tags)];}
    if(collection==='diaries'){backupDateV2(out.date,label+'.date',false);backupStringV2(out.content,label+'.content',10000,false);out.mood=backupEnumV2(out.mood,label+'.mood',Object.keys(GROWTH_MOODS_V5));out.weather=backupEnumV2(out.weather,label+'.weather',Object.keys(GROWTH_WEATHER_V5));out.category=backupEnumV2(out.category||'daily',label+'.category',Object.keys(DIARY_CATEGORIES_V6));if(out.images!==undefined){if(!Array.isArray(out.images)||out.images.length>4)rejectBackupV2(label+'.images 图片数量无效');out.images=out.images.map((image,i)=>backupPhotoV2(image,label+'.images['+i+']'));}}
    if(collection==='focusSessions'){backupStringV2(out.task,label+'.task',120,false);backupDateV2(out.date,label+'.date',false);out.durationMinutes=backupNumberV2(out.durationMinutes,label+'.durationMinutes',1,180);}
    return out;
  }
  function backupRepaymentV2(raw,label){
    const out=backupPickV2(raw,label,['id','amount','date','remaining','accountId','method','remark','trackAccount','feePart','interestPart','principalPart','flowTxId','repaymentPlanId','planMonth','createdAt','updatedAt']);
    out.id=backupIdV2(out.id,label+'.id',false);out.amount=backupNumberV2(out.amount,label+'.amount',0.01,1e12);out.date=backupDateV2(out.date,label+'.date',false);
    for(const key of ['accountId','flowTxId','repaymentPlanId'])if(out[key]!==undefined)out[key]=backupIdV2(out[key],label+'.'+key,true);for(const key of ['remaining','feePart','interestPart','principalPart'])if(out[key]!==undefined)out[key]=backupNumberV2(out[key],label+'.'+key,0,1e12);if(out.planMonth!==undefined&&(typeof out.planMonth!=='string'||!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(out.planMonth)))rejectBackupV2(label+'.planMonth 月份无效');
    if(out.method!==undefined)out.method=backupEnumV2(out.method,label+'.method',['bank','wechat','alipay','cash','other']);if(out.remark!==undefined)out.remark=backupStringV2(out.remark,label+'.remark',2000);if(out.trackAccount!==undefined)out.trackAccount=backupBooleanV2(out.trackAccount,label+'.trackAccount');for(const key of ['createdAt','updatedAt'])if(out[key]!==undefined)out[key]=backupNumberV2(out[key],label+'.'+key,0,Number.MAX_SAFE_INTEGER,true);return out;
  }
  function backupPlanStateV2(raw,label){
    const input=backupPlainObjectV2(raw||{},label),keys=Object.keys(input);if(keys.length>5000)rejectBackupV2(label+' 条目过多');const out={};
    for(const date of keys){backupDateV2(date,label+' 日期',false);const state=backupPickV2(input[date],label+'.'+date,['completed','completedAt','notifiedAt','snoozeUntil']);for(const key of ['completedAt','notifiedAt','snoozeUntil'])if(state[key]!==undefined)state[key]=backupNumberV2(state[key],label+'.'+date+'.'+key,0,Number.MAX_SAFE_INTEGER,true);if(state.completed!==undefined)state.completed=backupBooleanV2(state.completed,label+'.'+date+'.completed');out[date]=state;}return out;
  }
  function normalizeImportedBackupV2(data){
    const root=backupPickV2(data,'备份',['app','schemaVersion','exportedAt','currentLedger','theme','reminder','llmCfg','transactions','escrows','usages','debts','ledgers','accounts','categories','budgets','recurringRules','personalPlans','repaymentPlans','plannerPrefs','goals','inspirations','diaries','focusSessions','focusPrefs']);
    const collections={};for(const name of Object.keys(BACKUP_KEYS_V2)){const rows=root[name]===undefined?[]:root[name],limit=name==='transactions'?100000:20000;if(!Array.isArray(rows)||rows.length>limit)rejectBackupV2(name+' 集合无效');collections[name]=rows.map((row,index)=>backupRecordV2(row,name,index));const seen=new Set();for(const row of collections[name]){if(seen.has(row.id))rejectBackupV2(name+' 含有重复 id');seen.add(row.id);}}
    const liveLedgerIds=new Set(collections.ledgers.filter(x=>!x.deleted).map(x=>x.id));if(!liveLedgerIds.size)rejectBackupV2('至少需要一个有效账本');
    const currentLedger=backupIdV2(root.currentLedger||'', 'currentLedger',false);if(!liveLedgerIds.has(currentLedger))rejectBackupV2('当前账本引用不存在');
    const accountIds=new Set(collections.accounts.filter(x=>!x.deleted).map(x=>x.id)),debtIds=new Set(collections.debts.filter(x=>!x.deleted).map(x=>x.id)),txIds=new Set(collections.transactions.filter(x=>!x.deleted).map(x=>x.id)),escrowIds=new Set(collections.escrows.filter(x=>!x.deleted).map(x=>x.id)),recurringIds=new Set(collections.recurringRules.filter(x=>!x.deleted).map(x=>x.id));
    const requireLedger=(row,name)=>{if(!row.deleted&&(!row.ledger||!liveLedgerIds.has(row.ledger)))rejectBackupV2(name+' 引用了不存在的账本');};
    for(const name of ['transactions','escrows','usages','debts','accounts','categories','budgets','recurringRules','repaymentPlans'])collections[name].forEach((row,i)=>requireLedger(row,name+'['+i+']'));collections.personalPlans.forEach((row,i)=>{if(row.ledger&&!liveLedgerIds.has(row.ledger))rejectBackupV2('personalPlans['+i+'] 引用了不存在的账本');});
    collections.transactions.filter(x=>!x.deleted).forEach((t,i)=>{for(const key of ['accountId','fromAccountId','toAccountId'])if(t[key]&&!accountIds.has(t[key]))rejectBackupV2('transactions['+i+'].'+key+' 引用不存在');if(t.linkedDebtId&&!debtIds.has(t.linkedDebtId))rejectBackupV2('transactions['+i+'].linkedDebtId 引用不存在');if(t.recurringId&&!recurringIds.has(t.recurringId))rejectBackupV2('transactions['+i+'].recurringId 引用不存在');});
    collections.usages.filter(x=>!x.deleted).forEach((u,i)=>{if(!u.escrowId||!escrowIds.has(u.escrowId))rejectBackupV2('usages['+i+'].escrowId 引用不存在');});
    collections.debts.filter(x=>!x.deleted).forEach((d,i)=>{if(d.accountId&&!accountIds.has(d.accountId))rejectBackupV2('debts['+i+'].accountId 引用不存在');if(d.initialFlowTxId&&!txIds.has(d.initialFlowTxId))rejectBackupV2('debts['+i+'].initialFlowTxId 引用不存在');const seen=new Set();d.repayments.forEach((r,j)=>{if(seen.has(r.id))rejectBackupV2('debts['+i+'] 还款 id 重复');seen.add(r.id);if(r.accountId&&!accountIds.has(r.accountId))rejectBackupV2('debts['+i+'].repayments['+j+'].accountId 引用不存在');if(r.flowTxId&&!txIds.has(r.flowTxId))rejectBackupV2('debts['+i+'].repayments['+j+'].flowTxId 引用不存在');});});
    collections.recurringRules.filter(x=>!x.deleted).forEach((r,i)=>{if(r.accountId&&!accountIds.has(r.accountId))rejectBackupV2('recurringRules['+i+'].accountId 引用不存在');});
    collections.repaymentPlans.filter(x=>!x.deleted).forEach((p,i)=>{if(p.accountId&&!accountIds.has(p.accountId))rejectBackupV2('repaymentPlans['+i+'].accountId 引用不存在');p.debtIds.forEach(id=>{if(!debtIds.has(id))rejectBackupV2('repaymentPlans['+i+'].debtIds 引用不存在');});});
    const theme=root.theme===undefined?{mode:'auto',color:'#ff7197',preset:'strawberry'}:backupPickV2(root.theme,'theme',['mode','color','preset']);theme.mode=backupEnumV2(theme.mode||'auto','theme.mode',['light','dark','auto']);if(typeof theme.color!=='string'||!BACKUP_COLOR_RE_V2.test(theme.color))rejectBackupV2('theme.color 颜色无效');theme.preset=backupEnumV2(theme.preset||'strawberry','theme.preset',CUTE_THEMES.map(x=>x.id));
    const reminder=root.reminder===undefined?{enabled:false,time:'21:00'}:backupPickV2(root.reminder,'reminder',['enabled','time']);reminder.enabled=backupBooleanV2(reminder.enabled===undefined?false:reminder.enabled,'reminder.enabled');if(typeof reminder.time!=='string'||!BACKUP_TIME_RE_V2.test(reminder.time))rejectBackupV2('reminder.time 无效');
    const plannerPrefs=root.plannerPrefs===undefined?{viewDate:today(),notifyEnabled:false,sound:true,pushEnabled:false,pushPending:false}:backupPickV2(root.plannerPrefs,'plannerPrefs',['viewDate','notifyEnabled','sound','pushEnabled','pushPending']);plannerPrefs.viewDate=backupDateV2(plannerPrefs.viewDate||today(),'plannerPrefs.viewDate',false);for(const key of ['notifyEnabled','sound','pushEnabled','pushPending'])plannerPrefs[key]=backupBooleanV2(plannerPrefs[key]===undefined?(key==='sound'):plannerPrefs[key],'plannerPrefs.'+key);
    const focusPrefs=root.focusPrefs===undefined?{duration:25,breakDuration:5,task:'',active:null}:backupPickV2(root.focusPrefs,'focusPrefs',['duration','breakDuration','task','active']);focusPrefs.duration=backupNumberV2(Number(focusPrefs.duration||25),'focusPrefs.duration',1,180,true);focusPrefs.breakDuration=backupNumberV2(Number(focusPrefs.breakDuration||5),'focusPrefs.breakDuration',1,60,true);focusPrefs.task=backupStringV2(String(focusPrefs.task||''),'focusPrefs.task',120);if(focusPrefs.active!==null&&focusPrefs.active!==undefined){const a=backupPickV2(focusPrefs.active,'focusPrefs.active',['id','task','duration','startedAt','endsAt','remaining','paused']);a.id=backupIdV2(a.id,'focusPrefs.active.id',false);a.task=backupStringV2(a.task,'focusPrefs.active.task',120,false);a.duration=backupNumberV2(a.duration,'focusPrefs.active.duration',1,180,true);for(const key of ['startedAt','endsAt','remaining'])a[key]=backupNumberV2(a[key],'focusPrefs.active.'+key,0,Number.MAX_SAFE_INTEGER,key==='remaining');a.paused=backupBooleanV2(a.paused,'focusPrefs.active.paused');focusPrefs.active=a;}else focusPrefs.active=null;
    return Object.assign({schemaVersion:7,currentLedger,theme,reminder,plannerPrefs,focusPrefs},collections);
  }
  window.restoreFullBackup=function(event){
    const file=event.target.files[0];event.target.value='';if(!file)return;if(file.size>25*1024*1024){toast('备份文件超过 25MB，无法安全导入');return;}const reader=new FileReader();reader.onload=()=>{try{
      const d=normalizeImportedBackupV2(JSON.parse(reader.result));
      cuteConfirmV2({title:'恢复这份完整备份？',text:'当前账号在本机的数据会被备份文件替换。建议先导出一份现有备份。',okText:'确认恢复',icon:'♻️'},()=>{const before=accountSnapshotV2(false);d.llmCfg=before.llmCfg;applySnapshotMemoryV2(d);ensureLedgers();ensureFeatureData();applyTheme();if(!save()){applySnapshotMemoryV2(before);coreSave(false);saveFeatureData(false);return;}hideMask('maskDataV2');showTab('tx');toast('备份恢复成功');});
    }catch(e){toast('恢复失败：'+(e.message||e),4500);}};reader.readAsText(file,'utf-8');
  };
  function csvCell(v){const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  window.exportCsvV2=function(){
    const rows=[['日期','类型','商家/名称','分类','账户','转入账户','金额','备注','AI置信度']];inLedger(transactions).sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>rows.push([t.date,typeLabel(t.type),t.merchant||'',t.category||'',t.type==='transfer'?(findAccountById(t.fromAccountId)||{}).name||'':t.account||'',t.type==='transfer'?(findAccountById(t.toAccountId)||{}).name||'':t.amount,t.remark||'',Number.isFinite(Number(t.aiConfidence))?Math.round(Number(t.aiConfidence)*100)+'%':'']));
    downloadBlob('\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8','小确幸记账_'+curLedger().name+'_'+today()+'.csv');toast('CSV 已导出');
  };
  window.openCsvFile=function(){document.getElementById('csv_file_v2').click();};
  function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell='';}else if(ch==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=ch;}if(cell||row.length){row.push(cell);rows.push(row);}return rows;}
  window.importCsvV2=function(event){
    const file=event.target.files[0];event.target.value='';if(!file)return;const reader=new FileReader();reader.onload=()=>{try{
      const rows=parseCsv(String(reader.result).replace(/^\ufeff/,''));if(rows.length<2)throw new Error('CSV 没有数据');const heads=rows[0].map(x=>x.trim().toLowerCase());
      const idx=(...names)=>heads.findIndex(h=>names.includes(h));const di=idx('日期','date'),ti=idx('类型','type'),ni=idx('商家/名称','名称','商家','merchant','name'),ci=idx('分类','category'),ai=idx('账户','account'),mi=idx('金额','amount','金额(元)'),ri=idx('备注','remark','note');if(di<0||mi<0)throw new Error('至少需要“日期”和“金额”列');
      const imported=[];rows.slice(1).forEach(r=>{const amount=Math.abs(parseFloat(r[mi]));if(!(amount>0))return;let type=(r[ti]||'支出').trim();type=/收入|in/i.test(type)?'in':'out';let date=(r[di]||today()).trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(date))date=today();const accountName=(r[ai]||'').trim();const a=liveAccounts().find(x=>x.name===accountName)||liveAccounts()[0];imported.push({id:uid(),ledger:currentLedger,owner:deviceId,type,amount,merchant:ni>=0?(r[ni]||'').trim():'',category:(r[ci]||'其他').trim()||'其他',account:a?a.name:accountName,accountId:a&&a.id,date,remark:(r[ri]||'').trim(),importedAt:Date.now(),createdAt:Date.now(),updatedAt:Date.now()});});
      if(!imported.length)throw new Error('没有识别到有效账单');cuteConfirmV2({title:'导入这些账单？',text:`识别到 ${imported.length} 笔有效账单，将加入「${curLedger().name}」。`,okText:'确认导入',icon:'📥'},()=>{transactions.push(...imported);if(!save()){transactions=transactions.filter(x=>!imported.includes(x));return;}hideMask('maskDataV2');showTab('tx');toast('已导入 '+imported.length+' 笔账单');});
    }catch(e){toast('导入失败：'+(e.message||e),4500);}};reader.readAsText(file,'utf-8');
  };

  function authProfileKeyV2(id){return AUTH_PROFILE_PREFIX+(id&&id!=='guest'?String(id).replace(/[^A-Za-z0-9_-]/g,''):'guest');}
  function cloneDataV2(value){return JSON.parse(JSON.stringify(value));}
  function compactDeletedDataV2(){
    const now=Date.now(),allowed=new Set(['id','ledger','owner','userId','ownerUserId','private','escrowId','deleted','deletedAt','updatedAt']),compact=x=>{if(!x||!x.deleted)return x;if(!Object.keys(x).some(k=>!allowed.has(k)))return x;return {id:x.id,ledger:x.ledger,owner:x.owner,userId:x.userId,ownerUserId:x.ownerUserId,private:x.private===true,escrowId:x.escrowId,deleted:true,deletedAt:x.deletedAt||now,updatedAt:Math.max(Number(x.updatedAt)||0,now)};};
    transactions=transactions.map(compact);escrows=escrows.map(compact);usages=usages.map(compact);debts=debts.map(compact);ledgers=ledgers.map(compact);financeAccounts=financeAccounts.map(compact);customCategories=customCategories.map(compact);budgets=budgets.map(compact);recurringRules=recurringRules.map(compact);personalPlans=personalPlans.map(compact);repaymentPlans=repaymentPlans.map(compact);growthGoals=growthGoals.map(compact);growthInspirations=growthInspirations.map(compact);growthDiaries=growthDiaries.map(compact);growthFocusSessions=growthFocusSessions.map(compact);
  }
  function accountSnapshotV2(withoutPhotos=false){
    const data={schemaVersion:7,savedAt:Date.now(),currentLedger,theme,reminder,llmCfg:{enabled:true,provider:'platform'},
      transactions,escrows,usages,debts,ledgers,accounts:financeAccounts,categories:customCategories,budgets,recurringRules,personalPlans,repaymentPlans,plannerPrefs,goals:growthGoals,inspirations:growthInspirations,diaries:growthDiaries,focusSessions:growthFocusSessions,focusPrefs:growthFocusPrefs};
    const copy=cloneDataV2(data);
    if(withoutPhotos)copy.transactions.forEach(t=>{if(t&&t.photo){delete t.photo;t.photoOmittedFromLocalProfile=true;}});
    return copy;
  }
  function activeProfileIdV2(){return authMode==='account'&&authUser&&authUser.id?authUser.id:'guest';}
  function persistProfileDataForIdV2(profileId){
    if(authProfileWriteSuspended)return;
    const id=profileId&&profileId!=='guest'?profileId:'guest',key=authProfileKeyV2(id);
    try{localStorage.setItem(key,JSON.stringify(accountSnapshotV2(false)));}
    catch(_){try{localStorage.setItem(key,JSON.stringify(accountSnapshotV2(true)));}catch(__){}}
    localStorage.setItem(AUTH_KEYS.active,id);
  }
  function persistActiveProfileV2(){persistProfileDataForIdV2(activeProfileIdV2());}
  function resetProfileDataV2(){
    transactions=[];escrows=[];usages=[];debts=[];ledgers=[];financeAccounts=[];customCategories=[];budgets=[];recurringRules=[];personalPlans=[];repaymentPlans=[];growthGoals=[];growthInspirations=[];growthDiaries=[];growthFocusSessions=[];
    currentLedger='';theme={mode:'light',color:'#ff7197',preset:'strawberry'};reminder={enabled:false,time:'21:00'};
    plannerPrefs={viewDate:today(),notifyEnabled:false,sound:true,pushEnabled:false};growthFocusPrefs={duration:25,breakDuration:5,task:'',active:null};llmCfg=Object.assign({},LLM_DEFAULTS,{enabled:true,provider:'platform'});
  }
  function applySnapshotMemoryV2(d){
    resetProfileDataV2();if(!d||typeof d!=='object')return;
    transactions=Array.isArray(d.transactions)?d.transactions:[];escrows=Array.isArray(d.escrows)?d.escrows:[];usages=Array.isArray(d.usages)?d.usages:[];debts=Array.isArray(d.debts)?d.debts:[];ledgers=Array.isArray(d.ledgers)?d.ledgers:[];
    financeAccounts=Array.isArray(d.accounts)?d.accounts:[];customCategories=Array.isArray(d.categories)?d.categories:[];budgets=Array.isArray(d.budgets)?d.budgets:[];recurringRules=Array.isArray(d.recurringRules)?d.recurringRules:[];personalPlans=Array.isArray(d.personalPlans)?d.personalPlans:[];repaymentPlans=Array.isArray(d.repaymentPlans)?d.repaymentPlans:[];growthGoals=Array.isArray(d.goals)?d.goals:[];growthInspirations=Array.isArray(d.inspirations)?d.inspirations:[];growthDiaries=Array.isArray(d.diaries)?d.diaries:[];growthFocusSessions=Array.isArray(d.focusSessions)?d.focusSessions:[];
    currentLedger=d.currentLedger||'';theme=Object.assign(theme,d.theme||{});reminder=Object.assign(reminder,d.reminder||{});plannerPrefs=Object.assign(plannerPrefs,d.plannerPrefs||{});growthFocusPrefs=Object.assign(growthFocusPrefs,d.focusPrefs||{});llmCfg=Object.assign({},LLM_DEFAULTS,{enabled:true,provider:'platform'});
    compactDeletedDataV2();
  }
  function loadProfileDataV2(id){
    authProfileWriteSuspended=true;
    try{
      const d=readStoredJson(authProfileKeyV2(id),null);applySnapshotMemoryV2(d);
      localStorage.setItem('theme',JSON.stringify(theme));localStorage.setItem('reminder',JSON.stringify(reminder));localStorage.setItem('llmCfg',JSON.stringify(llmCfg));
      ensureLedgers();ensureFeatureData();applyTheme();coreSave(false);saveFeatureData(false);localStorage.setItem(AUTH_KEYS.active,id||'guest');
    }finally{authProfileWriteSuspended=false;}
  }
  function hasMeaningfulLocalDataV2(){
    return active(transactions).length+active(debts).length+active(escrows).length+active(usages).length+active(budgets).length+active(recurringRules).length+active(personalPlans).length+active(repaymentPlans).length+active(growthGoals).length+active(growthInspirations).length+active(growthDiaries).length+active(growthFocusSessions).length+active(customCategories).length>0;
  }
  function authBaseV2(){return (syncUrl||defaultSyncUrl||location.origin).replace(/\/$/,'');}
  async function authFetchV2(path,body){
    let response;
    try{response=await fetch(authBaseV2()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth(body||{}))});}
    catch(_){const e=new Error('连接不到账号服务器，请确认记账服务已经启动');e.status=0;throw e;}
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const e=new Error(data.error||data.detail||('账号服务器返回 HTTP '+response.status));e.status=response.status;throw e;}
    return data;
  }
  function setAuthErrorV2(message){const el=document.getElementById('auth_error_v2');if(el)el.textContent=message||'';}
  function setAccountInlineStatusV2(message,kind=''){const el=document.getElementById('account_inline_status_v2');if(!el)return;el.textContent=message||'';el.className='account-inline-status-v2 '+kind;}
  function authDisplayNameV2(){return authUser&&(authUser.displayName||authUser.name)||'我的账号';}
  function updateAuthUiV2(){
    const chip=document.getElementById('account_chip_v2');if(!chip)return;
    const logged=authMode==='account'&&authUser&&authUser.id;
    chip.classList.toggle('guest',!logged);chip.querySelector('i').textContent=logged?(authUser.avatar||'🍓'):'👤';chip.querySelector('span').textContent=logged?authDisplayNameV2():'未登录';
    const loggedBox=document.getElementById('account_logged_content_v2'),guestBox=document.getElementById('account_guest_content_v2');if(loggedBox)loggedBox.style.display=logged?'block':'none';if(guestBox)guestBox.style.display=logged?'none':'block';
    renderMembershipUiV3();if(!logged){const identity=document.getElementById('account_identity_v2'),state=document.getElementById('account_state_v2');if(identity)identity.textContent='基础功能可直接使用';if(state)state.textContent='游客免费版';return;}
    selectedAuthAvatar=authUser.avatar||'🍓';document.getElementById('account_avatar_preview_v2').textContent=selectedAuthAvatar;document.getElementById('account_identity_v2').textContent=authUser.email||'';document.getElementById('account_state_v2').textContent='邮箱账号';
    document.getElementById('account_display_name_v2').value=authDisplayNameV2();document.getElementById('account_email_v2').value=authUser.email||'';document.getElementById('account_bio_v2').value=authUser.bio||'';document.getElementById('account_timezone_v2').value=authUser.timezone||'Asia/Shanghai';
    const picks=['🍓','🍑','🐰','🦄','🐳','🐻','🌷','🌙','🍀','🧁'];document.getElementById('account_avatar_picks_v2').innerHTML=picks.map(x=>`<button type="button" class="${x===selectedAuthAvatar?'on':''}" onclick="pickAuthAvatarV2('${x}')">${x}</button>`).join('');
    const growthCount=active(growthGoals).length+active(growthInspirations).length+active(growthDiaries).length+active(growthFocusSessions).length;
    const stats=[['📒','账本',liveLedgers().length],['🧾','账单',active(transactions).length],['🤝','借还',active(debts).length],['🌱','成长',growthCount+active(personalPlans).length]];
    document.getElementById('account_stats_v2').innerHTML=stats.map(x=>`<div><span>${x[0]}</span><b>${x[2]}</b><small>${x[1]}</small></div>`).join('');
    const last=Number(localStorage.getItem(AUTH_KEYS.lastSync+':'+authUser.id)||0);document.getElementById('account_last_sync_v2').textContent=last?'上次同步 '+new Date(last).toLocaleString('zh-CN',{hour12:false}):'尚未同步';
    document.getElementById('account_device_v2').innerHTML=`<b>当前设备</b><span>${esc(deviceId.slice(0,10))}… · 会话受保护</span>`;
  }
  window.switchAuthModeV2=function(mode){
    const next=mode==='register'?'register':'login';setAuthErrorV2('');document.querySelectorAll('.auth-tabs-v2 button').forEach(x=>x.classList.toggle('on',x.dataset.mode===next));
    document.getElementById('auth_login_pane_v2').classList.toggle('on',next==='login');document.getElementById('auth_register_pane_v2').classList.toggle('on',next==='register');
  };
  window.openAuthGateV2=function(mode='login',loading=false){
    const gate=document.getElementById('auth_gate_v2');gate.style.display='flex';document.getElementById('auth_loading_v2').style.display=loading?'flex':'none';document.getElementById('auth_forms_v2').style.display=loading?'none':'block';
    if(!loading){switchAuthModeV2(mode);const merge=hasMeaningfulLocalDataV2()&&authMode!=='account';document.getElementById('auth_login_merge_row_v2').style.display=merge?'flex':'none';document.getElementById('auth_login_merge_v2').checked=false;setTimeout(()=>document.getElementById(mode==='register'?'auth_register_name_v2':'auth_login_email_v2').focus(),80);}
  };
  function hideAuthGateV2(){document.getElementById('auth_gate_v2').style.display='none';document.getElementById('auth_loading_v2').style.display='none';document.getElementById('auth_forms_v2').style.display='block';}
  window.continueGuestV2=function(){
    if(authBusy)return;authMode='guest';authUser=null;authSessionToken='';membershipStateV3={loaded:true,user:null,subscription:null,entitlements:{},usage:{},plans:membershipStateV3.plans||[],themes:membershipStateV3.themes||[],featureFlags:membershipStateV3.featureFlags||{},aiStatus:membershipStateV3.aiStatus,fetchedAt:Date.now()};authSessionVersion++;localStorage.removeItem(AUTH_KEYS.session);localStorage.removeItem(AUTH_KEYS.user);localStorage.setItem(AUTH_KEYS.mode,'guest');persistActiveProfileV2();hideAuthGateV2();updateAuthUiV2();renderThemeUI();renderCurrent();toast('基础记账已直接开放；需要 AI 时再注册开通即可');
  };
  async function acceptAuthV2(data,mergeLocal){
    if(!data||!data.user||!data.user.id||!data.sessionToken)throw new Error('账号服务器返回的数据不完整');
    const wasAccount=authMode==='account'&&authUser&&authUser.id,oldId=wasAccount?authUser.id:'guest';persistActiveProfileV2();authSessionVersion++;
    authSessionToken=data.sessionToken;authUser=data.user;authMode='account';localStorage.setItem(AUTH_KEYS.session,authSessionToken);localStorage.setItem(AUTH_KEYS.user,JSON.stringify(authUser));localStorage.setItem(AUTH_KEYS.mode,'account');
    if(!mergeLocal||wasAccount&&oldId!==authUser.id)loadProfileDataV2(authUser.id);else{localStorage.removeItem(authProfileKeyV2('guest'));localStorage.setItem(AUTH_KEYS.active,authUser.id);save(false);}
    hideAuthGateV2();updateAuthUiV2();renderCurrent();await refreshMembershipV3(true);
    try{await exchangeSyncState();renderCurrent();toast('登录成功，数据已同步 ✓');}
    catch(e){toast('登录成功；云端暂未同步：'+(e.message||e),5500);}
    persistActiveProfileV2();
  }
  window.submitAuthV2=async function(mode){
    if(authBusy)return;setAuthErrorV2('');const register=mode==='register';
    const email=document.getElementById(register?'auth_register_email_v2':'auth_login_email_v2').value.trim().toLowerCase();const password=document.getElementById(register?'auth_register_password_v2':'auth_login_password_v2').value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setAuthErrorV2('请填写正确的邮箱地址');return;}
    const body={email,password};let mergeLocal=false;
    if(register){const displayName=document.getElementById('auth_register_name_v2').value.trim(),confirmPassword=document.getElementById('auth_register_confirm_v2').value;if(!displayName){setAuthErrorV2('请填写昵称');return;}if(password!==confirmPassword){setAuthErrorV2('两次输入的密码不一致');return;}if(password.length<8||!/[A-Za-z]/.test(password)||!/\d/.test(password)){setAuthErrorV2('密码至少 8 位，并同时包含字母和数字');return;}body.displayName=displayName;body.avatar='🍓';mergeLocal=document.getElementById('auth_register_merge_v2').checked;}
    else mergeLocal=document.getElementById('auth_login_merge_v2').checked&&authMode!=='account';
    body.claimLocalData=mergeLocal;
    authBusy=true;const button=document.getElementById(register?'auth_register_submit_v2':'auth_login_submit_v2'),label=button.textContent;button.disabled=true;button.textContent=register?'正在创建账号…':'正在登录…';
    try{const data=await authFetchV2(register?'/api/auth/register':'/api/auth/login',body);await acceptAuthV2(data,mergeLocal);}
    catch(e){setAuthErrorV2(e.message||String(e));}
    finally{authBusy=false;button.disabled=false;button.textContent=label;}
  };
  window.openAccountCenterV2=function(){
    updateAuthUiV2();setAccountInlineStatusV2('');document.getElementById('account_current_password_v2').value='';document.getElementById('account_new_password_v2').value='';document.getElementById('account_confirm_password_v2').value='';showMask('maskAccountCenterV2');refreshMembershipV3(true);
  };
  window.pickAuthAvatarV2=function(avatar){selectedAuthAvatar=avatar;document.getElementById('account_avatar_preview_v2').textContent=avatar;document.querySelectorAll('#account_avatar_picks_v2 button').forEach(x=>x.classList.toggle('on',x.textContent===avatar));};
  window.saveAccountProfileV2=async function(){
    if(authBusy||authMode!=='account')return;const displayName=document.getElementById('account_display_name_v2').value.trim(),bio=document.getElementById('account_bio_v2').value.trim(),timezone=document.getElementById('account_timezone_v2').value;if(!displayName){setAccountInlineStatusV2('昵称不能为空','err');return;}authBusy=true;setAccountInlineStatusV2('正在保存…');
    try{const data=await authFetchV2('/api/auth/profile',{displayName,avatar:selectedAuthAvatar,bio,timezone});authUser=data.user||Object.assign({},authUser,{displayName,avatar:selectedAuthAvatar,bio,timezone});localStorage.setItem(AUTH_KEYS.user,JSON.stringify(authUser));persistActiveProfileV2();updateAuthUiV2();setAccountInlineStatusV2('个人资料已保存','ok');}
    catch(e){setAccountInlineStatusV2(e.message||String(e),'err');}finally{authBusy=false;}
  };
  window.changeAccountPasswordV2=async function(){
    if(authBusy||authMode!=='account')return;const currentPassword=document.getElementById('account_current_password_v2').value,newPassword=document.getElementById('account_new_password_v2').value,confirmPassword=document.getElementById('account_confirm_password_v2').value;
    if(newPassword!==confirmPassword){setAccountInlineStatusV2('两次新密码不一致','err');return;}if(newPassword.length<8||!/[A-Za-z]/.test(newPassword)||!/\d/.test(newPassword)){setAccountInlineStatusV2('新密码至少 8 位，并包含字母和数字','err');return;}
    authBusy=true;setAccountInlineStatusV2('正在修改密码…');try{const data=await authFetchV2('/api/auth/password',{currentPassword,newPassword});if(data.sessionToken){authSessionToken=data.sessionToken;localStorage.setItem(AUTH_KEYS.session,authSessionToken);authSessionVersion++;}document.getElementById('account_current_password_v2').value='';document.getElementById('account_new_password_v2').value='';document.getElementById('account_confirm_password_v2').value='';setAccountInlineStatusV2('密码已修改，其他设备会话已退出','ok');}
    catch(e){setAccountInlineStatusV2(e.message||String(e),'err');}finally{authBusy=false;}
  };
  window.syncAccountNowV2=async function(){
    if(authBusy||authMode!=='account')return;authBusy=true;setAccountInlineStatusV2('正在安全同步…');try{await exchangeSyncState();renderCurrent();updateAuthUiV2();setAccountInlineStatusV2('同步完成','ok');}catch(e){setAccountInlineStatusV2('同步失败：'+(e.message||e),'err');}finally{authBusy=false;}
  };
  window.exportAccountDataV2=async function(){
    if(authBusy||authMode!=='account')return;authBusy=true;setAccountInlineStatusV2('正在整理账号数据…');try{const data=await authFetchV2('/api/auth/export',{});downloadBlob(JSON.stringify(data,null,2),'application/json;charset=utf-8','小确幸记账_账号数据_'+today()+'.json');setAccountInlineStatusV2('账号数据已导出','ok');}catch(e){setAccountInlineStatusV2(e.message||String(e),'err');}finally{authBusy=false;}
  };
  async function clearPushJobsBeforeLogoutV2(){try{await fetch(authBaseV2()+'/api/push/schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth({jobs:[]}))});}catch(_){}}
  async function finishLocalLogoutV2(showGate=true,removeProfile=false){
    const oldId=authUser&&authUser.id;authSessionVersion++;if(removeProfile&&oldId)localStorage.removeItem(authProfileKeyV2(oldId));authSessionToken='';authUser=null;authMode='guest';membershipStateV3={loaded:true,user:null,subscription:null,entitlements:{},usage:{},plans:membershipStateV3.plans||[],themes:membershipStateV3.themes||[],featureFlags:membershipStateV3.featureFlags||{},aiStatus:membershipStateV3.aiStatus,fetchedAt:Date.now()};localStorage.removeItem(AUTH_KEYS.session);localStorage.removeItem(AUTH_KEYS.user);localStorage.setItem(AUTH_KEYS.mode,'guest');loadProfileDataV2('guest');updateAuthUiV2();renderThemeUI();renderCurrent();if(showGate)openAuthGateV2('login');
  }
  window.logoutAccountV2=async function(){
    if(authBusy||authMode!=='account')return;authBusy=true;setAccountInlineStatusV2('正在安全退出…');persistActiveProfileV2();try{await exchangeSyncState();}catch(_){}await clearPushJobsBeforeLogoutV2();try{await authFetchV2('/api/auth/logout',{});}catch(_){}hideMask('maskAccountCenterV2');await finishLocalLogoutV2(false,false);authBusy=false;toast('已退出账号，当前可继续使用游客免费版');
  };
  window.openDeleteAccountV2=function(){document.getElementById('delete_account_password_v2').value='';document.getElementById('delete_account_phrase_v2').value='';document.getElementById('delete_account_error_v2').textContent='';showMask('maskDeleteAccountV2');};
  window.deleteAccountV2=async function(){
    if(authBusy||authMode!=='account')return;const password=document.getElementById('delete_account_password_v2').value,phrase=document.getElementById('delete_account_phrase_v2').value.trim(),error=document.getElementById('delete_account_error_v2');if(phrase!=='删除'){error.textContent='请输入“删除”两个字确认';return;}if(!password){error.textContent='请输入登录密码';return;}
    authBusy=true;error.textContent='正在删除账号与云端数据…';try{await authFetchV2('/api/auth/delete',{password});hideMask('maskDeleteAccountV2');hideMask('maskAccountCenterV2');await finishLocalLogoutV2(false,true);toast('账号与云端数据已删除，已回到游客免费版');}catch(e){error.textContent=e.message||String(e);}finally{authBusy=false;}
  };
  async function initializeAuthV2(){
    updateAuthUiV2();const activeId=localStorage.getItem(AUTH_KEYS.active);
    if(authMode==='account'&&authSessionToken&&authUser&&authUser.id){
      if(activeId&&activeId!==authUser.id)loadProfileDataV2(authUser.id);openAuthGateV2('login',true);
      try{const data=await authFetchV2('/api/auth/me',{});if(data.user){authUser=data.user;localStorage.setItem(AUTH_KEYS.user,JSON.stringify(authUser));}authMode='account';localStorage.setItem(AUTH_KEYS.mode,'account');hideAuthGateV2();updateAuthUiV2();await refreshMembershipV3(true);try{await exchangeSyncState();renderCurrent();}catch(_){}return;}
      catch(e){if(e.status===401||e.status===403){persistActiveProfileV2();await finishLocalLogoutV2(false,false);openAuthGateV2('login');setAuthErrorV2('登录已过期，请重新登录');return;}hideAuthGateV2();updateAuthUiV2();toast('账号服务器暂时离线，已使用本机数据',4500);return;}
    }
    if(authMode==='guest'){authSessionToken='';authUser=null;if(activeId&&activeId!=='guest')loadProfileDataV2('guest');hideAuthGateV2();updateAuthUiV2();refreshMembershipV3(true);return;}
    // 会话键被清理或损坏时，核心 localStorage 仍可能装着上一账号的数据。
    // 先明确写回该账号命名空间，再切换到 guest，避免“仅在本机使用”污染游客档案。
    const staleAccountId=authUser&&authUser.id||activeId&&activeId!=='guest'&&activeId||'';
    if(staleAccountId)persistProfileDataForIdV2(staleAccountId);
    authSessionToken='';authUser=null;authMode='guest';authSessionVersion++;localStorage.removeItem(AUTH_KEYS.session);localStorage.removeItem(AUTH_KEYS.user);localStorage.setItem(AUTH_KEYS.mode,'guest');loadProfileDataV2('guest');hideAuthGateV2();updateAuthUiV2();refreshMembershipV3(true);if(!localStorage.getItem('xqxGuestWelcomeV3')){localStorage.setItem('xqxGuestWelcomeV3','1');setTimeout(()=>toast('欢迎使用：手动记账、借还、计划和导出都可直接使用 ✨',5500),700);}
  }

  exchangeSyncState=async function(){
    if(!syncUrl)throw new Error('请先填写同步服务器地址');const version=authSessionVersion,userId=authUser&&authUser.id||'';
    const res=await fetch(syncUrl.replace(/\/$/,'')+'/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(apiAuth({state:collectState()}))});const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||data.detail||('同步服务器返回 HTTP '+res.status));if(version!==authSessionVersion||userId!==(authUser&&authUser.id||''))throw new Error('账号已切换，已忽略上一账号的同步结果');
    applyRemote(data.state);save(false);if(authMode==='account'&&authUser){const now=Date.now();localStorage.setItem(AUTH_KEYS.lastSync+':'+authUser.id,String(now));updateAuthUiV2();}return data.state||{};
  };

  collectState=function(){const s=coreCollectState();const touch=a=>(a||[]).map(x=>{x.updatedAt=x.updatedAt||Date.now();return x;});return Object.assign(s,{accounts:touch(financeAccounts),categories:touch(customCategories),budgets:touch(budgets),recurringRules:touch(recurringRules),personalPlans:touch(personalPlans),repaymentPlans:touch(repaymentPlans),goals:touch(growthGoals),inspirations:touch(growthInspirations),diaries:touch(growthDiaries),focusSessions:touch(growthFocusSessions)});};
  applyRemote=function(state){
    coreApplyRemote(state);if(!state)return;
    if(state.accounts)financeAccounts=mergeCol(financeAccounts,state.accounts);if(state.categories)customCategories=mergeCol(customCategories,state.categories);if(state.budgets)budgets=mergeCol(budgets,state.budgets);if(state.recurringRules)recurringRules=mergeCol(recurringRules,state.recurringRules);if(state.personalPlans)personalPlans=mergeCol(personalPlans,state.personalPlans);if(state.repaymentPlans)repaymentPlans=mergeCol(repaymentPlans,state.repaymentPlans);if(state.goals)growthGoals=mergeCol(growthGoals,state.goals);if(state.inspirations)growthInspirations=mergeCol(growthInspirations,state.inspirations);if(state.diaries)growthDiaries=mergeCol(growthDiaries,state.diaries);if(state.focusSessions)growthFocusSessions=mergeCol(growthFocusSessions,state.focusSessions);compactDeletedDataV2();saveFeatureData(false);
  };
  function ownsLedgerV2(l){if(!l)return false;if(authMode==='account'&&authUser&&authUser.id){const ownerId=l.ownerUserId||l.userId;if(ownerId)return ownerId===authUser.id;}return l.owner===deviceId;}
  window.isCurrentLedgerOwnerV2=ownsLedgerV2;
  let ledgerDeleteTargetV2='';
  delLedger=function(id){
    const list=liveLedgers(),l=list.find(x=>x.id===id);if(!l)return;if(list.length<=1){toast('至少保留一个账本');return;}if(!ownsLedgerV2(l)){toast('共享成员不能删除账本，请使用“退出共享”');return;}
    const target=list.find(x=>x.id!==id&&ownsLedgerV2(x));if(!target){toast('请先新建一个自己的账本，再删除当前账本');return;}ledgerDeleteTargetV2=target.id;deletingLedgerId=id;document.getElementById('delete_ledger_text').innerHTML=`账本「<b>${esc(l.name)}</b>」将被删除。<br>其中的账单、借还、账户和计划会安全移到「<b>${esc(target.name)}</b>」，不会进入别人的共享账本。`;showMask('maskDeleteLedger');
  };
  performLedgerDelete=function(id){
    const source=liveLedgers().find(x=>x.id===id),target=liveLedgers().find(x=>x.id===ledgerDeleteTargetV2&&x.id!==id&&ownsLedgerV2(x));ledgerDeleteTargetV2='';if(!source||!target)return;const before=accountSnapshotV2(false),now=Date.now();
    [transactions,debts,escrows,usages].forEach(arr=>active(arr).forEach(x=>{if(x.ledger===id){x.ledger=target.id;markUpdated(x);}}));
    const accountRemap=new Map();active(financeAccounts).filter(a=>a.ledger===id).forEach(a=>{const same=active(financeAccounts).find(x=>x.ledger===target.id&&!x.archived&&x.name===a.name);if(same){accountRemap.set(a.id,same.id);const i=financeAccounts.indexOf(a);financeAccounts[i]={id:a.id,ledger:a.ledger,owner:a.owner,userId:a.userId,deleted:true,deletedAt:now,updatedAt:now};}else{a.ledger=target.id;markUpdated(a);}});
    const remapAccount=id=>accountRemap.get(id)||id;active(transactions).forEach(t=>{if(t.accountId&&accountRemap.has(t.accountId)){t.accountId=remapAccount(t.accountId);const a=active(financeAccounts).find(x=>x.id===t.accountId);if(a)t.account=a.name;markUpdated(t);}if(t.fromAccountId&&accountRemap.has(t.fromAccountId)){t.fromAccountId=remapAccount(t.fromAccountId);markUpdated(t);}if(t.toAccountId&&accountRemap.has(t.toAccountId)){t.toAccountId=remapAccount(t.toAccountId);markUpdated(t);}});active(debts).forEach(d=>{if(d.accountId&&accountRemap.has(d.accountId)){d.accountId=remapAccount(d.accountId);markUpdated(d);}(d.repayments||[]).forEach(r=>{if(r.accountId&&accountRemap.has(r.accountId))r.accountId=remapAccount(r.accountId);});});active(recurringRules).forEach(r=>{if(r.accountId&&accountRemap.has(r.accountId)){r.accountId=remapAccount(r.accountId);const a=active(financeAccounts).find(x=>x.id===r.accountId);if(a)r.account=a.name;markUpdated(r);}});active(repaymentPlans).forEach(p=>{if(p.accountId&&accountRemap.has(p.accountId)){p.accountId=remapAccount(p.accountId);markUpdated(p);}});
    active(transactions).filter(t=>t.type==='transfer').forEach(t=>{const a=active(financeAccounts).find(x=>x.id===t.fromAccountId),b=active(financeAccounts).find(x=>x.id===t.toAccountId);t.account=(a?a.name:'未知')+' → '+(b?b.name:'未知');});
    active(customCategories).filter(c=>c.ledger===id).forEach(c=>{const same=active(customCategories).find(x=>x.ledger===target.id&&x.type===c.type&&x.name===c.name);if(same){const i=customCategories.indexOf(c);customCategories[i]={id:c.id,ledger:c.ledger,owner:c.owner,userId:c.userId,deleted:true,deletedAt:now,updatedAt:now};}else{c.ledger=target.id;markUpdated(c);}});
    active(budgets).filter(b=>b.ledger===id).forEach(b=>{const same=active(budgets).find(x=>x.ledger===target.id&&x.month===b.month&&x.category===b.category);if(same){if((b.updatedAt||0)>(same.updatedAt||0)){same.amount=b.amount;markUpdated(same);}const i=budgets.indexOf(b);budgets[i]={id:b.id,ledger:b.ledger,owner:b.owner,userId:b.userId,deleted:true,deletedAt:now,updatedAt:now};}else{b.ledger=target.id;markUpdated(b);}});
    [recurringRules,personalPlans,repaymentPlans].forEach(arr=>active(arr).forEach(x=>{if(x.ledger===id){x.ledger=target.id;markUpdated(x);}}));const li=ledgers.indexOf(source);ledgers[li]={id:source.id,owner:source.owner,userId:source.userId,ownerUserId:source.ownerUserId,deleted:true,deletedAt:now,updatedAt:now};currentLedger=target.id;localStorage.setItem('currentLedger',currentLedger);
    if(!save()){applySnapshotMemoryV2(before);coreSave(false);saveFeatureData(false);toast('删除未完成，原数据已经恢复');return;}renderCurrent();openLedgerMgr();toast('账本已删除，相关数据已移入「'+target.name+'」');
  };
  window.leaveSharedLedgerV2=function(id){
    const l=liveLedgers().find(x=>x.id===id);if(!l||!l.shared||ownsLedgerV2(l))return;cuteConfirmV2({title:'退出这个共享账本？',text:`退出「${l.name}」后，本机不再显示其中的数据；其他成员的数据不会被删除。`,okText:'退出共享',icon:'↩️'},async()=>{try{const data=await authFetchV2('/api/share/leave',{ledgerId:id});if(data.ok===false)throw new Error(data.error||'退出失败');transactions=transactions.filter(x=>x.ledger!==id);debts=debts.filter(x=>x.ledger!==id);escrows=escrows.filter(x=>x.ledger!==id);usages=usages.filter(x=>x.ledger!==id);financeAccounts=financeAccounts.filter(x=>x.ledger!==id);customCategories=customCategories.filter(x=>x.ledger!==id);budgets=budgets.filter(x=>x.ledger!==id);recurringRules=recurringRules.filter(x=>x.ledger!==id);personalPlans=personalPlans.filter(x=>x.ledger!==id);repaymentPlans=repaymentPlans.filter(x=>x.ledger!==id);ledgers=ledgers.filter(x=>x.id!==id);if(currentLedger===id)currentLedger=liveLedgers()[0]&&liveLedgers()[0].id||'';localStorage.setItem('currentLedger',currentLedger);save();renderCurrent();openLedgerMgr();toast('已退出共享账本');}catch(e){toast('退出共享失败：'+(e.message||e),5500);}});
  };

  openDay=function(date){coreOpenDay(date);const panel=document.getElementById('calPanel');if(panel)panel.querySelectorAll('.detail-list .item').forEach((el,i)=>{const t=inLedger(transactions).filter(x=>x.date===date).sort((a,b)=>b.createdAt-a.createdAt)[i];if(!t)return;if(['in','out'].includes(t.type)&&!t.linkedDebtId)el.onclick=()=>openTx(t.id);else if(t.linkedDebtId)el.onclick=()=>openDebtDetail(t.linkedDebtId);else el.onclick=null;});};

  const oldExportExcel=exportExcel;
  exportExcel=function(list,scope){
    if(typeof XLSX==='undefined')return;const rows=[['日期','类型','商家/名称','分类','账户/转出','转入账户','金额(元)','备注','AI置信度']];
    list.forEach(t=>rows.push([t.date,typeLabel(t.type),t.merchant||'',t.category,t.type==='transfer'?(findAccountById(t.fromAccountId)||{}).name||'':t.account||'',t.type==='transfer'?(findAccountById(t.toAccountId)||{}).name||'':fmt(t.amount),t.remark||'',Number.isFinite(Number(t.aiConfidence))?Math.round(Number(t.aiConfidence)*100)+'%':'']));
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:12},{wch:10},{wch:18},{wch:10},{wch:14},{wch:14},{wch:12},{wch:28},{wch:12}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,scope==='ai'?'AI识别结果':'记账记录');XLSX.writeFile(wb,(scope==='ai'?'AI识别结果':'记账记录_'+(scope==='month'?ym(today()):'全部'))+'_'+today()+'.xlsx');hideMask('maskExport');toast('已导出 Excel');
  };
  buildReportHTML=function(list,scope){
    const sumIn=list.filter(t=>t.type==='in').reduce((s,t)=>s+t.amount,0),sumOut=list.filter(t=>t.type==='out').reduce((s,t)=>s+t.amount,0),rows=list.map(t=>`<tr><td>${esc(t.date)}</td><td style="color:${t.type==='in'?'#07c160':'#fa5151'}">${esc(typeLabel(t.type))}</td><td>${esc(t.merchant||'—')}</td><td>${esc(t.category||'—')}</td><td>${esc(t.account||'—')}</td><td style="text-align:right">${typeSymbol(t.type)}${fmt(t.amount)}</td><td>${esc(t.remark||'')}</td></tr>`).join('');
    const div=document.createElement('div');div.style.cssText='position:fixed;left:-9999px;top:0;width:820px;background:#fff;padding:24px;font-family:-apple-system,"PingFang SC",Arial,sans-serif;color:#1f2329;';div.innerHTML=`<h2 style="margin:0 0 4px">${scope==='ai'?'AI 图片识别结果':'记账记录'}</h2><div style="color:#8a9099;font-size:13px;margin-bottom:12px">导出日期：${today()} ｜ 共 ${list.length} 笔 ｜ 收入 ¥${fmt(sumIn)} ｜ 支出 ¥${fmt(sumOut)}</div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:${theme.color};color:#fff"><th>日期</th><th>类型</th><th>商家/名称</th><th>分类</th><th>账户</th><th>金额</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table><style>th,td{padding:7px;border:1px solid #e8e8e8}th{text-align:left}</style>`;return div;
  };

  function registerPwa(){if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});}
  function enhanceActionAccessibilityV2(root=document){
    const elements=[...(root.matches&&root.matches('[onclick]')?[root]:[]),...(root.querySelectorAll?root.querySelectorAll('[onclick]'):[])];elements.forEach(el=>{if(/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(el.tagName)||el.dataset.kbdReadyV2)return;el.dataset.kbdReadyV2='1';el.setAttribute('role','button');if(!el.hasAttribute('tabindex'))el.tabIndex=0;el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();el.click();}});});
  }

  compactDeletedDataV2();ensureFeatureData();injectFeatureSheets();enhanceStaticUi();
  enhanceActionAccessibilityV2();new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)enhanceActionAccessibilityV2(node);}))).observe(document.body,{childList:true,subtree:true});
  if(!theme.preset)theme.preset='strawberry';applyTheme();saveFeatureData(false);registerPwa();
  const plannerLink=new URLSearchParams(location.search),linkedDate=plannerLink.get('planDate');
  if(linkedDate&&/^\d{4}-\d{2}-\d{2}$/.test(linkedDate)){plannerPrefs.viewDate=linkedDate;planMode='schedule';showTab('plan');}else if(plannerLink.get('tab')==='debt'){debtViewModeV1=plannerLink.get('debtView')==='plan'?'plan':'records';showTab('debt');}else if(plannerLink.get('tab')==='plan'&&plannerLink.get('growthView')==='goal'){planMode='goal';growthFilterV5='goal';showTab('plan');}else showTab('tx');
  initializeAuthV2();
  setTimeout(()=>pingLlm(true),1600);
  setTimeout(checkPlannerRemindersV2,1200);setInterval(checkPlannerRemindersV2,30000);setTimeout(checkRepaymentPlanReminderV1,1800);setInterval(checkRepaymentPlanReminderV1,60000);setTimeout(checkGrowthGoalRemindersV1,2100);setInterval(checkGrowthGoalRemindersV1,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkPlannerRemindersV2();checkRepaymentPlanReminderV1();checkGrowthGoalRemindersV1();}});
  if(plannerPrefs.pushEnabled)setTimeout(syncPlannerPushScheduleV2,2200);
})();
