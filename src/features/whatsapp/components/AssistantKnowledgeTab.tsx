import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { CheckIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import type { AgentKnowledge, AgentKnowledgeSection } from "../api/assistantAgent";

const stateVariants = { Loaded: "success", Empty: "outline", LegacyUnreviewed: "warning" } as const;

/**
 * Conocimiento (AS5): the business information as the assistant uses it, read only, with the names of the zones of Información
 * del negocio and their state. It is edited there, with «Administrar información del negocio».
 */
export function AssistantKnowledgeTab({ knowledge, canEdit }: { knowledge: AgentKnowledge; canEdit: boolean }) {
  const { t } = useTranslation("whatsappAssistant");
  const phone = useMediaQuery("(width < 640px)");
  const empty = knowledge.sections.every(section => section.state === "Empty");
  const state = (section: AgentKnowledgeSection) => <Badge variant={stateVariants[section.state]}>{section.state === "Loaded" ? <CheckIcon className="size-3" /> : null}{t("knowledge.states." + section.state)}</Badge>;
  // In the table the cell has no padding of its own: the rows of the facts bring theirs, and a zone without facts, its dash.
  const says = (section: AgentKnowledgeSection, table: boolean) => <div className="flex flex-col gap-1">
    {section.facts.length ? <DataList items={section.facts.map(fact => ({ key: fact.id, label: fact.label, value: fact.text }))} />
      : <span className={table ? "py-1.5 text-[var(--color-content-muted)]" : "text-[var(--color-content-muted)]"}>—</span>}
    {section.key === "Answers" && knowledge.unansweredQuestions ? <span className={table ? "pb-2 text-xs text-[var(--color-content-muted)]" : "text-xs text-[var(--color-content-muted)]"}>{t("knowledge.unanswered", { count: knowledge.unansweredQuestions })}</span> : null}
  </div>;
  return <Surface title={t("knowledge.title")} help={t("knowledge.help")}
    actions={canEdit ? <Button asChild variant="outline" size="sm"><Link to="/configuracion/negocio">{t("knowledge.edit")}</Link></Button> : undefined}>
    {empty ? <div className="p-4 pb-0"><Banner tone="warning">{t("knowledge.empty")}</Banner></div> : null}
    {/* On the phone, one zone under the other: its name and its state, and what it says below. */}
    {phone ? <ul className="divide-y divide-[var(--color-border)]">{knowledge.sections.map(section => <li key={section.key} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{t("knowledge.zones." + section.key)}</span>{state(section)}</div>
      {says(section, false)}
    </li>)}</ul>
      : <Table className="table-fixed">
        <TableHeader><TableRow>
          <TableHead className="w-[28%]">{t("knowledge.zone")}</TableHead>
          <TableHead className="w-[22%]">{t("knowledge.state")}</TableHead>
          <TableHead>{t("knowledge.says")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{knowledge.sections.map(section => <TableRow key={section.key}>
          <TableRowHeader className="align-top whitespace-normal">{t("knowledge.zones." + section.key)}</TableRowHeader>
          <TableCell className="py-1.5 align-top">{state(section)}</TableCell>
          <TableCell className="py-0 align-top whitespace-normal">{says(section, true)}</TableCell>
        </TableRow>)}</TableBody>
      </Table>}
  </Surface>;
}
