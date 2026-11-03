import api from "./api";

export const getExperts = () => api.get("/experts");
export const createExpert = (expert) => api.post("/experts", expert);
export const updateExpert = (expertId, expert) =>
  api.put(`/experts/${expertId}`, expert);
export const deleteExpert = (expertId) => api.delete(`/experts/${expertId}`);
