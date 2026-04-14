import { useNavigate, useLocation } from 'react-router-dom'
import { Moon, Sun, Home, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFSStore } from '@/store/fsStore'

interface HeaderProps {
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
}

export default function Header({ breadcrumbs, actions }: HeaderProps) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const isDarkMode = useFSStore(s => s.isDarkMode)
  const toggleDark = useFSStore(s => s.toggleDarkMode)

  const isHome = location.pathname === '/'

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        {/* Left: Logo + Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <span className="text-gold font-serif font-bold text-sm">P</span>
            </div>
            <span className="font-serif font-semibold text-navy dark:text-gold hidden sm:block">
              PropFS
            </span>
          </button>

          {/* Breadcrumbs */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              {breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1 min-w-0">
                  {crumb.href ? (
                    <button
                      onClick={() => crumb.href && navigate(crumb.href)}
                      className="hover:text-foreground transition-colors truncate max-w-[160px]"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-foreground font-medium truncate max-w-[160px]">
                      {crumb.label}
                    </span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                </div>
              ))}
            </nav>
          )}

          {/* Home indicator */}
          {isHome && !breadcrumbs && (
            <span className="text-sm text-muted-foreground hidden sm:block">
              Dashboard Proyek
            </span>
          )}
        </div>

        {/* Right: Actions + Dark mode */}
        <div className="flex items-center gap-2">
          {actions}
          {!isHome && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="hidden sm:flex gap-1.5"
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            aria-label="Toggle dark mode"
          >
            {isDarkMode
              ? <Sun className="h-4 w-4" />
              : <Moon className="h-4 w-4" />
            }
          </Button>
        </div>
      </div>
    </header>
  )
}
