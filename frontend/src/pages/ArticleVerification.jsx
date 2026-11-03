import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  FileCheck2,
  FilePlus2,
  LoaderCircle,
  LogOut,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import useDocumentTitle from "../components/useDocumentTitle";
import { Localized, useLanguage } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/DarkContext";
import { logout, getUserInfo } from "../services/auth";
import {
  createArticle,
  createClaim,
  createEvidence,
  createSource,
  getArticles,
  getClaims,
  getEvidence,
  getSources,
} from "../services/sourceReliability";
import { getErrorMessage } from "../utils/getErrorMessage";

const EMPTY_ARTICLE = {
  source_id: "",
  title: "",
  url: "",
  author: "",
  published_at: "",
};

const EMPTY_SOURCE = {
  name: "",
  source_type: "",
  region: "",
  language: "",
  url: "",
  description: "",
};

const STATUS_LABELS = {
  to_verify: "À vérifier",
  inconclusive: "Non concluante",
  partially_corroborated: "Partiellement recoupée",
  corroborated: "Recoupée",
  contradictory: "Contradictoire",
};

const STATUS_STYLES = {
  to_verify: "pending",
  inconclusive: "inconclusive",
  partially_corroborated: "partial",
  corroborated: "verified",
  contradictory: "contradictory",
};

const formatDate = (date, language) => {
  if (!date) return "Date non précisée";
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime())
    ? date
    : new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(
        parsedDate,
      );
};

const fetchWorkspaceData = async () => {
  const [articleResponse, sourceResponse] = await Promise.all([
    getArticles(),
    getSources(),
  ]);
  return {
    articles: articleResponse.data,
    sources: sourceResponse.data,
  };
};

const ArticleVerification = () => {
  const { darkMode, toggleTheme } = useTheme();
  const { language } = useLanguage();
  const dateLocale = { mg: "mg-MG", fr: "fr-FR", en: "en-US" }[language];
  const [articles, setArticles] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [claims, setClaims] = useState([]);
  const [claimsArticleId, setClaimsArticleId] = useState("");
  const [failedClaimsArticleId, setFailedClaimsArticleId] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [evidenceClaimId, setEvidenceClaimId] = useState("");
  const [articleForm, setArticleForm] = useState(EMPTY_ARTICLE);
  const [sourceForm, setSourceForm] = useState(EMPTY_SOURCE);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [claimText, setClaimText] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({
    source_id: "",
    url: "",
    relation: "supports",
    excerpt: "",
    note: "",
    independent_source_confirmed: false,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const claimsRequest = useRef(0);
  const user = getUserInfo();

  useDocumentTitle("Vérification des articles");

  const selectedArticle = useMemo(
    () => articles.find((article) => article.id === selectedArticleId),
    [articles, selectedArticleId],
  );
  const displayedClaims = useMemo(
    () => (claimsArticleId === selectedArticleId ? claims : []),
    [claims, claimsArticleId, selectedArticleId],
  );
  const selectedClaim = useMemo(
    () =>
      displayedClaims.find((claim) => claim.id === selectedClaimId),
    [displayedClaims, selectedClaimId],
  );
  const claimsAreLoading =
    Boolean(selectedArticleId) &&
    claimsArticleId !== selectedArticleId &&
    failedClaimsArticleId !== selectedArticleId;
  const selectedClaimEvidence =
    evidenceClaimId === selectedClaimId ? evidence : [];
  const filteredArticles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr");
    if (!query) return articles;
    return articles.filter((article) =>
      `${article.title} ${article.source_name} ${article.author || ""}`
        .toLocaleLowerCase("fr")
        .includes(query),
    );
  }, [articles, search]);

  const applyWorkspaceData = useCallback(({ articles: loadedArticles, sources: loadedSources }) => {
    setArticles(loadedArticles);
    setSources(loadedSources);
    setShowSourceForm(loadedSources.length === 0);
    setSelectedArticleId((current) =>
      loadedArticles.some((article) => article.id === current)
        ? current
        : loadedArticles[0]?.id || "",
    );
    setArticleForm((current) => ({
      ...current,
      source_id: current.source_id || loadedSources[0]?.id || "",
    }));
  }, []);

  const loadWorkspace = useCallback(async () => {
    try {
      applyWorkspaceData(await fetchWorkspaceData());
      setError("");
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Impossible de charger les articles et les sources.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [applyWorkspaceData]);

  const handleSourceSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await createSource({
        ...sourceForm,
        description: sourceForm.description || null,
      });
      setSources((current) => [...current, data]);
      setArticleForm((current) => ({ ...current, source_id: data.id }));
      setEvidenceForm((current) => ({ ...current, source_id: data.id }));
      setSourceForm(EMPTY_SOURCE);
      setShowSourceForm(false);
      setNotice("Source ajoutée à l’annuaire.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Impossible d’ajouter cette source."));
    } finally {
      setSaving(false);
    }
  };

  const loadClaims = useCallback(async (articleId) => {
    if (!articleId) return;
    const requestId = ++claimsRequest.current;
    try {
      const response = await getClaims(articleId);
      if (requestId !== claimsRequest.current) return;
      setClaims(response.data);
      setClaimsArticleId(articleId);
      setFailedClaimsArticleId("");
      setSelectedClaimId((current) =>
        response.data.some((claim) => claim.id === current)
          ? current
          : response.data[0]?.id || "",
      );
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Impossible de charger les affirmations."),
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchWorkspaceData()
      .then((data) => {
        if (active) {
          applyWorkspaceData(data);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            getErrorMessage(
              requestError,
              "Impossible de charger les articles et les sources.",
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyWorkspaceData]);

  useEffect(() => {
    const requestId = ++claimsRequest.current;
    if (!selectedArticleId) return undefined;
    let active = true;
    getClaims(selectedArticleId)
      .then(({ data }) => {
        if (!active || requestId !== claimsRequest.current) return;
        setClaims(data);
        setClaimsArticleId(selectedArticleId);
        setFailedClaimsArticleId("");
        setSelectedClaimId((current) =>
          data.some((claim) => claim.id === current)
            ? current
            : data[0]?.id || "",
        );
      })
      .catch((requestError) => {
        if (active && requestId === claimsRequest.current) {
          setFailedClaimsArticleId(selectedArticleId);
          setError(
            getErrorMessage(
              requestError,
              "Impossible de charger les affirmations.",
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [selectedArticleId]);

  useEffect(() => {
    if (!selectedClaimId || !selectedClaim) return undefined;
    let active = true;
    getEvidence(selectedClaimId)
      .then(({ data }) => {
        if (active) {
          setEvidence(data);
          setEvidenceClaimId(selectedClaimId);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            getErrorMessage(requestError, "Impossible de charger les preuves."),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [selectedClaim, selectedClaimId]);

  const handleRefresh = () => {
    setLoading(true);
    setError("");
    setNotice("");
    loadWorkspace();
  };

  const handleArticleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await createArticle({
        ...articleForm,
        author: articleForm.author || null,
        published_at: articleForm.published_at || null,
      });
      setArticles((current) => [data, ...current]);
      setSelectedArticleId(data.id);
      setArticleForm({ ...EMPTY_ARTICLE, source_id: sources[0]?.id || "" });
      setNotice("Article ajouté à votre espace de vérification.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Impossible d’ajouter cet article."));
    } finally {
      setSaving(false);
    }
  };

  const handleClaimSubmit = async (event) => {
    event.preventDefault();
    if (!selectedArticleId || !claimText.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { data } = await createClaim(selectedArticleId, {
        text: claimText.trim(),
      });
      setClaims((current) => [...current, data]);
      setClaimsArticleId(selectedArticleId);
      setSelectedClaimId(data.id);
      setClaimText("");
      setNotice("Affirmation ajoutée. Vous pouvez maintenant la recouper.");
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Impossible d’ajouter cette affirmation."),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEvidenceSubmit = async (event) => {
    event.preventDefault();
    if (!selectedClaimId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await createEvidence(selectedClaimId, {
        ...evidenceForm,
        excerpt: evidenceForm.excerpt || null,
        note: evidenceForm.note || null,
      });
      const { data } = await getEvidence(selectedClaimId);
      setEvidence(data);
      setEvidenceClaimId(selectedClaimId);
      await loadClaims(selectedArticleId);
      setNotice("Élément de preuve enregistré.");
      setEvidenceForm((current) => ({
        ...current,
        url: "",
        excerpt: "",
        note: "",
        independent_source_confirmed: false,
      }));
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Impossible d’enregistrer cette preuve."),
      );
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    user?.username || user?.name || user?.email?.split("@")[0] || "Rédaction";
  const initials = displayName.slice(0, 1).toLocaleUpperCase("fr");

  return (
    <Localized>
    <main className="verification-page">
      <header className="verification-header">
        <a className="verification-brand" href="/" aria-label="Check-Eko, accueil">
          <span className="verification-brand-mark">
            <ShieldCheck size={22} />
          </span>
          <span>
            <strong>Check-Eko</strong>
            <small>La vérification au service de l’info</small>
          </span>
        </a>

        <nav className="verification-nav" aria-label="Navigation principale">
          <a className="active" href="#workspace">
            Vérification
          </a>
          <a href="#articles">Articles</a>
        </nav>

        <div className="verification-account">
          <button
            type="button"
            className="verification-icon-button"
            onClick={toggleTheme}
            aria-label={
              darkMode ? "Activer le thème clair" : "Activer le thème sombre"
            }
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="verification-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="verification-user" data-no-translate>
            {displayName}
          </span>
          <button
            type="button"
            className="verification-logout"
            onClick={logout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <section className="verification-intro" id="workspace">
        <div>
          <p className="verification-eyebrow">ESPACE DE RÉDACTION</p>
          <h1>Vérifier une information</h1>
          <p className="verification-subtitle">
            Enregistrez un article, isolez ses affirmations et confrontez-les à
            des sources documentées.
          </p>
        </div>
        <div className="verification-session">
          <span className="session-indicator" />
          Session active
        </div>
      </section>

      {error && (
        <div className="verification-alert error" role="alert">
          <CircleAlert size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="verification-alert success" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}

      <section className="verification-layout" id="articles">
        <aside className="article-sidebar">
          <div className="sidebar-heading">
            <div>
              <p className="verification-eyebrow">VOTRE ESPACE</p>
              <h2>Articles</h2>
            </div>
            <span className="article-count">{articles.length}</span>
          </div>
          <label className="article-search">
            <Search size={17} />
            <input
              type="search"
              placeholder="Rechercher un article"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Rechercher un article"
            />
          </label>

          <div className="article-list">
            {loading ? (
              <div className="verification-loading">
                <LoaderCircle className="spin" size={20} />
                <span>Chargement...</span>
              </div>
            ) : error && !articles.length ? (
              <div className="sidebar-empty">
                <CircleAlert size={22} />
                <p>Les articles ne peuvent pas être affichés pour le moment.</p>
              </div>
            ) : filteredArticles.length ? (
              filteredArticles.map((article) => (
                <button
                  type="button"
                  className={`article-list-item ${
                    article.id === selectedArticleId ? "selected" : ""
                  }`}
                  key={article.id}
                  onClick={() => setSelectedArticleId(article.id)}
                >
                  <span className="article-list-icon">
                    <FileCheck2 size={18} />
                  </span>
                  <span className="article-list-copy" data-no-translate>
                    <strong>{article.title}</strong>
                    <small>{article.source_name}</small>
                    <small>{formatDate(article.published_at, dateLocale)}</small>
                  </span>
                  <ChevronDown size={16} className="article-chevron" />
                </button>
              ))
            ) : (
              <div className="sidebar-empty">
                <FilePlus2 size={22} />
                <p>{search ? "Aucun résultat." : "Aucun article pour le moment."}</p>
              </div>
            )}
          </div>

          <div className="source-manager">
            <button
              type="button"
              className="source-manager-toggle"
              onClick={() => setShowSourceForm((current) => !current)}
              aria-expanded={showSourceForm}
            >
              <span>
                <Plus size={15} />
                {sources.length ? "Ajouter une source à l’annuaire" : "Créer une source"}
              </span>
              <ChevronDown
                size={15}
                className={showSourceForm ? "expanded" : ""}
              />
            </button>
            {showSourceForm && (
              <form className="source-form" onSubmit={handleSourceSubmit}>
                <label>
                  Nom de la source
                  <input
                    required
                    maxLength={160}
                    value={sourceForm.name}
                    onChange={(event) =>
                      setSourceForm({ ...sourceForm, name: event.target.value })
                    }
                    placeholder="Ex. Radio Madagasikara"
                  />
                </label>
                <div className="form-row">
                  <label>
                    Type
                    <input
                      required
                      maxLength={80}
                      value={sourceForm.source_type}
                      onChange={(event) =>
                        setSourceForm({
                          ...sourceForm,
                          source_type: event.target.value,
                        })
                      }
                      placeholder="Média"
                    />
                  </label>
                  <label>
                    Région
                    <input
                      required
                      maxLength={120}
                      value={sourceForm.region}
                      onChange={(event) =>
                        setSourceForm({
                          ...sourceForm,
                          region: event.target.value,
                        })
                      }
                      placeholder="National"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Langue
                    <input
                      required
                      maxLength={100}
                      value={sourceForm.language}
                      onChange={(event) =>
                        setSourceForm({
                          ...sourceForm,
                          language: event.target.value,
                        })
                      }
                      placeholder="Malagasy"
                    />
                  </label>
                  <label>
                    Site web
                    <input
                      required
                      type="url"
                      value={sourceForm.url}
                      onChange={(event) =>
                        setSourceForm({ ...sourceForm, url: event.target.value })
                      }
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <button
                  className="verification-primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Plus size={16} />
                  )}
                  Enregistrer la source
                </button>
              </form>
            )}
          </div>

          <form className="new-article-form" onSubmit={handleArticleSubmit}>
            <div className="form-section-heading">
              <span className="mini-icon">
                <Plus size={16} />
              </span>
              <div>
                <strong>Nouvel article</strong>
                <small>Ajoutez un contenu à vérifier</small>
              </div>
            </div>
            <label>
              Titre de l’article
              <input
                required
                maxLength={300}
                value={articleForm.title}
                onChange={(event) =>
                  setArticleForm({ ...articleForm, title: event.target.value })
                }
                placeholder="Ex. Une annonce à vérifier"
              />
            </label>
            <label>
              Source
              <select
                required
                value={articleForm.source_id}
                onChange={(event) =>
                  setArticleForm({
                    ...articleForm,
                    source_id: event.target.value,
                  })
                }
                disabled={!sources.length}
              >
                <option value="" disabled>
                  {sources.length
                    ? "Sélectionner une source"
                    : "Aucune source enregistrée"}
                </option>
                {sources.map((source) => (
                  <option value={source.id} key={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              URL de l’article
              <input
                required
                type="url"
                value={articleForm.url}
                onChange={(event) =>
                  setArticleForm({ ...articleForm, url: event.target.value })
                }
                placeholder="https://..."
              />
            </label>
            <div className="form-row">
              <label>
                Auteur <span>(facultatif)</span>
                <input
                  value={articleForm.author}
                  onChange={(event) =>
                    setArticleForm({
                      ...articleForm,
                      author: event.target.value,
                    })
                  }
                  placeholder="Nom"
                />
              </label>
              <label>
                Date <span>(facultatif)</span>
                <input
                  type="date"
                  value={articleForm.published_at}
                  onChange={(event) =>
                    setArticleForm({
                      ...articleForm,
                      published_at: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            <button
              className="verification-primary-button"
              type="submit"
              disabled={saving || !sources.length}
            >
              {saving ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Plus size={17} />
              )}
              Ajouter l’article
            </button>
          </form>
        </aside>

        <section className="verification-content" aria-live="polite">
          {loading ? (
            <div className="workspace-empty">
              <LoaderCircle className="spin" size={28} />
              <p>Préparation de votre espace...</p>
            </div>
          ) : selectedArticle ? (
            <>
              <article className="selected-article-card">
                <div className="selected-article-icon">
                  <FileCheck2 size={22} />
                </div>
                <div className="selected-article-details">
                  <p className="verification-eyebrow">
                    ARTICLE · {selectedArticle.source_name}
                  </p>
                  <h2 data-no-translate>{selectedArticle.title}</h2>
                  <p>
                    {selectedArticle.author
                      ? `Par ${selectedArticle.author} · `
                      : ""}
                    {formatDate(selectedArticle.published_at, dateLocale)}
                  </p>
                </div>
                <a
                  className="article-source-link"
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ouvrir la source <ArrowUpRight size={16} />
                </a>
              </article>

              <div className="claims-heading">
                <div>
                  <p className="verification-eyebrow">ANALYSE ÉDITORIALE</p>
                  <h2>Affirmations à vérifier</h2>
                </div>
                <span className="claims-count">
                  {displayedClaims.length}{" "}
                  {displayedClaims.length === 1
                    ? "affirmation"
                    : "affirmations"}
                </span>
              </div>

              {claimsAreLoading ? (
                <div className="verification-loading claim-loading">
                  <LoaderCircle className="spin" size={18} />
                  <span>Chargement des affirmations...</span>
                </div>
              ) : failedClaimsArticleId === selectedArticleId ? (
                <div className="workspace-empty compact">
                  <CircleAlert size={22} />
                  <strong>Affirmations indisponibles</strong>
                  <p>Réessayez de charger cet article.</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => loadClaims(selectedArticleId)}
                  >
                    Réessayer
                  </button>
                </div>
              ) : displayedClaims.length ? (
                <div className="claims-list">
                  {displayedClaims.map((claim, index) => (
                    <button
                      type="button"
                      key={claim.id}
                      className={`claim-card ${
                        selectedClaimId === claim.id ? "selected" : ""
                      }`}
                      onClick={() => setSelectedClaimId(claim.id)}
                    >
                      <span className="claim-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="claim-copy">
                        <strong>{claim.text}</strong>
                        <small>
                          {claim.evidence_count} preuve
                          {claim.evidence_count === 1 ? "" : "s"} ·{" "}
                          {claim.distinct_sources} source
                          {claim.distinct_sources === 1 ? "" : "s"}
                        </small>
                      </span>
                      <span
                        className={`claim-status ${
                          STATUS_STYLES[claim.status] || "pending"
                        }`}
                      >
                        {STATUS_LABELS[claim.status] || claim.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="workspace-empty compact">
                  <FileCheck2 size={28} />
                  <strong>Aucune affirmation enregistrée</strong>
                  <p>Ajoutez les affirmations précises à confronter aux faits.</p>
                </div>
              )}

              <form className="claim-composer" onSubmit={handleClaimSubmit}>
                <label htmlFor="claim-text">Ajouter une affirmation</label>
                <div className="claim-input-row">
                  <input
                    id="claim-text"
                    required
                    maxLength={2000}
                    value={claimText}
                    onChange={(event) => setClaimText(event.target.value)}
                    placeholder="Saisissez une affirmation précise de l’article..."
                  />
                  <button
                    className="verification-primary-button"
                    type="submit"
                    disabled={saving || !claimText.trim()}
                  >
                    {saving ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Plus size={17} />
                    )}
                    Ajouter
                  </button>
                </div>
              </form>

              {selectedClaim && (
                <section className="evidence-panel">
                  <div className="evidence-heading">
                    <div>
                      <p className="verification-eyebrow">RECOUPEMENT MANUEL</p>
                      <h3>Éléments de preuve</h3>
                    </div>
                    {selectedClaim.independent_sources_confirmed && (
                      <span className="independence-chip">
                        <Check size={14} /> Indépendance déclarée
                      </span>
                    )}
                  </div>
                  <p className="selected-claim-quote" data-no-translate>
                    « {selectedClaim.text} »
                  </p>

                  {selectedClaimEvidence.length ? (
                    <ul className="evidence-list">
                      {selectedClaimEvidence.map((item) => (
                        <li key={item.id}>
                          <span
                            className={`evidence-relation ${item.relation}`}
                          >
                            {item.relation === "supports"
                              ? "Étaye"
                              : item.relation === "contradicts"
                                ? "Contredit"
                                : "Contextualise"}
                          </span>
                          <div>
                            <a
                              data-no-translate
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {item.source_name} <ArrowUpRight size={14} />
                            </a>
                            {item.excerpt && (
                              <p data-no-translate>« {item.excerpt} »</p>
                            )}
                            {item.note && (
                              <small className="evidence-note" data-no-translate>
                                {item.note}
                              </small>
                            )}
                          </div>
                          {item.independent_source_confirmed && (
                            <span
                              className="evidence-confirmed"
                              title="Indépendance confirmée manuellement"
                            >
                              <Check size={15} />
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-evidence">
                      Aucune preuve n’a encore été ajoutée à cette affirmation.
                    </p>
                  )}

                  <form
                    className="evidence-form"
                    onSubmit={handleEvidenceSubmit}
                  >
                    <h4>Consigner une preuve</h4>
                    <div className="evidence-form-grid">
                      <label>
                        Source de l’annuaire
                        <select
                          required
                          value={evidenceForm.source_id}
                          onChange={(event) =>
                            setEvidenceForm({
                              ...evidenceForm,
                              source_id: event.target.value,
                            })
                          }
                        >
                          <option value="" disabled>
                            Choisir une source
                          </option>
                          {sources.map((source) => (
                            <option value={source.id} key={source.id}>
                              {source.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Relation avec l’affirmation
                        <select
                          value={evidenceForm.relation}
                          onChange={(event) =>
                            setEvidenceForm({
                              ...evidenceForm,
                              relation: event.target.value,
                            })
                          }
                        >
                          <option value="supports">Étaye</option>
                          <option value="contradicts">Contredit</option>
                          <option value="contextualizes">Contextualise</option>
                        </select>
                      </label>
                      <label className="evidence-url-field">
                        URL de la preuve
                        <input
                          required
                          type="url"
                          value={evidenceForm.url}
                          onChange={(event) =>
                            setEvidenceForm({
                              ...evidenceForm,
                              url: event.target.value,
                            })
                          }
                          placeholder="https://..."
                        />
                      </label>
                      <label>
                        Extrait <span>(facultatif)</span>
                        <textarea
                          rows="2"
                          maxLength={2000}
                          value={evidenceForm.excerpt}
                          onChange={(event) =>
                            setEvidenceForm({
                              ...evidenceForm,
                              excerpt: event.target.value,
                            })
                          }
                          placeholder="Passage pertinent"
                        />
                      </label>
                      <label>
                        Note éditoriale <span>(facultatif)</span>
                        <textarea
                          rows="2"
                          maxLength={1000}
                          value={evidenceForm.note}
                          onChange={(event) =>
                            setEvidenceForm({
                              ...evidenceForm,
                              note: event.target.value,
                            })
                          }
                          placeholder="Commentaire de vérification"
                        />
                      </label>
                    </div>
                    <label className="independence-checkbox">
                      <input
                        type="checkbox"
                        checked={evidenceForm.independent_source_confirmed}
                        onChange={(event) =>
                          setEvidenceForm({
                            ...evidenceForm,
                            independent_source_confirmed: event.target.checked,
                          })
                        }
                      />
                      <span>
                        J’ai vérifié manuellement que cette source est
                        indépendante.
                        <small>
                          Cette déclaration n’est pas vérifiée automatiquement.
                        </small>
                      </span>
                    </label>
                    <button
                      className="verification-primary-button"
                      type="submit"
                      disabled={saving || !sources.length}
                    >
                      {saving ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <Plus size={17} />
                      )}
                      Enregistrer la preuve
                    </button>
                  </form>
                </section>
              )}
            </>
          ) : (
            <div className="workspace-empty welcome-empty">
              <span className="empty-illustration">
                <FilePlus2 size={30} />
              </span>
              <h2>Commencez une vérification</h2>
              <p>
                Ajoutez un article dans le panneau de gauche. Ses affirmations
                et preuves seront regroupées ici.
              </p>
              {!sources.length && !loading && !error && (
                <span className="source-prerequisite">
                  <CircleAlert size={16} />
                  Ajoutez d’abord une source à l’annuaire pour enregistrer un
                  article.
                </span>
              )}
              <button
                type="button"
                className="text-button"
                onClick={handleRefresh}
              >
                Actualiser les données
              </button>
            </div>
          )}
        </section>
      </section>

      <footer className="verification-footer">
        <span>
          <ShieldCheck size={15} />
          La décision finale reste éditoriale.
        </span>
        <span>Check-Eko · Espace sécurisé par session</span>
      </footer>
    </main>
    </Localized>
  );
};

export default ArticleVerification;
