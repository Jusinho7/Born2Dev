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

<<<<<<< HEAD
=======
  if (Array.isArray(data?.detail)) {
    const validationErrors = data.detail
      .map((item) => item.msg)
      .filter(Boolean)
      .join(", ");
    if (validationErrors) return `Erreur de validation : ${validationErrors}`;
  }

>>>>>>> 660e4d4 (add projet version 1.0.0)
  if (!err.response) {
    return "Serveur injoignable. Vérifiez votre connexion.";
  }

<<<<<<< HEAD
  return data?.message || data?.error || fallback;
=======
  return data?.message || data?.error || data?.detail || fallback;
>>>>>>> 660e4d4 (add projet version 1.0.0)
};