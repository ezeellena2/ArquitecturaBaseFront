import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Surface } from "@/shared/ui/Surface";
import { AssistantAttach, AssistantFile } from "@/shared/ui/assistant/AssistantAttachment";

// IA4 (Stage 2): the clip, the file chosen in the composer with its X, the same while it travels, and the file of a message with
// its rows, in the user's bubble.
export function CatalogAssistantAttachment() {
  const { i18n } = useTranslation();
  const english = i18n.language === "en";
  const input = useRef<HTMLInputElement>(null);
  const text = english
    ? { title: "Attach", attach: "Attach a spreadsheet", name: "contractors.xlsx", chosen: "Excel · 24 KB", remove: "Remove contractors.xlsx",
      message: "Excel · 86 rows · 24 KB", question: "Make me a catalog with this spreadsheet" }
    : { title: "Adjuntar", attach: "Adjuntar una planilla", name: "contratistas.xlsx", chosen: "Excel · 24 KB", remove: "Quitar contratistas.xlsx",
      message: "Excel · 86 filas · 24 KB", question: "Armame un catálogo con esta planilla" };
  return (
    <Surface title={text.title} padded>
      <div className="flex max-w-[42rem] flex-col gap-4">
        <div className="assistant-composer-actions justify-start">
          <AssistantAttach label={text.attach} accept=".xlsx,.csv" inputRef={input} onChoose={() => {}} />
        </div>
        <AssistantFile name={text.name} description={text.chosen} removeLabel={text.remove} onRemove={() => {}} />
        <AssistantFile name={text.name} description={text.chosen} removeLabel={text.remove} onRemove={() => {}} disabled />
        <div className="assistant-user-bubble self-end max-w-[90%]">
          <p>{text.question}</p>
          <AssistantFile name={text.name} description={text.message} />
        </div>
      </div>
    </Surface>
  );
}
