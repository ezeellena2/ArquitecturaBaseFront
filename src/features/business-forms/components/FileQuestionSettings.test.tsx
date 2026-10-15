import {useState} from "react";
import {fireEvent,screen} from "@testing-library/react";
import {expect,it} from "vitest";
import {renderWithProviders} from "@/test/utils/renderWithProviders";
import {newQuestion} from "../editorModel";
import type {DraftQuestion} from "../model";
import {FileQuestionSettings} from "./FileQuestionSettings";
function Editor(){
 const [question,setQuestion]=useState<DraftQuestion>(newQuestion("photo","es","test"));
 return question.type==="photo"?<FileQuestionSettings question={question} readOnly={false} onChange={setQuestion}/>:null;
}
it("preserves an empty count instead of turning it into zero",()=>{
 renderWithProviders(<Editor/>);
 const minimum=screen.getByRole("spinbutton",{name:"Mínimo"});
 fireEvent.change(minimum,{target:{value:""}});
 expect(minimum).toHaveValue(null);
 expect(minimum).toHaveAttribute("aria-invalid","true");
});
it.each(["-1","2.5","11"])("marks an invalid maximum %s and keeps the group invalid",value=>{
 renderWithProviders(<Editor/>);
 const maximum=screen.getByRole("spinbutton",{name:"Máximo"});
 fireEvent.change(maximum,{target:{value}});
 expect(maximum).toHaveAttribute("aria-invalid","true");
});
it("marks both controls when the backend reports a group error",()=>{
 const question=newQuestion("photo","es","test");if(question.type!=="photo")throw new Error("Expected photo");
 renderWithProviders(<FileQuestionSettings question={question} readOnly={false} error="Revisá las cantidades" onChange={()=>undefined}/>);
 expect(screen.getByRole("spinbutton",{name:"Máximo"})).toHaveAttribute("aria-invalid","true");
});
