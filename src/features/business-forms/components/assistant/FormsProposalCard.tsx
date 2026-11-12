import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import type { AssistantProposalCardProps } from "@/shared/hooks/assistantProposalContext";
import { AssistantProposalCard } from "@/shared/ui/assistant/AssistantProposalCard";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { assistantImportState } from "../../assistantImport";
import {
  formProposalPreview, newQuestions, readProposal,
  type FormProposal, type ImportProposal, type ProposalSpreadsheet, type ProposedQuestion, type ReadProposal,
} from "../../assistantProposal";
import { useAssistantProposalCreation } from "../../hooks/useAssistantProposalCreation";
import { FormPreview } from "../FormPreview";

/** The card of a proposal of this module under the answer that brought it (IA1-A). App lends it to Home by the extension point. */
export function FormsProposalCard(props: AssistantProposalCardProps) {
  const read = readProposal(props.proposal);
  if (!read) return null;
  if (read.kind === "form") return <FormCard {...props} content={read.content} />;
  if (read.kind === "import") return <ImportCard {...props} content={read.content} />;
  return <CatalogCard {...props} read={read} />;
}

const questionType = (type: ProposedQuestion["type"]) => type === "number" ? "decimal" : type === "yesNo" ? "boolean" : type === "catalog" ? "catalogChoice" : type;
const valueTypeName = (t: TFunction<"forms">, valueType: string) => t("catalogs.valueTypes." + valueType[0].toUpperCase() + valueType.slice(1));

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
  // A form proposed with a document says it reads them when the proposal turns the reading on (Etapa 3 de la IA).
  const summary = [t("assistantProposals.form.summary", { prefix: content.prefix, count: content.questions.length }),
    ...(content.documentReading ? [t("assistantProposals.form.readsDocuments")] : [])].join(" · ");
  return (
    <>
      <AssistantProposalCard kind={kind} title={content.name} summary={summary}
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

function CatalogCard({ requestId, proposal, replaced, read }: AssistantProposalCardProps & { read: Extract<ReadProposal, { kind: "catalog" | "people" }> }) {
  const { t } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const sheet = read.kind === "catalog" ? read.content.spreadsheet : null;
  // A catalog that maps the spreadsheet opens with its import ready to review (IA2).
  const creation = useAssistantProposalCreation("catalog", requestId, proposal.id, sheet && { fileName: sheet.fileName, rowCount: sheet.rowCount });
  const kind = t("assistantProposals.catalog.kind");
  const title = read.content.name;
  if (creation.created)
    return <AssistantProposalCard kind={kind} title={title} folded={{ state: t("assistantProposals.catalog.created"),
      action: <Button asChild size="sm" variant="link"><Link to={creation.created}>{t("assistantProposals.catalog.open")}</Link></Button> }} />;
  if (replaced) return <AssistantProposalCard kind={kind} title={title} folded={{ state: t("assistantProposals.replaced") }} />;
  const summary = read.kind === "people" ? t("assistantProposals.catalog.people")
    : [t("assistantProposals.catalog.summary", { type: valueTypeName(t, read.content.valueType), count: read.content.fields.length }),
      ...(sheet ? [t("assistantProposals.spreadsheet.rows", { count: sheet.rowCount })] : [])].join(" · ");
  return (
    <AssistantProposalCard kind={kind} title={title} summary={summary}
      actions={user?.permissions.includes("formcatalogs.manage")
        ? <Button size="sm" pending={creation.creating} onClick={() => void creation.create()}>{t(creation.creating ? "assistantProposals.catalog.creating" : "assistantProposals.catalog.create")}</Button>
        : undefined}>
      {creation.problem ? <p role="alert" className="text-sm text-[var(--color-danger-700)]">{creation.problem}</p> : null}
      {read.content.description ? <p className="break-words text-sm [overflow-wrap:anywhere]">{read.content.description}</p> : null}
      {read.kind === "catalog" ? (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            <MappingLine parts={[t("assistantProposals.catalog.code"), read.content.code]} letter={letterOf(sheet, "code")} />
            <MappingLine parts={[t("assistantProposals.catalog.option"), read.content.option]} letter={letterOf(sheet, "option")} />
            {sheet?.columns.filter(column => column.target === "value" || column.target === "detail").map(column =>
              <MappingLine key={column.target} parts={[columnName(t, column)]} letter={column.letter} />)}
            {read.content.fields.map((field, index) =>
              <MappingLine key={index} parts={[field.name, t("catalogs.fields.types." + field.type)]} letter={letterOf(sheet, "field", field.name)} />)}
          </ul>
          {sheet ? <SpreadsheetSample sheet={sheet} numeric={column => column.target === "value" ? numericType(read.content.valueType)
            : column.target === "field" && numericType(read.content.fields.find(field => field.name === column.field)?.type)} /> : null}
        </>
      ) : read.content.limitations.map((limitation, index) =>
        <p key={index} className="break-words text-sm text-[var(--color-warning-700)]">{t("catalogs.proposal.unsupportedColumn", { criterion: limitation.criterion })}</p>)}
    </AssistantProposalCard>
  );
}

// Importing the spreadsheet into a catalog that exists (IA4): nothing is created here; its button opens that catalog's import.
function ImportCard({ requestId, proposal, replaced, content }: AssistantProposalCardProps & { content: ImportProposal }) {
  const { t } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const kind = t("assistantProposals.import.kind");
  const { catalog, spreadsheet: sheet } = content;
  if (replaced) return <AssistantProposalCard kind={kind} title={catalog.name} folded={{ state: t("assistantProposals.replaced") }} />;
  return (
    <AssistantProposalCard kind={kind} title={catalog.name}
      summary={[valueTypeName(t, catalog.valueType), t("assistantProposals.spreadsheet.rows", { count: sheet.rowCount })].join(" · ")}
      actions={user?.permissions.includes("formcatalogs.manage")
        ? <Button size="sm" onClick={() => void navigate("/catalogos/" + catalog.id, { state: assistantImportState({ requestId, proposalId: proposal.id, fileName: sheet.fileName, rowCount: sheet.rowCount }) })}>
            {t("assistantProposals.import.review")}
          </Button>
        : undefined}>
      <ul className="flex flex-col gap-1 text-sm">
        {sheet.columns.map((column, index) => <MappingLine key={index} parts={[columnName(t, column)]} letter={column.letter} />)}
      </ul>
      <SpreadsheetSample sheet={sheet} numeric={column => column.target === "value" && numericType(catalog.valueType)} />
    </AssistantProposalCard>
  );
}

type SpreadsheetColumn = ProposalSpreadsheet["columns"][number];
const numericType = (type: string | undefined) => type === "integer" || type === "decimal";
const letterOf = (sheet: ProposalSpreadsheet | null, target: SpreadsheetColumn["target"], field?: string) =>
  sheet?.columns.find(column => column.target === target && (field === undefined || column.field === field))?.letter ?? null;
const columnName = (t: TFunction<"forms">, column: SpreadsheetColumn) =>
  column.target === "code" ? t("assistantProposals.catalog.code") : column.target === "option" ? t("assistantProposals.catalog.option")
    : column.target === "value" ? t("catalogs.import.columns.value") : column.target === "detail" ? t("catalogs.import.columns.detail") : column.field ?? "";

// «CUIT · columna A»: what fills the catalog and the spreadsheet's column it comes from, when there is a spreadsheet.
function MappingLine({ parts, letter }: { parts: readonly string[]; letter: string | null }) {
  const { t } = useTranslation("forms");
  return <li className="break-words [overflow-wrap:anywhere]">{[...parts, ...(letter ? [t("assistantProposals.spreadsheet.column", { letter })] : [])].join(" · ")}</li>;
}

// Three rows of the spreadsheet as the catalog orders its columns, with how many more it brings. A simple list takes the code and
// the option from one column, shown once.
function SpreadsheetSample({ sheet, numeric }: { sheet: ProposalSpreadsheet; numeric: (column: SpreadsheetColumn) => boolean }) {
  const { t } = useTranslation("forms");
  const shown = sheet.columns.flatMap((column, index) => sheet.columns.findIndex(other => other.letter === column.letter) === index ? [{ column, index }] : []);
  const more = sheet.rowCount - sheet.sample.length;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Table scrollLabel={t("assistantProposals.spreadsheet.sample")}>
        <TableHeader>
          <TableRow>
            {shown.map(({ column }) => <TableHead key={column.letter} numeric={numeric(column)}>
              {column.header || t("assistantProposals.spreadsheet.header", { letter: column.letter })}
            </TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheet.sample.map((row, rowIndex) => <TableRow key={rowIndex}>
            {shown.map(({ column, index }) => <TableCell key={column.letter} numeric={numeric(column)}>{row[index]}</TableCell>)}
          </TableRow>)}
        </TableBody>
      </Table>
      {more > 0 ? <p className="text-sm text-[var(--color-content-muted)]">{t("assistantProposals.spreadsheet.more", { count: more })}</p> : null}
    </div>
  );
}
