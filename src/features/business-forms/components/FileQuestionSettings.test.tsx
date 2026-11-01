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

// The source cards say only where the photo comes from, and the meaning of the minimum (with the document types) is the (i)
// next to «Cuántas fotos» or «Cuántos documentos», not a note under the controls (2026-10-31).
it.each([
  ["photo", "Cuántas fotos", "Con mínimo 1, la pregunta es obligatoria. Con 0, es opcional."],
  ["document", "Cuántos documentos", "PDF, Excel, Word o imágenes JPEG y PNG. Sin CSV. Con mínimo 1, la pregunta es obligatoria. Con 0, es opcional."],
] as const)("explains the %s counts in the (i) of their heading", async (type, heading, help) => {
  const question = newQuestion(type, "es", "test");
  if (question.type !== "photo" && question.type !== "document") throw new Error("Expected a file question");
  renderWithProviders(<FileQuestionSettings question={question} readOnly={false} onChange={vi.fn()}/>);
  expect(screen.getByText(heading)).toBeInTheDocument();
  for (const note of ["Con mínimo 1, la pregunta es obligatoria. Con 0, es opcional.", "PDF, Excel, Word o imágenes JPEG y PNG. Sin CSV.", "Puede sacarla en el momento o elegir una que ya tiene.", "La saca en el momento: sirve como evidencia de la visita."])
    expect(screen.queryByText(note, { ignore: "script, style, [hidden]" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Más información sobre " + heading })).toHaveAccessibleDescription(help);
  if (type === "photo") for (const name of [/Cámara o galería/, /Solo cámara/]) expect(screen.getByRole("radio", { name })).not.toHaveAccessibleDescription();
});
