// Transforme une erreur axios en message lisible (utilisé par Login et Register)
export const getErrorMessage = (err, fallback) => {
  const data = err.response?.data;

  if (
    err.response?.status === 500 &&
    data?.message?.includes("Unknown column 'updated_at'")
  ) {
    return "Erreur serveur : problème de configuration de la base de données.";
  }

  if (data?.errors) {
    const validationErrors = Object.values(data.errors).flat().join(", ");
    return `Erreur de validation : ${validationErrors}`;
  }

  if (!err.response) {
    return "Serveur injoignable. Vérifiez votre connexion.";
  }

  return data?.message || data?.error || fallback;
};