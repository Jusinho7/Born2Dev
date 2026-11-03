import { useState, useRef, useEffect } from "react";

const languages = [
  { code: "fr", label: "Français", flag: "fr" },
  { code: "mg", label: "Malagasy", flag: "mg" },
  { code: "en", label: "English", flag: "gb" },
];

const LanguageSelector = ({ language, setLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const selected =
    languages.find((item) => item.code === language) || languages[0];

  useEffect(() => {
    const closeMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  return (
    <div className="language-selector" ref={menuRef}>
      <button
        type="button"
        className="language-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Choisir la langue"
      >
        <img
          src={`https://flagcdn.com/w40/${selected.flag}.png`}
          alt=""
        />
        <span>{selected.code.toUpperCase()}</span>
        <span className={`language-arrow ${isOpen ? "rotated" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="language-menu">
          {languages.map((item) => (
            <button
              type="button"
              key={item.code}
              className={`language-option ${
                language === item.code ? "selected" : ""
              }`}
              onClick={() => {
                setLanguage(item.code);
                setIsOpen(false);
              }}
            >
              <img
                src={`https://flagcdn.com/w40/${item.flag}.png`}
                alt=""
              />
              <span>{item.code.toUpperCase()} — {item.label}</span>
              {language === item.code && <span>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;