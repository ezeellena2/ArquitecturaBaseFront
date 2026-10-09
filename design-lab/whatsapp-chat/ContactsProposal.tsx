import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Page } from "@/shared/ui/Page";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from "@/shared/ui/table";
import { ContactDetails } from "./ChatProposal";
import { initialContacts, type Contact } from "./proposalContacts";

export function ContactsProposal() {
  const { t } = useTranslation("finalProposal");
  const { t: chat } = useTranslation("chatProposal");
  const [scenario, setScenario] = useState("normal");
  const [search, setSearch] = useState("");
  const [linked, setLinked] = useState("all");
  const [selected, setSelected] = useState<Contact | null>(null);
  const rows = scenario === "empty" ? [] : initialContacts.filter(row => `${row.name} ${row.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()) && (linked === "all" || row.linked === (linked === "linked")));
  function clear() { setSearch(""); setLinked("all"); }
  return <Page title={t("contacts")} status={<span className="text-sm text-[var(--color-content-muted)]">{t("count", { count: rows.length })}</span>}>
    <div className="chat-lab-controls"><p className="text-sm text-[var(--color-content-muted)]">{t("lab")}</p><div className="chat-lab-select"><FormField label={t("state")}><NativeSelect value={scenario} onChange={e => setScenario(e.target.value)}>{["normal", "empty", "error", "denied"].map(value => <option value={value} key={value}>{t(value)}</option>)}</NativeSelect></FormField></div></div>
    {scenario !== "denied" ? <FilterBar><div className="proposal-filters"><SearchInput value={search} onChange={setSearch} label={t("search")} /><FormField label={t("account")}><NativeSelect value={linked} onChange={e => setLinked(e.target.value)}>{["all", "linked", "unlinked"].map(value => <option value={value} key={value}>{t(value)}</option>)}</NativeSelect></FormField>{search || linked !== "all" ? <Button variant="link" size="inline" onClick={clear}>{t("clear")}</Button> : null}</div></FilterBar> : null}
    <Surface>{scenario === "denied" ? <EmptyState embedded title={t("deniedTitle")} description={t("deniedHint")} /> : scenario === "error" ? <EmptyState embedded title={t("failed")} description={t("failedHint")} action={<Button variant="outline" onClick={() => setScenario("normal")}>{t("retry")}</Button>} /> : !rows.length ? <EmptyState embedded title={t(scenario === "empty" ? "none" : "noMatches")} description={scenario === "empty" ? t("noneHint") : undefined} action={scenario !== "empty" ? <Button variant="link" onClick={clear}>{t("clear")}</Button> : undefined} /> : <Table>
      <TableHeader><TableRow><TableHead>{t("name")}</TableHead><TableHead>{t("phone")}</TableHead><TableHead>{t("account")}</TableHead><TableHead>{t("lastMessage")}</TableHead><TableHead>{t("actions")}</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map(row => <TableRow key={row.id}><TableRowHeader>{row.name}</TableRowHeader><TableCell>{row.phone ?? t("noPhone")}</TableCell><TableCell>{chat(row.linked ? "linked" : "unknown")}</TableCell><TableCell>{row.time === "yesterday" ? chat("yesterday") : row.time}</TableCell><TableCell><div className="flex gap-3"><Button variant="link" size="inline" onClick={() => setSelected(row)} aria-label={`${t("view")}: ${row.name}`}>{t("view")}</Button><Link className="text-[var(--color-brand-600)] hover:underline" aria-label={t("openChatFor", { name: row.name })} to={`/whatsapp/chats?contact=${row.id}`}>{t("openChat")}</Link></div></TableCell></TableRow>)}</TableBody>
    </Table>}</Surface>
    {selected ? <ContactDetails contact={selected} onClose={() => setSelected(null)} /> : null}
  </Page>;
}
