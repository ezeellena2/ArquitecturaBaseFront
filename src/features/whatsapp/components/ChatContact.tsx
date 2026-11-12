import { useTranslation } from "react-i18next";
import { CellText } from "@/shared/ui/CellText";
import { UserIcon } from "@/shared/ui/icons";
import type { SharedContact } from "../api/chat";

/// W3 (UC3 and UC4): a contact the person shared is its first card, like a location of W1-A: the person icon, the name in bold and
/// the phones below, one per line, each group whole (`CellText`): one that does not fit breaks only at its spaces. One without a name
/// is «Contacto», as a photo without a file name is «Foto»; one without a phone, its name alone. It is a message of the chat whether
/// or not it completed a form.
export function ChatContact({ contact }: { contact: SharedContact }) {
  const { t } = useTranslation("whatsapp");
  return (
    <section className="flex min-w-0 items-start gap-2" aria-label={contact.name === null ? t("contact.label") : t("contact.name", { name: contact.name })}>
      <UserIcon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">{contact.name ?? t("contact.label")}</p>
        {contact.phones.map((phone, index) => <p key={index} className="tabular-nums"><CellText text={phone} /></p>)}
      </div>
    </section>
  );
}
