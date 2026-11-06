import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Surface } from "@/shared/ui/Surface";
import type { DraftEditorValue, FormCulture } from "../model";
import { publicationIssueNames } from "../publicationPresentation";
import type { useFormPublication } from "../hooks/useFormPublication";
import type { PublicationProgressState } from "../hooks/usePublicationProgress";
import { Finding, findingRows, type PublicationIssue } from "./PublicationFindings";

type Publication = ReturnType<typeof useFormPublication>;

// «Consultar publicación» and «Repetir el mismo intento», in the editor's header next to the label, only while they are the way
// forward. While it consults, also the periodic consultation, the button says so with its ring.
export function PublicationActions({ publication, progress, onReplay }: { publication: Publication; progress: PublicationProgressState; onReplay: () => void }) {
  const { t } = useTranslation("forms");
  if (!progress.canConsult) return null;
  return <>
    <DisabledReason reason={progress.waitReason}><Button type="button" variant="outline" pending={publication.busy} disabled={progress.cooling} onClick={() => void publication.consult()}>{t(publication.busy ? "publication.consulting" : "publication.consult")}</Button></DisabledReason>
    {publication.canReplay ? <DisabledReason reason={progress.waitReason}><Button type="button" variant="outline" disabled={publication.busy || progress.cooling} onClick={onReplay}>{t("publication.replay")}</Button></DisabledReason> : null}
  </>;
}

// What stopped a publication that did not go through, with the rows of the check before publishing (PU1-A); diagnostics by
// FieldId/ChoiceId, never indexes. Without problems the label and the notice are enough.
export function PublicationProblems({ progress, value, culture, onGoToIssue, canLocateIssue }: {
  progress: PublicationProgressState; value: DraftEditorValue; culture: FormCulture;
  onGoToIssue: (issue: PublicationIssue) => void; canLocateIssue: (issue: PublicationIssue) => boolean;
}) {
  const { t } = useTranslation("forms");
  if (!progress.issues.length) return null;
  const { issueName, issueDetail, sectionOf } = publicationIssueNames(value, culture, t);
  return <Surface title={t("publication.problems")} help={t("publication.problemsHelp")}>
    <ul className={findingRows}>{progress.issues.map((issue, index) => <Finding key={issue.path + ":" + index} tone="danger" title={issueName(issue)}
      action={canLocateIssue(issue) ? <Button type="button" size="sm" variant="outline" onClick={() => onGoToIssue(issue)}>{t(issue.fieldId ? "publication.goToQuestion" : sectionOf(issue.path) ? "publication.goToTitle" : "publication.goToText")}</Button> : null}>
      <p className="text-[var(--color-content-muted)]">{issueDetail(issue)}</p>
    </Finding>)}</ul>
  </Surface>;
}
