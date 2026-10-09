let scriptPromise:Promise<void>|undefined;
export function loadChatkit(){
  return scriptPromise ??= new Promise((resolve,reject)=>{
    if(customElements.get('openai-chatkit')) return resolve();
    const script=document.createElement('script');script.src='https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('ChatKit CDN could not be loaded'));document.head.append(script);
  });
}
