import{l,k as _}from"./chunks/icons/Add.js";var v=/["&<]/;function p(r){if(r.length===0||v.test(r)===!1)return r;for(var t=0,e=0,a="",n="";e<r.length;e++){switch(r.charCodeAt(e)){case 34:n="&quot;";break;case 38:n="&amp;";break;case 60:n="&lt;";break;default:continue}e!==t&&(a+=r.slice(t,e)),a+=n,t=e+1}return e!==t&&(a+=r.slice(t,e)),a}var y=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,d=0,x=Array.isArray;function b(r,t,e,a,n,s){t||(t={});var i,o,f=t;if("ref"in f)for(o in f={},t)o=="ref"?i=t[o]:f[o]=t[o];var c={type:r,props:f,key:e,ref:i,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:--d,__i:-1,__u:0,__source:n,__self:s};if(typeof r=="function"&&(i=r.defaultProps))for(o in i)f[o]===void 0&&(f[o]=i[o]);return l.vnode&&l.vnode(c),c}function k(r){var t=b(_,{tpl:r,exprs:[].slice.call(arguments,1)});return t.key=t.__v,t}var u={},g=/[A-Z]/g;function m(r,t){if(l.attr){var e=l.attr(r,t);if(typeof e=="string")return e}if(r==="ref"||r==="key")return"";if(r==="style"&&typeof t=="object"){var a="";for(var n in t){var s=t[n];if(s!=null&&s!==""){var i=n[0]=="-"?n:u[n]||(u[n]=n.replace(g,"-$&").toLowerCase()),o=";";typeof s!="number"||i.startsWith("--")||y.test(i)||(o="px;"),a=a+i+":"+s+o}}return r+'="'+a+'"'}return t==null||t===!1||typeof t=="function"||typeof t=="object"?"":t===!0?r:r+'="'+p(t)+'"'}function j(r){if(r==null||typeof r=="boolean"||typeof r=="function")return null;if(typeof r=="object"){if(r.constructor===void 0)return r;if(x(r)){for(var t=0;t<r.length;t++)r[t]=j(r[t]);return r}}return p(""+r)}export{_ as Fragment,b as jsx,m as jsxAttr,b as jsxDEV,j as jsxEscape,k as jsxTemplate,b as jsxs};
