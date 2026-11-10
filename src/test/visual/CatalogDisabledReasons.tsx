import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronDownIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { Surface } from "@/shared/ui/Surface";

// MA1-A (2026-11-09): what is off says why on the same control, with the mouse, the focus, a click or a touch, and
// nothing goes next to it. The pieces of the board: a box off in a block, a button off while a publication runs, an
// icon button at the first place, a field and an (i), with the texts of the app.
export function CatalogDisabledReasons() {
  const { t, i18n } = useTranslation();
  const text = i18n.language === "en"
    ? {
      title: "Reason for what is off", multiple: "Allow choosing several", multipleReason: "A block picks a single option.",
      publish: "Publish on WhatsApp", publishReason: "A publication is in progress.", up: "Move Quantity up",
      upReason: "Quantity: position 1 of 3", maximum: "Maximum", maximumHelp: "WhatsApp loads up to 10 items.",
      sample: "As if received by", sampleReason: "Save the form to try it with a person.",
    }
    : {
      title: "Motivo de lo apagado", multiple: "Permitir elegir varias", multipleReason: "En un bloque se elige una sola opción.",
      publish: "Publicar en WhatsApp", publishReason: "Hay una publicación en curso.", up: "Subir Cantidad",
      upReason: "Cantidad: posición 1 de 3", maximum: "Máximo", maximumHelp: "En WhatsApp se cargan hasta 10 ítems.",
      sample: "Como si lo recibiera", sampleReason: "Guardá el formulario para probar con una persona.",
    };
  return (
    <Surface title={text.title} padded>
      <div className="flex max-w-xl flex-col gap-4">
        <CheckboxField label={text.multiple} checked={false} disabled disabledReason={text.multipleReason} onCheckedChange={() => {}} />
        <div className="flex flex-wrap items-center gap-3">
          <DisabledReason reason={text.publishReason}><Button disabled>{text.publish}</Button></DisabledReason>
          <IconButton size="icon-sm" label={text.up} disabledLabel={text.upReason} disabled><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
          <span className="inline-flex items-center gap-1 text-sm">
            {text.maximum}
            <InfoTip label={t("actions.moreInfo", { label: text.maximum })} text={text.maximumHelp} />
          </span>
        </div>
        <FormField label={text.sample}>
          <DisabledReason reason={text.sampleReason} className="grid w-full"><Input disabled /></DisabledReason>
        </FormField>
      </div>
    </Surface>
  );
}
