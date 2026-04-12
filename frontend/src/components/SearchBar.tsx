import { Search } from "lucide-react";
import { Input } from "./input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, onSubmit, placeholder }: SearchBarProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed && onSubmit) {
      onSubmit(trimmed);
    }
  };

  return (
    <form className="relative w-full" onSubmit={handleSubmit}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-red-400" />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search for cravings, cuisines, or vibes..."}
        className="pl-12 h-14 text-base rounded-full border-2 border-red-200 focus:border-red-400 transition-colors shadow-sm"
      />
    </form>
  );
}