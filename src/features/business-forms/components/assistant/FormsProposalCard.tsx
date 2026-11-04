import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import type { AssistantProposalCardProps } from "@/shared/hooks/assistantProposalContext";
import { AssistantProposalCard } from "@/shared/ui/assistant/AssistantProposalCard";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { formProposalPreview, newQuestions, readProposal, type FormProposal, type ProposedQuestion, type ReadProposal } from "../../assistantProposal";
import { useAssistantProposalCreation } from "../../hooks/useAssistantProposalCreation";
import { FormPreview } from "../FormPreview";

/** The card of a proposal of this module under the answer that brought it (IA1-A). App lends it to Home by the extension point. */
export function FormsProposalCard(props: AssistantProposalCardProps) {
  const read = readProposal(props.proposal);
  if (!read) return null;
  return read.kind === "form" ? <FormCard {...props} content={read.content} /> : <CatalogCard {...props} read={read} />;
}

const questionType = (type: ProposedQuestion["type"]) => type === "number" ? "decimal" : type === "yesNo" ? "boolean" : type === "catalog" ? "catalogChoice" : type;

function FormCard({ requestId, proposal, previous, replaced, content }: AssistantProposalCardProps & { content: FormProposal }) {
  const { t } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const creation = useAssistantProposalCreation("draft", requestId, proposal.id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const kind = t("assistantProposals.form.kind");
  if (creation.created)
    return <AssistantProposalCard kind={kind} title={content.name} folded={{ state: t("assistantProposals.form.created"),
      action: <Button asChild size="sm" variant="link"><Link to={creation.created}>{t("assistantProposals.form.open")}</Link></Button> }} />;
  if (replaced) return <AssistantProposalCard kind={kind} title={content.name} folded={{ state: t("assistantProposals.replaced") }} />;
  const create = user?.permissions.includes("formtemplates.manage")
    ? <Button size="sm" pending={creation.creating} onClick={() => void creation.create()}>{t(creation.creating ? "assistantProposals.form.creating" : "assistantProposals.form.create")}</Button>
    : null;
  const fresh = newQuestions(content, previous);
  return (
    <>
      <AssistantProposalCard kind={kind} title={content.name} summary={t("assistantProposals.form.summary", { prefix: content.prefix, count: content.questions.length })}
        actions={<><Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>{t("assistantProposals.form.preview")}</Button>{create}</>}>
        {creation.problem ? <p role="alert" className="text-sm text-[var(--color-danger-700)]">{creation.problem}</p> : null}
        <ol className="flex flex-col gap-2">
          {content.questions.map((question, index) => <QuestionLine key={index} number={index + 1} question={question} isNew={fresh.has(index)} />)}
        </ol>
      </AssistantProposalCard>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent mobileFullscreen aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{t("assistantProposals.form.previewTitle", { name: content.name })}</DialogTitle></DialogHeader>
          {previewOpen ? <FormPreview value={formProposalPreview(content)} culture={content.culture} /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>{t("common:actions.close")}</Button>
            {create ? <Button pending={creation.creating} onClick={() => void creation.create()}>{t(creation.creating ? "assistantProposals.form.creating" : "assistantProposals.form.create")}</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function QuestionLine({ number, question, isNew }: { number: number; question: ProposedQuestion; isNew: boolean }) {
  const { t } = useTranslation("forms");
  const detail = question.type === "catalog" && question.catalog ? t("assistantProposals.form.catalogExists", { name: question.catalog.name })
    : question.options.length ? question.options.join(", ") : null;
  return (
    <li className="min-w-0">
      <p className="break-words [overflow-wrap:anywhere]">
        <span className="text-[var(--color-content-muted)]">{number}.</span> {question.label}
        {isNew ? <> <Badge variant="success">{t("assistantProposals.form.new")}</Badge></> : null}
      </p>
      <p className="break-words text-sm text-[var(--color-content-muted)] [overflow-wrap:anywhere]">
        {[t("types." + questionType(question.type)), detail, question.required ? t("assistantProposals.form.required") : null].filter(Boolean).join(" · ")}
      </p>
    </li>
  );
}

function CatalogCard({ requestId, proposal, replaced, read }: AssistantProposalCardProps & { read: Exclude<ReadProposal, { kind: "form" }> }) {
  const { t } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const creation = useAssistantProposalCreation("catalog", requestId, proposal.id);
  const kind = t("assistantProposals.catalog.kind");
  const title = read.content.name;
  if (creation.created)
    return <AssistantProposalCard kind={kind} title={title} folded={{ state: t("assistantProposals.catalog.created"),
      action: <Button asChild size="sm" variant="link"><Link to={creation.created}>{t("assistantProposals.catalog.open")}</Link></Button> }} />;
  if (replaced) return <AssistantProposalCard kind={kind} title={title} folded={{ state: t("assistantProposals.replaced") }} />;
  const summary = read.kind === "people" ? t("assistantProposals.catalog.people")
    : t("assistantProposals.catalog.summary", { type: t("catalogs.valueTypes." + read.content.valueType[0].toUpperCase() + read.content.valueType.slice(1)), count: read.content.fields.length });
  return (
    <AssistantProposalCard kind={kind} title={title} summary={summary}
      actions={user?.permissions.includes("formcatalogs.manage")
        ? <Button size="sm" pending={creation.creating} onClick={() => void creation.create()}>{t(creation.creating ? "assistantProposals.catalog.creating" : "assistantProposals.catalog.create")}</Button>
        : undefined}>
      {creation.problem ? <p role="alert" className="text-sm text-[var(--color-danger-700)]">{creation.problem}</p> : null}
      {read.content.description ? <p className="break-words text-sm [overflow-wrap:anywhere]">{read.content.description}</p> : null}
      {read.kind === "catalog" ? (
        <ul className="flex flex-col gap-1 text-sm">
          <li className="break-words [overflow-wrap:anywhere]">{t("assistantProposals.catalog.code")} · {read.content.code}</li>
          <li className="break-words [overflow-wrap:anywhere]">{t("assistantProposals.catalog.option")} · {read.content.option}</li>
          {read.content.fields.map((field, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{field.name} · {t("catalogs.fields.types." + field.type)}</li>)}
        </ul>
      ) : read.content.limitations.map((limitation, index) =>
        <p key={index} className="break-words text-sm text-[var(--color-warning-700)]">{t("catalogs.proposal.unsupportedColumn", { criterion: limitation.criterion })}</p>)}
    </AssistantProposalCard>
  );
}
