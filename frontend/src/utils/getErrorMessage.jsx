const isRecord = (value) => typeof value === "object" && value !== null;

export const getErrorMessage = (err, fallback = "La demande n’a pas abouti. Réessayez.") => {
  const error = isRecord(err) ? err : {};
  const response = isRecord(error.response) ? error.response : null;
  const data = response && isRecord(response.data) ? response.data : {};
  const status = response?.status;
  const requestUrl =
    isRecord(error.config) && typeof error.config.url === "string"
      ? error.config.url
      : "";

  if (
    status === 500 &&
    typeof data.message === "string" &&
    data.message.includes("Unknown column 'updated_at'")
  ) {
    return "Le serveur a rencontré un problème de configuration. Réessayez plus tard ou contactez l’administrateur.";
  }

  if (!response) {
    return "Impossible de joindre le serveur Check-Eko. Vérifiez votre connexion et que le backend est démarré, puis réessayez.";
  }

  if (status === 401) {
    if (requestUrl.endsWith("/login") && typeof data.detail === "string") {
      return data.detail;
    }
    return "Votre session n’est plus valide. Reconnectez-vous pour accéder aux résultats.";
  }

  if (status === 403) {
    return "Vous n’avez pas l’autorisation d’accéder à ces données. Contactez l’administrateur si vous pensez qu’il s’agit d’une erreur.";
  }

  if (status === 404) {
    return "Les données demandées sont introuvables sur le serveur. Actualisez la page; si le problème persiste, contactez l’administrateur.";
  }

  if (status === 422) {
    if (typeof data.detail === "string") return data.detail;
    return "Certaines informations sont invalides. Vérifiez les champs obligatoires et les formats, puis réessayez.";
  }

  if (status === 429) {
    return "Trop de demandes ont été envoyées. Patientez un instant, puis réessayez.";
  }

  if (typeof status === "number" && status >= 500) {
    return "Le serveur a rencontré une erreur. Les résultats ne sont pas disponibles pour le moment. Réessayez plus tard.";
  }

  if (data.errors) {
    const validationErrors = Object.values(data.errors).flat().join(", ");
    return validationErrors
      ? "Certaines informations sont invalides. Vérifiez les champs obligatoires et les formats, puis réessayez."
      : fallback;
  }

  if (Array.isArray(data.detail)) {
    const validationErrors = data.detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
    if (validationErrors) {
      return "Certaines informations sont invalides. Vérifiez les champs obligatoires et les formats, puis réessayez.";
    }
  }

  if (status === 400 || status === 409) {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.message === "string") return data.message;
  }

  return fallback;
};