import { NavLink, Outlet } from 'react-router-dom'
import { DiaperIcon, FeedingIcon, GrowthIcon, HomeIcon, SettingsIcon } from './Icons'

const NAV_ITEMS = [
  { to: '/', label: 'Início', icon: HomeIcon, end: true },
  { to: '/feeding', label: 'Mamadas', icon: FeedingIcon, end: false },
  { to: '/diapers', label: 'Fraldas', icon: DiaperIcon, end: false },
  { to: '/growth', label: 'Crescimento', icon: GrowthIcon, end: false },
  { to: '/settings', label: 'Bebê', icon: SettingsIcon, end: false },
]

export default function Layout() {
  return (
    <>
      <Outlet />
      <nav className="bottom-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
