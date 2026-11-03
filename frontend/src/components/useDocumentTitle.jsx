// src/components/useDocumentTitle.jsx
import { useEffect } from "react";

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `Softio | ${title}` : "Softio";
  }, [title]);
}