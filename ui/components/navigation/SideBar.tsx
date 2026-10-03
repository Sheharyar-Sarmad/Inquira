"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  Mail,
  Sun,
  Moon,
  Trash2,
} from "lucide-react";
import {
  Sparkle,
  Books,
  Atom,
  GithubLogo,
  LinkedinLogo,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  listConversations,
  removeConversation,
  saveConversation,
  subscribeConversations,
} from "@/lib/conversations";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "inquira:sidebar-collapsed";
const WIDTH_EXPANDED = 272;
const WIDTH_COLLAPSED = 72;

const NEW_RESEARCH = {
  href: "/research",
  label: "New Research",
  icon: Sparkle,
};

const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: "/", label: "Research", icon: Books },
  { href: "/about", label: "Inside Inquira", icon: Atom },
];

const DEV = {
  name: "Sheharyar Sarmad",
  role: "Developer",
  links: [
    {
      label: "Inquira Repo",
      href: "https://github.com/Sheharyar-Sarmad/Inquira",
      icon: GithubLogo,
    },
    {
      label: "GitHub",
      href: "https://github.com/Sheharyar-Sarmad",
      icon: GithubLogo,
    },
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/sheharyar-sarmad-9b7736289/",
      icon: LinkedinLogo,
    },
    {
      label: "Email",
      href: "https://mail.google.com/mail/u/0/?fs=1&to=developersheharyar2010@gmail.com&su=Subject+Here&body=Message+Here&tf=cm",
      icon: Mail,
    },
  ],
} as const;

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export type RecentResearch = { id: string; title: string; href: string };

type SideBarProps = {
  /** Optional override. When omitted, the sidebar reads from localStorage. */
  recent?: RecentResearch[];
};

/* -------------------------------------------------------------------------- */
/*  Conversation source                                                       */
/* -------------------------------------------------------------------------- */

const conversationHref = (id: string) =>
  `/research?c=${encodeURIComponent(id)}`;

/**
 * Live list of recent conversations.
 * If an override array is passed, it is used verbatim and no subscription
 * is set up — handy for testing or if the caller already has its own source.
 */
function useRecentConversations(override?: RecentResearch[]): RecentResearch[] {
  const [items, setItems] = useState<RecentResearch[]>(
    () => override ?? listConversations().map(toRecent),
  );

  useEffect(() => {
    if (override) {
      setItems(override);
      return;
    }
    const refresh = () => setItems(listConversations().map(toRecent));
    refresh();
    return subscribeConversations(refresh);
  }, [override]);

  return items;
}

function toRecent(c: { id: string; title: string }): RecentResearch {
  return { id: c.id, title: c.title, href: conversationHref(c.id) };
}

/* -------------------------------------------------------------------------- */
/*  Primitives                                                                */
/* -------------------------------------------------------------------------- */

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-0";

function Tip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactElement;
}) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function Label({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.span
          key="label"
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.16 }}
          className="truncate"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Brand({
  showWordmark,
  priority = false,
}: {
  showWordmark: boolean;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Inquira home"
      className={cn(
        "flex rounded-lg transition-all",
        showWordmark
          ? "flex-row items-center gap-2.5"
          : "flex-col items-center gap-1.5",
        focusRing,
      )}
    >
      <motion.span
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "flex h-9 items-center justify-center overflow-hidden rounded-lg transition-colors dark:bg-white",
          showWordmark ? "gap-2 dark:px-3" : "w-10 dark:px-0.5",
        )}
      >
        <Image
          src="/logo.png"
          alt=""
          width={0}
          height={0}
          sizes="200px"
          priority={priority}
          className="h-7 w-auto max-w-none object-contain object-left"
        />
        {showWordmark && (
          <span className="text-lg font-bold tracking-tight text-foreground dark:text-black">
            Inquira
          </span>
        )}
      </motion.span>
      {!showWordmark && (
        <span className="text-[11px] font-semibold tracking-tight text-sidebar-foreground">
          Inquira
        </span>
      )}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/*  Navigation                                                                */
/* -------------------------------------------------------------------------- */

function CtaLink({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const Icon = NEW_RESEARCH.icon;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Let cmd/ctrl/middle-click open in a new tab the normal way.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `c-${Date.now().toString(36)}-${Math.random()
              .toString(36)
              .slice(2, 10)}`;

      router.push(`/research?c=${encodeURIComponent(id)}`);
      onNavigate?.();
    },
    [router, onNavigate],
  );

  return (
    <Tip label={NEW_RESEARCH.label} show={collapsed}>
      <Link
        href={NEW_RESEARCH.href}
        onClick={handleClick}
        aria-label={collapsed ? NEW_RESEARCH.label : undefined}
        className={cn(
          "group flex h-10 items-center rounded-lg bg-brand text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover",
          collapsed ? "mx-auto w-10 justify-center" : "w-full gap-2.5 px-3",
          focusRing,
        )}
      >
        <Icon
          size={18}
          weight="fill"
          className="shrink-0 transition-transform group-hover:rotate-12"
        />
        <Label show={!collapsed}>{NEW_RESEARCH.label}</Label>
      </Link>
    </Tip>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Tip label={label} show={collapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-9 items-center rounded-lg text-sm font-medium transition-colors",
          collapsed ? "mx-auto w-10 justify-center" : "gap-3 px-3",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          focusRing,
        )}
      >
        {active && (
          <motion.span
            aria-hidden
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute top-2 bottom-2 w-0.5 rounded-full bg-brand",
              collapsed ? "-left-1.5" : "left-0",
            )}
          />
        )}
        <Icon
          size={19}
          weight={active ? "fill" : "regular"}
          className={cn(
            "shrink-0 transition-transform duration-200 group-hover:scale-110",
            active && "text-brand",
          )}
        />
        <Label show={!collapsed}>{label}</Label>
      </Link>
    </Tip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recent                                                                    */
/* -------------------------------------------------------------------------- */

function RecentList({
  items,
  onNavigate,
}: {
  items: RecentResearch[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("c");
  const onResearch = pathname === "/research";

  const handleRemove = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeConversation(id);
  }, []);

  return (
    <motion.section
      variants={itemVariants}
      aria-labelledby="recent-heading"
      className="mt-6 flex min-h-0 flex-1 flex-col"
    >
      <div className="mb-1.5 flex items-center justify-between px-3">
        <h2
          id="recent-heading"
          className="text-xs font-medium text-muted-foreground"
        >
          Recent
        </h2>
        {items.length > 0 && (
          <span className="tabular-nums text-[10px] text-muted-foreground/70">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm leading-snug text-muted-foreground/80">
          Your research threads will appear here.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const active = onResearch && activeId === item.id;
              return (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={item.title}
                    className={cn(
                      "group/item relative flex items-center rounded-lg pr-1 transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      focusRing,
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate px-3 py-1.5 text-sm">
                      {item.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(item.id, e)}
                      aria-label={`Remove "${item.title}" from recents`}
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 opacity-0 transition-all",
                        "hover:bg-destructive/10 hover:text-destructive",
                        "group-hover/item:opacity-100 focus-visible:opacity-100",
                        "focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none",
                      )}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </Link>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </motion.section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Theme toggle                                                              */
/* -------------------------------------------------------------------------- */

const THEME_KEY = "inquira:theme";

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }, []);

  const toggle = useCallback(() => {
    const next = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setTheme(next);
  }, []);

  return { theme, toggle };
}

function ThemeItem({ collapsed }: { collapsed: boolean }) {
  const { theme, toggle } = useTheme();
  const label =
    theme === "dark"
      ? "Light mode"
      : theme === "light"
        ? "Dark mode"
        : "Toggle theme";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <Tip label={label} show={collapsed}>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          "flex h-9 items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          collapsed ? "mx-auto w-10 justify-center" : "w-full gap-3 px-3",
          focusRing,
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={theme ?? "init"}
            initial={{ rotate: -70, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 70, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.16 }}
            className="flex shrink-0"
          >
            <Icon className="size-[19px]" />
          </motion.span>
        </AnimatePresence>
        <Label show={!collapsed}>{label}</Label>
      </button>
    </Tip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */

function DevLink({
  link,
  tooltip,
  className,
  children,
}: {
  link: (typeof DEV.links)[number];
  tooltip: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const external = link.href.startsWith("http");
  return (
    <Tip label={link.label} show={tooltip}>
      <a
        href={link.href}
        aria-label={
          external ? `${link.label} (opens in a new tab)` : `Send email`
        }
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={cn(className, focusRing)}
      >
        {children}
      </a>
    </Tip>
  );
}

function Footer({ layout }: { layout: "rail" | "row" | "list" }) {
  const iconBtn =
    "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground";

  if (layout === "list") {
    return (
      <div className="space-y-0.5">
        {DEV.links.map((l) => {
          const Icon = l.icon;
          return (
            <DevLink
              key={l.label}
              link={l}
              tooltip={false}
              className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{l.label}</span>
              {l.href.startsWith("http") && (
                <ExternalLink className="size-3.5 opacity-60" aria-hidden />
              )}
            </DevLink>
          );
        })}
      </div>
    );
  }

  if (layout === "rail") {
    return (
      <div className="flex flex-col items-center gap-1">
        {DEV.links.map((l) => {
          const Icon = l.icon;
          return (
            <DevLink key={l.label} link={l} tooltip className={iconBtn}>
              <Icon size={17} />
            </DevLink>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-1">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand"
      >
        SS
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-medium text-sidebar-foreground">
          {DEV.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{DEV.role}</p>
      </div>
      <div className="flex items-center">
        {DEV.links.map((l) => {
          const Icon = l.icon;
          return (
            <DevLink key={l.label} link={l} tooltip className={iconBtn}>
              <Icon size={16} />
            </DevLink>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared body                                                               */
/* -------------------------------------------------------------------------- */

function SidebarBody({
  collapsed,
  recent,
  onNavigate,
  mobile = false,
}: {
  collapsed: boolean;
  recent: RecentResearch[];
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="flex min-h-0 flex-1 flex-col"
    >
      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col px-3">
        <motion.div variants={itemVariants}>
          <CtaLink collapsed={collapsed} onNavigate={onNavigate} />
        </motion.div>
        <div className="mt-4 space-y-0.5">
          {NAV.map((item) => (
            <motion.div key={item.href} variants={itemVariants}>
              <NavItem
                {...item}
                active={isActive(item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            </motion.div>
          ))}
        </div>
        {!collapsed && <RecentList items={recent} onNavigate={onNavigate} />}
      </nav>
      <motion.div
        variants={itemVariants}
        className={cn("px-3 pb-2", collapsed && "mt-auto")}
      >
        <ThemeItem collapsed={collapsed} />
      </motion.div>
      <motion.div
        variants={itemVariants}
        className="border-t border-sidebar-border px-3 py-3"
      >
        <Footer layout={mobile ? "list" : collapsed ? "rail" : "row"} />
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile                                                                    */
/* -------------------------------------------------------------------------- */

function MobileNavbar({ recent }: { recent: RecentResearch[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b border-sidebar-border bg-background/85 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className={cn(
          "flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
          focusRing,
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={open ? "x" : "menu"}
            initial={{ rotate: -60, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 60, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </motion.span>
        </AnimatePresence>
      </button>
      <Brand showWordmark priority />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id="mobile-nav"
          side="left"
          className="flex w-[85%] max-w-[320px] flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation, recent research and developer links
          </SheetDescription>
          <div className="flex h-14 shrink-0 items-center px-4">
            <Brand showWordmark />
          </div>
          <SidebarBody
            collapsed={false}
            recent={recent}
            onNavigate={close}
            mobile
          />
        </SheetContent>
      </Sheet>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Desktop                                                                   */
/* -------------------------------------------------------------------------- */

function DesktopSidebar({ recent }: { recent: RecentResearch[] }) {
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {}
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <motion.aside
      id="app-sidebar"
      aria-label="Sidebar"
      initial={false}
      animate={{ width: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED }}
      transition={{
        duration: ready && !reduce ? 0.22 : 0,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="sticky top-0 hidden h-dvh shrink-0 self-start flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground xl:flex"
    >
      <div
        className={cn(
          "flex shrink-0 items-center pt-4 pb-4",
          collapsed
            ? "flex-col gap-3 px-2"
            : "h-16 justify-between px-4 pb-0 pt-0",
        )}
      >
        <Brand showWordmark={!collapsed} priority />
        <Tip
          label={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
          show
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              focusRing,
            )}
          >
            <ToggleIcon className="size-[18px]" />
          </button>
        </Tip>
      </div>
      <SidebarBody collapsed={collapsed} recent={recent} />
    </motion.aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Export                                                                    */
/* -------------------------------------------------------------------------- */

export default function SideBar({ recent }: SideBarProps) {
  const items = useRecentConversations(recent);
  return (
    <MotionConfig reducedMotion="user">
      <MobileNavbar recent={items} />
      <DesktopSidebar recent={items} />
    </MotionConfig>
  );
}
