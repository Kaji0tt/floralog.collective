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
  uiTheme = "dark",
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const headerRef = useRef(null);
  const searchQueryRef = useRef(searchQuery);
  const isLightUi = uiTheme === "light";

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

  const discoveredOptions = [
    { value: "all", label: "Alle", dotClassName: "bg-emerald-400" },
    { value: "discovered", label: "Entdeckt", dotClassName: "bg-emerald-400" },
    { value: "undiscovered", label: "Unentdeckt", dotClassName: "bg-stone-400" },
  ];
  const activeDiscoveredOptionIndex = Math.max(
    0,
    discoveredOptions.findIndex((option) => option.value === discoveredFilter)
  );
  const activeDiscoveredOption = discoveredOptions[activeDiscoveredOptionIndex];
  const cycleDiscoveredFilter = () => {
    const nextOption = discoveredOptions[(activeDiscoveredOptionIndex + 1) % discoveredOptions.length];
    onDiscoveredFilterChange?.(nextOption.value);
  };

  return (
    <div
      ref={headerRef}
      className="flex items-center gap-2 overflow-x-hidden"
    >
      {showSearchControl && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`relative flex items-center border backdrop-blur-sm rounded-full h-8 overflow-hidden transition-all duration-200 ease-out shrink-0 ${
            isLightUi ? "bg-white/70 border-[#c8ac62]/35" : "bg-black/40 border-[#f0e5a5]/35"
          } ${
            isOpen ? "flex-[0.55] min-w-[140px] px-3" : "w-8 justify-center"
          }`}
          aria-label="Suche öffnen"
        >
          <Search
            className={`w-4 h-4 transition-all duration-200 ease-out ${isLightUi ? "text-[#8f6b22]" : "text-[#f0e5a5]"} ${
              isOpen ? "mr-2 flex-shrink-0" : ""
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder={placeholder}
            className={`bg-transparent border-0 outline-none text-[11px] transition-all duration-200 ease-out ${isLightUi ? "placeholder:text-stone-500/80 text-stone-800" : "placeholder:text-stone-300/70 text-stone-100"} ${
              isOpen
                ? "w-full opacity-100"
                : "w-0 opacity-0 pointer-events-none"
            }`}
          />
        </button>
      )}

      {showSortControls && (
        <div
          className={"flex items-center rounded-full p-0.5 text-[11px] overflow-x-auto scrollbar-hide transition-all duration-200 ease-out flex-1 min-w-0 backdrop-blur-sm border " + (isLightUi ? "bg-white/60 border-[#c8ac62]/30" : "bg-black/30 border-[#f0e5a5]/30")}
        >
          {Array.isArray(sortOptions) && sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex-1 px-2 py-1 rounded-full whitespace-nowrap text-center ${
                sortValue === opt.value
                  ? (isLightUi ? "bg-white/90 border border-[#c8ac62]/55 text-[#8f6b22]" : "bg-black/60 border border-[#f0e5a5]/55 text-[#f7f0c1]")
                  : (isLightUi ? "text-stone-700 hover:bg-white/65" : "text-stone-200/85 hover:bg-black/35")
              }`}
              onClick={() => onSortChange?.(opt.value)}
            >
              {opt.label}
            </button>
          ))}

        </div>
      )}

      {showDiscoveredToggle && onDiscoveredFilterChange && (
        <button
          type="button"
          onClick={cycleDiscoveredFilter}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] backdrop-blur-sm ${
            isLightUi ? "bg-white/90 border-[#c8ac62]/55 text-[#8f6b22]" : "bg-black/60 border-[#f0e5a5]/55 text-[#f7f0c1]"
          }`}
          aria-label="Entdeckt-Filter"
        >
          <span className={`h-2 w-2 rounded-full ${activeDiscoveredOption.dotClassName}`} />
          {activeDiscoveredOption.label}
        </button>
      )}
    </div>
  );
}
