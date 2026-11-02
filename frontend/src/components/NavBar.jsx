// components/Navbar.js
import { useEffect, useState } from 'react';
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from '../contexts/DarkContext';
import { logout, getUserInfo } from '../services/auth';
import Navigation from "./Navigation";

const Navbar = ({ onSlide }) => {
  const { darkMode, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    // Récupérer le nom de l'utilisateur connecté
    const userInfo = getUserInfo();
    if (userInfo && userInfo.username) {
      setUserName(userInfo.username);
    }
  }, []);

  const handleMenuClick = () => {
    if (window.innerWidth < 576) {
      setMenuOpen(!menuOpen);
    } else {
      if (onSlide) onSlide();
    }
  };

  const getUserInitials = (name) => {
    if (!name) return "U";
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar navbar-expand-sm navbar-dark navbar-custom">
        <div className="container-fluid ">
          <div className="icon-container">
            <i
              className={`bi bi-justify navbar-icon ${darkMode ? 'icon-dark' : 'icon-light'}`}
              onClick={handleMenuClick}
            ></i>
            <img
              className="logo"
              src={darkMode ? "/assets/images/softio3.png" : "/assets/images/softio.png"}
              alt="Logo Softio"
            />
          </div>
        </div>
      </nav>

      <div className="noir">
        <button onClick={toggleTheme} className="theme-toggle-button mode">
          {darkMode ? '🌞' : '🌙'}
        </button>

        <div className="dropdown">
          <button className="dropdown-toggle user-menu-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <div className="user-avatar">
              {userName ? getUserInitials(userName) : <i className="bi bi-person-circle"></i>}
            </div>
            {userName && <span className="user-name">{userName}</span>}
          </button>

          <ul className="dropdown-menu">
            <li><Link className="dropdown-item" to="#">Utilisateur</Link></li>
            <li><Link className="dropdown-item" to="/Entreprise">Entreprise</Link></li>
            <li>
              <button
                className="dropdown-item"
                onClick={handleLogout}
                style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
              >
                Se déconnecter
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Modal Navigation pour mobile */}
      {menuOpen && window.innerWidth < 576 && (
        <div className="mobile-nav-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-nav" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setMenuOpen(false)}>✖</button>
            <Navigation Style="navigation" isClose={true} />
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
