(() => {
  'use strict';
  const host=location.hostname||'127.0.0.1';
  const API_BASE=location.port==='8081'?`http://${host}:3000`:location.origin;
  const state={admin:null,csrf:sessionStorage.getItem('littlejoyAdminCsrf')||'',data:{stats:{},plans:[],themes:[],aiProviders:[],aiRoutes:[],featureFlags:{},auditLogs:[],subscriptions:[],payments:[]}};
  const TITLES={overview:'运营总览',users:'用户与手动开通',plans:'套餐与收费',ai:'AI 服务与密钥',themes:'限定主题目录',flags:'功能开关',audit:'操作审计日志'};
  const ROLE_NAMES={super_admin:'超级管理员',billing_admin:'收费管理员',ai_operator:'AI 运营',support:'客服',auditor:'审计员'};
  const PAID_BILLING_CHANNELS=new Set(['offline','wechat_manual','alipay_manual','bank']);
  const THEME_LOOK={
    'premium-moon-cat':['#51478a','#b99ce8','🐈‍⬛'],'premium-sakura-post':['#dc5c8e','#ffb3c6','💌'],'premium-forest-spirit':['#287555','#95bf69','🧚'],'premium-caramel-pudding':['#a76b29','#efc36b','🍮'],'premium-cloud-sheep':['#5e9bd1','#b8d8ed','🐑'],'premium-galaxy-unicorn':['#5e43ad','#eb79c5','🦄'],'premium-sea-jellyfish':['#247cae','#69d4c7','🪼'],'premium-black-gold-cat':['#211c13','#b28535','🐈'],'premium-gingerbread':['#9d3b3a','#519368','🏠'],'premium-koi-new-year':['#bb3032','#e5ac38','🐟'],'premium-zodiac-golden-dragon':['#9f282a','#d9a73f','🐉'],'premium-zodiac-jade-rabbit':['#477f6e','#b898ca','🐇'],'premium-dunhuang-flying-apsara':['#a95137','#d0a13c','🪷'],'premium-blue-white-porcelain':['#28578d','#78acc8','🏺']
  };
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const bool=value=>String(value)==='true';
  const money=cents=>'¥'+((Number(cents)||0)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const time=value=>value?new Date(Number(value)||value).toLocaleString('zh-CN',{hour12:false}):'—';
  const short=value=>{const text=String(value||'');return text.length>28?text.slice(0,27)+'…':text||'—';};

  function toast(message,bad=false){const node=$('toast');node.textContent=message;node.className='toast show'+(bad?' bad':'');clearTimeout(node._timer);node._timer=setTimeout(()=>node.className='toast',3200);}
  function status(message,kind=''){const node=$('global_status');node.textContent=message;node.className='global-status show '+kind;clearTimeout(node._timer);node._timer=setTimeout(()=>node.className='global-status',3000);}
  async function api(path,{method='GET',body,csrf=false}={}){
    const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(csrf&&state.csrf)headers['X-CSRF-Token']=state.csrf;
    let response;
    try{response=await fetch(API_BASE+path,{method,headers,credentials:'include',body:body===undefined?undefined:JSON.stringify(body)});}catch(_){const error=new Error('连接不到管理服务，请确认服务已启动');error.status=0;throw error;}
    const data=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(data.error||data.detail||('服务器返回 HTTP '+response.status));error.status=response.status;throw error;}return data;
  }
  async function checkAdminStatus(){
    const dot=$('server_dot'),text=$('server_text');
    try{const data=await api('/api/admin/status');dot.className='ok';text.textContent=data.configured?'管理服务在线 · 等待安全登录':'管理服务在线 · 需要首次初始化';$('login_form').hidden=!data.configured;$('setup_form').hidden=!!data.configured;$('setup_token_row').hidden=!data.setupRequiresToken;return data;}
    catch(error){dot.className='err';text.textContent=error.message;$('auth_status').textContent=error.message;throw error;}
  }
  function saveSession(data){state.admin=data.admin;state.csrf=data.csrfToken||state.csrf;if(state.csrf)sessionStorage.setItem('littlejoyAdminCsrf',state.csrf);}
  async function tryExistingSession(){
    try{const data=await api('/api/admin/me');state.admin=data.admin;if(!state.csrf){$('auth_status').textContent='后台会话仍有效，但安全校验令牌已丢失，请重新登录后再修改数据';return false;}await enterApp();return true;}catch(_){return false;}
  }
  async function enterApp(){
    $('admin_login').hidden=true;$('admin_app').hidden=false;$('admin_name').textContent=state.admin.displayName||state.admin.email;$('admin_role').textContent=ROLE_NAMES[state.admin.role]||state.admin.role;$('admin_avatar').textContent=state.admin.role==='super_admin'?'👑':'🛡️';await loadBootstrap();
  }
  function leaveApp(){state.admin=null;state.csrf='';sessionStorage.removeItem('littlejoyAdminCsrf');$('admin_app').hidden=true;$('admin_login').hidden=false;$('login_password').value='';checkAdminStatus();}
  async function loadBootstrap(show=true){
    try{const data=await api('/api/admin/bootstrap');state.data=data;state.admin=data.admin||state.admin;renderAll();if(show)status('后台数据已刷新','good');}
    catch(error){if(error.status===401){leaveApp();toast('管理会话已过期，请重新登录',true);}else status(error.message,'bad');}
  }
  function showPage(page){document.querySelectorAll('#admin_nav button').forEach(button=>button.classList.toggle('on',button.dataset.page===page));document.querySelectorAll('.page').forEach(node=>node.classList.toggle('on',node.dataset.page===page));$('page_title').textContent=TITLES[page]||'运营后台';window.scrollTo({top:0,behavior:'smooth'});}

  function renderAll(){renderOverview();renderPlans();renderProviders();renderThemes();renderFlags();renderAudit();}
  function renderOverview(){
    const stats=state.data.stats||{},cards=[['注册用户',stats.users||0,'邮箱账号总数','#fff0f5'],['有效会员',stats.activeSubscriptions||0,'当前有效订阅','#eef8f2'],['累计手动收款',money(stats.paymentsCents||0),'已确认记录','#fff8e8'],['本月 AI 调用',stats.aiThisMonth||0,'成功识别次数','#f1edff']];
    $('metric_grid').innerHTML=cards.map(item=>`<div class="metric" style="--tone:${item[3]}"><span>${item[0]}</span><b>${item[1]}</b><small>${item[2]}</small></div>`).join('');
    const vision=(state.data.aiRoutes||[]).find(route=>route.capability==='vision'&&route.enabled!==false),stt=(state.data.aiRoutes||[]).find(route=>route.capability==='stt'&&route.enabled!==false),writing=(state.data.aiRoutes||[]).find(route=>route.capability==='text'&&route.enabled!==false),providers=(state.data.aiProviders||[]).filter(provider=>provider.enabled!==false&&provider.keyConfigured);$('ai_orb').className='status-orb '+(vision||stt||writing?'ok':'bad');
    $('overview_ai').innerHTML=`<div class="overview-ai-grid"><div><b>${providers.length}</b><small>已加密服务商</small></div><div><b>${vision?'在线':'未配置'}</b><small>图片识别线路</small></div><div><b>${writing?'在线':'复用视觉线路'}</b><small>AI 写作线路</small></div></div>`;
    const notices=[];if(!providers.length)notices.push(['🔑','尚未配置平台 AI Key，会员仍无法使用识别']);if(!vision)notices.push(['🧾','图片识别线路未启用']);if(!stt)notices.push(['🎤','语音识别线路未启用']);if(!(state.data.plans||[]).some(plan=>plan.active))notices.push(['💎','还没有上架套餐']);if(!notices.length)notices.push(['✅','核心收费、主题和 AI 配置均已就绪']);$('notice_list').innerHTML=notices.map(item=>`<div><i>${item[0]}</i><span>${esc(item[1])}</span></div>`).join('');
    $('overview_audit').innerHTML=auditRows((state.data.auditLogs||[]).slice(0,8),true);
  }
  function auditRows(logs,compact=false){if(!logs.length)return `<tr><td colspan="${compact?5:6}">暂无操作记录</td></tr>`;return logs.map(log=>`<tr><td>${time(log.createdAt)}</td><td>${esc(short(log.adminId))}<br><small>${esc(ROLE_NAMES[log.adminRole]||log.adminRole||'')}</small></td>${compact?'':'<td>—</td>'}<td>${esc(log.action||'—')}</td><td>${esc((log.targetType||'')+': '+short(log.targetId))}</td><td>${compact?'成功':esc(short(JSON.stringify(log.details||{})))}</td></tr>`).join('');}
  function renderAudit(){$('audit_table').innerHTML=auditRows(state.data.auditLogs||[],false);}
  function entitlementQuota(plan,key){const value=plan.entitlements&&plan.entitlements[key];return value&&value.monthlyQuota!==null&&value.monthlyQuota!==undefined?value.monthlyQuota:0;}
  function renderPlans(){
    const plans=state.data.plans||[],salePlans=plans.filter(plan=>plan.active&&plan.internal!==true&&Number(plan.priceCents)>0);$('plan_cards').innerHTML=plans.length?plans.map(plan=>`<div class="catalog-item"><span><b>${esc(plan.name)}</b><small>${esc(plan.id)} · ${plan.durationDays} 天 · 识票/批量/语音/写作 ${entitlementQuota(plan,'ai.receipt')}/${entitlementQuota(plan,'ai.batch_receipt')}/${entitlementQuota(plan,'ai.voice')}/${entitlementQuota(plan,'ai.writing')}</small></span><strong>${money(plan.priceCents)} · ${plan.internal?'内部':plan.active?'上架':'下架'}</strong></div>`).join(''):'<div class="empty-state">还没有套餐，请在右侧新建</div>';
    $('bill_plan').innerHTML=salePlans.map(plan=>`<option value="${esc(plan.id)}">${esc(plan.name)} · ${money(plan.priceCents)}</option>`).join('')||'<option value="">没有可收费的正式套餐</option>';
    syncBillingForm(true);
  }
  function renderProviders(){
    const providers=state.data.aiProviders||[],routes=state.data.aiRoutes||[];$('provider_list').innerHTML=providers.length?providers.map(provider=>`<div class="catalog-item"><span><b>${esc(provider.name)}</b><small>${esc(provider.baseUrl)} · ${provider.capabilities.join(' / ')}</small></span><strong>${provider.enabled?'启用':'停用'} · Key ••••${esc(provider.keyLast4)}</strong></div>`).join(''):'<div class="empty-state">尚未配置平台 AI 服务商</div>';
    $('route_list').innerHTML=routes.length?routes.map(route=>`<div class="catalog-item"><span><b>${route.capability==='vision'?'图片识别':route.capability==='text'?'AI 灵感与日记':'语音识别'}</b><small>${esc(route.providerId)} · ${esc(route.model)}</small></span><strong>${route.enabled?'在线':'停用'}</strong></div>`).join(''):'<div class="empty-state">尚未配置任务线路</div>';
    const options=providers.map(provider=>`<option value="${esc(provider.id)}">${esc(provider.name)}${provider.enabled?'':'（停用）'}</option>`).join('');$('route_primary').innerHTML=options||'<option value="">请先配置服务商</option>';
    const succeeded=Number(state.data.stats&&state.data.stats.aiThisMonth)||0;$('usage_summary').innerHTML=`<div><b>${succeeded}</b><small>本月成功调用</small></div><div><b>${providers.length}</b><small>服务商线路</small></div><div><b>${routes.filter(route=>route.enabled).length}</b><small>启用任务路由</small></div>`;
  }
  function renderThemes(){
    const themes=state.data.themes||[];$('theme_catalog').innerHTML=themes.map(theme=>{const look=THEME_LOOK[theme.id]||['#777','#aaa','✦'];return `<div class="theme-admin-card ${theme.enabled?'':'off'}" style="--a:${look[0]};--b:${look[1]}" data-mark="${look[2]}"><b>${esc(theme.name)}</b><small>${esc(theme.description)}</small><span>${theme.enabled?'已发布':'已隐藏'} · ${theme.premium?'限定':'免费'}</span></div>`;}).join('')||'<div class="empty-state">暂无主题目录</div>';
  }
  function renderFlags(){const flags=Object.values(state.data.featureFlags||{});$('flag_list').innerHTML=flags.map(flag=>`<div class="flag ${flag.enabled?'on':''}"><span><b>${esc(flag.key)}</b><small>${flag.public?'用户端可见':'仅后台'}</small></span><i></i></div>`).join('')||'<div class="empty-state">暂无功能开关</div>';}
  function renderUsers(users){
    $('user_results').innerHTML=users.length?users.map(user=>{const receipt=user.usage&&user.usage['ai.receipt']||{},ends=user.subscription&&user.subscription.endsAt;return `<div class="user-card"><div class="user-avatar">${esc(user.avatar||'🍓')}</div><div class="user-main"><b>${esc(user.displayName||'未命名用户')}</b><small>${esc(user.email)} · ${esc(short(user.id))}</small></div><div class="user-cell"><small>会员状态</small><b class="${user.paid?'paid-pill':'free-pill'}">${user.paid?'有效会员':'免费用户'}</b></div><div class="user-cell"><small>到期时间</small><b>${ends?new Date(ends).toLocaleDateString('zh-CN'):'—'}</b></div><div class="user-cell"><small>AI 单张识票</small><b>${receipt.remaining??0} / ${receipt.limit??0}</b></div><div class="user-cell"><small>账号创建</small><b>${time(user.createdAt).split(' ')[0]}</b></div></div>`;}).join(''):'<div class="empty-state">没有找到匹配用户</div>';
  }
  async function submitForm(form,handler){const button=form.querySelector('button[type="submit"],button:not([type])'),label=button&&button.textContent;if(button){button.disabled=true;button.textContent='正在安全保存…';}try{await handler();form.querySelectorAll('input[type=password]').forEach(input=>input.value='');await loadBootstrap(false);status('操作成功并已写入审计日志','good');}catch(error){status(error.message,'bad');toast(error.message,true);}finally{if(button){button.disabled=false;button.textContent=label;}}}
  function centsFromInput(input){const value=Number(input.value||0);if(!Number.isFinite(value)||value<0||Math.round(value*100)/100!==value)throw new Error('金额最多保留两位小数');return Math.round(value*100);}
  function syncBillingForm(usePlanPrice=false){
    const action=$('bill_action').value,paid=action==='activate'||action==='renew',gift=action==='gift',deactivate=action==='deactivate';
    $('bill_plan').disabled=deactivate;
    $('bill_amount').readOnly=gift||deactivate;$('bill_amount').required=paid;$('bill_amount').min=paid?'0.01':'0';
    $('bill_channel').disabled=!paid;$('bill_reference').disabled=!paid;$('bill_reference').required=paid;$('bill_reference').placeholder=paid?'必填，例如微信或支付宝交易单号':'赠送和停用不登记付款参考号';
    if(paid){if(!PAID_BILLING_CHANNELS.has($('bill_channel').value))$('bill_channel').value='offline';if(usePlanPrice||Number($('bill_amount').value)<=0){const plan=(state.data.plans||[]).find(item=>item.id===$('bill_plan').value);if(plan&&Number(plan.priceCents)>0)$('bill_amount').value=(Number(plan.priceCents)/100).toFixed(2);}}
    else{$('bill_amount').value='0';$('bill_reference').value='';}
    $('bill_rules').textContent=paid?'开通/续费：实收金额必须大于 0，并填写真实收款渠道和唯一付款参考号。':gift?'赠送：金额必须为 0，不会生成收费流水。':'停用：只终止当前有效订阅，不登记收费流水。';
  }

  $('login_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{const data=await api('/api/admin/login',{method:'POST',body:{email:$('login_email').value.trim(),password:$('login_password').value}});saveSession(data);await enterApp();});});
  $('setup_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{if($('setup_password').value!==$('setup_confirm').value)throw new Error('两次密码输入不一致');const data=await api('/api/admin/setup',{method:'POST',body:{displayName:$('setup_name').value.trim(),email:$('setup_email').value.trim(),password:$('setup_password').value,setupToken:$('setup_token').value}});saveSession(data);await enterApp();});});
  $('logout_btn').addEventListener('click',async()=>{try{await api('/api/admin/logout',{method:'POST',body:{},csrf:true});}catch(_){}leaveApp();});
  $('refresh_btn').addEventListener('click',()=>loadBootstrap(true));
  $('admin_nav').addEventListener('click',event=>{const button=event.target.closest('button[data-page]');if(button)showPage(button.dataset.page);});
  document.addEventListener('click',event=>{const jump=event.target.closest('[data-jump]');if(jump)showPage(jump.dataset.jump);});
  $('user_search_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{const query=$('user_query').value.trim(),data=await api('/api/admin/users/search',{method:'POST',body:{query}});renderUsers(data.users||[]);if(data.users&&data.users.length===1){$('bill_user').value=data.users[0].email;$('grant_user').value=data.users[0].email;}});});
  $('bill_action').addEventListener('change',()=>syncBillingForm(true));
  $('bill_plan').addEventListener('change',()=>syncBillingForm(true));
  $('billing_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{const target=$('bill_user').value.trim(),action=$('bill_action').value,amountCents=centsFromInput($('bill_amount')),channel=$('bill_channel').value,reference=$('bill_reference').value.trim(),paid=action==='activate'||action==='renew';if(paid&&amountCents<=0)throw new Error('开通或续费必须填写大于 0 的实收金额');if(paid&&!PAID_BILLING_CHANNELS.has(channel))throw new Error('请选择有效的收款渠道');if(paid&&!reference)throw new Error('开通或续费必须填写唯一付款参考号');if(action==='gift'&&amountCents!==0)throw new Error('赠送会员的金额必须为 0，且不会生成收费流水');const body={action,planId:$('bill_plan').value,amountCents,channel,reference,note:$('bill_note').value.trim(),confirmPassword:$('bill_password').value};if(target.includes('@'))body.email=target;else body.userId=target;if(action==='deactivate'){delete body.planId;delete body.amountCents;delete body.channel;delete body.reference;}if(action==='gift'){delete body.channel;delete body.reference;}await api('/api/admin/billing/apply',{method:'POST',body,csrf:true});});});
  $('grant_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{const target=$('grant_user').value.trim(),quota=$('grant_quota').value,body={feature:$('grant_feature').value,enabled:bool($('grant_enabled').value),monthlyQuota:quota===''?null:Number(quota),durationDays:Number($('grant_days').value),source:'manual',note:$('grant_note').value.trim(),confirmPassword:$('grant_password').value};if(target.includes('@'))body.email=target;else body.userId=target;await api('/api/admin/entitlements/grant',{method:'POST',body,csrf:true});});});
  $('plan_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{await api('/api/admin/plans/upsert',{method:'POST',csrf:true,body:{id:$('plan_id').value.trim(),name:$('plan_name').value.trim(),description:$('plan_description').value.trim(),active:bool($('plan_active').value),priceCents:centsFromInput($('plan_price')),durationDays:Number($('plan_days').value),entitlements:{'cloud.sync':{enabled:true},'ledger.share':{enabled:true},'theme.premium':{enabled:true},'ai.receipt':{enabled:true,monthlyQuota:Number($('plan_receipt_quota').value||0)},'ai.batch_receipt':{enabled:true,monthlyQuota:Number($('plan_batch_quota').value||0)},'ai.voice':{enabled:true,monthlyQuota:Number($('plan_voice_quota').value||0)},'ai.writing':{enabled:true,monthlyQuota:Number($('plan_writing_quota').value||0)}},confirmPassword:$('plan_password').value}});});});
  $('provider_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{await api('/api/admin/ai/providers/upsert',{method:'POST',csrf:true,body:{id:$('provider_id').value.trim(),name:$('provider_name').value.trim(),baseUrl:$('provider_base').value.trim(),apiKey:$('provider_key').value,capabilities:$('provider_capabilities').value.split(','),enabled:bool($('provider_enabled').value),timeoutMs:Number($('provider_timeout').value),inputPerMillionCents:Number($('provider_input_cost').value||0),outputPerMillionCents:Number($('provider_output_cost').value||0),confirmPassword:$('provider_password').value}});});});
  $('route_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{await api('/api/admin/ai/routes/upsert',{method:'POST',csrf:true,body:{capability:$('route_capability').value,providerId:$('route_primary').value,model:$('route_model').value.trim(),enabled:bool($('route_enabled').value),confirmPassword:$('route_password').value}});});});
  $('theme_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{await api('/api/admin/themes/upsert',{method:'POST',csrf:true,body:{id:$('theme_id').value.trim(),name:$('theme_name').value.trim(),description:$('theme_description').value.trim(),premium:bool($('theme_premium').value),enabled:bool($('theme_enabled').value),sortOrder:Number($('theme_sort').value),confirmPassword:$('theme_password').value}});});});
  $('flag_form').addEventListener('submit',event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{await api('/api/admin/feature-flags/set',{method:'POST',csrf:true,body:{key:$('flag_key').value.trim(),enabled:bool($('flag_value').value),public:true,note:$('flag_note').value.trim(),confirmPassword:$('flag_password').value}});});});

  (async()=>{try{const adminStatus=await checkAdminStatus();if(adminStatus.configured)await tryExistingSession();}catch(_){}})();
})();
