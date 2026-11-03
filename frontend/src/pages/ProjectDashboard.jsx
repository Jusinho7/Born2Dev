import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Expand,
  FileImage,
  Globe,
  LogOut,
  Moon,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import ArticleVerification from "./ArticleVerification";
import ExpertsDirectory from "./ExpertsDirectory";
import { useTheme } from "../contexts/DarkContext";
import LanguageSelector from "../components/LanguageSelector";
import { Localized } from "../contexts/LanguageContext";
import { getUserInfo, logout } from "../services/auth";
import { getErrorMessage } from "../utils/getErrorMessage";
import api from "../services/api";
import { useSearchParams } from "react-router-dom";
import logo from "../../public/fanilo.png";
import "../App.css";

const MonitoringWorkspace = lazy(() => import("./MonitoringWorkspace"));

const moduleDefinitions = [
  {
    key: "sources",
    name: "Vérification des sources",
    status: "Actif",
    color: "success",
    icon: ShieldCheck,
    description: "Catalogue, évaluation et recoupement manuel des affirmations.",
    detail: "Nominalement prêt pour la rédaction et la vérification des faits.",
  },
  {
    key: "authenticity",
    name: "Authentification des images",
    status: "Actif",
    color: "success",
    icon: FileImage,
    description: "Inspection EXIF, détection IA et C2PA en un seul rapport.",
    detail: "Le backend expose /authenticity et /check pour les images.",
  },
  {
    key: "watch",
    name: "Veille nationale",
    status: "Actif",
    color: "success",
    icon: Newspaper,
    description: "Suivi thématique des sujets sensibles et signalements nationaux.",
    detail: "Collecte RSS, recherche, carte régionale, tendances et alertes.",
  },
  {
    key: "experts",
    name: "Annuaire des experts",
    status: "Actif",
    color: "success",
    icon: Users,
    description: "Références de personnes-ressources, compétences et crédibilité.",
    detail: "Annuaire consultable des personnes-ressources et de leurs domaines.",
  },
  {
    key: "stats",
    name: "Statistiques actualisées",
    status: "En préparation",
    color: "warning",
    icon: TrendingUp,
    description: "Indicateurs temps réel, bilan de vérification et suivi des performances.",
    detail: "Le module est prêt à recevoir les données de production.",
  },
  {
    key: "editorial",
    name: "Inspiration éditoriale",
    status: "En préparation",
    color: "warning",
    icon: BookOpenText,
    description: "Conseils, modèles de rédaction et aide à la formulation.",
    detail: "Un espace de recommandations éditoriales est prévu ici.",
  }
];

const initialSummary = [
  { label: "Sources répertoriées", value: "12 +", accent: "green" },
  { label: "Articles à vérifier", value: "08", accent: "amber" },
  { label: "Images analysées", value: "05", accent: "blue" },
  { label: "Modules actifs", value: "4 / 6", accent: "purple" },
];

const defaultResult = {
  name: "",
  assessment: {
    result: "non_conclusif",
    note: "Téléchargez une image pour lancer l’analyse.",
  },
  signals: {
    ai_detection: null,
    exif: null,
    c2pa_provenance: null,
  },
};

const getAiSummary = (detection) => {
  if (!detection) return "Aucune information disponible.";
  if (detection.result === "générée par IA") {
    return "Un indice suggère que cette image pourrait avoir été créée par une IA.";
  }
  if (detection.result === "réelle") {
    return "Aucun indice clair d’image créée par une IA n’a été détecté.";
  }
  return "Le résultat de la détection IA n’est pas disponible.";
};

const getExifSummary = (exif) => {
  if (!exif) return "Aucune information disponible.";
  if (!exif.has_exif) {
    return "Aucune information supplémentaire trouvée. Cela ne permet pas de confirmer l’origine de l’image.";
  }
  if (exif.editing_software_detected) {
    return "Des informations indiquent que l’image a pu être modifiée avec un logiciel.";
  }
  return "Des informations sur l’image sont présentes, mais elles ne prouvent pas son origine.";
};

const getC2paSummary = (provenance) => {
  if (!provenance) return "Aucune information disponible.";
  const summaries = {
    trusted: "L’origine est accompagnée d’une signature reconnue comme fiable.",
    valid_untrusted:
      "Une signature est présente, mais son auteur n’est pas reconnu comme fiable.",
    invalid: "La signature d’origine n’a pas passé la vérification.",
    unverified: "L’origine de l’image n’a pas pu être confirmée.",
    not_found: "Aucune signature d’origine n’a été trouvée.",
    unreadable: "Les informations sur l’origine n’ont pas pu être lues.",
    unsupported_format: "Le format de cette image ne permet pas cette vérification.",
  };
  return summaries[provenance.status] || "L’origine de l’image n’a pas pu être confirmée.";
};

const ProjectDashboard = () => {
  const user = getUserInfo();
  const { darkMode, toggleTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedModule = searchParams.get("module");
  const selectedModule = moduleDefinitions.some((entry) => entry.key === requestedModule)
    ? requestedModule
    : "sources";
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState(defaultResult);
  const [errorMessage, setErrorMessage] = useState("");
  const previewDialogRef = useRef(null);
  const logoutDialogRef = useRef(null);

  const setSelectedModule = (key) => {
    const nextParams = new URLSearchParams(searchParams);
    if (key === "sources") {
      nextParams.delete("module");
    } else {
      nextParams.set("module", key);
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const dialog = previewDialogRef.current;
    if (!dialog) return;

    if (isPreviewOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isPreviewOpen && dialog.open) {
      dialog.close();
    }
  }, [isPreviewOpen]);

  useEffect(() => {
    const dialog = logoutDialogRef.current;
    if (!dialog) return;

    if (isLogoutDialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isLogoutDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [isLogoutDialogOpen]);

  const module = useMemo(
    () => moduleDefinitions.find((entry) => entry.key === selectedModule) ?? moduleDefinitions[0],
    [selectedModule],
  );

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrorMessage("Sélectionnez une image avant de lancer l’analyse.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await api.post("/authenticity", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAnalysis(response.data);
    } catch (error) {
      setAnalysis(defaultResult);
      setErrorMessage(
        getErrorMessage(error, "Impossible d’analyser cette image."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    const nextPreviewUrl = file ? URL.createObjectURL(file) : "";
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setIsPreviewOpen(false);
    setAnalysis(defaultResult);
    setErrorMessage("");
  };

  return (
    <Localized>
    <main className="project-dashboard">
      <header className="project-header">
        <div className="project-brand-wrap">
          <div className="project-brand-mark">
            <img
                className="project-brand-logo"
                src={logo}
                alt="Logo"
            />
          </div>
          <div>
            <h1 className="project-title"><span className="one">CHECK</span>-<span className="two">EKO</span></h1>
          </div>
        </div>

        <div className="project-header-actions">
          <LanguageSelector />
          <button type="button" className="ghost-button" onClick={() => setSelectedModule("authenticity")}>
            Vérifier une image
          </button>
          <button
            type="button"
            className="theme-button"
            onClick={toggleTheme}
            aria-label={darkMode ? "Activer le thème clair" : "Activer le thème sombre"}
            title={darkMode ? "Activer le thème clair" : "Activer le thème sombre"}
          >
            {darkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div className="user-chip" data-no-translate>
            <span>{(user?.username || user?.email || "Rédaction").slice(0, 1).toUpperCase()}</span>
            <small>{user?.username || user?.email || "Rédaction"}</small>
          </div>
          <button
            type="button"
            className="logout-button"
            onClick={() => setIsLogoutDialogOpen(true)}
          >
            <LogOut size={15} />
            Déconnexion
          </button>
        </div>
      </header>

      <section className="summary-grid">
        {initialSummary.map((stat) => (
          <article key={stat.label} className={`summary-card ${stat.accent}`}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="project-layout">
        <aside className="module-sidebar">
          <p className="eyebrow">MODULES</p>
          <div className="module-list">
            {moduleDefinitions.map((entry) => {
              const Icon = entry.icon;
              const isActive = entry.key === selectedModule;
              return (
                <button
                  type="button"
                  key={entry.key}
                  className={`module-card ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedModule(entry.key)}
                >
                  <span className={`status-dot ${entry.color}`} />
                  <Icon size={16} />
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.status}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="workspace-panel">
          <div className="feature-header">
            <div>
              <p className="eyebrow">FONCTION</p>
              <h2>{module.name}</h2>
            </div>
            <span className={`status-pill ${module.color}`}>{module.status}</span>
          </div>

          {module.key === "authenticity" && (
            <div className="authenticity-panel">
              <div className="upload-card">
                <label className="upload-box">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                  />
                  <FileImage size={28} />
                  <strong>{selectedFile ? selectedFile.name : "Choisir une image"}</strong>
                  <small>PNG, JPEG ou WEBP · jusqu’à 10 Mo</small>
                </label>
                {selectedFile && previewUrl && (
                  <button
                    type="button"
                    className="image-preview-trigger"
                    onClick={() => setIsPreviewOpen(true)}
                    aria-label={`Agrandir l’aperçu de ${selectedFile.name}`}
                    title="Agrandir l’aperçu"
                  >
                    <img src={previewUrl} alt={`Aperçu de ${selectedFile.name}`} />
                    <span>
                      <Expand size={14} />
                      Agrandir l’image
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleUpload}
                  disabled={isSubmitting || !selectedFile}
                >
                  {isSubmitting ? "Analyse en cours…" : "Lancer l’analyse"}
                </button>
              </div>

              {errorMessage && <div className="error-box" role="alert">{errorMessage}</div>}

              <div className="result-card">
                <p className="eyebrow">RAPPORT</p>
                <h3>{analysis.name || "Analyse d’image"}</h3>
                <div className="result-overview">
                  <strong>Résultat non concluant</strong>
                  <p>
                    Ces vérifications donnent des indices, mais ne permettent
                    pas de confirmer avec certitude si l’image est authentique.
                </p>
                </div>

                <div className="signal-grid">
                  <div className="signal-box">
                    <span>Détection IA</span>
                    <strong>{getAiSummary(analysis.signals.ai_detection)}</strong>
                  </div>
                  <div className="signal-box">
                    <span>EXIF</span>
                    <strong>{getExifSummary(analysis.signals.exif)}</strong>
                  </div>
                  <div className="signal-box">
                    <span>C2PA</span>
                    <strong>{getC2paSummary(analysis.signals.c2pa_provenance)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {module.key === "sources" && (
            <div className="embedded-module">
              <ArticleVerification />
            </div>
          )}

          {module.key === "watch" && (
            <Suspense fallback={<div className="placeholder-card">Chargement du centre de veille…</div>}>
              <MonitoringWorkspace />
            </Suspense>
          )}

          {module.key === "experts" && <ExpertsDirectory />}

          {module.key !== "authenticity" &&
            module.key !== "sources" &&
            module.key !== "watch" &&
            module.key !== "experts" && (
            <div className="placeholder-card">
              <div className="placeholder-icon">
                <Sparkles size={22} />
              </div>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
              <div className="placeholder-meta">
                <span>{module.detail}</span>
                <button type="button" className="secondary-button">
                  Préparer la suite <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      {previewUrl && selectedFile && (
        <dialog
          ref={previewDialogRef}
          className="image-preview-dialog"
          aria-label={`Aperçu de ${selectedFile.name}`}
          onClose={() => setIsPreviewOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsPreviewOpen(false);
            }
          }}
        >
          <div className="image-preview-dialog-header">
            <strong>{selectedFile.name}</strong>
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              aria-label="Fermer l’aperçu"
            >
              <X size={18} />
            </button>
          </div>
          <img
            className="image-preview-large"
            src={previewUrl}
            alt={`Aperçu agrandi de ${selectedFile.name}`}
          />
        </dialog>
      )}

      <dialog
        ref={logoutDialogRef}
        className="logout-confirm-dialog"
        aria-labelledby="logout-confirm-title"
        aria-describedby="logout-confirm-description"
        onClose={() => setIsLogoutDialogOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsLogoutDialogOpen(false);
          }
        }}
      >
        <div className="logout-confirm-icon">
          <LogOut size={20} />
        </div>
        <h2 id="logout-confirm-title">Confirmer la déconnexion</h2>
        <p id="logout-confirm-description">
          Voulez-vous vraiment vous déconnecter de votre compte ?
        </p>
        <div className="logout-confirm-actions">
          <button
            type="button"
            className="logout-cancel-button"
            onClick={() => setIsLogoutDialogOpen(false)}
          >
            Annuler
          </button>
          <button
            type="button"
            className="logout-confirm-button"
            onClick={logout}
          >
            Oui, me déconnecter
          </button>
        </div>
      </dialog>

      <section className="bottom-grid">
        <article className="bottom-card">
          <div className="mini-title">
            <Globe size={16} />
            <strong>Veille nationale</strong>
          </div>
          <p>Centre de veille prêt : flux RSS, actualités et alertes.</p>
          <button type="button" className="secondary-button" onClick={() => setSelectedModule("watch")}>
            Ouvrir la veille <ArrowRight size={15} />
          </button>
        </article>

        <article className="bottom-card">
          <div className="mini-title">
            <Users size={16} />
            <strong>Réseau d’experts</strong>
          </div>
          <p>Personnes-ressources, expertise, contact et crédibilité.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelectedModule("experts")}
          >
            Ouvrir l’annuaire <ArrowRight size={15} />
          </button>
        </article>

        <article className="bottom-card">
          <div className="mini-title">
            <TrendingUp size={16} />
            <strong>Statistiques</strong>
          </div>
          <p>Suivi de vérification, indicateurs et rythme d’édition.</p>
          <span className="beta-tag">À venir</span>
        </article>
      </section>
    </main>
    </Localized>
  );
};

export default ProjectDashboard;
