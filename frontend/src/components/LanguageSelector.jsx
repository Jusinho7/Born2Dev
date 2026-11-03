import { useLanguage } from "../contexts/LanguageContext";

const LANGUAGES = [
  { code: "mg", label: "Malagasy" },
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <label className="language-selector">
      <span className="language-selector-label">Language / Fiteny / Langue</span>
      <select
        aria-label="Language / Fiteny / Langue"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSelector;
