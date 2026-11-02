import useDocumentTitle from "../components/useDocumentTitle";

// Affichée dans le DashboardLayout : la Navbar et la Navigation sont déjà fournies par le layout.
const Actu = () => {
  useDocumentTitle("Actualités");

  return (
    <div className="contenu">
      <h1>Actualités</h1>
    </div>
  );
};

export default Actu;