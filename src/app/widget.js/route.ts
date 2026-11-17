// Embeddable script: <script src="https://YOUR-APP/widget.js" data-salon="your-slug" async></script>
// Adds a floating "Book now" button that opens the assistant in an iframe.
import { appUrl } from "@/lib/agent/vapi";


export function GET() {
  const base = appUrl();
  const js = `(function(){
  var s=document.currentScript||document.querySelector('script[data-salon]');
  if(!s||window.__shanayaWidget)return;window.__shanayaWidget=1;
  var slug=s.getAttribute('data-salon');var color=s.getAttribute('data-color')||'#2a2220';
  var btn=document.createElement('button');
  btn.setAttribute('aria-label','Book an appointment');
  btn.textContent='✦ Book now';
  btn.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483646;border:0;border-radius:999px;padding:14px 22px;background:'+color+';color:#faf7f2;font:600 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:pointer';
  var frame=null;
  btn.onclick=function(){
    if(!frame){frame=document.createElement('iframe');frame.src='${base}/w/'+encodeURIComponent(slug);
      frame.allow='microphone';frame.title='Booking assistant';
      frame.style.cssText='position:fixed;right:20px;bottom:84px;z-index:2147483647;width:min(380px,calc(100vw - 40px));height:min(600px,calc(100vh - 120px));border:0;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.25);background:#faf7f2';
      document.body.appendChild(frame);btn.textContent='✕ Close';return;}
    var hidden=frame.style.display==='none';frame.style.display=hidden?'block':'none';btn.textContent=hidden?'✕ Close':'✦ Book now';
  };
  document.body.appendChild(btn);
})();`;
  return new Response(js, {
    headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
