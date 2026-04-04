import React, { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";

/**
 * Reusable animated search + sort header used in community collections and collection hero.
 */
export default function SearchSortBar({
  placeholder = "Suchen...",
  searchQuery,
  onSearchQueryChange,
  sortOptions,
  sortValue,
  onSortChange,
  initialOpen = false,
  showSearchControl = true,
  showSortControls = true,
  showDiscoveredToggle = false,
  discoveredFilter = "all",
  onDiscoveredFilterChange,
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const headerRef = useRef(null);
  const searchQueryRef = useRef(searchQuery);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
    if (searchQuery) {
      setIsOpen(true);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (initialOpen) {
      setIsOpen(true);
    } else if (!searchQueryRef.current) {
      setIsOpen(false);
    }
  }, [initialOpen]);

  // Close search pill when clicking/tapping outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(event.target)) {
        if (!searchQueryRef.current) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleDiscovered = () => {
    if (!onDiscoveredFilterChange) return;
    let next = "all";
    if (discoveredFilter === "all") next = "discovered";
    else if (discoveredFilter === "discovered") next = "undiscovered";
    else if (discoveredFilter === "undiscovered") next = "all";
    onDiscoveredFilterChange(next);
  };

  const discoveredLabel = {
    all: "Alle",
    discovered: "Entdeckt",
    undiscovered: "Nicht entdeckt",
  }[discoveredFilter] || "Alle";

  return (
    <div
      ref={headerRef}
      className="flex items-center gap-2 overflow-x-hidden"
    >
      {showSearchControl && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`relative flex items-center bg-stone-100 border border-stone-200 shadow-sm rounded-full h-8 overflow-hidden transition-all duration-200 ease-out shrink-0 ${
            isOpen ? "flex-[0.55] min-w-[140px] px-3" : "w-8 justify-center"
          }`}
          aria-label="Suche öffnen"
        >
          <Search
            className={`w-4 h-4 text-stone-600 transition-all duration-200 ease-out ${
              isOpen ? "mr-2 flex-shrink-0" : ""
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder={placeholder}
            className={`bg-transparent border-0 outline-none text-[11px] placeholder:text-stone-400 text-stone-900 transition-all duration-200 ease-out ${
              isOpen
                ? "w-full opacity-100"
                : "w-0 opacity-0 pointer-events-none"
            }`}
          />
        </button>
      )}

      {showSortControls && (
        <div
          className="flex items-center rounded-full bg-stone-100 p-0.5 text-[11px] overflow-x-auto scrollbar-hide transition-all duration-200 ease-out flex-1 min-w-0"
        >
          {Array.isArray(sortOptions) && sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex-1 px-2 py-1 rounded-full whitespace-nowrap text-center ${
                sortValue === opt.value
                  ? "bg-white shadow text-stone-900"
                  : "text-stone-500"
              }`}
              onClick={() => onSortChange?.(opt.value)}
            >
              {opt.label}
            </button>
          ))}

          {showDiscoveredToggle && onDiscoveredFilterChange && (
            <button
              type="button"
              onClick={handleToggleDiscovered}
              className="ml-1 px-2 py-1 rounded-full bg-white/70 text-[10px] text-stone-600 hover:bg-white shadow flex items-center gap-1"
              aria-label={`Filter: ${discoveredLabel}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{discoveredLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
