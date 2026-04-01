import{N as O,Y as J,V as E,j as e}from"./vendor-frappe-LlpT3ygC.js";import{r as x}from"./vendor-react-BBTzqz1z.js";import{a as Z,u as X,D as ee,g as te,S as re,j as ae,k as se,l as ne,m as F,B as w,n as R}from"./index-DsRD9oY4.js";import{aO as I,a5 as z,aP as ie,aC as de,v as le,ao as oe,aQ as L,as as ce,a3 as M,x as C,aR as pe,A as xe,L as me,a6 as ge,t as y}from"./vendor-ui-Bh7e6FOa.js";import{D as ue}from"./DeliveryMap-ColVusMW.js";function be(){const c=(a,s)=>{const n=new Date(a.creation||Date.now()).toLocaleString(),l=a.order_items||[],t="₹",j=l.map(d=>`
      <tr>
        <td style="padding: 4px 0; vertical-align: top;">
          <div style="font-weight: bold;">${d.product_name||d.product}</div>
          ${d.customizations?`<div style="font-size: 10px; color: #666; font-style: italic;">${m(d.customizations)}</div>`:""}
        </td>
        <td style="padding: 4px 0; text-align: center; vertical-align: top;">${d.quantity}</td>
        <td style="padding: 4px 0; text-align: right; vertical-align: top;">${t}${(d.unit_price||0).toFixed(2)}</td>
        <td style="padding: 4px 0; text-align: right; vertical-align: top;">${t}${(d.total_price||d.unit_price*d.quantity||0).toFixed(2)}</td>
      </tr>
    `).join("");return`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: auto; margin: 0mm; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 12px; 
            line-height: 1.4; 
            color: #000;
            margin: 0;
            padding: 20px;
            width: 80mm; /* Standard thermal printer width */
          }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
          .restaurant-name { font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0 0 5px 0; }
          .restaurant-info { font-size: 10px; color: #444; margin: 2px 0; }
          .order-info { margin-bottom: 15px; font-size: 11px; }
          .order-info div { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .table th { border-bottom: 1px solid #000; text-align: left; padding: 5px 0; font-size: 10px; text-transform: uppercase; }
          .totals { border-top: 1px solid #000; padding-top: 8px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-weight: 500; }
          .total-row.grand-total { font-size: 16px; font-weight: 900; margin-top: 8px; border-top: 1px dashed #ccc; padding-top: 8px; }
          .footer { text-align: center; margin-top: 25px; font-size: 10px; color: #666; border-top: 1px dashed #ccc; padding-top: 15px; }
          .tag { display: inline-block; padding: 2px 6px; background: #000; color: #fff; font-size: 9px; font-weight: 900; border-radius: 3px; text-transform: uppercase; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="restaurant-name">${s?.restaurant_name||"DINEMATTERS RESTAURANT"}</h1>
          <p class="restaurant-info">${s?.address||"Restaurant Address"}</p>
          <p class="restaurant-info">PH: ${s?.contact_phone||"N/A"}</p>
        </div>

        <div class="order-info">
          <div><span>Order ID:</span> <strong>#${a.order_number||a.name.split("-").pop()}</strong></div>
          <div><span>Date:</span> <span>${n}</span></div>
          <div><span>Type:</span> <span class="tag">${(a.order_type||"dine_in").replace("_"," ")}</span></div>
          ${a.table_number?`<div><span>Table:</span> <strong>Table ${a.table_number}</strong></div>`:""}
          <div><span>Customer:</span> <span>${a.customer_name||"Guest"}</span></div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th style="width: 50%;">Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${j}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${t}${a.subtotal?.toFixed(2)||"0.00"}</span>
          </div>
          ${a.discount?`
            <div class="total-row" style="color: #000;">
              <span>Discount</span>
              <span>-${t}${a.discount.toFixed(2)}</span>
            </div>
          `:""}
          ${a.tax?`
            <div class="total-row">
              <span>GST (Incl.)</span>
              <span>${t}${a.tax.toFixed(2)}</span>
            </div>
          `:""}
          <div class="total-row grand-total">
            <span>GRAND TOTAL</span>
            <span>${t}${a.total?.toFixed(2)||"0.00"}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for dining with us!</p>
          <p style="font-weight: bold; margin-top: 5px;">Powered by Dinematters</p>
        </div>
      </body>
      </html>
    `},u=a=>{const s=new Date().toLocaleString(),l=(a.order_items||[]).map(t=>`
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; width: 30px; font-size: 20px; font-weight: 900;">${t.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          <div style="font-size: 16px; font-weight: 800;">${t.product_name||t.product}</div>
          ${t.customizations?`<div style="font-size: 12px; font-weight: 600; color: #333; margin-top: 4px; padding: 4px; background: #f9f9f9; border-radius: 4px;">${m(t.customizations)}</div>`:""}
        </td>
      </tr>
    `).join("");return`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: auto; margin: 0mm; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px; 
            line-height: 1.2; 
            color: #000;
            margin: 0;
            padding: 15px;
            width: 80mm;
          }
          .kot-header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .kot-title { font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 2px; }
          .order-details { margin-bottom: 15px; font-size: 14px; font-weight: 700; }
          .order-details div { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .table { width: 100%; border-collapse: collapse; }
          .table th { text-align: left; padding: 5px 0; border-bottom: 2px solid #000; font-size: 12px; }
          .footer { text-align: center; margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; font-size: 11px; font-weight: 800; }
          .big-text { font-size: 22px; font-weight: 900; }
        </style>
      </head>
      <body>
        <div class="kot-header">
          <h1 class="kot-title">KITCHEN ORDER</h1>
          <div style="margin-top: 5px; font-size: 12px;">${s}</div>
        </div>

        <div class="order-details">
          <div><span>ORDER ID:</span> <span>#${a.order_number||a.name.split("-").pop()}</span></div>
          <div><span>TYPE:</span> <span style="background: #000; color: #fff; padding: 0 4px;">${(a.order_type||"dine_in").toUpperCase()}</span></div>
          ${a.table_number!==void 0?`<div class="big-text"><span>TABLE:</span> <span>${a.table_number}</span></div>`:""}
        </div>

        <table class="table">
          <thead>
            <tr>
              <th style="text-align: left;">QTY</th>
              <th style="text-align: left;">ITEM & CUSTOMIZATIONS</th>
            </tr>
          </thead>
          <tbody>
            ${l}
          </tbody>
        </table>

        ${a.cooking_instructions?`
          <div style="margin-top: 15px; padding: 10px; border: 2px solid #000; border-radius: 8px;">
            <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">Special Instructions:</div>
            <div style="font-size: 14px; font-weight: 700; font-style: italic;">${a.cooking_instructions}</div>
          </div>
        `:""}

        <div class="footer">
          END OF KOT
        </div>
      </body>
      </html>
    `},m=a=>{if(!a)return"";try{const s=typeof a=="string"?JSON.parse(a):a;return Object.entries(s).map(([n,l])=>`${n}: ${Array.isArray(l)?l.join(", "):l}`).join(" | ")}catch{return""}},i=x.useCallback(a=>{const s=document.createElement("iframe");s.style.display="none",document.body.appendChild(s);const n=s.contentWindow?.document||s.contentDocument;n&&(n.open(),n.write(a),n.close(),s.contentWindow?.focus(),setTimeout(()=>{s.contentWindow?.print(),setTimeout(()=>{document.body.removeChild(s)},1e3)},500))},[]);return{print:x.useCallback((a,s)=>{if(s.type==="RECEIPT"){const n=c(a,s.restaurant);i(n)}else{const n=u(a);i(n)}},[i])}}function Ne({orderId:c,open:u,onOpenChange:m}){const{formatAmount:i,formatAmountNoDecimals:D}=Z(),[a,s]=x.useState(!1),{print:n}=be(),{restaurantConfig:l}=X(),{data:t,isLoading:j,mutate:d}=O("Order",c||"",{fields:["*"],enabled:u&&!!c});J("order_update",r=>{r.order_id===c&&d()});const[T,$]=x.useState(!1),[S,A]=x.useState(!1),[v,U]=x.useState("manual"),[o,N]=x.useState({partner_name:"",rider_name:"",rider_phone:"",eta:""}),{call:B}=E("dinematters.dinematters.api.delivery.assign_delivery"),{call:H}=E("dinematters.dinematters.api.delivery.cancel_delivery"),Y=async()=>{if(t?.name){$(!0);try{const r={order_id:t.name,delivery_mode:v};v==="manual"&&(r.partner_name=o.partner_name||"manual",r.rider_name=o.rider_name,r.rider_phone=o.rider_phone,r.eta=o.eta);const p=await B(r);if(!p.success)throw new Error(p.error||"Failed to assign delivery");y.success("Delivery assigned successfully"),window.location.reload()}catch(r){y.error("Failed to assign delivery",{description:R(r)})}finally{$(!1)}}},G=async()=>{if(!(!t?.delivery_id&&!t?.delivery_partner)&&confirm("Are you sure you want to cancel the delivery assignment?")){A(!0);try{const r=await H({order_id:t.name,delivery_id:t.delivery_id});if(!r.success)throw new Error(r.error||"Failed to cancel delivery");y.success("Delivery cancelled successfully"),window.location.reload()}catch(r){y.error("Failed to cancel delivery",{description:R(r)})}finally{A(!1)}}},{data:b}=O("Coupon",t?.coupon||"",{fields:["code","discount_type","discount_value","description","detailed_description"],enabled:u&&!!t?.coupon}),h=l?.restaurant||{};if(!c)return null;const K=()=>{c&&(navigator.clipboard.writeText(c),s(!0),y.success("Order ID copied to clipboard"),setTimeout(()=>s(!1),2e3))},V=(r,p,f)=>{if(f==="delivery"&&p){const g=p.toLowerCase();return g==="cancelled"?{color:"text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400",icon:C,label:"Delivery Cancelled"}:g==="delivered"||g==="completed"?{color:"text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400",icon:z,label:"Delivered"}:{color:"text-primary bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30",icon:L,label:p}}switch(r?.toLowerCase()){case"delivered":case"billed":return{color:"text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400",icon:z,label:"Completed"};case"cancelled":return{color:"text-red-600 bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400",icon:C,label:"Cancelled"};case"pending verification":case"pending_verification":return{color:"text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400",icon:ge,label:"Verifying"};case"preparing":return{color:"text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-400",icon:me,label:"Preparing"};case"ready":return{color:"text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400",icon:xe,label:"Ready for Pickup"};default:return{color:"text-gray-600 bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400",icon:pe,label:r}}},W=r=>{if(!r)return{};if(typeof r=="string")try{return JSON.parse(r)}catch{return{}}return r},k=V(t?.status||"",t?.delivery_status,t?.order_type),Q=k.icon;return e.jsx(ee,{open:u,onOpenChange:m,children:e.jsx(te,{className:"max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none bg-slate-50 dark:bg-zinc-950 gap-0",children:j?e.jsxs("div",{className:"flex flex-col items-center justify-center py-20 space-y-4",children:[e.jsx("div",{className:"w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"}),e.jsx("p",{className:"text-sm font-medium text-muted-foreground italic",children:"Fetching order details..."})]}):t?e.jsxs("div",{className:"flex flex-col h-full bg-white dark:bg-zinc-900 shadow-xl overflow-hidden",children:[e.jsx("div",{className:"px-6 py-6 border-b bg-white dark:bg-zinc-900 sticky top-0 z-10",children:e.jsxs("div",{className:"flex flex-col md:flex-row md:items-center justify-between gap-4",children:[e.jsxs("div",{children:[e.jsx("div",{className:"flex items-center gap-2 mb-1",children:e.jsxs("span",{className:"text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1",children:[e.jsx(I,{className:"w-3 h-3"}),"Order Identification"]})}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("h2",{className:"text-2xl font-display font-black tracking-tight text-foreground",children:t?.order_number||t?.name}),e.jsx("button",{onClick:K,className:"p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-muted-foreground",title:"Copy Order ID",children:a?e.jsx(z,{className:"w-4 h-4 text-green-500"}):e.jsx(ie,{className:"w-4 h-4"})})]})]}),e.jsxs("div",{className:`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 font-bold text-xs uppercase tracking-wider shadow-sm ${k.color}`,children:[e.jsx(Q,{className:"w-4 h-4"}),k.label]})]})}),e.jsxs("div",{className:"p-6 space-y-8 overflow-y-auto bg-slate-50/50 dark:bg-zinc-950/20",children:[e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-4",children:[e.jsxs("div",{className:"bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("div",{className:"p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",children:e.jsx(de,{className:"w-4 h-4"})}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-tighter text-muted-foreground",children:"Order Type"})]}),e.jsx("p",{className:"text-sm font-bold capitalize",children:(t.order_type||"dine_in").replace("_"," ")}),t.order_type==="dine_in"&&t.table_number!==void 0&&t.table_number!==null&&e.jsxs("p",{className:"text-xs text-muted-foreground mt-1 font-mono bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded inline-block",children:["Table No. ",t.table_number]}),t.order_type==="takeaway"&&e.jsx("p",{className:"text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/20 text-blue-600 px-1.5 py-0.5 rounded inline-block",children:"Self Pickup"}),t.order_type==="delivery"&&e.jsx("p",{className:"text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-tighter bg-orange-50 dark:bg-orange-900/20 text-orange-600 px-1.5 py-0.5 rounded inline-block",children:"Doorstep Delivery"})]}),e.jsxs("div",{className:"bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("div",{className:"p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",children:e.jsx(le,{className:"w-4 h-4"})}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-tighter text-muted-foreground",children:"Timing"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsxs("p",{className:"text-xs flex items-center justify-between",children:[e.jsx("span",{className:"text-muted-foreground",children:"Placed:"}),e.jsx("span",{className:"font-bold",children:new Date(t.creation).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})})]}),t.pickup_time&&e.jsxs("p",{className:"text-xs flex items-center justify-between",children:[e.jsx("span",{className:"text-muted-foreground",children:"Pickup:"}),e.jsx("span",{className:"font-bold",children:new Date(t.pickup_time).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})})]})]})]}),e.jsxs("div",{className:"bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx("div",{className:"p-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",children:e.jsx(oe,{className:"w-4 h-4"})}),e.jsx("span",{className:"text-[10px] font-black uppercase tracking-tighter text-muted-foreground",children:"Customer"})]}),e.jsx("p",{className:"text-sm font-bold truncate",children:t.customer_name||"Guest User"}),e.jsx("p",{className:"text-xs text-muted-foreground mt-1 font-mono tracking-tighter",children:t.customer_phone||"No phone"})]})]}),t.order_type==="delivery"&&e.jsxs("div",{className:"bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm",children:[e.jsx("div",{className:"px-4 py-3 border-b bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(L,{className:"w-4 h-4 text-primary"}),e.jsx("h3",{className:"text-xs font-black uppercase tracking-widest",children:"Delivery Management"})]})}),e.jsxs("div",{className:"p-4 space-y-4",children:[!t.delivery_id&&t.status!=="cancelled"&&e.jsxs("div",{className:"p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 space-y-4",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("span",{className:"text-sm font-bold",children:"Partner:"}),e.jsxs(re,{value:v,onValueChange:r=>U(r),children:[e.jsx(ae,{className:"w-48 h-8 text-xs",children:e.jsx(se,{})}),e.jsxs(ne,{children:[e.jsx(F,{value:"auto",children:"Borzo (Third Party)"}),e.jsx(F,{value:"manual",children:"Self / Manual Delivery"})]})]})]}),v==="manual"&&e.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t mt-4 border-zinc-200 dark:border-zinc-700",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"text-[10px] font-black uppercase text-muted-foreground",children:"Rider Name"}),e.jsx("input",{className:"flex h-8 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-xs shadow-sm",value:o.rider_name,onChange:r=>N({...o,rider_name:r.target.value}),placeholder:"Rider Name"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"text-[10px] font-black uppercase text-muted-foreground",children:"Rider Phone"}),e.jsx("input",{className:"flex h-8 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-xs shadow-sm",value:o.rider_phone,onChange:r=>N({...o,rider_phone:r.target.value}),placeholder:"Rider Phone"})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx("label",{className:"text-[10px] font-black uppercase text-muted-foreground",children:"ETA (mins)"}),e.jsx("input",{className:"flex h-8 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-xs shadow-sm",value:o.eta,onChange:r=>N({...o,eta:r.target.value}),placeholder:"e.g. 30"})]})]}),e.jsx("div",{className:"flex justify-end",children:e.jsx(w,{size:"sm",onClick:Y,disabled:T,className:"h-8 text-xs font-bold uppercase tracking-wider",children:T?"Assigning...":"Assign Delivery"})})]}),(t.delivery_id||t.delivery_partner)&&e.jsxs("div",{className:"flex flex-col gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800",children:[e.jsxs("div",{className:"flex items-start justify-between",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-xs font-black uppercase tracking-tighter text-muted-foreground mb-1",children:"Assigned Partner"}),e.jsx("p",{className:"text-sm font-bold",children:t.delivery_partner==="borzo"?"Borzo Delivery":t.delivery_partner==="manual"||t.delivery_mode==="manual"?"Manual Delivery":"Unassigned"}),t.delivery_id&&t.delivery_partner!=="manual"&&t.delivery_mode!=="manual"&&e.jsxs("p",{className:"text-[10px] font-mono mt-1 bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded inline-block",children:["ID: ",t.delivery_id," | Status: ",e.jsx("span",{className:"font-bold text-primary",children:t.delivery_status})]}),(t.delivery_partner==="manual"||t.delivery_mode==="manual")&&e.jsxs("p",{className:"text-[10px] font-bold mt-1 bg-gray-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded inline-block",children:["Status: ",e.jsx("span",{className:"text-primary",children:t.delivery_status||"Assigned"})]}),t.delivery_eta&&e.jsxs("p",{className:"text-[10px] font-bold text-muted-foreground mt-1",children:["ETA: ",t.delivery_eta]})]}),e.jsx("div",{className:"flex flex-col gap-2",children:t.delivery_status!=="cancelled"&&t.delivery_status!=="delivered"&&e.jsx(w,{size:"sm",variant:"destructive",onClick:G,disabled:S,className:"h-7 text-[10px] font-bold uppercase",children:S?"Cancelling...":"Cancel Assignment"})})]}),t.delivery_rider_name&&e.jsxs("div",{className:"flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50",children:[e.jsx("div",{className:"w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-black",children:t.delivery_rider_name.charAt(0).toUpperCase()}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black uppercase text-blue-600",children:"Active Rider"}),e.jsx("p",{className:"text-xs font-bold leading-none",children:t.delivery_rider_name}),e.jsx("p",{className:"text-[10px] font-mono text-muted-foreground mt-0.5",children:t.delivery_rider_phone})]})]}),t.delivery_partner==="borzo"&&t.delivery_tracking_url&&t.delivery_status!=="cancelled"&&e.jsx(w,{variant:"outline",size:"sm",asChild:!0,className:"h-8 text-xs font-bold uppercase w-full",children:e.jsx("a",{href:t.delivery_tracking_url,target:"_blank",rel:"noopener noreferrer",children:"Track on Borzo"})})]}),(t.delivery_latitude||t.delivery_location_pin||t.rider_latitude)&&e.jsx("div",{className:"mt-2",children:e.jsx(ue,{restaurantName:h.name,pickupLocation:h.latitude&&h.longitude?{lat:parseFloat(h.latitude),lng:parseFloat(h.longitude)}:void 0,dropLocation:t.delivery_latitude&&t.delivery_longitude?{lat:parseFloat(t.delivery_latitude),lng:parseFloat(t.delivery_longitude)}:t.delivery_location_pin&&String(t.delivery_location_pin).includes(",")?{lat:parseFloat(String(t.delivery_location_pin).split(",")[0]),lng:parseFloat(String(t.delivery_location_pin).split(",")[1])}:void 0,riderLocation:t.rider_latitude&&t.rider_longitude?{lat:parseFloat(t.rider_latitude),lng:parseFloat(t.rider_longitude)}:void 0,riderLastUpdated:t.rider_last_updated})}),e.jsxs("div",{className:"flex gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800",children:[e.jsx("div",{className:"mt-1",children:e.jsx(ce,{className:"w-4 h-4 text-muted-foreground"})}),e.jsxs("div",{className:"flex-1 space-y-1",children:[e.jsx("p",{className:"text-xs font-bold uppercase tracking-tighter text-muted-foreground",children:"Drop Location"}),e.jsx("p",{className:"text-xs font-medium leading-relaxed",children:[t.delivery_address,t.delivery_landmark,t.delivery_city,t.delivery_zip_code].filter(Boolean).join(", ")})]})]})]})]}),e.jsxs("div",{className:"bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm",children:[e.jsxs("div",{className:"px-4 py-4 border-b bg-gray-50/50 dark:bg-zinc-800/30 flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center",children:e.jsx(I,{className:"w-3.5 h-3.5 text-primary"})}),e.jsx("h3",{className:"text-xs font-black uppercase tracking-widest",children:"Order Items"})]}),e.jsxs("span",{className:"text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full text-muted-foreground",children:[t.order_items?.length||0," Products"]})]}),e.jsx("div",{className:"divide-y divide-gray-100 dark:divide-zinc-800",children:t.order_items?.map((r,p)=>{const f=W(r.customizations),P=f&&Object.keys(f).length>0;return e.jsx("div",{className:"p-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors",children:e.jsxs("div",{className:"flex items-start justify-between gap-4",children:[e.jsxs("div",{className:"flex-1 min-w-0",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"flex items-center justify-center font-mono font-black text-xs min-w-[24px] h-[24px] bg-zinc-900 text-white rounded-md shadow-inner",children:r.quantity||1}),e.jsx("span",{className:"text-base font-bold text-foreground truncate",children:r.product_name||r.product||"Unnamed Item"})]}),P&&e.jsx("div",{className:"mt-2 ml-8 space-y-1",children:Object.entries(f).map(([g,_])=>{const q=Array.isArray(_)?_:[_];return e.jsxs("div",{className:"flex items-start gap-1.5",children:[e.jsxs("span",{className:"text-[10px] uppercase font-bold text-muted-foreground/60 mt-0.5",children:[g,":"]}),e.jsx("span",{className:"text-xs font-medium text-muted-foreground leading-tight",children:q.join(", ")})]},g)})})]}),e.jsxs("div",{className:"text-right",children:[e.jsx("p",{className:"text-sm font-black text-foreground",children:i(r.total_price||r.unit_price)}),e.jsxs("p",{className:"text-[10px] text-muted-foreground font-mono mt-0.5 opacity-60",children:["@",i(r.unit_price)]})]})]})},p)})})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-8 items-start pb-4",children:[e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-700",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-3",children:[e.jsx(M,{className:"w-5 h-5 text-muted-foreground"}),e.jsx("span",{className:"text-xs font-black uppercase tracking-wider text-muted-foreground",children:"Payment Method"})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"h-10 w-10 rounded-full bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center",children:e.jsx(M,{className:"w-5 h-5 text-primary"})}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-black capitalize",children:(t.payment_method||"Unspecified").replace("_"," ")}),e.jsx("p",{className:`text-[10px] font-bold uppercase mt-0.5 ${t.payment_status==="Paid"?"text-green-500":"text-orange-500"}`,children:t.payment_status||"Pending Payment"})]})]})]}),t.coupon&&e.jsxs("div",{className:"bg-green-50 dark:bg-green-900/20 p-4 rounded-2xl border border-green-100 dark:border-green-800/50",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("span",{className:"text-[10px] font-black uppercase text-green-700 dark:text-green-400 tracking-widest",children:"Promotion Applied"}),e.jsxs("div",{className:"px-2 py-0.5 bg-green-600 text-white text-[9px] font-black rounded-full shadow-sm",children:["-",b?.discount_type==="percent"?`${b.discount_value}%`:i(b?.discount_value||0)]})]}),e.jsx("p",{className:"text-sm font-black text-green-800 dark:text-green-300",children:t.coupon}),b?.description&&e.jsx("p",{className:"text-xs text-green-600/80 dark:text-green-400/60 mt-1 italic leading-tight",children:b.description})]})]}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs("div",{className:"flex justify-between items-center text-sm px-1",children:[e.jsx("span",{className:"text-muted-foreground font-medium",children:"Sub Total"}),e.jsx("span",{className:"font-bold text-foreground",children:i(t.subtotal)})]}),t.loyalty_discount>0&&e.jsxs("div",{className:"flex justify-between items-center text-sm px-1 italic",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("div",{className:"w-1 h-3 bg-green-500 rounded-full"}),e.jsxs("span",{className:"text-green-600 font-bold",children:["Loyalty Discount (",t.loyalty_coins_redeemed," Coins)"]})]}),e.jsxs("span",{className:"font-black text-green-600",children:["-",i(t.loyalty_discount)]})]}),t.discount-(t.loyalty_discount||0)>0&&e.jsxs("div",{className:"flex justify-between items-center text-sm px-1 italic",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("div",{className:"w-1 h-3 bg-green-500 rounded-full"}),e.jsx("span",{className:"text-green-600 font-bold",children:"Coupon Savings"})]}),e.jsxs("span",{className:"font-black text-green-600",children:["-",i(t.discount-(t.loyalty_discount||0))]})]}),e.jsx("div",{className:"border-t border-slate-100 dark:border-zinc-800/50 my-2"}),t.packaging_fee>0&&e.jsxs("div",{className:"flex justify-between items-center text-sm px-1",children:[e.jsx("span",{className:"text-muted-foreground font-medium",children:"Packaging Charge"}),e.jsx("span",{className:"font-bold text-foreground",children:i(t.packaging_fee)})]}),t.delivery_fee>0&&e.jsxs("div",{className:"flex justify-between items-center text-sm px-1",children:[e.jsx("span",{className:"text-muted-foreground font-medium",children:"Delivery Charge"}),e.jsx("span",{className:"font-bold text-foreground",children:i(t.delivery_fee)})]}),t.tax>0&&e.jsxs("div",{className:"flex justify-between items-center text-sm px-1",children:[e.jsx("span",{className:"text-muted-foreground font-medium",children:"Taxes (18%)"}),e.jsx("span",{className:"font-bold text-foreground",children:i(t.tax)})]}),e.jsxs("div",{className:"mt-4 pt-4 border-t-2 border-slate-100 dark:border-zinc-800 flex justify-between items-end px-1",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1",children:"Total Amount Payable"}),e.jsx("span",{className:"text-[10px] text-muted-foreground font-medium italic",children:"Incl. all taxes and fees"})]}),e.jsx("div",{className:"text-right",children:e.jsx("h4",{className:"text-3xl font-display font-black text-foreground tracking-tighter leading-none",children:D(t.total)})})]}),t.coins_earned>0&&e.jsxs("div",{className:"mt-6 pt-4 border-t border-dashed border-slate-200 dark:border-zinc-800 flex justify-between items-center px-1",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black uppercase text-orange-600 tracking-widest mb-0.5",children:"Loyalty Points Earning"}),e.jsx("p",{className:"text-[10px] text-muted-foreground font-bold italic",children:"Order Earning"})]}),e.jsxs("div",{className:"text-right",children:[e.jsxs("span",{className:"text-lg font-black text-orange-600",children:["+",t.coins_earned]}),e.jsx("span",{className:"text-[10px] font-bold text-orange-600/70 ml-1 uppercase",children:"Coins"})]})]})]})]})]}),e.jsxs("div",{className:"p-4 border-t bg-white dark:bg-zinc-900 flex justify-end gap-3 sticky bottom-0",children:[e.jsx("button",{onClick:()=>m(!1),className:"px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 dark:bg-zinc-800 text-foreground hover:bg-gray-200 dark:hover:bg-zinc-700 transition-all border-b-4 border-gray-200 dark:border-zinc-700 active:border-b-0 active:translate-y-1",children:"Close Window"}),e.jsx("button",{onClick:()=>n(t,{type:"KOT"}),className:"px-6 py-2.5 rounded-xl font-black text-[10px] uppercase bg-purple-100 text-purple-700 hover:bg-purple-200 border-b-4 border-purple-200 active:border-b-0 active:translate-y-1",children:"Print KOT"}),e.jsx("button",{onClick:()=>n(t,{type:"RECEIPT",restaurant:l?.restaurant}),className:"px-6 py-2.5 rounded-xl font-black text-[10px] uppercase bg-zinc-900 text-white hover:bg-black border-b-4 border-zinc-950 active:border-b-0 active:translate-y-1",children:"Print Receipt"})]})]}):e.jsxs("div",{className:"text-center py-20 px-6 space-y-4",children:[e.jsx("div",{className:"w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto",children:e.jsx(C,{className:"w-8 h-8 text-red-500"})}),e.jsxs("div",{children:[e.jsx("h3",{className:"text-xl font-black text-foreground",children:"Order Not Found"}),e.jsx("p",{className:"text-sm text-muted-foreground mt-2 max-w-sm mx-auto",children:"We couldn't retrieve the details for this order. It may have been deleted or the ID is incorrect."})]}),e.jsx("button",{onClick:()=>m(!1),className:"px-8 py-3 bg-primary text-white font-black rounded-xl",children:"Go Back"})]})})})}export{Ne as O,be as u};
