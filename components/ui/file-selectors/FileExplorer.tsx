import { error2String } from "@/lib/error2String";
import { cn } from "@/lib/utils";
import { FileSource } from "@prisma/client";
import { SlashIcon } from "@radix-ui/react-icons";
import { useDebounceFn } from "ahooks";

import {
  ChevronRight,
  FolderIcon,
  HomeIcon,
  Loader2Icon,
  LucideIcon,
  TriangleAlertIcon,
  File,
  X,
  Search,
  InfoIcon,
} from "@/components/ui/lucide-shim";
import React, {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Highlighter from "react-highlight-words";
import { z } from "zod";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../breadcrumb";
import { Checkbox } from "../checkbox";
import { Label } from "../label";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
import { GOOGLE_DRIVE_SHORTCUT_MIME_TYPE } from "@/lib/integrations/cloud-drives/google-drive";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Badge } from "../badge";
import TextAutoEllipsis from "@/components/TextAutoEllipsis";
import useInfiniteScroll from "@/lib/hooks/useInfiniteScroll";
import { PartialExcept } from "@/lib/type";
import { useVirtualizer } from "@tanstack/react-virtual";
import { isPlainObject } from "@/lib/plainObject";

const DEFAULT_VIRTUAL_THRESHOLD = 100;
const DEFAULT_VIRTUAL_ROW_ESTIMATE = 37;

export const CloudFileSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  isDir: z.boolean(),
  disabled: z.union([z.boolean(), z.string()]).optional(),
  /* It’s not currently in use. It should be under `annotation`, but that would require significant changes. */
  cloudSource: z.custom<FileSource>(),
  /* Extra information for certain integrations, such as driveId, namespaceId, model name, etc. */
  annotation: z.record(z.string(), z.any()).optional(),
});

export type CloudFile = z.infer<typeof CloudFileSchema>;

type UIAttributes = {
  icon?: LucideIcon;
  iconLink?: string;
};
type DirAsPathItem = PartialExcept<CloudFile, "id" | "name"> & UIAttributes;

export type UIFileItem = CloudFile &
  UIAttributes & {
    /** Full path from home, used to fix wrong breadcrumbs while searching */
    path?: DirAsPathItem[];
  };

export type UIFileListResult = {
  list: UIFileItem[];
  done: boolean;
  cursor?: CloudFile["id"];
  keywords?: string[];
};

export type FileExplorerProps = {
  getList: (query: {
    parentId?: CloudFile["id"];
    keywords: string[];
    rawQuery?: string;
    cursor?: CloudFile["id"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    annotation?: Record<string, any>;
    acceptedFileTypes?: string[];
  }) => Promise<UIFileListResult>;
  rootId?: CloudFile["id"];
  rootName?: CloudFile["name"];
  multiple?: boolean;
  allowDirSelection?: boolean;
  showSelectAll?: boolean;
  scrollableClassName?: string;
  value?: CloudFile[];
  onChange?: (files: CloudFile[]) => void;
  disabled?: boolean;
  hideBreadcrumbs?: boolean;
  borderless?: boolean;
  search?: {
    placeholder?: string;
  };
  render?: (components: {
    components: {
      breadcrumbs: ReactNode;
      searchBar: ReactNode;
      searchInput: ReactNode;
      fileList: ReactNode;
      selectionTip: ReactNode;
      selectAll: ReactNode;
    };
    breadcrumbs: DirAsPathItem[];
    setBreadcrumbs: React.Dispatch<React.SetStateAction<DirAsPathItem[]>>;
    keywords: string;
    setKeywords: (keywords: string) => void;

    containerRef: React.RefObject<HTMLDivElement>;
    loading: boolean;
    loadingMore: boolean;
    error: unknown;
    data: UIFileListResult | undefined;
    reload: () => void;
  }) => ReactNode;
  renderItem?: (params: {
    props: HTMLAttributes<HTMLDivElement>;
    components: {
      checkbox: ReactNode;
      icon: ReactNode;
      name: ReactNode;
    };
    checked: boolean;
    setChecked: (checked: boolean) => void;
    item: UIFileItem;
    rootId: CloudFile["id"];
    data?: UIFileListResult;
  }) => ReactNode;

  /** Virtualized list support */
  virtualization?: boolean | { threshold?: number; rowEstimate?: number };
};

function renderIcon(fileOrDir: UIFileItem, rootId: CloudFile["id"]) {
  if (fileOrDir.iconLink) {
    return <img src={fileOrDir.iconLink} alt="icon" className="icon" key={`icon-${fileOrDir.id}`} />;
  }
  if (fileOrDir.icon) {
    return <fileOrDir.icon className="icon" key={`icon-${fileOrDir.id}`} />;
  }
  if (fileOrDir.isDir) {
    return fileOrDir.id === rootId ? (
      <HomeIcon className="icon" key={`icon-${fileOrDir.id}`} />
    ) : (
      <FolderIcon className="icon" key={`icon-${fileOrDir.id}`} color="currentColor" fill="currentColor" />
    );
  }
  return null;
}

export function findItemsBetween2Id<T extends { id: CloudFile["id"]; [k: string]: unknown }>(
  list: T[],
  id1: CloudFile["id"],
  id2: CloudFile["id"],
) {
  const newValue = new Map<CloudFile["id"], T>(/* items.map((item) => [item.id, item]) */);
  if (id1 === id2) {
    // If both ids are the same, just return the item with that id
    const item = list.find((it) => it.id === id1);
    if (item) {
      newValue.set(item.id, item);
    }
    return newValue;
  }

  let isInRange = false;

  for (const item of list) {
    if (item.id === id1 || item.id === id2) {
      isInRange = !isInRange; // Toggle the range start
      newValue.set(item.id, item);
      if (!isInRange) {
        // Stop if we reached the end of the range
        break;
      }
    }
    if (isInRange) {
      newValue.set(item.id, item);
    }
  }
  return newValue;
}

export interface FileExplorerHandle {
  container: HTMLDivElement | null;
  debouncedReload: () => void;
}

const FileExplorer = forwardRef<FileExplorerHandle, FileExplorerProps>((props, ref) => {
  const { rootId = "", rootName = "Home", value = [], multiple = true, hideBreadcrumbs, virtualization } = props;
  const selectAllId = useId();
  function onChange(files: UIFileItem[]) {
    const newValue = multiple ? files : files.slice(-1);
    // Omit UI attributes before calling onChange
    props.onChange?.(newValue.map<CloudFile>(({ icon, iconLink, ...safeJson }) => safeJson satisfies CloudFile));
  }
  const [keywords, setKeywordsState] = useState("");
  const [breadcrumbs, setBreadcrumbs] = useState<DirAsPathItem[]>([
    {
      id: rootId,
      name: rootName,
    },
  ]);

  const recentRangeRef = useRef<UIFileItem[]>([]);
  const currentDir = breadcrumbs[breadcrumbs.length - 1];
  const isInRootDir = currentDir.id === rootId;

  const containerRef = useRef<HTMLDivElement>(null);

  const lastSelectedIdRef = useRef<CloudFile["id"] | null>(null);

  const lastFetchId = useRef(0);
  const { data, loading, loadingMore, reload, error } = useInfiniteScroll<UIFileListResult>(
    async (currentData) => {
      const fetchId = ++lastFetchId.current;
      const param = {
        parentId: currentDir.id,
        rawQuery: keywords,
        keywords: keywords.trim().split(/\s+/).filter(Boolean),
        cursor: currentData?.cursor,
        annotation: currentDir.annotation,
      };
      // console.log(`[${fetchId}] get with`, param, currentData);
      const result = await props.getList(param);
      if (fetchId !== lastFetchId.current) {
        // Outdated fetch, discard. Make sure update the state only with the latest fetch
        // console.log(`[${fetchId}] response deprecated`, result);
        return new Promise<UIFileListResult>(() => {});
      }
      // console.log(`[${fetchId}] response`, result);
      result.list = result.list.filter((item) => (currentData?.list || []).every((i) => i.id !== item.id));
      return result;
    },
    {
      target: containerRef,
      manual: true,
      isNoMore: (d) => Boolean(d?.done),
      onSuccess: () => {
        // Reset last selected id to avoid confusion
        lastSelectedIdRef.current = null;
        recentRangeRef.current = [];
      },
      onError: console.error,
    },
  );
  const { run: debouncedReload, cancel: debouncedReloadCancel } = useDebounceFn(reload, { wait: 300 });
  useImperativeHandle(ref, () => ({
    container: containerRef.current,
    // reload,
    debouncedReload,
  }));
  useEffect(() => {
    debouncedReloadCancel();
    setKeywordsState("");
    setTimeout(() => {
      // Make sure reload with empty keywords after dir change
      reload();
    }, 0);
  }, [currentDir.id, debouncedReloadCancel, reload]);

  // Extract UI components for render prop
  const breadcrumbsNode = hideBreadcrumbs ? null : (
    <Breadcrumb>
      <BreadcrumbList className="!gap-0.5 text-3xl font-medium">
        {breadcrumbs.map((dir, index) =>
          index < breadcrumbs.length - 1 ? (
            <React.Fragment key={`dir-${dir.id}`}>
              <BreadcrumbItem
                key={dir.id}
                className="cursor-pointer select-none"
                onClick={() => {
                  setBreadcrumbs((old) => old.slice(0, index + 1));
                }}
              >
                <span>{dir.name}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator key={`separator-${dir.id}`}>
                <SlashIcon />
              </BreadcrumbSeparator>
            </React.Fragment>
          ) : (
            <BreadcrumbItem key={`dir-${dir.id}`}>
              <BreadcrumbPage>
                <span>{dir.name}</span>
              </BreadcrumbPage>
            </BreadcrumbItem>
          ),
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );

  let placeholder = props?.search?.placeholder;
  if (!placeholder) {
    placeholder = isInRootDir ? "Search files or folders..." : "Search in this folder...";
  }

  const setKeywordsByUser = (kw: string) => {
    setKeywordsState(kw);
    debouncedReload();
  };

  const searchInputNode = (
    <input
      value={keywords}
      onChange={(e) => setKeywordsByUser(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setKeywordsByUser("");
        } else if (e.key === "Enter") {
          e.preventDefault();
        }
      }}
      placeholder={placeholder}
      className="flex-1 border-0 bg-transparent outline-none"
    />
  );
  const searchBarNode = (
    <div className="flex items-center" data-testid="search-bar">
      <Search className="icon text-muted-foreground" />
      {searchInputNode}
    </div>
  );

  const virtualEnabled = Boolean(virtualization);
  const virtualConfig = isPlainObject(virtualization) ? virtualization : {};
  const virtualThreshold = Number.isFinite(virtualConfig.threshold)
    ? (virtualConfig.threshold as number)
    : DEFAULT_VIRTUAL_THRESHOLD;
  const virtualRowEstimate = Number.isFinite(virtualConfig.rowEstimate)
    ? (virtualConfig.rowEstimate as number)
    : DEFAULT_VIRTUAL_ROW_ESTIMATE;

  const totalCount = data?.list.length || 0;

  const shouldVirtualize =
    virtualEnabled && virtualThreshold > 0 && virtualRowEstimate > 0 && totalCount > virtualThreshold;

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => containerRef.current || null,
    estimateSize: () => virtualRowEstimate,
    getItemKey: (index) => data?.list?.[index]?.id ?? index,
    overscan: 12,
  });

  const renderItemNode = (
    item: UIFileItem,
    extraProps: HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> } = {},
  ) => {
    const checked = value.some((s) => s.id === item.id);
    const setChecked = (c: boolean) => {
      if (c) {
        onChange([...value, item]);
      } else {
        onChange(value.filter((s) => s.id !== item.id));
      }
    };
    const { isDir } = item;
    const isSelectable = (!isDir || props.allowDirSelection) && item.type !== GOOGLE_DRIVE_SHORTCUT_MIME_TYPE;
    const itemNodeProps: HTMLAttributes<HTMLDivElement> = {
      ...extraProps,
      "data-id": `${item.id}`,
      "aria-label": isDir ? "dir" : "file",
      className: cn(
        "flex cursor-pointer select-none items-center gap-2 overflow-hidden px-4 py-2 hover:bg-muted",
        {
          "opacity-60": item.disabled,
          "cursor-not-allowed": item.disabled,
        },
        extraProps.className,
      ),
      onClick: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (item.disabled) return;
        const pointerEvents = window.getComputedStyle(e.target as HTMLElement).getPropertyValue("pointer-events");
        if (pointerEvents === "none") {
          // fake click event triggered by Checkbox
          return;
        }
        extraProps.onClick?.(e);
        if (isDir && !e.shiftKey) {
          if (checked) {
            // If the folder is already selected, we should deselect it before navigating into it
            onChange(value.filter((s) => s.id !== item.id));
          } else {
            // If the folder is not selected, we should navigate into it
            if (item.path) {
              const rootIndex = item.path.findIndex((dir) => dir.id === rootId);
              setBreadcrumbs((old) => [old[0] /* The Home */, ...item.path!.slice(rootIndex + 1), item]);
            } else {
              setBreadcrumbs((prev) => prev.concat([item]));
            }
          }
        } else {
          // If it's a file or the Shift key is pressed, we should toggle it.
          if (checked) {
            onChange(value.filter((s) => s.id !== item.id));
          } else {
            onChange([...value, item]);
          }
        }
      },
    };
    if (shouldVirtualize) {
      itemNodeProps.style = {
        ...itemNodeProps.style,
        minHeight: virtualRowEstimate,
      };
    }
    const checkboxNode = isSelectable && (
      <div key={`col-checkbox-${item.id}`} style={{ fontSize: 0 }} className="icon">
        <Checkbox
          checked={checked}
          disabled={!!item.disabled}
          onClick={(e) => {
            e.stopPropagation();
            setChecked(!checked);
          }}
        />
      </div>
    );
    const iconNode = renderIcon(item, rootId);
    const nameNode = (
      <TextAutoEllipsis title={item.name} className="shrink-1 grow-0 truncate break-all" key={`col-name-${item.id}`}>
        {/* Highlighter do not have a forwardRef, so we cannot use asChild here */}
        <Highlighter
          aria-label={item.name}
          searchWords={data?.keywords || []}
          autoEscape={true}
          textToHighlight={item.name}
        />
      </TextAutoEllipsis>
    );
    let itemNode: ReactNode = null;
    if (props.renderItem) {
      itemNode = props.renderItem({
        item,
        checked,
        setChecked,
        props: itemNodeProps,
        components: {
          checkbox: checkboxNode,
          icon: iconNode,
          name: nameNode,
        },
        rootId,
        data,
      });
    } else {
      itemNode = (
        <div {...itemNodeProps} key={item.id}>
          {checkboxNode}
          {iconNode}
          {nameNode}
          {item.isDir && <ChevronRight className="icon ml-auto" key={`${item.id}-chevron`} />}
        </div>
      );
    }
    if (item.disabled && typeof item.disabled === "string") {
      return (
        <Tooltip key={`${item.id}`}>
          <TooltipTrigger asChild>{itemNode}</TooltipTrigger>
          <TooltipContent className="flex max-w-128 items-center gap-1.5">
            <TriangleAlertIcon className="size-3 shrink-0 text-destructive" />
            {item.disabled}
          </TooltipContent>
        </Tooltip>
      );
    }
    return <React.Fragment key={`item-${item.id}`}>{itemNode}</React.Fragment>;
  };

  const renderFileList = () => {
    if (loading) {
      return <Loader2Icon className="mx-auto my-6 animate-spin" data-testid="loading" />;
    }
    if (error) {
      return (
        <div className="mx-auto text-center" data-testid="error-message">
          <div className="text-destructive">{error2String(error)}</div>
          <a
            className="cursor-pointer text-accent"
            onClick={() => {
              reload();
            }}
          >
            Retry
          </a>
        </div>
      );
    }
    const list = data?.list || [];
    if (list.length === 0) {
      return <div className="mx-auto my-6 text-center">No available files</div>;
    }

    if (shouldVirtualize) {
      const virtualItems = virtualizer.getVirtualItems();
      const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
      const paddingBottom =
        virtualItems.length > 0 ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0) : 0;
      return (
        <>
          {paddingTop > 0 && <div aria-hidden style={{ height: paddingTop }} />}
          {virtualItems.map((vi) => {
            const item = list[vi.index];
            if (!item) return null;
            return renderItemNode(item, {
              ref: virtualizer.measureElement,
              "data-index": `${vi.index}`,
            });
          })}
          {paddingBottom > 0 && <div aria-hidden style={{ height: paddingBottom }} />}
        </>
      );
    }

    return list.map((item) => renderItemNode(item));
  };

  const fileListNode = (
    <div
      className={cn(
        "h-[calc(100vh-30rem)] max-h-160 overflow-y-auto overflow-x-hidden !px-0",
        props.scrollableClassName,
      )}
      data-testid="scrollable-container"
      ref={containerRef}
      onClickCapture={(e) => {
        const pointerEvents = window.getComputedStyle(e.target as HTMLElement).getPropertyValue("pointer-events");
        if (pointerEvents === "none") {
          // fake click event triggered by Checkbox
          return;
        }
        const lastId = lastSelectedIdRef.current;

        let itemDiv: HTMLElement | null = e.target as HTMLElement;
        while (itemDiv && !itemDiv.dataset.id && itemDiv !== containerRef.current) {
          itemDiv = itemDiv.parentElement;
        }
        const currentId = itemDiv?.dataset.id;
        if (!itemDiv || !currentId) {
          return;
        }
        if (!e.shiftKey || !lastId) {
          // range start
          lastSelectedIdRef.current = currentId;
          recentRangeRef.current = [];
          return;
        }
        if (e.shiftKey && multiple && lastId) {
          // Shift-click to select multiple files
          if (currentId === lastId) return;
          e.stopPropagation();
          const oldRange = recentRangeRef.current;
          const rangeValue = findItemsBetween2Id(data?.list || [], currentId, lastId);
          recentRangeRef.current = Array.from(rangeValue.values());
          // (value - oldRange) + rangeValue
          value.forEach((item) => {
            if (oldRange.some((oldItem) => oldItem.id === item.id)) return;
            rangeValue.set(item.id, item);
          });
          onChange(
            Array.from(rangeValue.values()).filter(({ isDir, disabled }) => {
              const isSelectable = !isDir || props.allowDirSelection;
              return !disabled && isSelectable;
            }),
          );
        }
      }}
    >
      {renderFileList()}
      {loadingMore && <Loader2Icon className="mx-auto animate-spin" data-testid="loading-more" />}
    </div>
  );

  const selectionTipNode = multiple ? (
    <p className="flex items-center gap-2 text-2xs text-muted-foreground">
      <InfoIcon className="size-4" /> Hold shift + click to select a range of items.
    </p>
  ) : null;

  // Select All functionality
  const allSelectableItems = useMemo(
    () =>
      data?.list.filter((item) => {
        if (item.disabled) {
          return false;
        }
        if (!props.allowDirSelection && item.isDir) {
          return false;
        }
        return true;
      }) || [],
    [data?.list, props.allowDirSelection],
  );
  const showSelectAll = props.showSelectAll && multiple && allSelectableItems.length > 0 && !loading && !loadingMore;
  const isSelectedAll = useMemo(
    () => allSelectableItems.every((item) => value?.some((it) => it.id === item.id)),
    [allSelectableItems, value],
  );
  const selectAllNode = showSelectAll ? (
    <div className="flex items-center gap-2">
      <Checkbox
        id={selectAllId}
        checked={isSelectedAll}
        onCheckedChange={(check) => {
          if (check) {
            const newSelection = new Map<UIFileItem["id"], UIFileItem>();
            value?.forEach((item) => {
              newSelection.set(item.id, item);
            });
            allSelectableItems.forEach((item) => {
              newSelection.set(item.id, item);
            });
            onChange(Array.from(newSelection.values()));
          } else {
            const newSelection = value?.filter((item) => allSelectableItems.every((it) => it.id !== item.id));
            onChange(newSelection || []);
          }
        }}
      />
      <Label htmlFor={selectAllId}>Select All</Label>
    </div>
  ) : null;

  // If render prop is provided, use it
  if (props.render) {
    return props.render({
      breadcrumbs,
      setBreadcrumbs,
      components: {
        breadcrumbs: breadcrumbsNode,
        searchBar: searchBarNode,
        searchInput: searchInputNode,
        fileList: fileListNode,
        selectionTip: selectionTipNode,
        selectAll: selectAllNode,
      },
      keywords,
      setKeywords: setKeywordsByUser,
      containerRef,
      loading,
      loadingMore,
      error,
      data,
      reload,
    });
  }

  // Default render
  return (
    <div
      data-testid="file-explorer"
      className={cn(
        "min-h-0 w-full flex-1 divide-y rounded [&>*]:gap-2 [&>*]:px-4 [&>*]:py-2",
        props.borderless ? "" : "border ",
      )}
    >
      {Boolean(breadcrumbsNode || selectAllNode) && (
        <div className="flex items-center justify-between">
          {breadcrumbsNode}
          {selectAllNode}
        </div>
      )}
      {searchBarNode}
      {fileListNode}
      {selectionTipNode}
    </div>
  );
});
FileExplorer.displayName = "FileExplorer";
export default FileExplorer;

export function FileExplorerSelector(props: FileExplorerProps) {
  return (
    <Popover>
      <PopoverTrigger
        className="group inline-flex w-full flex-wrap gap-2 rounded-md border border-input px-3 py-2 text-left"
        disabled={props.disabled}
      >
        {(!props.value || props.value.length === 0) && (
          <div className="w-full flex-1 bg-transparent text-muted-foreground outline-none">Global</div>
        )}
        {props.value &&
          props.value.length > 0 &&
          props.value.map((f) => (
            <Badge key={f.id} className="flex items-center gap-2" variant="secondary">
              {f.isDir ? <FolderIcon className="icon" /> : <File className="icon" />}
              <TextAutoEllipsis className="max-w-52 flex-1 truncate">{f.name}</TextAutoEllipsis>
              {!props.disabled && (
                <X
                  className="icon cursor-pointer"
                  onClick={() => props.onChange?.(props.value!.filter((k) => k.id !== f.id))}
                />
              )}
            </Badge>
          ))}
      </PopoverTrigger>
      <PopoverContent className="pointer-events-auto w-[--radix-popover-trigger-width]" align="start">
        <FileExplorer scrollableClassName="max-h-[calc(50vh-12rem)]" {...props} />
      </PopoverContent>
    </Popover>
  );
}
