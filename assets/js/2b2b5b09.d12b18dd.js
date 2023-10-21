"use strict";(self.webpackChunkpingerchips=self.webpackChunkpingerchips||[]).push([[505],{3905:(e,t,n)=>{n.d(t,{Zo:()=>c,kt:()=>m});var r=n(7294);function o(e,t,n){return t in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function i(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),n.push.apply(n,r)}return n}function a(e){for(var t=1;t<arguments.length;t++){var n=null!=arguments[t]?arguments[t]:{};t%2?i(Object(n),!0).forEach((function(t){o(e,t,n[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):i(Object(n)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(n,t))}))}return e}function l(e,t){if(null==e)return{};var n,r,o=function(e,t){if(null==e)return{};var n,r,o={},i=Object.keys(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||(o[n]=e[n]);return o}(e,t);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);for(r=0;r<i.length;r++)n=i[r],t.indexOf(n)>=0||Object.prototype.propertyIsEnumerable.call(e,n)&&(o[n]=e[n])}return o}var s=r.createContext({}),p=function(e){var t=r.useContext(s),n=t;return e&&(n="function"==typeof e?e(t):a(a({},t),e)),n},c=function(e){var t=p(e.components);return r.createElement(s.Provider,{value:t},e.children)},d="mdxType",u={inlineCode:"code",wrapper:function(e){var t=e.children;return r.createElement(r.Fragment,{},t)}},f=r.forwardRef((function(e,t){var n=e.components,o=e.mdxType,i=e.originalType,s=e.parentName,c=l(e,["components","mdxType","originalType","parentName"]),d=p(n),f=o,m=d["".concat(s,".").concat(f)]||d[f]||u[f]||i;return n?r.createElement(m,a(a({ref:t},c),{},{components:n})):r.createElement(m,a({ref:t},c))}));function m(e,t){var n=arguments,o=t&&t.mdxType;if("string"==typeof e||o){var i=n.length,a=new Array(i);a[0]=f;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l[d]="string"==typeof e?e:o,a[1]=l;for(var p=2;p<i;p++)a[p]=n[p];return r.createElement.apply(null,a)}return r.createElement.apply(null,n)}f.displayName="MDXCreateElement"},3720:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>s,contentTitle:()=>a,default:()=>u,frontMatter:()=>i,metadata:()=>l,toc:()=>p});var r=n(7462),o=(n(7294),n(3905));const i={sidebar_position:1},a="Getting Started With Flows",l={unversionedId:"tutorial-basics/getting-started",id:"tutorial-basics/getting-started",title:"Getting Started With Flows",description:"Pingerflows allows you to intercept and modify the flow of events in your application. You can use it to add additional data to your events, or to modify the data in your events.",source:"@site/docs/tutorial-basics/getting-started.md",sourceDirName:"tutorial-basics",slug:"/tutorial-basics/getting-started",permalink:"/pcing-docs/docs/tutorial-basics/getting-started",draft:!1,editUrl:"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/docs/tutorial-basics/getting-started.md",tags:[],version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"tutorialSidebar",previous:{title:"Pingerflows",permalink:"/pcing-docs/docs/category/pingerflows"},next:{title:"Transform Node",permalink:"/pcing-docs/docs/tutorial-basics/transform-node"}},s={},p=[{value:"Getting Started",id:"getting-started",level:2},{value:"Flow Editor",id:"flow-editor",level:2},{value:"Publishing flows",id:"publishing-flows",level:2}],c={toc:p},d="wrapper";function u(e){let{components:t,...n}=e;return(0,o.kt)(d,(0,r.Z)({},c,n,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h1",{id:"getting-started-with-flows"},"Getting Started With Flows"),(0,o.kt)("p",null,"Pingerflows allows you to intercept and modify the flow of events in your application. You can use it to add additional data to your events, or to modify the data in your events."),(0,o.kt)("h2",{id:"getting-started"},"Getting Started"),(0,o.kt)("ol",null,(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("p",{parentName:"li"},"Create a new Pingerflows app in your ",(0,o.kt)("a",{parentName:"p",href:"https://dashboard.pingerchips.com/dashboard/apps"},"Pingerchips Dashboard"),".")),(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("p",{parentName:"li"},"Navigate to the ",(0,o.kt)("inlineCode",{parentName:"p"},"Flows")," tab and click on ",(0,o.kt)("inlineCode",{parentName:"p"},"Create Flow"),".")),(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("p",{parentName:"li"},"Give your flow a name and a channel to listen to"),(0,o.kt)("admonition",{parentName:"li",type:"tip"},(0,o.kt)("p",{parentName:"admonition"},"You can only have one flow per channel. We might allow multiple flows per channel in the future."))),(0,o.kt)("li",{parentName:"ol"},(0,o.kt)("p",{parentName:"li"},"Click on ",(0,o.kt)("inlineCode",{parentName:"p"},"Create Flow")," and you will be redirected to the flow editor."))),(0,o.kt)("h2",{id:"flow-editor"},"Flow Editor"),(0,o.kt)("p",null,"Add a new step to your flow by clicking on the ",(0,o.kt)("inlineCode",{parentName:"p"},"+")," button. You can add multiple steps to your flow."),(0,o.kt)("h2",{id:"publishing-flows"},"Publishing flows"),(0,o.kt)("p",null,"Click on the ",(0,o.kt)("inlineCode",{parentName:"p"},"Publish")," button to publish your flow. This will deploy your flow to our servers and it will be active immediately.\nWe will be adding a feature to allow you to publish flows to specific environments and save drafts of flows."))}u.isMDXComponent=!0}}]);