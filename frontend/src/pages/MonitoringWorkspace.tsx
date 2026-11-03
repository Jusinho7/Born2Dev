import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Globe2,
  Layers3,
  MapPinned,
  Newspaper,
  Plus,
  RefreshCw,
  Rss,
  Search,
  ShieldAlert,
  Trash2,
  TrendingUp,
} from "lucide-react";
import api from "../services/api";
import { Localized, useLanguage } from "../contexts/LanguageContext";

const MonitoringMap = lazy(() => import("./MonitoringMap"));
const VolumeChart = lazy(() =>
  import("./MonitoringCharts").then((module) => ({ default: module.VolumeChart })),
);
const CategoryChart = lazy(() =>
  import("./MonitoringCharts").then((module) => ({ default: module.CategoryChart })),
);
const TrendChart = lazy(() =>
  import("./MonitoringCharts").then((module) => ({ default: module.TrendChart })),
);

type ViewKey =
  | "overview"
  | "articles"
  | "map"
  | "trends"
  | "contradictions"
  | "alerts"
  | "sources";

type Article = {
  id: number;
  source_id: number;
  source_name: string;
  title: string;
  summary: string | null;
  content: string | null;
  original_url: string;
  author: string | null;
  published_at: string | null;
  collected_at: string;
  image_url: string | null;
  language: string | null;
  category: string;
  category_suggestion: string;
  category_reviewed: boolean;
  region: string | null;
  region_evidence: string | null;
};

type Source = {
  id: number;
  name: string;
  url: string;
  media_type: string;
  region: string | null;
  languages: string[];
  rss_url: string;
  is_active: boolean;
  collection_interval_minutes: number;
  last_collected_at: string | null;
};

type Dashboard = {
  total_articles: number;
  active_sources: number;
  pending_alerts: number;
  categories: Record<string, number>;
  daily_volume: Array<{ date: string; count: number }>;
  regional_coverage_count: number;
  recent_articles: Article[];
  recent_collections: Array<{
    id: number;
    source_name: string;
    status: string;
    inserted_count: number;
    created_at: string;
  }>;
};

type Trend = {
  keyword: string;
  article_count: number;
  source_count: number;
  first_seen_at: string;
  change_percent: number | null;
  sample_titles: string[];
};

type Region = {
  name: string;
  article_count: number;
  categories: Record<string, number>;
  coordinates: [number, number];
};

type Alert = {
  id: number;
  alert_type: string;
  title: string;
  detail: string;
  keyword: string | null;
  region: string | null;
  is_read: boolean;
  created_at: string;
};

type AlertRule = {
  id: number;
  alert_type: string;
  keyword: string | null;
  region: string | null;
  threshold: number;
  is_active: boolean;
};

type Contradiction = {
  event_title: string;
  article_ids: number[];
  sources: string[];
  differing_numbers: string[];
  note: string;
};

type ArticlePage = { items: Article[]; page: number; page_size: number; total: number };
type SourceForm = {
  name: string;
  url: string;
  media_type: string;
  region: string;
  languages: string;
  rss_url: string;
  collection_interval_minutes: number;
  is_active: boolean;
};

const BASE = "/api/v1/monitoring";
const CATEGORIES = [
  "Politique",
  "Économie",
  "Société",
  "Santé",
  "Éducation",
  "Environnement",
  "Sécurité",
  "Technologie",
  "Sport",
  "Culture",
  "Autre",
];
const REGIONS = [
  "Alaotra-Mangoro",
  "Amoron'i Mania",
  "Analamanga",
  "Analanjirofo",
  "Androy",
  "Anosy",
  "Atsimo-Andrefana",
  "Atsimo-Atsinanana",
  "Atsinanana",
  "Betsiboka",
  "Boeny",
  "Bongolava",
  "Diana",
  "Haute Matsiatra",
  "Ihorombe",
  "Itasy",
  "Melaky",
  "Menabe",
  "Sava",
  "Sofia",
  "Vakinankaratra",
  "Vatovavy",
  "Fitovinany",
];
const TABS: Array<{ key: ViewKey; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "Vue générale", icon: Activity },
  { key: "articles", label: "Fil d’actualités", icon: Newspaper },
  { key: "map", label: "Carte nationale", icon: MapPinned },
  { key: "trends", label: "Tendances", icon: TrendingUp },
  { key: "contradictions", label: "Contradictions", icon: CircleHelp },
  { key: "alerts", label: "Alertes", icon: Bell },
  { key: "sources", label: "Sources médiatiques", icon: Rss },
];
const EMPTY_SOURCE: SourceForm = {
  name: "",
  url: "",
  media_type: "Média en ligne",
  region: "",
  languages: "Malagasy, Français",
  rss_url: "",
  collection_interval_minutes: 60,
  is_active: true,
};
const toErrorMessage = (error: unknown) => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error ? error.message : "La requête a échoué.";
};

const formatDate = (value: string | null, locale: string) =>
  value
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "Date non précisée";

const MonitoringWorkspace = () => {
  const { language } = useLanguage();
  const dateLocale = { mg: "mg-MG", fr: "fr-FR", en: "en-US" }[language];
  const [view, setView] = useState<ViewKey>("overview");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [articles, setArticles] = useState<ArticlePage | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [keyword, setKeyword] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [regionEvidence, setRegionEvidence] = useState("");
  const [sourceForm, setSourceForm] = useState<SourceForm>(EMPTY_SOURCE);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);
  const [alertKeyword, setAlertKeyword] = useState("");
  const [alertType, setAlertType] = useState("keyword");
  const [alertRegion, setAlertRegion] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refreshOverview = useCallback(async () => {
    const [dashboardResponse, sourceResponse, alertResponse, regionResponse, trendResponse] =
      await Promise.all([
        api.get<Dashboard>(`${BASE}/dashboard`),
        api.get<Source[]>(`${BASE}/sources`),
        api.get<Alert[]>(`${BASE}/alerts`),
        api.get<Region[]>(`${BASE}/regions`),
        api.get<Trend[]>(`${BASE}/trends`),
      ]);
    setDashboard(dashboardResponse.data);
    setSources(sourceResponse.data);
    setAlerts(alertResponse.data);
    setRegions(regionResponse.data);
    setTrends(trendResponse.data);
  }, []);

  const loadArticles = useCallback(async () => {
    const response = await api.get<ArticlePage>(`${BASE}/articles`, {
      params: {
        keyword: keyword || undefined,
        region: regionFilter || undefined,
        category: categoryFilter || undefined,
        language: languageFilter || undefined,
        source_id: sourceFilter ? Number(sourceFilter) : undefined,
        start_date: startDate ? `${startDate}T00:00:00` : undefined,
        end_date: endDate ? `${endDate}T23:59:59` : undefined,
        page,
        page_size: 15,
      },
    });
    setArticles(response.data);
  }, [categoryFilter, endDate, keyword, languageFilter, page, regionFilter, sourceFilter, startDate]);

  const loadAlertsAndRules = useCallback(async () => {
    const [alertResponse, rulesResponse] = await Promise.all([
      api.get<Alert[]>(`${BASE}/alerts`),
      api.get<AlertRule[]>(`${BASE}/alerts/rules`),
    ]);
    setAlerts(alertResponse.data);
    setAlertRules(rulesResponse.data);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await refreshOverview();
      } catch (requestError) {
        setError(toErrorMessage(requestError));
      }
    };
    void load();
  }, [refreshOverview]);

  useEffect(() => {
    const load = async () => {
      try {
        if (view === "articles") await loadArticles();
        if (view === "alerts") await loadAlertsAndRules();
        if (view === "contradictions") {
          const response = await api.get<Contradiction[]>(`${BASE}/contradictions`);
          setContradictions(response.data);
        }
      } catch (requestError) {
        setError(toErrorMessage(requestError));
      }
    };
    void load();
  }, [loadAlertsAndRules, loadArticles, view]);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (requestError) {
      setError(toErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const submitSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...sourceForm,
      region: sourceForm.region || null,
      languages: sourceForm.languages
        .split(",")
        .map((language) => language.trim())
        .filter(Boolean),
    };
    await runAction(async () => {
      if (editingSourceId) {
        await api.put(`${BASE}/sources/${editingSourceId}`, payload);
      } else {
        await api.post(`${BASE}/sources`, payload);
      }
      setSourceForm(EMPTY_SOURCE);
      setEditingSourceId(null);
      await refreshOverview();
    }, editingSourceId ? "Source mise à jour." : "Source ajoutée.");
  };

  const openSourceEditor = (source: Source) => {
    setEditingSourceId(source.id);
    setSourceForm({
      name: source.name,
      url: source.url,
      media_type: source.media_type,
      region: source.region || "",
      languages: source.languages.join(", "),
      rss_url: source.rss_url,
      collection_interval_minutes: source.collection_interval_minutes,
      is_active: source.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runSourceOperation = async (
    source: Source,
    operation: "test" | "collect" | "delete",
  ) => {
    await runAction(async () => {
      if (operation === "delete") {
        await api.delete(`${BASE}/sources/${source.id}`);
        await refreshOverview();
        return;
      }
      const { data } = await api.post(`${BASE}/sources/${source.id}/${operation}`);
      if (operation === "test") {
        setNotice(
          data.valid
            ? `Flux valide : ${data.entry_count} article(s) trouvé(s).`
            : "Le flux ne contient pas d’articles valides.",
        );
      } else {
        setNotice(
          `Collecte ${data.status} : ${data.inserted_count} nouvel(aux) article(s), ${data.duplicate_count} doublon(s).`,
        );
        await refreshOverview();
      }
    }, operation === "delete" ? "Source désactivée; son attribution reste conservée." : "");
  };

  const updateCategory = async (article: Article, category: string) => {
    await runAction(async () => {
      const { data } = await api.patch<Article>(`${BASE}/articles/${article.id}/category`, {
        category,
        reviewed: true,
      });
      setSelectedArticle(data);
      await loadArticles();
    }, "Catégorie validée par la rédaction.");
  };

  const updateRegion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedArticle || !regionFilter) return;
    await runAction(async () => {
      const { data } = await api.patch<Article>(
        `${BASE}/articles/${selectedArticle.id}/region`,
        { region: regionFilter, evidence: regionEvidence },
      );
      setSelectedArticle(data);
      await loadArticles();
      await refreshOverview();
    }, "Région attribuée avec sa justification.");
  };

  const createKeywordRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      await api.post(`${BASE}/alerts/rules`, {
        alert_type: alertType,
        keyword: alertType === "keyword" || alertType === "trend" ? alertKeyword || null : null,
        region: alertType === "region" ? alertRegion : null,
        threshold: alertThreshold,
        is_active: true,
      });
      setAlertKeyword("");
      setAlertRegion("");
      await loadAlertsAndRules();
    }, "Alerte par mot-clé créée.");
  };

  const openArticle = async (articleId: number) => {
    await runAction(async () => {
      const { data } = await api.get<Article>(`${BASE}/articles/${articleId}`);
      setSelectedArticle(data);
      setRegionEvidence(data.region_evidence || "");
      setView("articles");
    }, "");
  };

  const renderArticleList = (items: Article[]) => (
    <div className="monitor-article-list">
      {items.length === 0 ? (
        <div className="monitor-empty">
          <Newspaper size={22} />
          <strong>Aucun article pour ces filtres</strong>
          <span>Ajoutez des sources RSS et lancez une collecte pour alimenter la veille.</span>
        </div>
      ) : (
        items.map((article) => (
          <button
            type="button"
            className={`monitor-article-row ${selectedArticle?.id === article.id ? "selected" : ""}`}
            key={article.id}
            onClick={() => {
              setSelectedArticle(article);
              setRegionEvidence(article.region_evidence || "");
            }}
          >
            <span className="monitor-article-icon"><FileText size={17} /></span>
            <span className="monitor-article-copy" data-no-translate>
              <strong>{article.title}</strong>
              <small>
                {article.source_name} · {formatDate(article.published_at, dateLocale)} · {article.language || "Langue inconnue"}
              </small>
              {article.summary && <span>{article.summary}</span>}
            </span>
            <span className="monitor-article-tags">
              <em>{article.category}</em>
              {article.region && <em>{article.region}</em>}
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))
      )}
    </div>
  );

  const selectedRegionData = regions.find((item) => item.name === regionFilter);

  return (
    <Localized>
    <section className="monitoring-workspace">
      <header className="monitoring-heading">
        <div>
          <p className="eyebrow">CHECK-EKO · VEILLE NATIONALE</p>
          <h2>Centre de veille informationnelle</h2>
          <p>Actualités publiques des médias malgaches, centralisées avec leur source et attribution.</p>
        </div>
        <button
          type="button"
          className="monitor-refresh"
          disabled={busy}
          onClick={() =>
            runAction(
              async () => {
                await refreshOverview();
                if (view === "articles") await loadArticles();
              },
              "Données actualisées depuis la base.",
            )
          }
        >
          <RefreshCw size={15} /> Actualiser
        </button>
      </header>

      <nav className="monitor-tabs" aria-label="Navigation de la veille">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            type="button"
            key={key}
            className={view === key ? "active" : ""}
            onClick={() => {
              setError("");
              setNotice("");
              setView(key);
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {error && <div className="monitor-message error"><AlertTriangle size={15} />{error}</div>}
      {notice && <div className="monitor-message success"><Check size={15} />{notice}</div>}

      {view === "overview" && (
        <>
          <div className="monitor-kpi-grid">
            <article><span><FileText size={16} /> Articles collectés</span><strong>{dashboard?.total_articles ?? "—"}</strong></article>
            <article><span><Rss size={16} /> Sources actives</span><strong>{dashboard?.active_sources ?? "—"}</strong></article>
            <article><span><Bell size={16} /> Alertes non lues</span><strong>{dashboard?.pending_alerts ?? "—"}</strong></article>
            <article><span><MapPinned size={16} /> Régions couvertes</span><strong>{dashboard?.regional_coverage_count ?? "—"} <small>/ 23</small></strong></article>
          </div>
          <div className="monitor-chart-grid">
            <article className="monitor-card">
              <div className="monitor-card-title"><div><p className="eyebrow">ACTIVITÉ</p><h3>Publications collectées</h3></div><Activity size={17} /></div>
              <div className="monitor-chart">
                <Suspense fallback={<div className="monitor-muted">Chargement du graphique…</div>}>
                  <VolumeChart data={dashboard?.daily_volume ?? []} />
                </Suspense>
              </div>
            </article>
            <article className="monitor-card">
              <div className="monitor-card-title"><div><p className="eyebrow">CLASSIFICATION</p><h3>Répartition par catégorie</h3></div><Layers3 size={17} /></div>
              <div className="monitor-chart">
                <Suspense fallback={<div className="monitor-muted">Chargement du graphique…</div>}>
                  <CategoryChart categories={dashboard?.categories ?? {}} />
                </Suspense>
              </div>
            </article>
          </div>
          <div className="monitor-lower-grid">
            <article className="monitor-card">
              <div className="monitor-card-title"><div><p className="eyebrow">DERNIÈRES PUBLICATIONS</p><h3>Fil d’actualité</h3></div><button type="button" className="monitor-link" onClick={() => setView("articles")}>Tout voir <ChevronRight size={14} /></button></div>
              {renderArticleList(dashboard?.recent_articles ?? [])}
            </article>
            <article className="monitor-card">
              <div className="monitor-card-title"><div><p className="eyebrow">JOURNALISATION</p><h3>Dernières collectes</h3></div><RefreshCw size={16} /></div>
              <div className="monitor-collection-list">
                {(dashboard?.recent_collections ?? []).map((run) => (
                  <div className="monitor-collection-row" key={run.id}>
                    <span className={`collection-state ${run.status}`} />
                    <span><strong>{run.source_name}</strong><small>{formatDate(run.created_at, dateLocale)}</small></span>
                    <em>+{run.inserted_count}</em>
                  </div>
                ))}
                {!dashboard?.recent_collections.length && <p className="monitor-muted">Aucune collecte enregistrée.</p>}
              </div>
            </article>
          </div>
        </>
      )}

      {view === "articles" && (
        <div className="monitor-card">
          <div className="monitor-card-title">
            <div><p className="eyebrow">EXPLORATION</p><h3>Fil d’actualités</h3></div>
            <span className="monitor-total">{articles?.total ?? 0} résultat(s)</span>
          </div>
          <div className="monitor-filters">
            <label className="monitor-search"><Search size={16} /><input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1); }} placeholder="Mot-clé ou expression" /></label>
            <select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }}><option value="">Toutes les sources</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select>
            <select value={regionFilter} onChange={(event) => { setRegionFilter(event.target.value); setPage(1); }}><option value="">Toutes les régions</option>{REGIONS.map((region) => <option key={region}>{region}</option>)}</select>
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">Toutes les catégories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
            <select value={languageFilter} onChange={(event) => { setLanguageFilter(event.target.value); setPage(1); }}><option value="">Toutes les langues</option><option>Malagasy</option><option>Français</option><option>English</option></select>
            <label className="monitor-date-filter">Du<input type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setPage(1); }} /></label>
            <label className="monitor-date-filter">Au<input type="date" value={endDate} onChange={(event) => { setEndDate(event.target.value); setPage(1); }} /></label>
            <button type="button" className="monitor-refresh" onClick={() => loadArticles().catch((requestError: unknown) => setError(toErrorMessage(requestError)))}>Filtrer</button>
          </div>
          {renderArticleList(articles?.items ?? [])}
          <div className="monitor-pagination">
            <span>Page {page} · {articles?.total ?? 0} article(s)</span>
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Précédent</button>
            <button type="button" disabled={!articles || page * articles.page_size >= articles.total} onClick={() => setPage((value) => value + 1)}>Suivant <ChevronRight size={15} /></button>
          </div>
          {selectedArticle && (
            <div className="monitor-detail">
              <div className="monitor-detail-head"><div><p className="eyebrow">DÉTAIL DE L’ARTICLE</p><h3>{selectedArticle.title}</h3></div><button type="button" onClick={() => setSelectedArticle(null)}>×</button></div>
              <p>{selectedArticle.summary || "Aucun résumé fourni par le flux."}</p>
              <div className="monitor-detail-meta"><span>Source : <strong>{selectedArticle.source_name}</strong></span><span>Publié : {formatDate(selectedArticle.published_at, dateLocale)}</span><span>Collecté : {formatDate(selectedArticle.collected_at, dateLocale)}</span><a href={selectedArticle.original_url} target="_blank" rel="noreferrer">Ouvrir l’article <ArrowUpRight size={13} /></a></div>
              <div className="monitor-review-row">
                <label>Catégorie suggérée / validée
                  <select value={selectedArticle.category} onChange={(event) => updateCategory(selectedArticle, event.target.value)}>
                    {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
                <span>{selectedArticle.category_reviewed ? "Validée par la rédaction" : `Suggestion automatique : ${selectedArticle.category_suggestion}`}</span>
              </div>
              <form className="monitor-region-form" onSubmit={updateRegion}>
                <label>Région justifiée
                  <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)} required><option value="">Choisir une région</option>{REGIONS.map((region) => <option key={region}>{region}</option>)}</select>
                </label>
                <label>Élément justificatif
                  <input value={regionEvidence} onChange={(event) => setRegionEvidence(event.target.value)} minLength={8} required placeholder="Lieu cité, dateline ou déclaration explicite" />
                </label>
                <button className="monitor-refresh" type="submit" disabled={busy || !regionFilter}>Enregistrer</button>
              </form>
            </div>
          )}
        </div>
      )}

      {view === "map" && (
        <div className="monitor-map-layout">
          <article className="monitor-card monitor-map-card">
            <div className="monitor-card-title"><div><p className="eyebrow">COUVERTURE GÉOGRAPHIQUE</p><h3>Actualités par région</h3></div><Globe2 size={17} /></div>
            <Suspense fallback={<div className="monitor-leaflet-map monitor-empty">Chargement de la carte…</div>}>
              <MonitoringMap regions={regions} onRegionSelect={setRegionFilter} />
            </Suspense>
            <p className="monitor-map-note">Les marqueurs indiquent des positions régionales approximatives, pas des frontières. Une attribution régionale nécessite un élément justificatif enregistré.</p>
          </article>
          <article className="monitor-card">
            <div className="monitor-card-title"><div><p className="eyebrow">LES 23 RÉGIONS</p><h3>Couverture et sujets</h3></div><MapPinned size={17} /></div>
            <div className="monitor-region-list">
              {regions.map((item) => (
                <button type="button" key={item.name} className={regionFilter === item.name ? "selected" : ""} onClick={() => setRegionFilter(item.name)}>
                  <span><strong>{item.name}</strong><small>{Object.keys(item.categories).length ? Object.keys(item.categories).join(" · ") : "Pas encore d’article attribué"}</small></span><em>{item.article_count}</em>
                </button>
              ))}
            </div>
          </article>
          {selectedRegionData && <div className="monitor-map-filter"><strong>{selectedRegionData.name}</strong> · {selectedRegionData.article_count} article(s) · <button type="button" onClick={() => { setView("articles"); setPage(1); }}>Voir les actualités filtrées</button></div>}
        </div>
      )}

      {view === "trends" && (
        <div className="monitor-card">
          <div className="monitor-card-title"><div><p className="eyebrow">ANALYSE DES PUBLICATIONS</p><h3>Sujets fréquemment cités sur 7 jours</h3></div><TrendingUp size={17} /></div>
          <p className="monitor-caveat">Détection lexicale exploratoire à partir des titres et résumés collectés. Les résultats ne représentent pas une analyse d’opinion ni une conclusion journalistique.</p>
          <div className="monitor-trend-chart">
            <Suspense fallback={<div className="monitor-muted">Chargement du graphique…</div>}>
              <TrendChart trends={trends} />
            </Suspense>
          </div>
          <div className="monitor-trend-list">
            {trends.map((trend, index) => (
              <article key={trend.keyword}>
                <span className="monitor-trend-rank">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong data-no-translate>{trend.keyword}</strong>
                  <small>{trend.source_count} source(s) · Première apparition : {formatDate(trend.first_seen_at, dateLocale)}</small>
                  <p data-no-translate>{trend.sample_titles.join(" · ")}</p>
                </div>
                <em>{trend.article_count} publication(s)</em>
                <span className={trend.change_percent !== null && trend.change_percent > 0 ? "trend-up" : "trend-neutral"}>{trend.change_percent === null ? "Nouveau" : `${trend.change_percent > 0 ? "+" : ""}${trend.change_percent}%`}</span>
                <button type="button" className="monitor-trend-open" onClick={() => { setKeyword(trend.keyword); setPage(1); setView("articles"); }}>Voir les articles</button>
              </article>
            ))}
            {!trends.length && <div className="monitor-empty"><TrendingUp size={22} /><strong>Pas encore assez de données</strong><span>Les tendances apparaissent lorsque les flux contiennent assez d’articles sur une période de 7 jours.</span></div>}
          </div>
        </div>
      )}

      {view === "contradictions" && (
        <div className="monitor-card">
          <div className="monitor-card-title"><div><p className="eyebrow">PISTES DE VÉRIFICATION</p><h3>Divergences numériques entre sources</h3></div><ShieldAlert size={17} /></div>
          <div className="monitor-warning"><AlertTriangle size={17} /><span>Détection expérimentale : les différences signalées sont des pistes à vérifier manuellement, jamais des preuves de désinformation.</span></div>
          <div className="monitor-contradiction-list">
            {contradictions.map((item) => (
              <article key={item.article_ids.join("-")}>
                <h4 data-no-translate>{item.event_title}</h4>
                <p data-no-translate>{item.sources.join(" · ")}</p>
                <div className="monitor-number-pills">{item.differing_numbers.map((number) => <em key={number}>{number}</em>)}</div>
                <small data-no-translate>{item.note}</small>
                <div className="monitor-article-links">{item.article_ids.map((id) => <button type="button" key={id} onClick={() => openArticle(id)}>Article #{id}</button>)}</div>
              </article>
            ))}
            {!contradictions.length && <div className="monitor-empty"><CircleHelp size={22} /><strong>Aucune divergence candidate</strong><span>Le moteur compare des groupes de titres similaires et les chiffres contenus dans leurs résumés.</span></div>}
          </div>
        </div>
      )}

      {view === "alerts" && (
        <div className="monitor-two-columns">
          <article className="monitor-card">
            <div className="monitor-card-title"><div><p className="eyebrow">CENTRE DE NOTIFICATIONS</p><h3>Alertes récentes</h3></div><Bell size={17} /></div>
            <div className="monitor-alert-list">
              {alerts.map((alert) => (
                <article className={alert.is_read ? "read" : ""} key={alert.id}>
                  <span className="monitor-alert-icon"><Bell size={16} /></span>
                  <div>
                    <strong data-no-translate>{alert.title}</strong>
                    <p data-no-translate>{alert.detail}</p>
                    <small>{formatDate(alert.created_at, dateLocale)}</small>
                  </div>
                  {!alert.is_read && <button type="button" title="Marquer comme lue" onClick={() => runAction(async () => { await api.patch(`${BASE}/alerts/${alert.id}/read`); await loadAlertsAndRules(); }, "Alerte marquée comme lue.")}><Check size={15} /></button>}
                </article>
              ))}
              {!alerts.length && <p className="monitor-muted">Aucune alerte. Créez une règle ou démarrez les collectes.</p>}
            </div>
          </article>
          <article className="monitor-card">
            <div className="monitor-card-title"><div><p className="eyebrow">CONFIGURATION</p><h3>Règles d’alertes</h3></div><Plus size={17} /></div>
            <form className="monitor-rule-form" onSubmit={createKeywordRule}>
              <label>Type d’alerte<select value={alertType} onChange={(event) => setAlertType(event.target.value)}><option value="keyword">Mot-clé</option><option value="trend">Tendance</option><option value="region">Région surveillée</option><option value="volume">Volume de publications</option><option value="divergence">Divergence entre sources</option></select></label>
              {(alertType === "keyword" || alertType === "trend") && <label>Sujet surveillé<input value={alertKeyword} onChange={(event) => setAlertKeyword(event.target.value)} required minLength={2} placeholder="ex. cyclone, élections" /></label>}
              {alertType === "region" && <label>Région<select value={alertRegion} onChange={(event) => setAlertRegion(event.target.value)} required><option value="">Choisir</option>{REGIONS.map((region) => <option key={region}>{region}</option>)}</select></label>}
              <label>Seuil<input type="number" min={1} value={alertThreshold} onChange={(event) => setAlertThreshold(Number(event.target.value))} required /></label>
              <button type="submit" className="monitor-refresh" disabled={busy}>Créer l’alerte</button>
            </form>
            <div className="monitor-rules-list">
              {alertRules.map((rule) => (
                <div key={rule.id}><span><strong>{rule.keyword || rule.region || rule.alert_type}</strong><small>{rule.alert_type} · seuil {rule.threshold}</small></span><button type="button" aria-label="Supprimer la règle" onClick={() => runAction(async () => { await api.delete(`${BASE}/alerts/rules/${rule.id}`); await loadAlertsAndRules(); }, "Règle supprimée.")}><Trash2 size={14} /></button></div>
              ))}
              {!alertRules.length && <p className="monitor-muted">Aucune règle configurée.</p>}
            </div>
          </article>
        </div>
      )}

      {view === "sources" && (
        <div className="monitor-source-layout">
          <article className="monitor-card">
            <div className="monitor-card-title"><div><p className="eyebrow">RÉFÉRENTIEL</p><h3>{editingSourceId ? "Modifier une source" : "Ajouter une source RSS"}</h3></div><Rss size={17} /></div>
            <form className="monitor-source-form" onSubmit={submitSource}>
              <label>Nom du média<input value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} required /></label>
              <label>Site officiel<input type="url" value={sourceForm.url} onChange={(event) => setSourceForm({ ...sourceForm, url: event.target.value })} required placeholder="https://media.mg" /></label>
              <label>URL du flux RSS<input type="url" value={sourceForm.rss_url} onChange={(event) => setSourceForm({ ...sourceForm, rss_url: event.target.value })} required placeholder="https://media.mg/rss" /></label>
              <label>Type de média<select value={sourceForm.media_type} onChange={(event) => setSourceForm({ ...sourceForm, media_type: event.target.value })}><option>Presse écrite</option><option>Radio</option><option>Télévision</option><option>Média en ligne</option><option>Agence de presse</option></select></label>
              <label>Région du média<input value={sourceForm.region} onChange={(event) => setSourceForm({ ...sourceForm, region: event.target.value })} placeholder="Région ou portée nationale" /></label>
              <label>Langues (séparées par des virgules)<input value={sourceForm.languages} onChange={(event) => setSourceForm({ ...sourceForm, languages: event.target.value })} required /></label>
              <label>Fréquence de collecte (minutes)<input type="number" min={5} max={10080} value={sourceForm.collection_interval_minutes} onChange={(event) => setSourceForm({ ...sourceForm, collection_interval_minutes: Number(event.target.value) })} required /></label>
              {editingSourceId && <label className="monitor-active-checkbox"><input type="checkbox" checked={sourceForm.is_active} onChange={(event) => setSourceForm({ ...sourceForm, is_active: event.target.checked })} />Source active</label>}
              <div className="monitor-source-actions"><button type="submit" className="monitor-refresh" disabled={busy}><Plus size={14} />{editingSourceId ? "Enregistrer" : "Ajouter la source"}</button>{editingSourceId && <button type="button" className="monitor-secondary" onClick={() => { setEditingSourceId(null); setSourceForm(EMPTY_SOURCE); }}>Annuler</button>}</div>
            </form>
            <p className="monitor-caveat"><ShieldAlert size={14} />Seuls les flux RSS/Atom publics sont interrogés. Le site d’origine est conservé comme attribution; aucun article n’est aspiré hors du flux.</p>
          </article>
          <article className="monitor-card">
            <div className="monitor-card-title"><div><p className="eyebrow">SOURCES ENREGISTRÉES</p><h3>Gestion des médias</h3></div><span className="monitor-total">{sources.length}</span></div>
            <div className="monitor-source-list">
              {sources.map((source) => (
                <article key={source.id} className={!source.is_active ? "inactive" : ""}>
                  <div className="monitor-source-title"><span className={source.is_active ? "source-active" : "source-inactive"} /><div><strong data-no-translate>{source.name}</strong><small>{source.media_type} · {source.languages.join(", ")}</small></div></div>
                  <a href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
                  <small>Dernière collecte : {formatDate(source.last_collected_at, dateLocale)}</small>
                  <div className="monitor-source-buttons">
                    <button type="button" onClick={() => runAction(async () => { const { data } = await api.post(`${BASE}/sources/${source.id}/test`); setNotice(data.valid ? `Flux valide : ${data.entry_count} article(s).` : "Aucun article valide dans le flux."); }, "")}>Tester RSS</button>
                    <button type="button" disabled={!source.is_active || busy} onClick={() => runSourceOperation(source, "collect")}><RefreshCw size={13} /> Collecter</button>
                    <button type="button" onClick={() => openSourceEditor(source)}>Modifier</button>
                    {source.is_active && <button type="button" className="danger" onClick={() => runSourceOperation(source, "delete")}><Trash2 size={13} /> Désactiver</button>}
                  </div>
                </article>
              ))}
              {!sources.length && <div className="monitor-empty"><Rss size={22} /><strong>Ajoutez votre première source</strong><span>Indiquez un flux public RSS ou Atom pour commencer.</span></div>}
            </div>
          </article>
        </div>
      )}
      <footer className="monitor-footer"><BookOpen size={14} /> Les catégories et tendances sont des aides de tri. Les rédacteurs doivent vérifier les informations auprès des sources citées.</footer>
    </section>
    </Localized>
  );
};

export default MonitoringWorkspace;
