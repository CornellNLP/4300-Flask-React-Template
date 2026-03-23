import { FormEvent } from "react";
import searchIcon from "../assets/mag.png";

type SearchBarProps = {
    value: string;
    onChange: (nextValue: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    disabled?: boolean;
}

function SearchBar({ 
    value, 
    onChange, 
    onSubmit, 
    placeholder = "look up the best Brazilian wingers...", 
    disabled = false }: SearchBarProps): JSX.Element {
        const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
            event.preventDefault();
            onSubmit();
        };
        return (
            <form className="search-bar" onSubmit={handleSubmit}>
            <img className="search-bar-icon" src={searchIcon} alt="" aria-hidden="true" />
            <input
                className="search-bar-input"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                autoComplete="off"
                aria-label="Search players"
            />
            </form>
        );
    }
    export default SearchBar;