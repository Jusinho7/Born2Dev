// src/components/useDocumentTitle.jsx
import { useEffect } from "react";

export default function useDocumentTitle(title) {
  useEffect(() => {
<<<<<<< HEAD
    document.title = title ? `Softio | ${title}` : "Softio";
=======
    document.title = title ? `Check-Eko | ${title}` : "Check-Eko";
>>>>>>> 660e4d4 (add projet version 1.0.0)
  }, [title]);
}