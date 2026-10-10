import {describe,expect,it} from "vitest";
import {http,HttpResponse} from "msw";
import {server} from "@/test/mocks/server";
import {readFormPreview} from "./response";
import {fetchFormPreview} from "./forms";
const id="01990000-0000-7000-8000-000000000001",version="01990000-0000-7000-8000-000000000002";
describe("Official form preview",()=>{
 it("requests the selected content culture explicitly and bypasses HTTP cache",async()=>{let parameters='';let cache='';server.use(http.get('/api/forms/definitions/:id/versions/:version/preview',({request})=>{parameters=new URL(request.url).search;cache=request.cache;return HttpResponse.json({url:'https://www.facebook.com/whatsapp/flows/preview/test',expiresAtUtc:'2099-10-10T12:00:00Z'});}));await fetchFormPreview(id,version,'en');expect(parameters).toBe('?culture=en');expect(cache).toBe('no-store');});
 it("rejects an expired URL before it can be embedded",()=>{expect(()=>readFormPreview({url:'https://www.facebook.com/whatsapp/flows/preview/expired',expiresAtUtc:'2026-10-10T12:00:00Z'},Date.parse('2026-10-10T12:00:00Z'))).toThrow();});
 it.each(['javascript:alert(1)','data:text/html,bad','http://example.com/preview','https://user:password@example.com/preview'])("rejects unsafe preview URL %s",url=>{expect(()=>readFormPreview({url,expiresAtUtc:'2099-10-10T12:00:00Z'})).toThrow('Unsupported form response.');});
 it("rejects extra transport secrets without retaining the body in its error",()=>{expect(()=>readFormPreview({url:'https://www.facebook.com/whatsapp/flows/preview/test',expiresAtUtc:'2099-10-10T12:00:00Z',flowToken:'private-token'})).toThrow('Unsupported form response.');});
});
