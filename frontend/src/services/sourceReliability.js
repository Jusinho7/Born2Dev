import api from "./api";

export const getSources = () => api.get("/sources");
export const createSource = (source) => api.post("/sources", source);
export const getArticles = () => api.get("/articles");
export const createArticle = (article) => api.post("/articles", article);
export const createClaim = (articleId, claim) =>
  api.post(`/articles/${articleId}/claims`, claim);
export const getClaims = (articleId) =>
  api.get(`/articles/${articleId}/claims`);
export const createEvidence = (claimId, evidence) =>
  api.post(`/claims/${claimId}/evidence`, evidence);
export const getEvidence = (claimId) =>
  api.get(`/claims/${claimId}/evidence`);
