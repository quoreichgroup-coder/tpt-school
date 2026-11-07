'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  Calendar,
  CalendarDays,
  ClipboardList,
  Award,
  BarChart2,
  MessageSquare,
  DollarSign,
  Settings,
  GraduationCap,
  Bell,
  AlertTriangle,
  FileCheck,
  PlusCircle,
  LayoutList,
  BookMarked,
} from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { label: 'Tableau de bord', href: '/dashboard',            icon: LayoutDashboard },
    { label: 'Élèves',          href: '/students',             icon: GraduationCap },
    { label: 'Personnel',       href: '/staff',                icon: UserCheck },
    { label: 'Classes',         href: '/classes',              icon: BookOpen },
    { label: 'Emploi du temps', href: '/timetable',            icon: Calendar },
    { label: 'Calendrier',      href: '/calendar',             icon: CalendarDays },
    { label: 'Présences',       href: '/attendance',           icon: ClipboardList },
    { label: 'Charge de travail', href: '/workload',           icon: LayoutList },
    { label: 'Notes',           href: '/grades',               icon: Award },
    { label: 'Examens',         href: '/exams',                icon: CalendarDays },
    { label: 'Rapports',        href: '/reports',              icon: BarChart2 },
    { label: 'Comportement',    href: '/behaviour',            icon: AlertTriangle },
    { label: 'Communication',   href: '/communication',        icon: MessageSquare },
    { label: 'Finances',        href: '/finance',              icon: DollarSign },
    { label: 'Demandes d’inscription', href: '/enrollment-requests', icon: FileCheck },
    { label: 'Paramètres',      href: '/settings',             icon: Settings },
  ],
  teacher: [
    { label: 'Tableau de bord', href: '/dashboard',       icon: LayoutDashboard },
    { label: 'Mes classes',     href: '/classes',         icon: BookOpen },
    { label: 'Charge de travail', href: '/workload',      icon: LayoutList },
    { label: 'Emploi du temps', href: '/timetable',       icon: Calendar },
    { label: 'Calendrier',      href: '/calendar',        icon: CalendarDays },
    { label: 'Présences',       href: '/attendance',      icon: ClipboardList },
    { label: 'Notes',           href: '/grades',          icon: Award },
    { label: 'Examens',         href: '/exams',           icon: CalendarDays },
    { label: 'Comportement',    href: '/behaviour',       icon: AlertTriangle },
    { label: 'Communication',   href: '/communication',   icon: MessageSquare },
  ],
  accountant: [
    { label: 'Finances', href: '/finance', icon: DollarSign },
  ],
  parent: [
    { label: 'Tableau de bord', href: '/dashboard',        icon: LayoutDashboard },
    { label: 'Mes enfants',     href: '/children',         icon: Users },
    { label: 'Inscription',     href: '/portal/enroll',    icon: PlusCircle },
    { label: 'Présences',       href: '/attendance',       icon: ClipboardList },
    { label: 'Notes',           href: '/grades',           icon: Award },
    { label: 'Calendrier',      href: '/calendar',         icon: CalendarDays },
    { label: 'Annonces',        href: '/notices',          icon: Bell },
  ],
  student: [
    { label: 'Tableau de bord', href: '/dashboard',       icon: LayoutDashboard },
    { label: 'Mes classes',     href: '/classes',         icon: BookOpen },
    { label: 'Devoirs',         href: '/assignments',     icon: BookMarked },
    { label: 'Inscription',     href: '/portal/enroll',   icon: PlusCircle },
    { label: 'Présences',       href: '/attendance',      icon: ClipboardList },
    { label: 'Mes notes',       href: '/grades',          icon: Award },
    { label: 'Calendrier',      href: '/calendar',        icon: CalendarDays },
    { label: 'Annonces',        href: '/notices',         icon: Bell },
  ],
}

type SidebarProps = {
  role: string
  onNavigate?: () => void
}

export default function SidebarNav({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const items = NAV_ITEMS[role] ?? NAV_ITEMS.student

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {items.map(item => {
        const Icon = item.icon
        const isActive =
          item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-slate-400 group-hover:text-slate-600'}`} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
