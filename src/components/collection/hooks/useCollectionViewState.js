import { useEffect, useRef, useState } from "react";

const COLLECTION_FILTERS_STORAGE_KEY = "collection_filters_by_collection_v1";
const COLLECTION_VIEW_STATE_STORAGE_KEY = "collection_view_state_v1";

export const DEFAULT_COLLECTION_FILTERS = {
  activeCategory: null,
  searchQuery: "",
  collectionSort: "index",
  discoveredFilter: "all",
  sortChipsOpen: true,
  heroSegmentOpen: true,
};

const readCollectionViewState = () => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(COLLECTION_VIEW_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export default function useCollectionViewState({
  initialCollectionId,
  onSelectedCollectionIdChange,
  isRouteMode,
  searchParams,
  setSearchParams,
}) {
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionSort, setCollectionSort] = useState("index");
  const [discoveredFilter, setDiscoveredFilter] = useState("all");
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialCollectionId || "global");
  const [sortChipsOpen, setSortChipsOpen] = useState(true);
  const listScrollContainerRef = useRef(null);
  const restoredScrollForCollectionRef = useRef(null);
  const collectionViewStateRef = useRef(readCollectionViewState());
  const [filterSettingsByCollection, setFilterSettingsByCollection] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(COLLECTION_FILTERS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const saveFiltersForCollection = (collectionId, partial) => {
    const key = collectionId || "global";
    setFilterSettingsByCollection((prev) => {
      const prevForKey = {
        ...DEFAULT_COLLECTION_FILTERS,
        ...(prev[key] || {}),
      };
      return {
        ...prev,
        [key]: {
          ...prevForKey,
          ...partial,
        },
      };
    });
  };

  useEffect(() => {
    if (!isRouteMode) return;
    const urlCollectionId = searchParams.get("collectionId");
    if (urlCollectionId && urlCollectionId !== selectedCollectionId) {
      setSelectedCollectionId(urlCollectionId);
      return;
    }
    if (!urlCollectionId && selectedCollectionId !== "global") {
      setSelectedCollectionId("global");
    }
  }, [isRouteMode, searchParams, selectedCollectionId]);

  useEffect(() => {
    if (isRouteMode) return;
    const nextId = initialCollectionId || "global";
    if (nextId !== selectedCollectionId) {
      setSelectedCollectionId(nextId);
    }
  }, [isRouteMode, initialCollectionId, selectedCollectionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        COLLECTION_FILTERS_STORAGE_KEY,
        JSON.stringify(filterSettingsByCollection)
      );
    } catch {
      // Ignore localStorage write errors silently
    }
  }, [filterSettingsByCollection]);

  useEffect(() => {
    const key = selectedCollectionId || "global";
    const saved = filterSettingsByCollection[key];
    const next = {
      ...DEFAULT_COLLECTION_FILTERS,
      ...(saved || {}),
    };
    setActiveCategory(next.activeCategory || null);
    setSearchQuery(next.searchQuery || "");
    setCollectionSort(next.collectionSort);
    setDiscoveredFilter(next.discoveredFilter);
    setSortChipsOpen(Boolean(next.sortChipsOpen));
  }, [selectedCollectionId, filterSettingsByCollection]);

  const persistCollectionViewState = (updater) => {
    if (typeof window === "undefined") return;
    const previous = collectionViewStateRef.current || {};
    const next = typeof updater === "function" ? updater(previous) : { ...previous, ...updater };
    collectionViewStateRef.current = next;
    try {
      window.sessionStorage.setItem(COLLECTION_VIEW_STATE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore sessionStorage write errors silently
    }
  };

  const persistCurrentScrollPosition = () => {
    const key = selectedCollectionId || "global";
    const currentTop = listScrollContainerRef.current?.scrollTop || 0;
    persistCollectionViewState((prev) => ({
      ...prev,
      scrollByCollection: {
        ...(prev.scrollByCollection || {}),
        [key]: currentTop,
      },
    }));
  };

  useEffect(() => {
    return () => {
      persistCurrentScrollPosition();
    };
  }, [selectedCollectionId]);

  const handleCollectionListScroll = () => {
    persistCurrentScrollPosition();
  };

  const handleCollectionChipSelect = (nextCollectionId) => {
    const currentKey = selectedCollectionId || "global";
    const nextKey = nextCollectionId || "global";

    if (nextKey === currentKey) {
      const currentConfig = {
        ...DEFAULT_COLLECTION_FILTERS,
        ...(filterSettingsByCollection[currentKey] || {}),
      };
      saveFiltersForCollection(currentKey, {
        heroSegmentOpen: !currentConfig.heroSegmentOpen,
      });
      return;
    }

    setSelectedCollectionId(nextCollectionId);
    if (typeof onSelectedCollectionIdChange === "function") {
      onSelectedCollectionIdChange(nextCollectionId);
    }

    if (!isRouteMode) return;

    const nextParams = new URLSearchParams(searchParams);
    if (nextCollectionId === "global") {
      nextParams.delete("collectionId");
      nextParams.delete("from");
    } else {
      nextParams.set("collectionId", nextCollectionId);
      nextParams.delete("from");
    }

    setSearchParams(nextParams, { replace: true });
  };

  const restoreScrollForCollection = (collectionId) => {
    const key = collectionId || "global";
    if (restoredScrollForCollectionRef.current === key) return;
    if (!listScrollContainerRef.current) return;

    const savedTop = collectionViewStateRef.current?.scrollByCollection?.[key];
    const nextTop = Number.isFinite(savedTop) ? savedTop : 0;

    window.requestAnimationFrame(() => {
      if (!listScrollContainerRef.current) return;
      listScrollContainerRef.current.scrollTop = nextTop;
      restoredScrollForCollectionRef.current = key;
    });
  };

  return {
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    collectionSort,
    setCollectionSort,
    discoveredFilter,
    setDiscoveredFilter,
    selectedCollectionId,
    setSelectedCollectionId,
    sortChipsOpen,
    setSortChipsOpen,
    filterSettingsByCollection,
    saveFiltersForCollection,
    handleCollectionChipSelect,
    listScrollContainerRef,
    handleCollectionListScroll,
    restoreScrollForCollection,
  };
}
