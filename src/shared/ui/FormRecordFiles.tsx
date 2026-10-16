import { AlertTriangleIcon, ClockIcon } from "@/shared/ui/icons";
import { PrivateImage } from "@/shared/ui/PrivateImage";
import { PhotoThumbnail } from "@/shared/ui/PhotoThumbnail";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { type PrivateFormFile } from "@/shared/api/formFiles";
import {
  usePrivateFormFile,
  savePrivateBlob,
} from "@/shared/hooks/usePrivateFormFile";
import { Button } from "@/shared/ui/button";
import { PhotoViewer } from "@/shared/ui/PhotoViewer";

function fileSize(bytes: number, language: string) {
  return bytes < 1024 * 1024
    ? new Intl.NumberFormat(language).format(
        Math.max(1, Math.ceil(bytes / 1024)),
      ) + " KB"
    : new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(
        bytes / (1024 * 1024),
      ) + " MB";
}
function Thumbnail({
  actor,
  recordId,
  file,
  selected,
  onOpen,
  onForbidden,
  onError,
}: {
  actor: string;
  recordId: string;
  file: PrivateFormFile;
  selected?: boolean;
  onOpen: () => void;
  onForbidden: () => void;
  onError: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const query = usePrivateFormFile(
    actor,
    recordId,
    file.fileId,
    true,
    onForbidden,
    onError,
  );
  return (
    <PhotoThumbnail
      label={
        t("files.openPhoto", { name: file.name }) +
        (query.data
          ? ""
          : " · " + t(query.isPending ? "files.loading" : "files.unavailable"))
      }
      selected={selected}
      onClick={onOpen}
    >
      {query.data ? (
        <PrivateImage
          blob={query.data}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">
          {query.isPending ? (
            <ClockIcon className="size-5" />
          ) : (
            <AlertTriangleIcon className="size-5" />
          )}
        </span>
      )}
    </PhotoThumbnail>
  );
}
function Original({
  actor,
  recordId,
  files,
  index,
  label,
  number,
  onIndex,
  onClose,
  onForbidden,
  onError,
  focusFallback,
  date,
}: {
  actor: string;
  recordId: string;
  files: readonly PrivateFormFile[];
  index: number;
  label: string;
  number: string;
  onIndex: (index: number) => void;
  onClose: () => void;
  onForbidden: () => void;
  onError: (error: unknown) => void;
  focusFallback?: RefObject<HTMLElement | null>;
  date?: string;
}) {
  const { i18n } = useTranslation();
  const file = files[index];
  const query = usePrivateFormFile(
    actor,
    recordId,
    file.fileId,
    false,
    onForbidden,
    onError,
  );
  return (
    <PhotoViewer
      date={date}
      focusFallback={focusFallback}
      title={label}
      description={number}
      name={file.name}
      size={fileSize(file.size, i18n.resolvedLanguage ?? "es")}
      index={index}
      count={files.length}
      loading={query.isPending}
      blob={query.data}
      onIndex={onIndex}
      onClose={onClose}
      onDownload={() => {
        if (query.data) savePrivateBlob(query.data, file.name);
      }}
      thumbnails={files.map((item, i) => (
        <Thumbnail
          key={item.fileId}
          actor={actor}
          recordId={recordId}
          file={item}
          selected={i === index}
          onOpen={() => onIndex(i)}
          onForbidden={onForbidden}
          onError={onError}
        />
      ))}
    />
  );
}
function DocumentDownload({
  actor,
  recordId,
  file,
  onForbidden,
  onError,
}: {
  actor: string;
  recordId: string;
  file: PrivateFormFile;
  onForbidden: () => void;
  onError: (error: unknown) => void;
}) {
  const { t, i18n } = useTranslation();
  const [requested, setRequested] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] p-2">
      <div className="min-w-0 flex-1">
        <p className="break-words">{file.name}</p>
        <p className="text-xs text-[var(--color-content-muted)]">
          {fileSize(file.size, i18n.resolvedLanguage ?? "es")}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={requested}
        onClick={() => setRequested(true)}
      >
        {t("files.download")}
      </Button>
      {requested ? (
        <DownloadRequest
          actor={actor}
          recordId={recordId}
          file={file}
          onDone={() => setRequested(false)}
          onForbidden={onForbidden}
          onError={onError}
        />
      ) : null}
    </div>
  );
}
function DownloadRequest({
  actor,
  recordId,
  file,
  onDone,
  onForbidden,
  onError,
}: {
  actor: string;
  recordId: string;
  file: PrivateFormFile;
  onDone: () => void;
  onForbidden: () => void;
  onError: (error: unknown) => void;
}) {
  const query = usePrivateFormFile(
    actor,
    recordId,
    file.fileId,
    false,
    onForbidden,
    onError,
  );
  const consumed = useRef(false);
  useEffect(() => {
    if (query.data && !consumed.current) {
      consumed.current = true;
      savePrivateBlob(query.data, file.name);
      onDone();
    } else if (query.isError) onDone();
  }, [query.data, query.isError, file.name, onDone]);
  return null;
}
export function FormRecordFiles({
  actor,
  recordId,
  files,
  photo,
  label,
  number,
  onForbidden,
  onError,
  focusFallback,
  date,
  thumbnailLimit = 4,
  compact = false,
  viewerFiles = files,
}: {
  actor: string;
  recordId: string;
  files: readonly PrivateFormFile[];
  photo: boolean;
  thumbnailLimit?: number;
  compact?: boolean;
  viewerFiles?: readonly PrivateFormFile[];
  label: string;
  number: string;
  onForbidden: () => void;
  onError: (error: unknown) => void;
  focusFallback?: RefObject<HTMLElement | null>;
  date?: string;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState<number | null>(null);
  if (files.length === 0) return <span>{t("files.none")}</span>;
  if (!photo)
    return (
      <div className="flex flex-col gap-2">
        {files.map((file) => (
          <DocumentDownload
            key={file.fileId}
            actor={actor}
            recordId={recordId}
            file={file}
            onForbidden={onForbidden}
            onError={onError}
          />
        ))}
      </div>
    );
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {files.slice(0, compact ? 1 : thumbnailLimit).map((file) => (
          <Thumbnail
            key={file.fileId}
            actor={actor}
            recordId={recordId}
            file={file}
            onOpen={() =>
              setIndex(
                viewerFiles.findIndex((item) => item.fileId === file.fileId),
              )
            }
            onForbidden={onForbidden}
            onError={onError}
          />
        ))}
        {compact ? (
          <span className="text-xs">
            {t("files.photoCount", { count: files.length })}
          </span>
        ) : files.length > thumbnailLimit ? (
          <PhotoThumbnail
            label={t("files.morePhotos", {
              count: files.length - thumbnailLimit,
            })}
            onClick={() =>
              setIndex(
                viewerFiles.findIndex(
                  (item) => item.fileId === files[thumbnailLimit].fileId,
                ),
              )
            }
          >
            +{files.length - thumbnailLimit}
          </PhotoThumbnail>
        ) : null}
      </div>
      {index !== null ? (
        <Original
          actor={actor}
          recordId={recordId}
          files={viewerFiles}
          index={index}
          label={label}
          number={number}
          date={date}
          focusFallback={focusFallback}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
          onForbidden={onForbidden}
          onError={onError}
        />
      ) : null}
    </>
  );
}
