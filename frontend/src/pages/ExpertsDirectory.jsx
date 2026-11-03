import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Globe,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  createExpert,
  deleteExpert,
  getExperts,
  updateExpert,
} from "../services/expertDirectory";
import { getErrorMessage } from "../utils/getErrorMessage";

const EMPTY_EXPERT = {
  full_name: "",
  expertise: "",
  organization: "",
  region: "",
  languages: "",
  email: "",
  phone: "",
  website: "",
  bio: "",
};

const ExpertsDirectory = () => {
  const [experts, setExperts] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(EMPTY_EXPERT);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getExperts()
      .then((response) => {
        if (active) {
          setExperts(response.data);
          setError("");
          setLoadFailed(false);
        }
      })
      .catch((requestError) => {
        if (active) {
          setLoadFailed(true);
          setError(
            getErrorMessage(
              requestError,
              "Impossible de charger l’annuaire des experts.",
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
  }, [reloadKey]);

  const retryLoading = () => {
    setError("");
    setLoadFailed(false);
    setLoading(true);
    setReloadKey((current) => current + 1);
  };

  const filteredExperts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return experts;
    return experts.filter((expert) =>
      [
        expert.full_name,
        expert.expertise,
        expert.organization,
        expert.region,
        expert.languages,
      ]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [experts, query]);

  const resetForm = () => {
    setForm(EMPTY_EXPERT);
    setEditingId("");
    setShowForm(false);
  };

  const startEditing = (expert) => {
    setForm(
      Object.fromEntries(
        Object.keys(EMPTY_EXPERT).map((field) => [
          field,
          expert[field] ?? "",
        ]),
      ),
    );
    setEditingId(expert.id);
    setShowForm(true);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = Object.fromEntries(
      Object.entries(form).map(([field, value]) => [
        field,
        value.trim() || null,
      ]),
    );

    try {
      if (editingId) {
        const response = await updateExpert(editingId, payload);
        setExperts((current) =>
          current.map((expert) =>
            expert.id === editingId ? response.data : expert,
          ),
        );
      } else {
        const response = await createExpert(payload);
        setExperts((current) => [...current, response.data]);
      }
      resetForm();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Impossible d’enregistrer cet expert.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expert) => {
    if (!window.confirm(`Supprimer la fiche de ${expert.full_name} ?`)) return;
    setError("");
    try {
      await deleteExpert(expert.id);
      setExperts((current) =>
        current.filter((entry) => entry.id !== expert.id),
      );
      if (editingId === expert.id) resetForm();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Impossible de supprimer cet expert."),
      );
    }
  };

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <section className="experts-directory" aria-label="Annuaire des experts">
      <div className="experts-toolbar">
        <label className="experts-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher par nom, expertise, région..."
            aria-label="Rechercher un expert"
          />
        </label>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            if (showForm && !editingId) {
              resetForm();
            } else {
              setForm(EMPTY_EXPERT);
              setEditingId("");
              setShowForm(true);
              setError("");
            }
          }}
        >
          {showForm && !editingId ? <X size={16} /> : <Plus size={16} />}
          {showForm && !editingId ? "Fermer" : "Ajouter un expert"}
        </button>
      </div>

      {error && (
        <div className="experts-error" role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Fermer le message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showForm && (
        <form className="expert-form" onSubmit={handleSubmit}>
          <div className="expert-form-heading">
            <div>
              <p className="eyebrow">FICHE EXPERT</p>
              <h3>{editingId ? "Modifier un expert" : "Nouvel expert"}</h3>
            </div>
            <button
              type="button"
              className="expert-close-button"
              onClick={resetForm}
              aria-label="Fermer le formulaire"
            >
              <X size={18} />
            </button>
          </div>
          <div className="expert-form-grid">
            <label>
              Nom complet
              <input
                required
                maxLength={160}
                value={form.full_name}
                onChange={(event) =>
                  updateField("full_name", event.target.value)
                }
                placeholder="Ex. Marie Rakoto"
              />
            </label>
            <label>
              Domaine d’expertise
              <input
                required
                maxLength={200}
                value={form.expertise}
                onChange={(event) =>
                  updateField("expertise", event.target.value)
                }
                placeholder="Ex. Santé publique"
              />
            </label>
            <label>
              Organisation
              <input
                maxLength={160}
                value={form.organization}
                onChange={(event) =>
                  updateField("organization", event.target.value)
                }
                placeholder="Université, association..."
              />
            </label>
            <label>
              Région
              <input
                maxLength={120}
                value={form.region}
                onChange={(event) => updateField("region", event.target.value)}
                placeholder="Ex. Analamanga"
              />
            </label>
            <label>
              Langues
              <input
                maxLength={160}
                value={form.languages}
                onChange={(event) =>
                  updateField("languages", event.target.value)
                }
                placeholder="Ex. Malagasy, français"
              />
            </label>
            <label>
              Adresse e-mail
              <input
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="nom@exemple.mg"
              />
            </label>
            <label>
              Téléphone
              <input
                type="tel"
                maxLength={50}
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="+261..."
              />
            </label>
            <label>
              Site web
              <input
                type="url"
                maxLength={500}
                value={form.website}
                onChange={(event) =>
                  updateField("website", event.target.value)
                }
                placeholder="https://..."
              />
            </label>
          </div>
          <label className="expert-bio-field">
            Présentation
            <textarea
              maxLength={2000}
              rows={3}
              value={form.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              placeholder="Parcours, sujets de recherche ou informations utiles..."
            />
          </label>
          <div className="expert-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}
              {saving ? "Enregistrement..." : "Enregistrer la fiche"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="experts-state">
          <LoaderCircle className="spin" size={20} />
          <span>Chargement de l’annuaire...</span>
        </div>
      ) : loadFailed ? (
        <div className="experts-state empty">
          <span className="experts-empty-icon">
            <Users size={24} />
          </span>
          <h3>Annuaire indisponible</h3>
          <p>Les résultats n’ont pas pu être chargés depuis le serveur.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={retryLoading}
          >
            Réessayer
          </button>
        </div>
      ) : filteredExperts.length ? (
        <div className="expert-grid">
          {filteredExperts.map((expert) => (
            <article className="expert-card" key={expert.id}>
              <div className="expert-card-heading">
                <span className="expert-avatar" aria-hidden="true">
                  {expert.full_name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="expert-card-name">
                  <h3>{expert.full_name}</h3>
                  <p>{expert.expertise}</p>
                </div>
                <div className="expert-actions">
                  <button
                    type="button"
                    onClick={() => startEditing(expert)}
                    aria-label={`Modifier ${expert.full_name}`}
                    title="Modifier"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(expert)}
                    aria-label={`Supprimer ${expert.full_name}`}
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {(expert.organization || expert.region || expert.languages) && (
                <div className="expert-facts">
                  {expert.organization && (
                    <span>
                      <Briefcase size={14} />
                      {expert.organization}
                    </span>
                  )}
                  {expert.region && (
                    <span>
                      <MapPin size={14} />
                      {expert.region}
                    </span>
                  )}
                  {expert.languages && (
                    <span>
                      <Globe size={14} />
                      {expert.languages}
                    </span>
                  )}
                </div>
              )}

              {expert.bio && <p className="expert-bio">{expert.bio}</p>}

              {(expert.email || expert.phone || expert.website) && (
                <div className="expert-contacts">
                  {expert.email && (
                    <a href={`mailto:${expert.email}`}>
                      <Mail size={14} />
                      {expert.email}
                    </a>
                  )}
                  {expert.phone && (
                    <a href={`tel:${expert.phone}`}>
                      <Phone size={14} />
                      {expert.phone}
                    </a>
                  )}
                  {expert.website && (
                    <a href={expert.website} target="_blank" rel="noreferrer">
                      <Globe size={14} />
                      Site web
                    </a>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="experts-state empty">
          <span className="experts-empty-icon">
            <Users size={24} />
          </span>
          <h3>{query ? "Aucun expert trouvé" : "L’annuaire est vide"}</h3>
          <p>
            {query
              ? "Essayez un autre nom, domaine d’expertise ou région."
              : "Ajoutez les personnes-ressources pour les retrouver facilement."}
          </p>
          {!query && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowForm(true)}
            >
              <Plus size={15} />
              Ajouter un expert
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default ExpertsDirectory;
