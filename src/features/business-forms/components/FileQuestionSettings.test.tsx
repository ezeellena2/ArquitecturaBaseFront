import {useState} from "react";
import {act,fireEvent,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {renderWithProviders} from "@/test/utils/renderWithProviders";
import {newQuestion} from "../editorModel";
import type {DraftQuestion} from "../model";
import {FileQuestionSettings} from "./FileQuestionSettings";
function Editor(){
 const [question,setQuestion]=useState<DraftQuestion>(newQuestion("photo","es","test"));
 return question.type==="photo"?<FileQuestionSettings question={question} readOnly={false} onChange={setQuestion}/>:null;
}
it("preserves an empty count instead of turning it into zero",async()=>{
 await act(async()=>{renderWithProviders(<Editor/>);});
 const minimum=screen.getByRole("spinbutton",{name:"Mínimo"});
 fireEvent.change(minimum,{target:{value:""}});
 expect(minimum).toHaveValue(null);
 expect(minimum).toHaveAttribute("aria-invalid","true");
});
it.each(["-1","2.5","11"])("marks an invalid maximum %s and keeps the group invalid",async value=>{
 await act(async()=>{renderWithProviders(<Editor/>);});
 const maximum=screen.getByRole("spinbutton",{name:"Máximo"});
 fireEvent.change(maximum,{target:{value}});
 expect(maximum).toHaveAttribute("aria-invalid","true");
});
it("marks both controls when the backend reports a group error",async()=>{
 const question=newQuestion("photo","es","test");if(question.type!=="photo")throw new Error("Expected photo");
 await act(async()=>{renderWithProviders(<FileQuestionSettings question={question} readOnly={false} error="Revisá las cantidades" onChange={()=>undefined}/>);});
 expect(screen.getByRole("spinbutton",{name:"Máximo"})).toHaveAttribute("aria-invalid","true");
});


it.each(["photo", "document"] as const)("keeps the %s settings and derives required only from the minimum", async type => {
  const question = newQuestion(type, "es", "test");
  if (question.type !== "photo" && question.type !== "document") throw new Error("Expected a file question");
  const change = vi.fn();
  const view = renderWithProviders(<FileQuestionSettings question={question} readOnly={false} onChange={change}/>);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Mínimo" }), { target: { value: "2" } });
  const updated = change.mock.calls[0]?.[0] as DraftQuestion | undefined;
  expect(updated).toEqual({ ...question, required: true, files: { ...question.files, minFiles: 2 } });
  if (!updated || updated.type !== "photo" && updated.type !== "document") throw new Error("Expected a file question");
  view.rerender(<FileQuestionSettings question={updated} readOnly={false} onChange={change}/>);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Máximo" }), { target: { value: "5" } });
  expect(change).toHaveBeenLastCalledWith({ ...updated, files: { ...updated.files, maxFiles: 5 } });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Mínimo" }), { target: { value: "0" } });
  expect(change).toHaveBeenLastCalledWith({ ...updated, required: false, files: { ...updated.files, minFiles: 0 } });
});
