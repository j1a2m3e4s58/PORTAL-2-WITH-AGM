import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDefaultAgmYear } from "@/pages/registration/registration-form-utils";

const STORAGE_KEY = "agm-active-year";

type AgmYearContextValue = {
  activeYear: string;
  setActiveYear: (year: string) => void;
  yearOptions: string[];
};

const AgmYearContext = createContext<AgmYearContextValue | null>(null);

export function AgmYearProvider({ children }: { children: React.ReactNode }) {
  const [activeYear, setActiveYearState] = useState(() => {
    if (typeof window === "undefined") return getDefaultAgmYear();
    return window.localStorage.getItem(STORAGE_KEY) ?? getDefaultAgmYear();
  });

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<string>();
    for (let year = currentYear - 3; year <= 2099; year += 1) {
      years.add(String(year));
    }
    years.add(activeYear);
    return [...years].sort((left, right) => Number(left) - Number(right));
  }, [activeYear]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, activeYear);
  }, [activeYear]);

  const value = useMemo(
    () => ({
      activeYear,
      setActiveYear: setActiveYearState,
      yearOptions,
    }),
    [activeYear, yearOptions],
  );

  return (
    <AgmYearContext.Provider value={value}>{children}</AgmYearContext.Provider>
  );
}

export function useAgmYear() {
  const context = useContext(AgmYearContext);
  if (!context) {
    throw new Error("useAgmYear must be used within AgmYearProvider");
  }
  return context;
}
