import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/leads', label: 'Leads' },
  { path: '/campaigns', label: 'Campaigns' },
  { path: '/messages', label: 'Messages' },
  { path: '/running-campaigns', label: 'Running campaigns' },
  { path: '/history', label: 'History' },
  { path: '/settings', label: 'Settings' },
];

export default function TopNav() {
  const [expanded, setExpanded] = useState(false);

  return (
    <nav className="navbar navbar-expand-md navbar-light fixed-top nav-app" role="navigation" aria-label="Main">
      <div className="container">
        <NavLink to="/" className="navbar-brand fw-semibold" onClick={() => setExpanded(false)}>
          Lead Gen
        </NavLink>
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label="Toggle navigation"
          aria-controls="navbarNav"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse ${expanded ? 'show' : ''}`} id="navbarNav">
          <ul className="navbar-nav ms-auto">
            {navItems.map(({ path, label }) => (
              <li key={path} className="nav-item">
                <NavLink
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active fw-semibold' : ''}`}
                  onClick={() => setExpanded(false)}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
