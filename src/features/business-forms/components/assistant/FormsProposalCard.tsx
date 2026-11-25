import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import type { AssistantProposalCardProps } from "@/shared/hooks/assistantProposalContext";
import { AssistantProposalCard } from "@/shared/ui/assistant/AssistantProposalCard";
import { Button } from "@/shared/ui/button";
import { DataList, type DataListItem } from "@/shared/ui/DataList";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { assistantImportState } from "../../assistantImport";
import {
  formProposalPreview, newQuestions, readProposal,
  type FormProposal, type ImportProposal, type ProposalSpreadsheet, type ProposedQuestion, type ReadProposal,
} from "../../assistantProposal";
import { useAssistantProposalCreation } from "../../hooks/useAssistantProposalCreation";
import { FormPreview } from "../FormPreview";

/**
 * The card of a proposal of this module under the answer that brought it (IA1-A). App lends it to Home by the extension point.
 * Its data read in two columns and a collection in a table from edge to edge (TC1-B, TC2-B and TC3-A, 2026-11-25).
 */
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
  // A form proposed with a document says it reads them when the proposal turns the reading on (Etapa 3 de la IA).
  const data: DataListItem[] = [{ key: "prefix", label: t("publication.prefixRow"), value: content.prefix },
    ...(content.documentReading ? [{ key: "reading", label: t("assistantProposals.form.readsDocuments"), value: t("yes") }] : [])];
  return (
    <>
      <AssistantProposalCard kind={kind} title={content.name}
        actions={<><Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>{t("assistantProposals.form.preview")}</Button>{create}</>}>
        {creation.problem ? <p role="alert" className="text-sm text-[var(--color-danger-700)]">{creation.problem}</p> : null}
        <DataList items={data} />
        <QuestionTable questions={content.questions} fresh={newQuestions(content, previous)}
          opensCatalogs={Boolean(user?.permissions.includes("formcatalogs.read") || user?.permissions.includes("formcatalogs.manage"))} />
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

// TC3-A: one question per row. «Opciones» only when a question takes them, from its list or from a catalog that already exists
// (which opens from its name for whoever can see catalogs), and «Cambio» only for what an adjustment added.
function QuestionTable({ questions, fresh, opensCatalogs }: { questions: readonly ProposedQuestion[]; fresh: ReadonlySet<number>; opensCatalogs: boolean }) {
  const { t } = useTranslation("forms");
  const withOptions = questions.some(question => question.options.length > 0 || question.catalog !== null);
  const withChange = fresh.size > 0;
  const options = (question: ProposedQuestion): ReactNode => question.catalog
    ? opensCatalogs ? <Link className="text-[var(--color-brand-600)] underline-offset-4 hover:underline" to={"/catalogos/" + question.catalog.id}>{question.catalog.name}</Link> : question.catalog.name
    : question.options.length ? question.options.join(", ") : <span className="text-[var(--color-content-muted)]">—</span>;
  return (
    <div className="assistant-proposal-table">
      <Table scrollLabel={t("assistantProposals.form.questions")}>
        <TableHeader>
          <TableRow>
            <TableHead numeric>{t("assistantProposals.form.columns.number")}</TableHead>
            <TableHead>{t("assistantProposals.form.columns.question")}</TableHead>
            <TableHead>{t("assistantProposals.form.columns.type")}</TableHead>
            {withOptions ? <TableHead>{t("assistantProposals.form.columns.options")}</TableHead> : null}
            <TableHead>{t("assistantProposals.form.required")}</TableHead>
            {withChange ? <TableHead>{t("assistantProposals.form.columns.change")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {questions.map((question, index) => <TableRow key={index}>
            <TableCell numeric>{index + 1}</TableCell>
            <TableCell className="assistant-proposal-wrap">{question.label}</TableCell>
            <TableCell className="assistant-proposal-wrap">{t("types." + questionType(question.type))}</TableCell>
            {withOptions ? <TableCell className="assistant-proposal-wrap">{options(question)}</TableCell> : null}
            <TableCell>{t(question.required ? "yes" : "no")}</TableCell>
            {withChange ? <TableCell className="text-[var(--color-success-700)]">{fresh.has(index) ? t("assistantProposals.form.new") : null}</TableCell> : null}
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
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
  const description: DataListItem[] = read.content.description ? [{ key: "description", label: t("catalogs.metadata.description"), value: read.content.description }] : [];
  // TC1-B: with a spreadsheet, its sample says what fills each column; without one, each datum of the catalog is a row of its data.
  const data: DataListItem[] = read.kind === "people"
    ? [...description, { key: "origin", label: t("assistantProposals.catalog.origin"), value: t("assistantProposals.catalog.people") }]
    : [...description, { key: "valueType", label: t("catalogs.valueType.label"), value: valueTypeName(t, read.content.valueType) },
      ...(sheet ? [] : [{ key: "code", label: t("assistantProposals.catalog.code"), value: read.content.code },
        { key: "option", label: t("assistantProposals.catalog.option"), value: read.content.option },
        ...read.content.fields.map((field, index) => ({ key: "field" + index, label: field.name, value: t("catalogs.fields.types." + field.type) }))])];
  return (
    <AssistantProposalCard kind={kind} title={title} footer={sheet ? sampleFoot(t, sheet) : undefined}
      actions={user?.permissions.includes("formcatalogs.manage")
        ? <Button size="sm" pending={creation.creating} onClick={() => void creation.create()}>{t(creation.creating ? "assistantProposals.catalog.creating" : "assistantProposals.catalog.create")}</Button>
        : undefined}>
      {creation.problem ? <p role="alert" className="text-sm text-[var(--color-danger-700)]">{creation.problem}</p> : null}
      <DataList items={data} />
      {read.kind === "people" ? read.content.limitations.map((limitation, index) =>
        <p key={index} className="break-words text-sm text-[var(--color-warning-700)]">{t("catalogs.proposal.unsupportedColumn", { criterion: limitation.criterion })}</p>)
        : sheet ? <SpreadsheetSample sheet={sheet} numeric={column => column.target === "value" ? numericType(read.content.valueType)
          : column.target === "field" && numericType(read.content.fields.find(field => field.name === column.field)?.type)} /> : null}
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
    <AssistantProposalCard kind={kind} title={catalog.name} footer={sampleFoot(t, sheet)}
      actions={user?.permissions.includes("formcatalogs.manage")
        ? <Button size="sm" onClick={() => void navigate("/catalogos/" + catalog.id, { state: assistantImportState({ requestId, proposalId: proposal.id, fileName: sheet.fileName, rowCount: sheet.rowCount }) })}>
            {t("assistantProposals.import.review")}
          </Button>
        : undefined}>
      <SpreadsheetSample sheet={sheet} numeric={column => column.target === "value" && numericType(catalog.valueType)} />
    </AssistantProposalCard>
  );
}

type SpreadsheetColumn = ProposalSpreadsheet["columns"][number];
const numericType = (type: string | undefined) => type === "integer" || type === "decimal";
const columnName = (t: TFunction<"forms">, column: SpreadsheetColumn) =>
  column.target === "code" ? t("assistantProposals.catalog.code") : column.target === "option" ? t("assistantProposals.catalog.option")
    : column.target === "value" ? t("catalogs.import.columns.value") : column.target === "detail" ? t("catalogs.import.columns.detail") : column.field ?? "";
// The foot of the sample: how many rows it shows of how many the spreadsheet brings, or that it shows them all.
const sampleFoot = (t: TFunction<"forms">, sheet: ProposalSpreadsheet) => sheet.rowCount === 0 ? undefined
  : sheet.sample.length >= sheet.rowCount ? t("assistantProposals.spreadsheet.all", { count: sheet.rowCount })
    : t("assistantProposals.spreadsheet.first", { count: sheet.sample.length, total: sheet.rowCount });

// Three rows of the spreadsheet as the catalog orders its columns (TC1-B): each column says on top the datum of the catalog it
// fills and, in its grey row, the column of the spreadsheet it comes from. A simple list takes the code and the option from one
// column, shown once.
function SpreadsheetSample({ sheet, numeric }: { sheet: ProposalSpreadsheet; numeric: (column: SpreadsheetColumn) => boolean }) {
  const { t } = useTranslation("forms");
  const shown = sheet.columns.flatMap((column, index) => sheet.columns.findIndex(other => other.letter === column.letter) === index ? [{ column, index }] : []);
  const name = (column: SpreadsheetColumn) => {
    const targets = sheet.columns.filter(other => other.letter === column.letter).map(other => other.target);
    return targets.includes("code") && targets.includes("option") ? t("assistantProposals.spreadsheet.codeAndOption") : columnName(t, column);
  };
  const source = (column: SpreadsheetColumn) => column.header
    ? t("assistantProposals.spreadsheet.source", { letter: column.letter, header: column.header })
    : t("assistantProposals.spreadsheet.header", { letter: column.letter });
  return (
    <div className="assistant-proposal-table">
      <Table scrollLabel={t("assistantProposals.spreadsheet.sample")}>
        <TableHeader>
          <TableRow>{shown.map(({ column }) => <TableHead key={column.letter} numeric={numeric(column)}>{name(column)}</TableHead>)}</TableRow>
          <TableRow className="assistant-proposal-source">{shown.map(({ column }) => <TableHead key={column.letter} numeric={numeric(column)}>{source(column)}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {sheet.sample.map((row, rowIndex) => <TableRow key={rowIndex}>
            {shown.map(({ column, index }) => <TableCell key={column.letter} numeric={numeric(column)}>{row[index]}</TableCell>)}
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
  );
}
