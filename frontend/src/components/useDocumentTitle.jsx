// src/components/useDocumentTitle.jsx
import { useEffect } from "react";

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `Check-Eko | ${title}` : "Check-Eko";
  }, [title]);
}