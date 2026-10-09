import { answerFor, exampleMessages, labels } from './copy';

const timestamp='2026-10-04T13:24:00Z';
function item(message:{id:string;role:string;content:string},threadId:string) {
  return {id:message.id,thread_id:threadId,created_at:timestamp,type:message.role==='user'?'user_message':'assistant_message',
    content:[{type:message.role==='user'?'input_text':'output_text',text:message.content,...(message.role==='assistant'?{annotations:[]}: {})}],
    ...(message.role==='user'?{attachments:[],quoted_text:null,inference_options:{}}:{})};
}
export function createChatkitMock(answer:boolean):typeof fetch {
  let id='demo-thread';
  let items=answer?exampleMessages.map(message=>item(message,id)):[];
  const metadata=()=>({id,title:labels.users,created_at:timestamp,status:{type:'active'},metadata:{},allowed_image_domains:[]});
  const page=()=>({data:items,has_more:false,after:null});
  const thread=()=>({...metadata(),items:page()});
  return async (_input,init)=>{
    const body=JSON.parse(String(init?.body ?? '{}')) as {type:string;params?:{input?:{content?:{text?:string}[]};thread_id?:string;title?:string}};
    if(body.type==='threads.list') return Response.json({data:items.length?[metadata()]:[],has_more:false,after:null});
    if(body.type==='threads.get_by_id') return Response.json(thread());
    if(body.type==='items.list') return Response.json(page());
    if(body.type==='threads.delete') { items=[]; return Response.json({}); }
    if(body.type==='threads.update') return Response.json(metadata());
    if(body.type==='threads.create'||body.type==='threads.add_user_message') {
      const fresh=body.type==='threads.create';
      if(fresh){id=`demo-${crypto.randomUUID()}`;items=[];}
      const text=body.params?.input?.content?.map(part=>part.text??'').join('')??labels.users;
      const user=item({id:`user-${crypto.randomUUID()}`,role:'user',content:text},id);
      const assistant=item({id:`assistant-${crypto.randomUUID()}`,role:'assistant',content:answerFor(text)},id);
      const events=[...(fresh?[{type:'thread.created',thread:thread()}]:[]),{type:'stream_options',stream_options:{allow_cancel:true}},
        {type:'thread.item.done',item:user},{type:'thread.item.added',item:{...assistant,content:[]}}, {type:'thread.item.done',item:assistant}];
      const encoder=new TextEncoder();
      const stream=new ReadableStream({async start(controller){
        for(const event of events){ if(init?.signal?.aborted) break; controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); await new Promise(resolve=>setTimeout(resolve,180)); }
        items.push(user,assistant);controller.close();
      }});
      return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
    }
    throw new Error(`Unsupported mock request: ${body.type}`);
  };
}
