import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  FileImage,
  Globe,
  Languages,
  MonitorSmartphone,
  Moon,
  Newspaper,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import ArticleVerification from "./ArticleVerification";
import { useTheme } from "../contexts/DarkContext";
import LanguageSelector from "../components/LanguageSelector";
import { Localized } from "../contexts/LanguageContext";
import { getUserInfo, logout } from "../services/auth";
import api from "../services/api";

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
    key: "multilingual",
    name: "Multilinguisme",
    status: "En préparation",
    color: "warning",
    icon: Languages,
    description: "Traductions, repérage des termes-clés et adaptation par langue.",
    detail: "L’interface montre la structure du module sans backend complet.",
  },
  {
    key: "offline",
    name: "Accès hors ligne",
    status: "En préparation",
    color: "warning",
    icon: MonitorSmartphone,
    description: "Mise en cache, fichiers téléchargeables et lecture hors connexion.",
    detail: "Le module est conçu pour un espace de travail déconnecté.",
  },
  {
    key: "experts",
    name: "Annuaire des experts",
    status: "En préparation",
    color: "warning",
    icon: Users,
    description: "Références de personnes-ressources, compétences et crédibilité.",
    detail: "Le catalogue est prévu pour être enrichi par le réseau.",
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
  },
];

const initialSummary = [
  { label: "Sources répertoriées", value: "12 +", accent: "green" },
  { label: "Articles à vérifier", value: "08", accent: "amber" },
  { label: "Images analysées", value: "05", accent: "blue" },
  { label: "Module actifs", value: "2 / 8", accent: "purple" },
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

const ProjectDashboard = () => {
  const user = getUserInfo();
  const { darkMode, toggleTheme } = useTheme();
  const [selectedModule, setSelectedModule] = useState("sources");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState(defaultResult);
  const [errorMessage, setErrorMessage] = useState("");

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
        error.response?.data?.detail ||
          error.response?.data?.message ||
          "Impossible d’analyser cette image.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Localized>
    <main className="project-dashboard">
      <header className="project-header">
        <div className="project-brand-wrap">
          <div className="project-brand-mark">
            <BadgeCheck size={18} />
          </div>
          <div>
            <p className="eyebrow">CHECK-EKO</p>
            <h1>Tableau de bord projet</h1>
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
          <button type="button" className="logout-button" onClick={logout}>
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
                    onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  />
                  <FileImage size={28} />
                  <strong>{selectedFile ? selectedFile.name : "Choisir une image"}</strong>
                  <small>PNG, JPEG ou WEBP · jusqu’à 10 Mo</small>
                </label>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleUpload}
                  disabled={isSubmitting || !selectedFile}
                >
                  {isSubmitting ? "Analyse en cours…" : "Lancer l’analyse"}
                </button>
              </div>

              {errorMessage && <div className="error-box">{errorMessage}</div>}

              <div className="result-card">
                <p className="eyebrow">RAPPORT</p>
                <h3>{analysis.name || "Analyse d’image"}</h3>
                <p className="result-note">{analysis.assessment.note}</p>

                <div className="signal-grid">
                  <div className="signal-box">
                    <span>Détection IA</span>
                    <strong>{analysis.signals.ai_detection ? JSON.stringify(analysis.signals.ai_detection) : "—"}</strong>
                  </div>
                  <div className="signal-box">
                    <span>EXIF</span>
                    <strong>{analysis.signals.exif ? JSON.stringify(analysis.signals.exif) : "—"}</strong>
                  </div>
                  <div className="signal-box">
                    <span>C2PA</span>
                    <strong>{analysis.signals.c2pa_provenance ? JSON.stringify(analysis.signals.c2pa_provenance) : "—"}</strong>
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

          {module.key !== "authenticity" &&
            module.key !== "sources" &&
            module.key !== "watch" && (
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
          <span className="beta-tag">À venir</span>
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
