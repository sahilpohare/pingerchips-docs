"use strict";(self.webpackChunkpingerchips=self.webpackChunkpingerchips||[]).push([[620],{3905:(e,t,n)=>{n.d(t,{Zo:()=>p,kt:()=>f});var r=n(7294);function a(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function s(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function i(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?s(Object(n),!0).forEach((function(t){a(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):s(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function o(e,t){if(null==e)return{};var n,r,a=function(e,t){if(null==e)return{};var n,r,a={},s=Object.keys(e);for(r=0;r<s.length;r++)n=s[r],t.indexOf(n)>=0||(a[n]=e[n]);return a}(e,t);if(Object.getOwnPropertySymbols){var s=Object.getOwnPropertySymbols(e);for(r=0;r<s.length;r++)n=s[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(a[n]=e[n])}return a}var l=r.createContext({}),c=function(e){var t=r.useContext(l),n=t;return e&&(n="function"==typeof e?e(t):i(i({},t),e)),n},p=function(e){var t=c(e.components);return r.createElement(l.Provider,{value:t},e.children)},u="mdxType",d={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},m=r.forwardRef((function(e,t){var n=e.components,a=e.mdxType,s=e.originalType,l=e.parentName,p=o(e,["components","mdxType","originalType","parentName"]),u=c(n),m=a,f=u["".concat(l,".").concat(m)]||u[m]||d[m]||s;return n?r.createElement(f,i(i({ref:t},p),{},{components:n})):r.createElement(f,i({ref:t},p))}));function f(e,t){var n=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var s=n.length,i=new Array(s);i[0]=m;var o={};for(var l in t)hasOwnProperty.call(t,l)&&(o[l]=t[l]);o.originalType=e,o[u]="string"==typeof e?e:a,i[1]=o;for(var c=2;c<s;c++)i[c]=n[c];return r.createElement.apply(null,i)}return r.createElement.apply(null,n)}m.displayName="MDXCreateElement"},3988:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>i,default:()=>d,frontMatter:()=>s,metadata:()=>o,toc:()=>c});var r=n(7462),a=(n(7294),n(3905));const s={sidebar_position:2},i="Client SDK Setup",o={unversionedId:"installation/client-sdk",id:"installation/client-sdk",title:"Client SDK Setup",description:"You can use any Pusher Client SDK to connect to Pingerchips.",source:"@site/docs/installation/client-sdk.md",sourceDirName:"installation",slug:"/installation/client-sdk",permalink:"/pcing-docs/docs/installation/client-sdk",draft:!1,editUrl:"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/docs/installation/client-sdk.md",tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"tutorialSidebar",previous:{title:"Setup Server SDK",permalink:"/pcing-docs/docs/installation/server-sdk"},next:{title:"Pingerflows",permalink:"/pcing-docs/docs/category/pingerflows"}},l={},c=[{value:"Installation",id:"installation",level:2},{value:"Usage",id:"usage",level:2}],p={toc:c},u="wrapper";function d(e){let{components:t,...n}=e;return(0,a.kt)(u,(0,r.Z)({},p,n,{components:t,mdxType:"MDXLayout"}),(0,a.kt)("h1",{id:"client-sdk-setup"},"Client SDK Setup"),(0,a.kt)("p",null,"You can use any ",(0,a.kt)("a",{parentName:"p",href:"https://pusher.com/docs/channels/channels_libraries/libraries/"},"Pusher Client SDK")," to connect to Pingerchips.\nWe will be using ",(0,a.kt)("a",{parentName:"p",href:"https://github.com/pusher/pusher-js?_gl=1*wjq8zd*_gcl_au*MTY2MTcxMTY3NC4xNjk1NzU0NTUz"},"Pusher JS")," for this example."),(0,a.kt)("h2",{id:"installation"},"Installation"),(0,a.kt)("p",null,":: Note: You can skip this step if you already have the Pusher JS SDK installed in your project"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-bash"},"npm install pusher-js\n")),(0,a.kt)("h2",{id:"usage"},"Usage"),(0,a.kt)("pre",null,(0,a.kt)("code",{parentName:"pre",className:"language-js"},'import Pusher from "pusher-js";\n\nlet pusher = new PusherJS(<APP KEY>, {\n    wsHost: "ws.pingerchips.com",\n    wsPort: 6001,\n    forceTLS: false,\n    encrypted: true,\n    disableStats: true,\n    enabledTransports: ["ws", "wss"],\n    cluster: "mt1",\n});\n\nlet channel = pusher.subscribe("my-channel");\nchannel.bind("my-event", function (data) {\n    alert("Received my-event with message: " + data.message);\n});\n')))}d.isMDXComponent=!0}}]);