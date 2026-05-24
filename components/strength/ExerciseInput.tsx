"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { getExerciseNames } from "@/lib/actions";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function ExerciseInput({ id, value, onChange, placeholder, required }: Props) {
  const [allNames, setAllNames] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getExerciseNames().then(setAllNames);
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    const lower = value.toLowerCase();
    setSuggestions(allNames.filter((name) => name.toLowerCase().includes(lower)));
  }, [value, allNames]);

  function handleSelect(name: string) {
    onChange(name);
    setSuggestions([]);
    setFocused(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setSuggestions([]);
      setFocused(false);
    }
  }

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay hiding to allow click on suggestion to register
          setTimeout(() => setFocused(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
      />
      {showDropdown && (
        <ul className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md py-1">
          {suggestions.map((name) => (
            <li
              key={name}
              onMouseDown={(e) => {
                // Prevent blur from firing before click
                e.preventDefault();
                handleSelect(name);
              }}
              className="px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
