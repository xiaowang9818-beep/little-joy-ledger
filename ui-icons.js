/*
 * 小确幸统一图标层
 * 将历史模板、用户分类和后续新增页面中的彩色 Emoji 自动替换成同一套线性 SVG。
 * 使用 Unicode 码点分组而不是依赖系统 Emoji 字体，确保 Windows、Android、iOS 外观一致。
 */
(function(){
  'use strict';
  const EMOJI_RE=/\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?)*/gu;
  // 24×24、圆角端点、统一线宽；基础轮廓遵循 Lucide/Feather 的一致性原则。
  const ICONS={
    spark:'<path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z"/><path d="m5 14 .7 2.3L8 17.5l-2.3 1.2L5 21l-.7-2.3L2 17.5l2.3-1.2L5 14Z"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    book:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22V4.5Z"/>',
    chart:'<path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7"/><path d="M2 20h20"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    wallet:'<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z"/><path d="M3 8h18M16 13h5v4h-5a2 2 0 0 1 0-4Z"/>',
    mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20.5 14.4A8.5 8.5 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z"/>',
    bot:'<rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"/>',
    clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/>',
    rocket:'<path d="M14 5c3.5-3.5 6.5-3 7-2.5.5.5 1 3.5-2.5 7L13 15l-4-4 5-6Z"/><path d="m9 11-4 1-3 3 7 1 1 6 3-3 1-4M5 19l-2 2"/><circle cx="17" cy="6" r="1"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
    trash:'<path d="M3 6h18M8 6V3h8v3M19 6l-1 16H6L5 6M10 11v6M14 11v6"/>',
    food:'<path d="M6 2v8M3 2v5a3 3 0 0 0 6 0V2M6 10v12M16 2c3 2 4 5 4 9h-4v11M16 2v9"/>',
    car:'<path d="m5 17-2-2v-4l2-1 2-5h10l2 5 2 1v4l-2 2H5Z"/><path d="M7 17v2M17 17v2M3 11h18M7 13h.01M17 13h.01"/>',
    shopping:'<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    game:'<path d="M8 8h8a6 6 0 0 1 5.5 8.4L20 20l-4-3H8l-4 3-1.5-3.6A6 6 0 0 1 8 8Z"/><path d="M7 12v4M5 14h4M16 13h.01M19 15h.01"/>',
    medical:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
    home:'<path d="m3 11 9-8 9 8v10h-6v-6H9v6H3V11Z"/>',
    phone:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    gift:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M7.5 8C5 8 4 6.5 4.5 5S8 3.5 12 8M16.5 8C19 8 20 6.5 19.5 5S16 3.5 12 8"/>',
    plane:'<path d="m2 16 20-8-8 14-2-7-10 1Z"/><path d="m12 15 4-4"/>',
    box:'<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
    money:'<circle cx="12" cy="12" r="9"/><path d="M16 8h-5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H8M12 6v12"/>',
    trend:'<path d="M3 18 9 12l4 4 8-10"/><path d="M15 6h6v6"/>',
    user:'<circle cx="12" cy="7" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
    idea:'<path d="M9 18h6M10 22h4"/><path d="M8.2 14.5A7 7 0 1 1 15.8 14.5C14.8 15.3 14 16.2 14 18h-4c0-1.8-.8-2.7-1.8-3.5Z"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"/>',
    lock:'<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.5 6L20 12M4 12l1.5 6A7 7 0 0 0 18 16"/>',
    search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    leaf:'<path d="M20 4C10 4 5 9 5 15c0 3 2 5 5 5 6 0 10-6 10-16Z"/><path d="M4 22c2-6 6-10 12-13"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    warning:'<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
    shield:'<path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    cloud:'<path d="M17.5 19H6a4 4 0 0 1-.7-7.9A7 7 0 0 1 18.8 9a5 5 0 0 1-1.3 10Z"/>',
    waves:'<path d="M2 7c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 12c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M2 17c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    cake:'<path d="M4 12h16v9H4zM4 16h16M8 12V8M12 12V7M16 12V8"/><path d="M8 8c1-1 1-2 0-3M12 7c1-1 1-2 0-3M16 8c1-1 1-2 0-3"/>',
    fish:'<path d="M16 7c-4-2-8 0-11 5 3 5 7 7 11 5l5 3-1-5 1-3-1-3 1-5-5 3Z"/><path d="M15 10h.01"/>',
    flame:'<path d="M12 22c4.4 0 7-3 7-7 0-3.5-2-6.5-5-9 .2 2-1 3.5-2 4.5C10.5 8 10 5.5 11 2 7 4.5 5 8.5 5 13c0 5 3 9 7 9Z"/><path d="M9.5 17c0 2 1 3 2.5 3s2.5-1 2.5-3c0-1.5-1-2.7-2.5-4-1.5 1.3-2.5 2.5-2.5 4Z"/>',
    flower:'<circle cx="12" cy="12" r="2"/><path d="M12 10c-3-1-4-3-3-5 2-1 4 0 5 3 1-3 3-4 5-3 1 2 0 4-3 5 3 1 4 3 3 5-2 1-4 0-5-3-1 3-3 4-5 3-1-2 0-4 3-5-3-1-4-3-3-5 2-1 4 0 5 3Z"/>',
    wind:'<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
    vase:'<path d="M8 3h8M9 3c0 4-2 5-3 8-1.5 5 1 10 6 10s7.5-5 6-10c-1-3-3-4-3-8M7 10h10M8 17h8"/>',
    rabbit:'<path d="M8 9C5 6 5 2 7 2c2 0 3 4 4 7M16 9c3-3 3-7 1-7-2 0-3 4-4 7"/><path d="M6 14a6 6 0 0 1 12 0v2a6 6 0 0 1-12 0v-2Z"/><path d="M10 14h.01M14 14h.01M11 17h2"/>'
  };
  const GROUPS={
    settings:[0x2699],book:[0x1f4d2,0x1f4da,0x1f4d6],chart:[0x1f4ca,0x1f4c8],users:[0x1f91d,0x1f46a,0x1f468,0x1f469,0x1f467],wallet:[0x1f4bc,0x1f4b3,0x1f45b,0x1f4b8],mic:[0x1f3a4],image:[0x1f4f7,0x1f5bc],sun:[0x2600],moon:[0x1f319],bot:[0x1f916],clipboard:[0x1f4cb,0x1f9fe],rocket:[0x1f680],link:[0x1f517],trash:[0x1f5d1],food:[0x1f35a,0x1f35c,0x1f37d],car:[0x1f68c,0x1f697,0x1f3c3],shopping:[0x1f6cd,0x1f9f4],game:[0x1f3ae,0x26bd],medical:[0x1f48a],home:[0x1f3e0,0x1f3e1,0x1f3e1],phone:[0x1f4f1],gift:[0x1f381,0x1f9e7],plane:[0x2708],box:[0x1f4e6],money:[0x1f4b0,0x1f4b5,0x1f9e7],trend:[0x1f4c8],user:[0x1f464],idea:[0x1f4a1],check:[0x2705,0x1f44d],bell:[0x1f514,0x23f0],calendar:[0x1f4c5,0x1f5d3],edit:[0x270f,0x270d],lock:[0x1f512,0x1f510],refresh:[0x1f504,0x267b,0x21a9],search:[0x1f50e],target:[0x1f3af],clock:[0x23f1],leaf:[0x1f331,0x1f340,0x1fab7],heart:[0x2764,0x1f49a,0x1f49a],warning:[0x26a0],shield:[0x1f6e1]
  };
  const CODE_TO_ICON=new Map();Object.keys(GROUPS).forEach(name=>GROUPS[name].forEach(cp=>CODE_TO_ICON.set(cp,name)));
  function iconName(token){const cp=token.codePointAt(0);if(CODE_TO_ICON.has(cp))return CODE_TO_ICON.get(cp);if((cp>=0x1f400&&cp<=0x1f43f)||(cp>=0x1f980&&cp<=0x1f9ae))return 'heart';if(cp>=0x1f300&&cp<=0x1f5ff)return 'spark';return 'spark';}
  function iconMarkup(name,className){const safe=ICONS[name]?name:'spark';return '<span class="ui-icon-v1 ui-icon-'+safe+(className?' '+className:'')+'" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'+ICONS[safe]+'</svg></span>';}
  window.uiIconMarkupV1=iconMarkup;
  function iconNode(token){const name=iconName(token),holder=document.createElement('span');holder.innerHTML=iconMarkup(name,'');return holder.firstElementChild;}
  function cleanPlain(value){return String(value||'').replace(EMOJI_RE,'').replace(/\s{2,}/g,' ').trim();}
  function replaceText(node){if(!node||!node.parentElement||!EMOJI_RE.test(node.nodeValue||''))return;EMOJI_RE.lastIndex=0;const parent=node.parentElement;if(parent.closest('script,style,svg,.ui-icon-v1'))return;if(parent.tagName==='OPTION'||parent.tagName==='TITLE'){node.nodeValue=cleanPlain(node.nodeValue);return;}const text=node.nodeValue,frag=document.createDocumentFragment();let last=0;EMOJI_RE.lastIndex=0;for(const match of text.matchAll(EMOJI_RE)){if(match.index>last)frag.append(document.createTextNode(text.slice(last,match.index)));frag.append(iconNode(match[0]));last=match.index+match[0].length;}if(last<text.length)frag.append(document.createTextNode(text.slice(last)));node.replaceWith(frag);}
  function scan(root){if(!root)return;if(root.nodeType===3){replaceText(root);return;}if(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11)return;if(root.nodeType===1){['title','aria-label','placeholder'].forEach(attr=>{if(root.hasAttribute&&root.hasAttribute(attr)){const old=root.getAttribute(attr),next=cleanPlain(old);if(next!==old)root.setAttribute(attr,next);}});}const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(replaceText);}
  function boot(){scan(document.documentElement);const observer=new MutationObserver(records=>records.forEach(record=>{record.addedNodes.forEach(scan);if(record.type==='characterData')replaceText(record.target);}));observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.documentElement.classList.add('unified-icons-v1');window.cleanUiTextV1=cleanPlain;}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
