import {describe,expect,it} from "vitest";
import {fixtureDefinition,wireDefinition,fixtureFormId} from "@/test/visual/formFixtures";
import {readFormDetail,readFormPage,publicationPath} from "./response";
const versionId="01990000-0000-7000-8000-000000000090",requestId="01990000-0000-7000-8000-000000000091";
const audit={createdAtUtc:"2026-10-10T12:00:00Z",modifiedAtUtc:null,lastChangedAtUtc:"2026-10-10T12:00:00Z",lastChangedBy:null};
const operation={versionId,versionNumber:2,draftRevision:3,state:"Publishing",stage:"Publishing",requiresReview:false,canRetry:false,requestId,recoveryPath:publicationPath(fixtureFormId,requestId)};
const publication={activeVersion:{versionId:"01990000-0000-7000-8000-000000000089",versionNumber:1,draftRevision:1},currentOperation:operation,displayState:"Publishing"};
const detail={definition:wireDefinition(fixtureDefinition()),audit,capabilities:{canSave:true,canPublish:true,canPreview:true},publication};
describe("Publication read projections",()=>{
 it("reads the extended real detail while retaining the bilingual draft and previous active version",()=>{const read=readFormDetail(detail);expect(read.definition.name).toEqual({es:"Registrar visita",en:"Register visit"});expect(read.publication).toEqual(publication);expect(read.capabilities).toEqual(detail.capabilities);});
 it("accepts an aggregate operation without another operator recovery identity",()=>{const read=readFormDetail({...detail,capabilities:{canSave:false,canPublish:false,canPreview:true},publication:{...publication,currentOperation:{...operation,requestId:null,recoveryPath:null}}});expect(read.publication.currentOperation?.requestId).toBeNull();});
 it("rejects a recovery path or request identity that escapes the authorized projection",()=>{expect(()=>readFormDetail({...detail,publication:{...publication,currentOperation:{...operation,recoveryPath:'/api/other'}}})).toThrow('Unsupported form response.');expect(()=>readFormDetail({...detail,capabilities:{...detail.capabilities,canPublish:false}})).toThrow('Unsupported form response.');});
 it.each(["Accepted","Preparing","Publishing","Uncertain","ActivationPending","Failed","Published"])("preserves %s and its active version in the list",state=>{const page=readFormPage({items:[{id:fixtureFormId,name:{es:'Visita',en:'Visit'},prefix:'VIS',questionCount:6,activeVersionNumber:1,displayState:state,lastChangedAtUtc:audit.lastChangedAtUtc,lastChangedBy:null,canEdit:true}],page:1,pageSize:20,totalCount:1,totalPages:1,hasPrevious:false,hasNext:false});expect(page.items[0]).toMatchObject({displayState:state,activeVersionNumber:1});});
});
